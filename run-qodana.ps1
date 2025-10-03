# Script para executar Qodana localmente no Windows
# Uso: .\run-qodana.ps1

Write-Host "🔍 Iniciando análise Qodana..." -ForegroundColor Cyan

# Verificar se Docker está rodando
$null = docker ps 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Erro: Docker não está rodando!" -ForegroundColor Red
    Write-Host "   Por favor, inicie o Docker Desktop e tente novamente." -ForegroundColor Yellow
    exit 1
}

Write-Host "✅ Docker está rodando" -ForegroundColor Green

# Criar diretório de cache se não existir
if (-not (Test-Path ".qodana/cache")) {
    New-Item -ItemType Directory -Path ".qodana/cache" -Force | Out-Null
    Write-Host "📁 Diretório de cache criado" -ForegroundColor Green
}

# Executar Qodana
Write-Host "`n🚀 Executando análise Qodana..." -ForegroundColor Cyan
Write-Host "   Isso pode levar alguns minutos na primeira vez..." -ForegroundColor Yellow
Write-Host "   O relatório será aberto automaticamente em http://localhost:8080`n" -ForegroundColor Yellow

docker run --rm -it `
    -v ${PWD}:/data/project/ `
    -v ${PWD}/.qodana/cache:/data/cache/ `
    -p 8080:8080 `
    jetbrains/qodana-js:latest `
    --show-report

if ($LASTEXITCODE -eq 0) {
    Write-Host "`n✅ Análise concluída com sucesso!" -ForegroundColor Green
    Write-Host "   Relatório disponível em: http://localhost:8080" -ForegroundColor Cyan
} else {
    Write-Host "`n❌ Análise falhou com código de saída: $LASTEXITCODE" -ForegroundColor Red
    Write-Host "   Verifique os logs acima para mais detalhes." -ForegroundColor Yellow
}
