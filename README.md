# QI Support AI

Plataforma SaaS de atendimento WhatsApp + IA (foco ERP / fiscal) entregue
como aplicativo **Electron portable para Windows**. O usuario final nao
instala nada: basta enviar a pasta gerada e ele executa o `.exe`.

## Como buildar a versao distribuivel

```powershell
# (1) Pre-requisitos: Node.js 18+ e Git
# (2) A partir da raiz do projeto:
npm install                    # instala electron + electron-builder
npm run dist                   # compila frontend + backend e gera dist/
```

Saidas em `dist/`:

- `dist/win-unpacked/`            -> pasta portable (zipe e envie ao usuario)
- `QISupportAI-1.0.0-portable.exe`-> portable single-file
- `QISupportAI-1.0.0-win-x64.exe` -> instalador NSIS (1-click)

> Se quiser apenas a versao portable: `npm run dist:portable`

## O que o pacote contem

- Backend Node (Express + filestore) compilado em `backend/dist`
- Frontend React/Vite buildado em `backend/public`
- `node_modules` do backend (incluindo Puppeteer/whatsapp-web.js)
- LOGO/ e config/secrets.env (chave OpenAI)

Tudo embarcado em `resources/qi-app/` dentro do executavel.

## Configurar a chave OpenAI antes do build

Edite `backend/config/secrets.env`:

```
OPENAI_API_KEY=sk-...sua-chave...
JWT_SECRET=qualquer-string-aleatoria-longa
```

Esse arquivo vai junto com o instalador. No primeiro boot ele e copiado
para `%APPDATA%/QI Support AI/qi-support-data/config/secrets.env` para
que o usuario possa trocar pela interface no futuro.

## Como o app funciona em runtime

1. `electron/main.cjs` faz `fork()` do backend (`backend/dist/index.js`)
   passando `QI_APP_ROOT=%APPDATA%/QI Support AI/qi-support-data`.
2. Backend ouve em `127.0.0.1:4000` e serve a SPA + API.
3. Quando `/api/health` responde, o Electron carrega a janela.
4. Dados persistem em arquivos (`data/dados.json` e `data/mensagens/*.txt`).

## Deploy em servidor (Render)

Para rodar como SaaS/Servidor no Render:

1. Configure o Web Service apontando para `/backend`.
   - Build: `npm install --omit=dev && npm run build`
   - Start: `npm run start`
   - Defina a variável `QI_DATA_DIR=/data` e anexe um disco persistente montado em `/data`.
   - Configure envs (`DATABASE_URL`, `OPENAI_API_KEY`, etc.) conforme `backend/config/secrets.env.example`.
   - Após primeiro deploy, rode `npm run prisma:migrate deploy` no Shell para aplicar migrations.
2. Crie um Static Site em `/frontend`.
   - Build: `npm install && npm run build`
   - Publish: `frontend/dist`
   - Set `VITE_API_BASE_URL` para a URL pública do backend.
3. Opcional: configure domínio customizado e HTTPS diretamente no Render.

## Login padrao

- Usuario: `admin`
- Senha: `admin`

## Estrutura

- `electron/`  -> processo principal Electron + preload
- `backend/`   -> API Node/Express, filestore, integracoes (OpenAI, WhatsApp)
- `frontend/`  -> SPA React/Vite (build vai direto para `backend/public`)
- `LOGO/`      -> icones empacotados
- `dist/`      -> saida do electron-builder

## Scripts uteis

| Script                 | O que faz                                  |
|------------------------|--------------------------------------------|
| `npm run start`        | Roda Electron apontando para o build atual |
| `npm run build:app`    | Compila frontend + backend                 |
| `npm run dist`         | Build completo + electron-builder          |
| `npm run dist:portable`| Apenas portable single-file                |
| `npm run dist:installer`| Apenas NSIS one-click                     |
