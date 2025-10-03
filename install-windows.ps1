# Script de Instalação - Portal de Alocação
# Execute este script como Administrador se necessário

Write-Host "=== Portal de Alocação - Instalação Windows ===" -ForegroundColor Green
Write-Host ""

# Verificar se Node.js está instalado
Write-Host "Verificando se Node.js está instalado..." -ForegroundColor Yellow
try {
    $nodeVersion = node --version 2>$null
    $npmVersion = npm --version 2>$null
    
    if ($nodeVersion -and $npmVersion) {
        Write-Host "✓ Node.js encontrado: $nodeVersion" -ForegroundColor Green
        Write-Host "✓ npm encontrado: $npmVersion" -ForegroundColor Green
        Write-Host ""
    } else {
        throw "Node.js não encontrado"
    }
} catch {
    Write-Host "✗ Node.js não está instalado!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Para instalar o Node.js:" -ForegroundColor Yellow
    Write-Host "1. Acesse: https://nodejs.org/" -ForegroundColor Cyan
    Write-Host "2. Baixe a versão LTS" -ForegroundColor Cyan
    Write-Host "3. Execute o instalador" -ForegroundColor Cyan
    Write-Host "4. Reinicie este script após a instalação" -ForegroundColor Cyan
    Write-Host ""
    Read-Host "Pressione Enter para sair"
    exit 1
}

# Verificar se estamos no diretório correto
if (-not (Test-Path "package.json")) {
    Write-Host "✗ package.json não encontrado!" -ForegroundColor Red
    Write-Host "Certifique-se de estar no diretório raiz do projeto" -ForegroundColor Yellow
    Read-Host "Pressione Enter para sair"
    exit 1
}

Write-Host "✓ Diretório do projeto encontrado" -ForegroundColor Green
Write-Host ""

# Instalar dependências do projeto
Write-Host "Instalando dependências do projeto..." -ForegroundColor Yellow
Write-Host ""

try {
    # Instalar dependências do root
    Write-Host "Instalando dependências do projeto principal..." -ForegroundColor Cyan
    npm install
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ Dependências do projeto principal instaladas" -ForegroundColor Green
    } else {
        throw "Erro ao instalar dependências do projeto principal"
    }
    
    # Instalar dependências do frontend
    Write-Host "Instalando dependências do frontend..." -ForegroundColor Cyan
    Set-Location frontend
    npm install
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ Dependências do frontend instaladas" -ForegroundColor Green
    } else {
        throw "Erro ao instalar dependências do frontend"
    }
    
    # Voltar para o diretório raiz
    Set-Location ..
    
    # Instalar dependências do backend
    Write-Host "Instalando dependências do backend..." -ForegroundColor Cyan
    Set-Location backend
    npm install
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ Dependências do backend instaladas" -ForegroundColor Green
    } else {
        throw "Erro ao instalar dependências do backend"
    }
    
    # Voltar para o diretório raiz
    Set-Location ..
    
} catch {
    Write-Host "✗ Erro durante a instalação: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host ""
    Write-Host "Tente executar os comandos manualmente:" -ForegroundColor Yellow
    Write-Host "npm install" -ForegroundColor Cyan
    Write-Host "cd frontend && npm install" -ForegroundColor Cyan
    Write-Host "cd backend && npm install" -ForegroundColor Cyan
    Read-Host "Pressione Enter para sair"
    exit 1
}

Write-Host ""
Write-Host "=== Instalação Concluída com Sucesso! ===" -ForegroundColor Green
Write-Host ""

# Verificar se os arquivos de configuração existem
Write-Host "Verificando arquivos de configuração..." -ForegroundColor Yellow

if (-not (Test-Path "backend\.env")) {
    Write-Host "⚠ Arquivo .env do backend não encontrado" -ForegroundColor Yellow
    Write-Host "Copie backend\.env.example para backend\.env e configure as variáveis" -ForegroundColor Cyan
}

if (-not (Test-Path "frontend\.env")) {
    Write-Host "⚠ Arquivo .env do frontend não encontrado" -ForegroundColor Yellow
    Write-Host "Copie frontend\.env.example para frontend\.env e configure as variáveis" -ForegroundColor Cyan
}

Write-Host ""
Write-Host "=== Próximos Passos ===" -ForegroundColor Green
Write-Host "1. Configure os arquivos .env (se necessário)" -ForegroundColor Cyan
Write-Host "2. Execute: npm run dev" -ForegroundColor Cyan
Write-Host "3. Acesse: http://localhost:3000" -ForegroundColor Cyan
Write-Host ""

Write-Host "Deseja iniciar o projeto agora? (s/n)" -ForegroundColor Yellow
$response = Read-Host

if ($response -eq "s" -or $response -eq "S" -or $response -eq "sim" -or $response -eq "SIM") {
    Write-Host "Iniciando o projeto..." -ForegroundColor Green
    npm run dev
} else {
    Write-Host "Para iniciar o projeto posteriormente, execute: npm run dev" -ForegroundColor Cyan
}

Write-Host ""
Write-Host "Pressione Enter para sair"
Read-Host 