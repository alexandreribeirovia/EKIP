# Quick Qodana scan - sem abrir relatório automaticamente
# Token configurado diretamente no script
$env:QODANA_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJwcm9qZWN0IjoiWjB2MmoiLCJvcmdhbml6YXRpb24iOiI0MGVEbyIsInRva2VuIjoiV1l3OFkifQ.-j6vnCjFq7yDIllaWrcRRxlwsFYvKao0RsLUrfU8Aek"

if (-not $env:QODANA_TOKEN) {
    Write-Host "AVISO: Variável QODANA_TOKEN não encontrada!" -ForegroundColor Yellow
    Write-Host "Para configurar o token:" -ForegroundColor Cyan
    Write-Host "  1. Registre-se em: https://qodana.cloud" -ForegroundColor White
    Write-Host "  2. Obtenha seu token de acesso" -ForegroundColor White
    Write-Host "  3. Configure no PowerShell:" -ForegroundColor White
    Write-Host '     $env:QODANA_TOKEN = "seu-token-aqui"' -ForegroundColor Green
    Write-Host ""
    $response = Read-Host "Deseja continuar sem token (pode falhar)? (s/N)"
    if ($response -ne 's' -and $response -ne 'S') {
        exit 1
    }
}

docker run --rm -it -v ${PWD}:/data/project/ -v ${PWD}/.qodana/cache:/data/cache/ -e QODANA_TOKEN=$env:QODANA_TOKEN jetbrains/qodana-js:latest
