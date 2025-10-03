# Guia de Upload de Progresso via CSV

## Visão Geral

O modal de Progresso das Fases agora suporta upload de arquivos CSV para atualizar o progresso de múltiplas fases de uma só vez. Esta funcionalidade está integrada ao bucket "ProjectProgress" do Supabase.

## Como Usar

1. **Abrir o Modal de Progresso**: Clique em "Editar Progresso" em qualquer projeto
2. **Acessar Interface de Upload**: Clique no botão "Carregar Progresso" (ícone de upload azul)
3. **Selecionar Arquivo**: 
   - Clique para abrir o seletor de arquivos
   - Ou arraste e solte o arquivo CSV na área demarcada
4. **Upload e Processamento**: Clique em "Carregar" para fazer upload e processar o arquivo

## Formato do Arquivo CSV

### Estrutura Completa

```csv
Projeto,Fase,Progresso,Progresso esperado,Ordem,Semana
```

**Separadores Suportados:** Vírgula (`,`) ou Ponto e vírgula (`;`) - Detecção automática

### Colunas

#### Obrigatórias
- **Fase**: Nome da fase do projeto
- **Progresso**: Valor do progresso atual (0-100)

#### Opcionais
- **Projeto**: Nome do projeto (validação de correspondência)
- **Progresso esperado**: Valor do progresso esperado (0-100)
- **Ordem**: Número da ordem da fase (para reordenação)
- **Semana**: Número da semana do projeto (filtro automático)

### Exemplo de Arquivo

**Com vírgulas:**
```csv
Projeto,Fase,Progresso,Progresso esperado,Ordem,Semana
Sistema EKIP,Análise de Requisitos,75.5,80.0,1,1
Sistema EKIP,Desenvolvimento,45.0,50.0,2,1
Sistema EKIP,Testes,25.0,30.0,3,1
```

**Com ponto e vírgula:**
```csv
Projeto;Fase;Progresso;Progresso esperado;Ordem;Semana
APP Quadras;Levantamento;15;10;1;1
APP Quadras;Desenvolvimento;10;15;2;1
APP Quadras;Levantamento;12;15;1;2
```

## Regras e Validações

### Arquivo
- Formato: CSV (.csv)
- Tamanho máximo: 5MB
- Codificação: UTF-8 recomendada

### Dados
- Valores de progresso entre 0 e 100
- Nomes das fases devem corresponder (parcialmente) às fases existentes no projeto
- Primeira linha deve conter o cabeçalho
- Linhas vazias são ignoradas

## Processamento

1. **Upload**: O arquivo é enviado para o bucket "ProjectProgress" no Supabase
2. **Edge Function**: Chamada assíncrona para `import_projects_phase` usando chave anônima do Supabase
3. **Validação**: A Edge Function verifica formato, estrutura e conteúdo do CSV
4. **Detecção de Separador**: Identificação automática de vírgula (`,`) ou ponto e vírgula (`;`)
5. **Processamento de Dados**: Inserção/atualização dos registros no banco de dados
6. **Limpeza**: O arquivo é automaticamente removido do bucket após processamento
7. **Relatório**: Retorno detalhado com estatísticas do processamento
8. **Atualização da Interface**: Recarregamento automático dos dados na tela

## Nomenclatura dos Arquivos

Os arquivos são salvos com o padrão:
```
project_{project_id}_week_{week_number}_{timestamp}.csv
```

Exemplo: `project_123_week_5_2025-09-29T20-15-30-123Z.csv`

## Resposta da Edge Function

A Edge Function retorna um objeto JSON com informações detalhadas sobre o processamento:

```json
{
  "file": "project_3803874_week_1_2025-09-29T20-06-30-978Z.csv",
  "parsed_rows": 4,
  "valid_rows": 4,
  "inserted_or_updated": 4,
  "errors_count": 0,
  "errors": [],
  "file_deleted": true,
  "detected_delimiter": ";",
  "used_columns": [
    "Projeto",
    "Fase", 
    "Progresso",
    "Progresso esperado",
    "ordem",
    "semana"
  ],
  "ms": 1708
}
```

### Campos da Resposta

- **file**: Nome do arquivo processado
- **parsed_rows**: Total de linhas lidas do CSV
- **valid_rows**: Linhas que passaram na validação
- **inserted_or_updated**: Registros efetivamente salvos no banco
- **errors_count**: Número de erros encontrados
- **errors**: Array com detalhes dos erros (se houver)
- **file_deleted**: Se o arquivo foi removido do bucket
- **detected_delimiter**: Separador detectado no CSV
- **used_columns**: Colunas identificadas e utilizadas
- **ms**: Tempo de processamento em milissegundos

## Tratamento de Erros

### Erros Comuns
- **Arquivo inválido**: Formato não é CSV
- **Arquivo muito grande**: Excede 5MB
- **CSV malformado**: Sem cabeçalho ou estrutura incorreta
- **Colunas obrigatórias**: Faltam colunas "Fase" ou "Progresso"
- **Dados inválidos**: Valores de progresso fora do intervalo 0-100
- **Erro 401**: Problema com a chave anônima ou configuração da Edge Function
- **Projeto não corresponde**: Nome do projeto no CSV não bate com o projeto atual
- **Semana sem dados**: Nenhum dado encontrado para a semana selecionada
- **Sem correspondência**: Nenhuma fase do CSV corresponde às fases do projeto

### Logs
- Upload e processamento são logados no console
- Erros são exibidos como notificações no sistema

## Dicas

1. **Backup**: Sempre faça backup dos dados antes de fazer upload em massa
2. **Teste**: Teste com um arquivo pequeno primeiro
3. **Nomes**: Use nomes de fases que contenham palavras-chave das fases existentes
4. **Codificação**: Salve o CSV em UTF-8 para evitar problemas com acentos

## Exemplo Prático

1. Exporte as fases atuais do projeto
2. Edite os valores de progresso em uma planilha (Excel, Google Sheets)
3. Salve como CSV
4. Faça upload através da interface
5. Verifique se os valores foram atualizados corretamente

## Tecnologias Utilizadas

- **Supabase Storage**: Armazenamento temporário dos arquivos CSV
- **Bucket**: ProjectProgress (público)
- **Edge Function**: Processamento server-side (`import_projects_phase`)
- **Supabase Database**: Persistência dos dados de progresso das fases
- **Interface**: Drag & Drop com React e feedback detalhado
- **Validação**: Server-side com relatório completo de erros
- **Limpeza Automática**: Remoção do arquivo após processamento
