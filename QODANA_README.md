# 🔍 Como Usar o Qodana Localmente

## Método Rápido (Windows)

Execute um dos scripts:

```powershell
# Com relatório interativo no navegador
.\run-qodana.ps1

# Apenas análise (sem abrir navegador)
.\qodana-scan.ps1
```

## O que o Qodana faz?
✅ Detecta bugs e problemas de qualidade  
✅ Encontra vulnerabilidades de segurança  
✅ Verifica boas práticas de código  
✅ Sugere melhorias de performance  

## Requisitos
- Docker Desktop instalado e rodando
- 4GB+ de RAM disponível
- Primeira execução: ~5-10 min (baixa imagem Docker)

## Resultados
Após a análise, acesse: **http://localhost:8080**

Os arquivos de resultado ficam em:
- `.qodana/results/` - Relatórios detalhados
- `qodana.sarif.json` - Baseline para comparação

## Problemas?
Veja o guia completo em: `docs/QODANA_GUIDE.md`
