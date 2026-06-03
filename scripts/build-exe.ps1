$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot

Write-Host ">> Logo e frontend..."
New-Item -ItemType Directory -Force -Path "$root\frontend\public" | Out-Null
Copy-Item "$root\LOGO\logo-big.png" "$root\frontend\public\logo.png" -Force

Set-Location "$root\frontend"
npm install
npm run build

Write-Host ">> Backend..."
Set-Location "$root\backend"
npm install

if (-not (Test-Path "config\secrets.env")) {
  Copy-Item "config\secrets.env.example" "config\secrets.env"
  Write-Host "AVISO: Preencha config\secrets.env com OPENAI_API_KEY"
}

Remove-Item -Recurse -Force dist -ErrorAction SilentlyContinue
npm run build
if ($LASTEXITCODE -ne 0) { throw "Falha TypeScript" }

Write-Host ">> EXE..."
New-Item -ItemType Directory -Force -Path "$root\release" | Out-Null
npx pkg . --targets node18-win-x64 --output "$root\release\QISupportAI.exe" --compress GZip

Copy-Item -Recurse -Force "$root\backend\config" "$root\release\config"
New-Item -ItemType Directory -Force -Path "$root\release\data\mensagens" | Out-Null
Copy-Item "$root\LOGO\logo-big.png" "$root\release\logo.png" -Force -ErrorAction SilentlyContinue

@"
QI Support AI — Enterprise
==========================
1. Execute QISupportAI.exe
2. Acesse o IP exibido no console ou http://localhost:4000
3. Login: admin  |  Senha: admin
4. Configuracoes: WhatsApp, IA, Servidor, Logs
5. Chave IA: config\secrets.env (ja incluida na instalacao)
"@ | Set-Content "$root\release\LEIA-ME.txt"

Write-Host "PRONTO: $root\release\QISupportAI.exe"
