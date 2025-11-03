# Projects - Documentação Funcional

## 1. Visão Geral

A tela **Projects** é responsável pela listagem e gerenciamento de todos os projetos da empresa. Permite visualizar informações consolidadas, filtrar por status e realizar buscas. Ao clicar em um projeto, o usuário é direcionado para a tela de detalhes.

---

## 2. Funcionalidades Principais

### 2.1 Listagem de Projetos

- **Exibição em Grid (AG-Grid)**
  - Tabela responsiva com ordenação e filtros por coluna
  - Seleção de linha única
  - Animação de linhas ao carregar/filtrar
  - Altura de linha: 48px
  - Altura de cabeçalho: 48px

- **Colunas Exibidas**
  - **Projeto**: Nome do projeto (flex: 2, min: 200px)
  - **Cliente**: Nome do cliente (flex: 1.5, min: 150px)
  - **Data Início**: Data de início formatada (DD/MM/YYYY)
  - **Data Fim**: Data de encerramento formatada (DD/MM/YYYY)
  - **Tarefas**: Total de tarefas do projeto
  - **Entregues**: Tarefas concluídas (is_closed)
  - **Andamento**: Tarefas em progresso (tasks_working_on_count)
  - **Fila**: Tarefas na fila (tasks_queued_count)
  - **Não Atribuídas**: Calculado como: `tasks_count - (closed + working_on + queued)`
  - **Horas**: Total de horas trabalhadas (time_total em segundos, convertido para formato "X.XXh")
  - **Responsável**: Avatares dos responsáveis (ProjectOwnersGridRenderer)

### 2.2 Filtros e Busca

#### Busca Textual
- **Campo**: Input com ícone de lupa
- **Placeholder**: "Buscar por projeto ou cliente..."
- **Comportamento**: 
  - Busca case-insensitive
  - Filtra por nome do projeto OU nome do cliente
  - Atualização em tempo real (onChange)
  - Ícone de busca posicionado à esquerda do input

#### Filtro de Status
- **Opções**:
  - **Abertos**: Projetos com `is_closed = false` (padrão)
  - **Fechados**: Projetos com `is_closed = true`
  - **Todos**: Sem filtro de status
- **Comportamento**:
  - Aplicado em conjunto com busca textual
  - Seletor dropdown estilizado

### 2.3 Estatísticas (Cards)

Exibe três cards com métricas gerais (independentes dos filtros aplicados):

#### Card "Total"
- **Ícone**: Layers (cinza)
- **Valor**: Total de projetos cadastrados
- **Estilo**: Fundo cinza claro, borda cinza

#### Card "Abertos"
- **Ícone**: FolderOpen (verde)
- **Valor**: Total de projetos não encerrados
- **Estilo**: Fundo verde claro, borda verde

#### Card "Fechados"
- **Ícone**: FolderCheck (azul)
- **Valor**: Total de projetos encerrados
- **Estilo**: Fundo azul claro, borda azul

**Importante**: Os cards mostram valores totais, não são afetados por filtros.

---

## 3. Regras de Negócio

### 3.1 Carregamento de Dados

- **Fonte**: Tabela `projects` no Supabase
- **Join**: Busca responsáveis via `projects_owner` → `users`
- **Ordenação**: Alfabética por nome do projeto (ascending)
- **Carregamento Inicial**: Executado uma única vez com useRef (hasLoadedInitially)

### 3.2 Formatação de Dados

#### Datas
- **Formato de entrada**: ISO 8601 (YYYY-MM-DD)
- **Formato de saída**: DD/MM/YYYY (pt-BR)
- **Valor nulo**: Exibe "-"

#### Horas
- **Entrada**: Segundos (time_total)
- **Saída**: Formato "X.XXh" com 2 casas decimais
- **Cálculo**: `seconds / 3600`
- **Valor nulo/zero**: "0.00h"

#### Responsáveis (Owners)
- **Transformação**: Array de `projects_owner` → Array de owners formatados
- **Estrutura**:
  - id, created_at, updated_at, project_id, user_id
  - users: { user_id, name, avatar_large_url }
- **Filtro**: Remove owners sem dados de usuário

### 3.3 Cálculo de Tarefas Não Atribuídas

```
não_atribuídas = tasks_count - (tasks_closed_count + tasks_working_on_count + tasks_queued_count)
```

### 3.4 Navegação

