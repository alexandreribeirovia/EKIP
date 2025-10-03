# Como Usar o Upload de Progresso via CSV

## Visão Geral

A funcionalidade de upload de CSV permite importar dados de progresso das fases de projetos de forma rápida e em lote, atualizando múltiplas semanas de uma só vez.

## Passo a Passo

### 1. Acessar a Funcionalidade

1. Navegue até a página de **Projetos**
2. Clique em um projeto para ver seus detalhes
3. Clique no botão **"Editar Progresso das Fases"**
4. No modal que abrir, clique no botão **"Carregar"** (ícone de upload)

### 2. Preparar o Arquivo CSV

#### Opção A: Baixar o Modelo
1. Clique em **"Baixar Modelo CSV"** na tela de upload
2. O modelo já virá preenchido com o nome do projeto atual
3. Edite os valores de progresso, ordem e semana conforme necessário

#### Opção B: Criar do Zero
Crie um arquivo CSV com as seguintes colunas obrigatórias:

```csv
Projeto,Fase,Progresso,Progresso esperado,Ordem,Semana
```

**Exemplo:**
```csv
Projeto;Fase;Progresso;Progresso esperado;Ordem;Semana
Sistema EKIP;Levantamento;75.5;80.0;1;1
Sistema EKIP;Desenvolvimento;45.0;50.0;2;1
Sistema EKIP;Homologação;25.0;30.0;3;1
Sistema EKIP;Deploy;10.0;15.0;4;1
Sistema EKIP;Acompanhamento;80.0;85.0;5;1
Sistema EKIP;Levantamento;85.0;90.0;1;2
Sistema EKIP;Desenvolvimento;65.0;70.0;2;2
```

### 3. Entender as Colunas

| Coluna | Descrição | Formato | Exemplo |
|--------|-----------|---------|---------|
| **Projeto** | Nome exato do projeto (deve existir no sistema) | Texto | "Sistema EKIP" |
| **Fase** | Nome exato da fase (deve existir nos domínios) | Texto | "Levantamento" |
| **Progresso** | Percentual de progresso atual | Número (0-100) | 75.5 |
| **Progresso esperado** | Percentual de progresso esperado | Número (0-100) | 80.0 |
| **Ordem** | Ordem de exibição da fase | Número inteiro | 1 |
| **Semana** | Número da semana do projeto | Número inteiro | 1 |

### 4. Fases Disponíveis

As fases devem estar cadastradas no sistema. Fases padrão:
- Levantamento
- Desenvolvimento
- Homologação
- Deploy
- Acompanhamento

> 💡 **Dica**: Verifique as fases disponíveis no dropdown ao adicionar uma nova fase manualmente no modal.

### 5. Separadores Suportados

O sistema detecta automaticamente o separador usado:
- `,` (vírgula)
- `;` (ponto e vírgula)
- `\t` (tab)

### 6. Fazer o Upload

1. Arraste o arquivo CSV para a área indicada **OU** clique para selecionar
2. Verifique se o arquivo foi carregado corretamente
3. Clique no botão **"Carregar"**
4. Acompanhe o progresso na barra visual

### 7. Acompanhar o Processamento

Durante o processamento, você verá:
- **Lendo arquivo...** - Leitura inicial do CSV
- **Carregando projetos...** - Busca de projetos no banco
- **Carregando fases...** - Busca de fases disponíveis
- **Processando linha X...** - Validação de cada linha
- **Salvando dados no banco...** - Inserção/atualização dos registros

### 8. Verificar o Resultado

Ao final, será exibido um relatório:
```
✅ Arquivo processado com sucesso!

📄 Arquivo: progresso.csv
📊 Linhas processadas: 10
✅ Linhas válidas: 8
➕ Registros inseridos: 5
🔄 Registros atualizados: 3
❌ Erros: 2
🔍 Separador detectado: ";"
```

## Regras Importantes

### ⚠️ Validações Automáticas

1. **Nome do Projeto**: Deve existir exatamente como cadastrado
2. **Nome da Fase**: Deve existir nos domínios do tipo "project_phase"
3. **Valores Numéricos**: Progresso e ordem devem ser números válidos
4. **Unicidade de Fase**: Não pode ter a mesma fase duplicada na mesma semana
5. **Unicidade de Ordem**: Não pode ter a mesma ordem duplicada na mesma semana

### ✅ Comportamento de Upsert

- **Se o registro já existe** (mesma combinação de projeto + fase + semana):
  - Os valores de progresso, progresso esperado e ordem são **atualizados**
  
- **Se o registro não existe**:
  - Um novo registro é **inserido**

## Resolução de Problemas

### Erro: "Projeto não encontrado"
- **Causa**: O nome do projeto no CSV não corresponde exatamente ao cadastrado
- **Solução**: Verifique se o nome está exato, incluindo maiúsculas/minúsculas

### Erro: "Fase não encontrada"
- **Causa**: A fase não está cadastrada nos domínios
- **Solução**: Verifique os nomes das fases disponíveis ou cadastre a nova fase nos domínios

### Erro: "Fase duplicada na semana X"
- **Causa**: O CSV tem duas linhas com a mesma fase para o mesmo projeto e mesma semana
- **Solução**: Mantenha apenas uma linha por fase/semana ou use semanas diferentes

### Erro: "Ordem duplicada na semana X"
- **Causa**: O CSV tem duas linhas com a mesma ordem para o mesmo projeto e mesma semana
- **Solução**: Use valores de ordem únicos para cada fase dentro da mesma semana

### Arquivo com Erros
Se houver erros durante o processamento:
1. O sistema mostrará até 10 primeiros erros
2. Você pode escolher:
   - **Continuar**: Importa apenas os registros válidos
   - **Cancelar**: Cancela toda a importação

## Dicas e Boas Práticas

### 📝 Preparação do Arquivo
- Use o modelo fornecido como base
- Teste com poucas linhas primeiro
- Mantenha backup do arquivo original

### 🔢 Numeração de Ordem
- Use números sequenciais: 1, 2, 3, 4, 5...
- Deixe espaço entre as ordens para inserções futuras (10, 20, 30...)
- Mantenha a mesma ordem para a mesma fase em semanas diferentes (facilita visualização)

### 📊 Progressos
- Use valores realistas (0-100)
- Progresso atual geralmente menor ou igual ao esperado
- Seja consistente entre semanas (progresso geralmente aumenta)

### 🗓️ Semanas
- Inicie sempre na semana 1
- Use valores sequenciais
- Não pule semanas sem necessidade

### 💾 Importação em Lotes
- Para muitos dados, divida em arquivos menores
- Importe uma semana por vez se houver muitos projetos
- Importe um projeto por vez se houver muitas semanas

## Atalhos

- **Baixar Modelo**: Gera automaticamente um CSV modelo com o projeto atual
- **Voltar**: Retorna à tela de edição manual
- **Remover arquivo**: Remove o arquivo selecionado antes do upload

## Limitações

- Tamanho máximo do arquivo: **5MB**
- Formato aceito: Apenas **.csv**
- Encoding: UTF-8 (recomendado)
- Processamento: Até 1000 linhas por vez (recomendado)

## Após a Importação

1. O modal será fechado automaticamente
2. Os dados serão atualizados na visualização
3. Você pode trocar de semana para verificar os dados importados
4. Os gráficos de progresso serão atualizados automaticamente
