# Mudanças no Upload de CSV - Processamento Local

## Resumo das Alterações

A funcionalidade de "Carregar Progresso via CSV" foi modificada para processar o arquivo **localmente no frontend** em vez de fazer upload para o Supabase Storage e chamar uma Edge Function.

## Mudanças Implementadas

### 1. Processamento Local do CSV
- O arquivo CSV agora é lido diretamente no navegador usando `FileReader`
- Todo o processamento é feito no frontend
- Não há mais upload para o Supabase Storage
- Não há mais chamada para a Edge Function `import_projects_phase`

### 2. Mapeamento de Dados

O sistema faz o seguinte mapeamento das colunas do CSV para a tabela `projects_phase`:

| Coluna CSV | Campo DB | Observação |
|------------|----------|------------|
| Projeto | `project_id` | Busca pelo `name` na tabela `projects` |
| Fase | `domains_id` | Busca pelo `value` na tabela `domains` onde `type='project_phase'` |
| Progresso | `progress` | Valor numérico (0-100) |
| Progresso esperado | `expected_progress` | Valor numérico (0-100) |
| Ordem | `order` | Valor inteiro |
| Semana | `period` | Valor inteiro |

### 3. Validações Implementadas

#### Durante o Processamento:
- ✅ Validação de colunas obrigatórias
- ✅ Detecção automática de delimitador (vírgula, ponto e vírgula ou tab)
- ✅ Validação de valores numéricos
- ✅ Verificação de projeto existente
- ✅ Verificação de fase existente

#### Regras de Negócio:
- ❌ **Não permite** gravar 2 domínios (fases) iguais no mesmo período para o mesmo projeto
- ❌ **Não permite** gravar 2 orders iguais no mesmo período para o mesmo projeto

### 4. Indicador de Progresso

Foi adicionado um indicador visual de progresso que mostra:
- Mensagem descritiva da etapa atual
- Contador de linhas processadas
- Barra de progresso visual

Etapas mostradas:
1. "Lendo arquivo..."
2. "Carregando projetos..."
3. "Carregando fases..."
4. "Processando linha X..."
5. "Salvando dados no banco..."

### 5. Upsert Inteligente

O sistema verifica se já existe um registro para a combinação:
- `project_id` + `domains_id` + `period`

Se existir:
- **Atualiza** os campos `progress`, `expected_progress` e `order`

Se não existir:
- **Insere** um novo registro

### 6. Relatório de Resultados

Ao final do processamento, é exibido um relatório completo:
```
✅ Arquivo processado com sucesso!

📄 Arquivo: nome_do_arquivo.csv
📊 Linhas processadas: 10
✅ Linhas válidas: 8
➕ Registros inseridos: 5
🔄 Registros atualizados: 3
❌ Erros: 2
🔍 Separador detectado: ";"
```

### 7. Tratamento de Erros

Erros são coletados durante o processamento e mostrados ao usuário:
- Lista de até 10 primeiros erros
- Indicação de quantos erros adicionais existem
- Opção de continuar com os registros válidos ou cancelar

Exemplos de erros:
- `Linha 3: Projeto "XYZ" não encontrado`
- `Linha 5: Fase "Testing" não encontrada`
- `Linha 7: Fase "Desenvolvimento" duplicada na semana 2 para o projeto "Sistema EKIP"`
- `Linha 9: Ordem 1 duplicada na semana 2 para o projeto "Sistema EKIP"`

## Formato do Arquivo CSV

### Colunas Obrigatórias:
```csv
Projeto,Fase,Progresso,Progresso esperado,Ordem,Semana
```

### Exemplo:
```csv
Projeto;Fase;Progresso;Progresso esperado;Ordem;Semana
Sistema EKIP;Levantamento;75.5;80.0;1;1
Sistema EKIP;Desenvolvimento;45.0;50.0;2;1
Sistema EKIP;Homologação;25.0;30.0;3;1
Sistema EKIP;Deploy;10.0;15.0;4;1
Sistema EKIP;Acompanhamento;80.0;85.0;5;1
```

## Benefícios das Mudanças

1. **Processamento Mais Rápido**: Sem latência de upload e chamada de API
2. **Feedback Visual**: Usuário acompanha o progresso em tempo real
3. **Melhor Validação**: Erros são detectados antes de inserir no banco
4. **Mais Controle**: Usuário decide se continua com registros válidos quando há erros
5. **Sem Dependências**: Não precisa de Edge Function ou Storage configurados
6. **Processamento em Lotes**: Inserções são feitas em lotes de 50 para melhor performance

## Possíveis Melhorias Futuras

1. **Workers Background**: Usar Web Workers para não bloquear a UI durante processamento
2. **Constraints no Banco**: Adicionar unique constraints na tabela `projects_phase` para garantir as regras
3. **Cache**: Cachear projetos e fases para evitar consultas repetidas
4. **Preview**: Mostrar preview dos dados antes de processar
5. **Undo**: Permitir desfazer importação

## Notas Técnicas

- O arquivo antigo enviava para o bucket `ProjectProgress` e chamava a Edge Function `import_projects_phase`
- Esses recursos podem agora ser removidos se não forem usados por outras funcionalidades
- A validação de duplicidade é feita em memória durante o processamento
- Recomenda-se adicionar constraints no banco de dados para garantir as regras mesmo se o CSV for importado por outro meio
