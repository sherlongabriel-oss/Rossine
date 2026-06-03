$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot

Write-Host ">> Logo..."
New-Item -ItemType Directory -Force -Path "$root\frontend\public" | Out-Null
Copy-Item "$root\LOGO\logo.svg" "$root\frontend\public\logo.svg" -Force
Copy-Item "$root\LOGO\logo.svg" "$root\frontend\public\logo.png" -Force -ErrorAction SilentlyContinue
if (Test-Path "$root\LOGO\logo-big.png") {
  Copy-Item "$root\LOGO\logo-big.png" "$root\frontend\public\logo.png" -Force
}

Write-Host ">> Frontend..."
Set-Location "$root\frontend"
npm install
npm run build

Write-Host ">> Backend..."
Set-Location "$root\backend"
npm install
npm run build
if ($LASTEXITCODE -ne 0) { throw "Falha TypeScript backend" }

Copy-Item "$root\LOGO\logo.svg" "$root\backend\public\logo.svg" -Force -ErrorAction SilentlyContinue
if (Test-Path "$root\LOGO\logo-big.png") {
  Copy-Item "$root\LOGO\logo-big.png" "$root\backend\public\logo.png" -Force
} else {
  Copy-Item "$root\LOGO\logo.svg" "$root\backend\public\logo.png" -Force -ErrorAction SilentlyContinue
}

Write-Host ">> Electron dist..."
Set-Location $root
npm install
npm run dist

New-Item -ItemType Directory -Force -Path "$root\release" | Out-Null
if (Test-Path "$root\dist") {
  Copy-Item -Recurse -Force "$root\dist\*" "$root\release\"
}

@"
QI Support AI — Instalador pronto
=================================
Pasta: release\  (ou dist\ após build)

1. Execute QISupportAI-*-win-x64.exe (portable) ou o instalador NSIS
2. Login: admin  |  Senha: admin
3. Admin: escaneie o QR na barra superior (WhatsApp)
4. Atendentes: criar login em Usuarios (sem email)
5. Todos respondem na mesma conversa WhatsApp pelo painel

Dados do usuario: %APPDATA%\qi-support-ai\qi-support-data\
"@ | Set-Content "$root\release\LEIA-ME.txt"

Write-Host "PRONTO: $root\dist e copia em $root\release"
