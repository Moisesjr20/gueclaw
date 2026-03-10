# install.ps1 - Instala dependências em Windows

Write-Host "[GueClaw] Iniciando instalacao em Windows..." -ForegroundColor Cyan

# Verificar Node
if (!(Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "[!] Node.js nao encontrado. Instale o Node.js v20+ antes de continuar." -ForegroundColor Red
    exit
}

Write-Host "[1/4] Instalando dependencias NPM..." -ForegroundColor Yellow
npm install

Write-Host "[2/4] Criando diretorios base..." -ForegroundColor Yellow
New-Item -ItemType Directory -Force -Path "data" | Out-Null
New-Item -ItemType Directory -Force -Path "tmp" | Out-Null
New-Item -ItemType Directory -Force -Path ".agents\skills" | Out-Null
New-Item -ItemType Directory -Force -Path "execution" | Out-Null

Write-Host "[3/4] Compilando TypeScript..." -ForegroundColor Yellow
npm run build

Write-Host "[4/4] Configurando .env..." -ForegroundColor Yellow
if (!(Test-Path -Path ".env")) {
    Copy-Item ".env.example" -Destination ".env"
    Write-Host "[!] Arquivo .env criado a partir do exemplo. Edite logo apos terminar!" -ForegroundColor Green
} else {
    Write-Host "[V] Arquivo .env ja existia." -ForegroundColor Green
}

Write-Host "[V] Instalacao Concluida! Use 'npm start' ou 'npm run dev' para ligar." -ForegroundColor Magenta
