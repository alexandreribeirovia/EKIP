# Script para executar Qodana localmente no Windows
# Uso: .\run-qodana.ps1
#
# IMPORTANTE: Voce precisa de um token do Qodana Cloud
# 1. Acesse: https://qodana.cloud
# 2. Faca login com sua conta GitHub/JetBrains
# 3. Gere um token gratuito
# 4. Defina a variavel de ambiente: $env:QODANA_TOKEN = "seu-token-aqui"

Write-Host "Iniciando analise Qodana..." -ForegroundColor Cyan

# Verificar se o token esta definido
if (-not $env:QODANA_TOKEN) {
    Write-Host "Erro: Token do Qodana nao encontrado!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Para usar o Qodana, voce precisa de um token gratuito:" -ForegroundColor Yellow
    Write-Host "1. Acesse: https://qodana.cloud" -ForegroundColor Cyan
    Write-Host "2. Faca login com sua conta GitHub/JetBrains" -ForegroundColor Cyan
    Write-Host "3. Gere um token gratuito" -ForegroundColor Cyan
    Write-Host "4. Defina a variavel de ambiente:" -ForegroundColor Cyan
    Write-Host "   `$env:QODANA_TOKEN = 'seu-token-aqui'" -ForegroundColor Green
    Write-Host ""
    Write-Host "Ou execute temporariamente:" -ForegroundColor Yellow
    Write-Host "   `$env:QODANA_TOKEN='seu-token'; .\run-qodana.ps1" -ForegroundColor Green
    exit 1
}

Write-Host "Token encontrado" -ForegroundColor Green

# Verificar se Docker esta rodando
$null = docker ps 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "Erro: Docker nao esta rodando!" -ForegroundColor Red
    Write-Host "Por favor, inicie o Docker Desktop e tente novamente." -ForegroundColor Yellow
    exit 1
}

Write-Host "Docker esta rodando" -ForegroundColor Green

# Criar diretorio de cache se nao existir
if (-not (Test-Path ".qodana/cache")) {
    New-Item -ItemType Directory -Path ".qodana/cache" -Force | Out-Null
    Write-Host "Diretorio de cache criado" -ForegroundColor Green
}

# Executar Qodana
Write-Host ""
Write-Host "Executando analise Qodana..." -ForegroundColor Cyan
Write-Host "Isso pode levar alguns minutos na primeira vez..." -ForegroundColor Yellow
Write-Host "O relatorio sera aberto automaticamente em http://localhost:8080" -ForegroundColor Yellow
Write-Host ""

docker run --rm -it `
    -e QODANA_TOKEN=$env:QODANA_TOKEN `
    -v ${PWD}:/data/project/ `
    -v ${PWD}/.qodana/cache:/data/cache/ `
    -p 8080:8080 `
    jetbrains/qodana-js:latest `
    --show-report

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "Analise concluida com sucesso!" -ForegroundColor Green
    Write-Host "Relatorio disponivel em: http://localhost:8080" -ForegroundColor Cyan
} else {
    Write-Host ""
    Write-Host "Analise falhou com codigo de saida: $LASTEXITCODE" -ForegroundColor Red
    Write-Host "Verifique os logs acima para mais detalhes." -ForegroundColor Yellow
}