- **Clique na Linha**: Abre ProjectDetail para o projeto selecionado
- **Estado**: Gerenciado por `selectedProject` (DbProject | null)
- **Retorno**: Botão "Voltar" em ProjectDetail limpa o estado

---

## 4. Mensagens e Feedback

### 4.1 Mensagens de Erro

#### Erro ao Buscar Projetos
- **Quando**: Falha na query do Supabase
- **Ação**: Console.error com detalhes do erro
- **Exibição**: Erro não é mostrado na interface (silencioso)

### 4.2 Estados de Carregamento

- **Carregamento Inicial**: Não há indicador visual de loading
- **Grid Vazio**: Tabela AG-Grid exibe mensagem padrão "No Rows To Show"

---

## 5. Interações do Usuário

### 5.1 Busca
1. Usuário digita no campo de busca
2. Sistema filtra instantaneamente (onChange)
3. Grid atualiza com resultados filtrados

### 5.2 Filtro de Status
1. Usuário seleciona opção no dropdown
2. Sistema refiltra projetos baseado em `is_closed`
3. Grid atualiza com resultados

### 5.3 Ordenação de Colunas
1. Usuário clica no cabeçalho da coluna
2. AG-Grid ordena automaticamente (sortable: true)
3. Indicador visual de ordenação aparece

### 5.4 Filtro por Coluna
1. Usuário clica no ícone de filtro no cabeçalho
2. AG-Grid abre menu de filtro (filter: true)
3. Aplica filtros específicos da coluna

### 5.5 Seleção de Projeto
1. Usuário clica em qualquer célula da linha
2. Sistema captura evento `onRowClicked`
3. Define `selectedProject` com dados completos
4. Renderiza componente ProjectDetail

---

## 6. Responsividade

### Layout Desktop
- Grid ocupa largura total disponível
- Filtros em linha horizontal
- Cards de estatísticas em grid de 3 colunas

### Layout Tablet/Mobile
- Filtros empilhados verticalmente (flex-col)
- Cards de estatísticas em grid responsivo (2 colunas em mobile, 3 em tablet)
- Grid AG-Grid mantém scroll horizontal para colunas

---

## 7. Acessibilidade

- **Contraste**: Suporte a dark mode em todos os elementos
- **Foco**: Campos de input com anel laranja ao focar (focus:ring-orange-500)
- **Navegação por Teclado**: AG-Grid suporta navegação completa
- **Labels**: Placeholders descritivos em campos de busca

---

## 8. Integração com Outras Telas

### ProjectDetail
- **Trigger**: Clique em linha do grid
- **Dados Passados**: Objeto completo DbProject com owners
- **Retorno**: Callback `onBack()` limpa selectedProject

---

## 9. Performance

### Otimizações Implementadas
- **useMemo**: Cálculo de projetos filtrados
- **useMemo**: Cálculo de estatísticas totais
- **useRef**: Controle de carregamento inicial (evita chamadas duplicadas)
- **Animação**: AG-Grid com animateRows para UX suave

### Carregamento de Dados
- **Estratégia**: Carregar todos os projetos de uma vez
- **Join Eager**: Busca owners em uma única query
- **Cache**: Não há cache implementado (sempre busca dados frescos)

---

## 10. Fluxo de Dados

```
[Supabase projects table]
         ↓
   [fetchProjects()]
         ↓
   [Transform owners]
         ↓
   [setProjects(data)]
         ↓
   [useMemo filteredProjects]
         ↓
   [AG-Grid rowData]
         ↓
   [User Interaction]
         ↓
   [ProjectDetail]
```

---

## 11. Validações

### Validação de Owners
- Remove owners sem dados de usuário válidos
- Filtra arrays vazios ou nulls
- Garante estrutura consistente

### Validação de Datas
- Trata valores null como "-"
- Converte strings ISO para Date antes de formatar

### Validação de Números
- Trata null/undefined como 0 em cálculos
- Garante valores numéricos válidos em todas as colunas

---

## 12. Segurança

### Autenticação
- Tela acessível apenas com usuário autenticado (ProtectedRoute)
- Token JWT verificado em todas as chamadas ao Supabase

### Autorização
- Todos os usuários autenticados podem visualizar projetos
- RLS (Row Level Security) aplicado no Supabase

### Dados Sensíveis
- Não há dados sensíveis expostos nesta tela
- Avatares carregados via URL pública (avatar_large_url)
