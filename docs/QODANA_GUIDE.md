# Guia de Uso do Qodana Local

## O que é Qodana?
Qodana é uma ferramenta de análise de código da JetBrains que detecta problemas de qualidade, bugs e vulnerabilidades no seu código.

## Pré-requisitos
- Docker instalado no seu sistema
- Ou Qodana CLI instalado

## Método 1: Usando Docker (Recomendado)

### Windows (PowerShell)
```powershell
# Análise básica
docker run --rm -it -v ${PWD}:/data/project/ -p 8080:8080 jetbrains/qodana-js:latest --show-report

# Com cache para melhor performance
docker run --rm -it `
  -v ${PWD}:/data/project/ `
  -v ${PWD}/.qodana/cache:/data/cache/ `
  -p 8080:8080 `
  jetbrains/qodana-js:latest --show-report
```

### Linux/macOS
```bash
# Análise básica
docker run --rm -it -v $(pwd):/data/project/ -p 8080:8080 jetbrains/qodana-js:latest --show-report

# Com cache
docker run --rm -it \
  -v $(pwd):/data/project/ \
  -v $(pwd)/.qodana/cache:/data/cache/ \
  -p 8080:8080 \
  jetbrains/qodana-js:latest --show-report
```

## Método 2: Usando Qodana CLI

### Instalação
```bash
# Windows (PowerShell)
winget install JetBrains.QodanaCLI

# macOS
brew install jetbrains/utils/qodana

# Linux
curl -fsSL https://jb.gg/qodana-cli/install | bash
```

### Executar análise
```bash
qodana scan --show-report
```

## Método 3: Usando a extensão VS Code

1. Instale a extensão "Qodana" no VS Code
2. Abra a paleta de comandos (Ctrl+Shift+P)
3. Digite "Qodana: Scan Project"
4. Aguarde a análise

## Visualizar Resultados

### Após a análise com Docker
O relatório será aberto automaticamente no navegador em: http://localhost:8080

### Relatórios salvos
Os resultados ficam em:
- `.qodana/results/` - Resultados detalhados
- `qodana.sarif.json` - Formato SARIF (baseline)

## Configuração Personalizada

Edite o arquivo `qodana.yaml` para:
- Excluir pastas específicas
- Habilitar/desabilitar inspeções
- Configurar perfis de análise

## Dicas

### Primeira execução
A primeira análise pode demorar pois baixa a imagem Docker (~2GB)

### Performance
Use cache montando o volume: `-v ${PWD}/.qodana/cache:/data/cache/`

### Integração CI/CD
O arquivo `.github/workflows/qodana.yml` já está configurado para GitHub Actions

### Analisar apenas mudanças
```bash
docker run --rm -it -v ${PWD}:/data/project/ jetbrains/qodana-js:latest --baseline qodana.sarif.json
```

## Solução de Problemas

### Erro: "unknown exit code"
- Certifique-se que o Docker está rodando
- Verifique se há dependências não instaladas
- Execute: `npm install` no backend e frontend

### Erro de memória
Aumente a memória do Docker:
- Windows: Docker Desktop > Settings > Resources > Memory
- Recomendado: Mínimo 4GB

### Scan muito lento
- Use cache: `-v ${PWD}/.qodana/cache:/data/cache/`
- Exclua mais pastas no `qodana.yaml`
- Analise apenas pastas específicas

## Links Úteis
- [Documentação Qodana](https://www.jetbrains.com/help/qodana/)
- [Qodana CLI](https://github.com/JetBrains/qodana-cli)
- [Configuração qodana.yaml](https://www.jetbrains.com/help/qodana/qodana-yaml.html)
