# Deploy grátis no Replit

Este projeto já está preparado para rodar no Replit sem precisar de cobrança.

## Como usar

1. Entre em https://replit.com
2. Crie uma conta (gratuita) ou faça login
3. Clique em "Import from GitHub"
4. Escolha o repositório `sherlongabriel-oss/Rossine`
5. Abra o projeto no Replit
6. O Replit já deve usar o arquivo `.replit` para rodar o backend

## Se precisar fazer manualmente

- Comando de build:
  ```bash
  cd backend && npm install --omit=dev && npm run build
  ```
- Comando de start:
  ```bash
  cd backend && npm start
  ```

## Variáveis de ambiente necessárias

Defina no painel do Replit:

- `OPENAI_API_KEY` = sua chave OpenAI
- `JWT_SECRET` = uma string aleatória
- `PORT` = `4000`
- `HOST` = `0.0.0.0`
- `QI_DATA_DIR` = `/data`

## Observações

- O app usa um backend Node + frontend React.
- No Replit, os arquivos gravados em `/data` podem ser temporários, mas o app sobe de graça.
- Se você não quiser usar WhatsApp local, configure apenas IA e use o app como assistente web.
