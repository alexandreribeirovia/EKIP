# ProjectDetail - Documentação Funcional

## 1. Visão Geral

A tela **ProjectDetail** é a interface mais complexa do sistema, responsável por exibir informações detalhadas de um projeto específico. Organizada em **4 abas principais**, oferece visualização e gerenciamento de tarefas, riscos, status report e upload de progresso.

**Navegação**: Acessada ao clicar em um projeto na listagem (Projects.tsx)

**Estrutura**: Single Page Application (SPA) com tabs e modals

---

## 2. Componentes da Interface

### 2.1 Cabeçalho do Projeto

**Informações Exibidas**:
- Botão "Voltar" (seta esquerda)
- Nome do projeto (destaque)
- Cliente
- Datas de início e fim
- Badge de status (Aberto/Fechado)
- Responsáveis do projeto (avatares) com gerenciamento

**Funcionalidades**:
- **Adicionar Responsável**: Dropdown para selecionar novo owner
- **Remover Responsável**: Botão X no avatar (confirmação via NotificationToast)
- **Atualização Automática**: ProjectOwnerRenderer gerencia estado

---

## 3. Abas (Tabs)

### 3.1 Aba "Acompanhamento" (tracking)

**Objetivo**: Visualizar resumo consolidado de horas trabalhadas e status das tarefas.

#### 3.1.1 Filtros de Período
- **Todos**: Sem filtro de data
- **Semana Atual**: Tarefas criadas na semana corrente (segunda a domingo)
- **Mês Atual**: Tarefas do mês corrente
- **Últimos 3 Meses**: Tarefas dos últimos 90 dias
- **Ano Atual**: Tarefas do ano corrente

#### 3.1.2 Filtros de Status
- **Todos**: Sem filtro
- **Abertas**: Tarefas com `is_closed = false`
- **Fechadas**: Tarefas com `is_closed = true`

#### 3.1.3 Seção "Horas por Tipo de Tarefa"

**Estrutura Accordion Expansível**:
- Lista de tipos de tarefa (expandir/colapsar com ícone ChevronDown/ChevronRight)
- Para cada tipo:
  - Nome do tipo
  - Horas estimadas (soma de `current_estimate_seconds`)
  - Horas trabalhadas (soma de `time_worked`)
  - Porcentagem (trabalhado / estimado)
  - Barra de progresso visual
    - Azul: até 100%
    - Vermelha: acima de 100% (over budget)

**Detalhamento por Consultor** (ao expandir tipo):
- Tabela com:
  - Nome do consultor
  - Horas trabalhadas naquele tipo
- Ordenação alfabética por nome

#### 3.1.4 Seção "Total de Tarefas por Status"

**Gráfico de Pizza (Recharts)**:
- Cada fatia representa um status de tarefa
- Cores automáticas
- Tooltip mostra nome do status e contagem
- Legenda lateral

**Cores Usadas**:
- Palette: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316']

#### 3.1.5 Seção "Horas Trabalhadas por Consultor"

**Gráfico de Pizza (Recharts)**:
- Cada fatia representa um consultor
- Tamanho proporcional às horas trabalhadas
- Tooltip mostra nome e horas formatadas (XXhXX)
- Legenda lateral com nomes

---

### 3.2 Aba "Tarefas" (tasks)

**Objetivo**: Visualizar e filtrar tarefas do projeto.

#### 3.2.1 Filtros e Busca

**Busca Textual**:
- Campo: Input com ícone de busca
- Busca em: `title` da tarefa
- Case-insensitive

**Filtro por Tipo**:
- Multi-select (React Select)
- Opções: Tipos únicos extraídos das tarefas
- Permite selecionar múltiplos tipos simultaneamente
- Ordenação alfabética

**Filtro por Status**:
- Dropdown simples
- Opções: "Aberto", "Fechado", "Todos"
- Padrão: "Aberto"

#### 3.2.2 Cards de Resumo

**Total de Tarefas**:
- Ícone: Layers (cinza)
- Valor: Contagem total

**Ativas**:
- Ícone: Clock (azul)
- Valor: Tarefas não fechadas

**Entregues**:
- Ícone: CheckCircle (verde)
- Valor: Tarefas fechadas

**Horas Planejadas**:
- Ícone: BarChart3 (laranja)
- Valor: Soma de `current_estimate_seconds` (formato XXhXX)

**Horas Trabalhadas**:
- Ícone: Clock (roxo)
- Valor: Soma de `time_worked` (formato XXhXX)

**Progresso Geral**:
- Barra de progresso: trabalhado / planejado
- Porcentagem exibida
- Cores: Azul (≤100%), Vermelho (>100%)

#### 3.2.3 Grid de Tarefas (AG-Grid)

**Colunas**:
- **Tarefa**: `title` (flex: 3, min: 250px)
- **Tipo**: `type_name` (flex: 1, min: 120px)
- **Status**: `board_stage_name` (flex: 1, min: 120px)
- **Início Planejado**: `gantt_bar_start_date` (formatado DD/MM/YYYY)
- **Fim Planejado**: `gantt_bar_end_date` (formatado DD/MM/YYYY)
- **Horas Previstas**: `current_estimate_seconds` (formato XXhXX)
- **Horas Trabalhadas**: `time_worked` (formato XXhXX)
- **Atribuído a**: `assignments` (Cell Renderer com avatares)

**Interações**:
- **Clique na linha**: Abre tarefa no Height em nova aba
  - URL: `https://height.app/[workspace]/T-[task_id]`
  - Target: `_blank` (nova janela)

**Configurações**:
- Paginação: Desabilitada (scroll infinito)
- Ordenação: Habilitada em todas as colunas
- Filtros: Habilitados em todas as colunas (AG-Grid nativo)
- Resizable: Todas as colunas
- Altura de linha: 48px

---

### 3.3 Aba "Riscos" (risks)

**Objetivo**: Gerenciar riscos e problemas do projeto.

#### 3.3.1 Filtros e Busca

**Busca Textual**:
- Campo: Input com ícone de busca
- Busca em: `description`, `action_plan`, `manual_owner`
- Case-insensitive

**Filtro por Status**:
- Multi-select (React Select)
- Opções: Extraídas da tabela `domains` (type='risk_status', is_active=true)
- Permite múltiplos status simultaneamente

**Botão "Adicionar Risco"**:
- Ícone: Plus (verde)
- Ação: Abre modal de criação

#### 3.3.2 Grid de Riscos (AG-Grid)

**Colunas**:
- **Tipo**: Badge com cores
  - Tarefa (azul), Informação (amarelo), Problema (vermelho), Risco (roxo)
- **Prioridade**: Badge com cores
  - Baixa (azul), Média (amarelo), Alta (vermelho), Bloqueante (roxo)
- **Descrição**: Renderizada como HTML (HtmlCellRenderer)
- **Plano de Ação**: Renderizada como HTML
- **Início**: `start_date` (DD/MM/YYYY)
- **Previsão**: `forecast_date` (DD/MM/YYYY)
- **Fim**: `close_date` (DD/MM/YYYY)
- **Status**: Badge com cores
  - Aberto (cinza), Em Andamento (azul), Concluído (verde), Pendente (amarelo)
- **Responsável**: `manual_owner` (texto simples)
- **Ações**: Botões de Editar e Excluir

**Interações**:
- **Editar**: Abre modal RiskModal com dados preenchidos
- **Excluir**: Abre modal de confirmação → Deleta do Supabase → Recarrega lista

#### 3.3.3 Modal de Risco (RiskModal)

**Campos**:
- **Tipo**: Dropdown (domains type='risk_type')
- **Prioridade**: Dropdown (domains type='risk_priority')
- **Descrição**: WYSIWYG editor (ReactQuill)
- **Plano de Ação**: WYSIWYG editor (ReactQuill)
- **Início**: Date picker
- **Previsão**: Date picker
- **Fim**: Date picker (opcional)
- **Status**: Dropdown (domains type='risk_status')
- **Responsável**: Text input

**Validações**:
- Tipo, Prioridade, Descrição, Status: Obrigatórios
- Data de início: Obrigatória
- Data de previsão: Obrigatória

**Ações**:
- **Salvar**: INSERT ou UPDATE na tabela `risks`
- **Cancelar**: Fecha modal sem salvar

---

### 3.4 Aba "Status Report" (status-report)

**Objetivo**: Visualizar progresso do projeto com gráficos avançados.

#### 3.4.1 Botão Tela Cheia

- Ícone: Maximize
- Ação: Alterna fullscreen na div do gráfico
- API: `requestFullscreen()` / `exitFullscreen()`

#### 3.4.2 Gráfico da Curva S

**Descrição**: Gráfico de linhas mostrando progresso planejado vs. real ao longo das semanas.

**Eixos**:
- **X**: Semanas do projeto (Sem 1, Sem 2, ...)
- **Y**: Porcentagem de conclusão (0-100%)

**Linhas**:
- **Planejado** (linha laranja):
  - Calculada com base nas datas de Gantt das tarefas
  - Curva S idealizada (acumulativo)
- **Real** (linha verde):
  - Baseada nos valores cadastrados em `projects_phase`
  - Pontos reais de progresso por semana

**Referências**:
- **Linha Vertical**: Semana atual (tracejada vermelha)
- **Área de Destaque**: Semana atual (fundo cinza semi-transparente)

**Barras Horizontais** (fases do projeto):
- Exibidas abaixo do gráfico
- Cada barra representa uma fase com:
  - Nome da fase
  - Semana de início e fim
  - Cor característica

#### 3.4.3 Mapeamento de Fases

**Lógica**: Tipos de tarefa mapeados para fases do projeto

**Mapeamento**:
- **Levantamento**: Desenho Funcional, Desenho Técnico
- **Desenvolvimento**: Desenvolvimento
- **Homologação**: Certificação
- **Deploy**: Implantação
- **Acompanhamento**: Acompanhamento

**Pesos Padrão** (distribuídos proporcionalmente):
- Levantamento: 10%
- Desenvolvimento: 50%
- Homologação: 20%
- Deploy: 10%
- Acompanhamento: 10%

#### 3.4.4 Gráficos de Pizza - Progresso por Fase

**Para cada fase cadastrada em `projects_phase`**:
- Gráfico de pizza mostrando:
  - Progresso Real (verde)
  - Esperado (cinza)
  - Legenda com percentuais

**Cálculo**:
- Progresso Real: Valor cadastrado em `projects_phase.progress`
- Esperado: Calculado com base no cronograma e semana atual

**Layout**:
- Grid responsivo (2-3 colunas)
- Cada fase em um card separado

---

### 3.5 Aba "Upload de Progresso" (progress-upload)

**Objetivo**: Importar dados de progresso via CSV.

#### 3.5.1 Informações Exibidas

**Semanas do Projeto**:
- Calculadas com base nas datas de Gantt das tarefas
- Intervalo: Data de início da primeira tarefa → Data de fim da última tarefa
- 1 semana = 7 dias

**Total de Semanas**: Exibido como badge

#### 3.5.2 Seleção de Semana

- Dropdown com lista de semanas: "Semana 1", "Semana 2", ...
- Permite selecionar semana para upload

#### 3.5.3 Botão "Importar Progress"

- Ícone: Plus
- Ação: Abre modal `ProjectProgressModal`
- Props:
  - `projectId`: ID do projeto
  - `selectedWeek`: Semana selecionada
  - `onClose`: Callback para fechar modal
  - `onSuccess`: Callback para recarregar dados

#### 3.5.4 Modal de Upload (ProjectProgressModal)

**Campos**:
- **Arquivo CSV**: Input type="file" (accept=".csv")
- **Semana**: Exibida como informação (readonly)

**Validações**:
- Arquivo obrigatório
- Formato CSV válido
- Delimitador: vírgula ou ponto-e-vírgula (auto-detect)

**Colunas Esperadas**:
- `phase_name`: Nome da fase
- `progress`: Porcentagem (0-100)
- `expected`: Porcentagem esperada (0-100)

**Processamento**:
1. Parse do CSV no frontend
2. Validação de dados
3. Upsert em `projects_phase` via edge function `import_projects_phase`
4. Upload do arquivo para Supabase Storage (bucket `ProjectProgress`)

**Nomenclatura do Arquivo**:
```
project_{project_id}_week_{week}_{timestamp}.csv
```

---

## 4. Regras de Negócio

### 4.1 Cálculo de Horas

**Horas Previstas**:
- Soma de `current_estimate_seconds` de todas as tarefas
- Convertidas para formato XXhXX (horas e minutos)

**Horas Trabalhadas**:
- Soma de `time_worked` de todas as tarefas
- Fonte: Tabela `time_worked` (agrupada por user_id)
- Convertidas para formato XXhXX

**Progresso**:
```
progresso = (horas_trabalhadas / horas_previstas) * 100
```

### 4.2 Filtros de Acompanhamento

**Aplicação**: Filtros afetam APENAS a aba "Acompanhamento"

**Lógica de Período**:
- Baseado em `created_at` da tarefa
- Semana Atual: Começa na segunda-feira da semana
- Mês Atual: Primeiro dia do mês
- Últimos 3 Meses: 90 dias atrás
- Ano Atual: 01/01 do ano corrente

**Lógica de Status**:
- Baseado em `is_closed` da tarefa

### 4.3 Cálculo da Curva S

#### 4.3.1 Progresso Planejado

**Base**: Datas de Gantt das tarefas (`gantt_bar_start_date`, `gantt_bar_end_date`)

**Algoritmo**:
1. Agrupa tarefas por tipo
2. Mapeia tipos para fases
3. Calcula cronograma de cada fase
4. Distribui progresso linearmente dentro da fase
5. Acumula progresso semanalmente

**Curva Idealizada**: S-curve suave (início lento, aceleração no meio, desaceleração no fim)

#### 4.3.2 Progresso Real

**Base**: Tabela `projects_phase` (valores cadastrados manualmente ou via CSV)

**Lógica**:
1. Para cada semana, busca fases cadastradas com `period = week_number`
2. Se não há dados, retorna 0
3. Calcula progresso ponderado baseado nos pesos das fases
4. Acumula para curva acumulativa

### 4.4 Gerenciamento de Responsáveis

**Adicionar**:
1. Usuário seleciona owner no dropdown
2. INSERT em `projects_owner` (project_id, user_id)
3. Sucesso: NotificationToast verde
4. Erro: NotificationToast vermelho

**Remover**:
1. Usuário clica no X do avatar
2. DELETE de `projects_owner` onde `id = owner_id`
3. Sucesso: NotificationToast verde
4. Atualização instantânea da UI

---

## 5. Mensagens e Notificações

### 5.1 NotificationToast

**Componente**: Toast flutuante no canto superior direito

**Características**:
- **Auto-close**: 10 segundos
- **Progress bar**: Barra visual decrescente
- **Hover pause**: Pausar timer ao passar mouse
- **Manual close**: Botão X
- **Portal**: Renderizado no body (z-index: 9999)

**Tipos**:
- **success**: Verde, ícone CheckCircle
- **error**: Vermelho, ícone XCircle

### 5.2 Mensagens de Sucesso

- "Responsável adicionado com sucesso!"
- "Responsável removido com sucesso!"
- "Risco salvo com sucesso!"
- "Risco excluído com sucesso!"
- "Progresso importado com sucesso!"

### 5.3 Mensagens de Erro

- "Erro ao buscar tarefas: {detalhes}"
- "Erro ao buscar riscos: {detalhes}"
- "Erro ao adicionar responsável: {detalhes}"
- "Erro ao salvar risco: {detalhes}"
- "Erro ao excluir risco: {detalhes}"
- "Erro ao importar progresso: {detalhes}"

### 5.4 Modal de Confirmação

**Título**: "Confirmar Exclusão"
**Mensagem**: "Tem certeza que deseja excluir este risco? Esta ação não pode ser desfeita."
**Botões**: "Cancelar" (cinza), "Excluir" (vermelho)

---

## 6. Interações do Usuário

### 6.1 Fluxo de Visualização de Tarefa

1. Usuário está na aba "Tarefas"
2. Clica em qualquer linha do grid
3. Sistema abre Height em nova aba
4. URL: `https://height.app/{workspace}/T-{task_id}`

### 6.2 Fluxo de Criação de Risco

1. Usuário clica em "Adicionar Risco" (aba Riscos)
2. Modal RiskModal abre (campos vazios)
3. Usuário preenche campos obrigatórios
4. Clica "Salvar"
5. Sistema valida → INSERT em `risks` → Fecha modal
6. NotificationToast de sucesso
7. Grid de riscos recarrega automaticamente

### 6.3 Fluxo de Edição de Risco

1. Usuário clica no ícone de Editar na linha do risco
2. Modal RiskModal abre (campos preenchidos)
3. Usuário altera campos
4. Clica "Salvar"
5. Sistema valida → UPDATE em `risks` → Fecha modal
6. NotificationToast de sucesso
7. Grid de riscos recarrega automaticamente

### 6.4 Fluxo de Exclusão de Risco

1. Usuário clica no ícone de Excluir na linha do risco
2. Modal de confirmação abre
3. Usuário confirma exclusão
4. Sistema executa DELETE em `risks`
5. NotificationToast de sucesso
6. Grid de riscos recarrega automaticamente

### 6.5 Fluxo de Upload de Progresso

1. Usuário acessa aba "Upload de Progresso"
2. Seleciona semana no dropdown
3. Clica "Importar Progress"
4. Modal ProjectProgressModal abre
5. Usuário seleciona arquivo CSV
6. Clica "Importar"
7. Sistema:
   - Parse CSV
   - Valida dados
   - Chama edge function
   - Upload para Storage
8. NotificationToast de sucesso/erro
9. Aba "Status Report" atualiza automaticamente

---

## 7. Validações

### 7.1 Validações de Riscos

**Campos Obrigatórios**:
- Tipo
- Prioridade
- Descrição (mínimo 10 caracteres)
- Status
- Data de início
- Data de previsão

**Validações de Data**:
- Data de início ≤ Data de previsão
- Data de fim (se preenchida) ≥ Data de início

### 7.2 Validações de CSV

**Estrutura**:
- Header obrigatório: `phase_name,progress,expected`
- Delimitador: vírgula ou ponto-e-vírgula
- Encoding: UTF-8

**Validações de Dados**:
- `progress`: Número entre 0 e 100
- `expected`: Número entre 0 e 100
- `phase_name`: String não vazia

**Erros Comuns**:
- CSV vazio
- Header faltando
- Valores fora do range (0-100)
- Formato de número inválido

---

## 8. Performance

### 8.1 Otimizações Implementadas

**useRef para Carregamento**:
- Evita re-fetch desnecessário de dados
- Flags: hasLoadedTasks, hasLoadedRisks, hasLoadedPhases, etc.

**useMemo para Cálculos**:
- `filteredTasks`: Recalcula apenas quando filtros ou tasks mudam
- `filteredRisks`: Recalcula apenas quando filtros ou risks mudam
- `filteredTrackingData`: Cálculos complexos de horas por tipo/consultor
- `getConsolidatedPhases`: Agrupamento de fases por period
- `calculateSCurveData`: Cálculos pesados da curva S

**useCallback para Handlers**:
- Evita re-criação de funções em cada render
- Usado em: toggleTypeExpansion, handleOwnerChange, getFilteredTasks

### 8.2 Lazy Loading

**Dados**:
- Tarefas carregadas apenas ao abrir ProjectDetail
- Riscos carregados apenas ao abrir ProjectDetail
- Não há paginação (todos os dados carregados de uma vez)

**Componentes**:
- Modals carregados apenas quando abertos
- AG-Grid renderiza apenas linhas visíveis (virtual scrolling)

---

## 9. Responsividade

### Layout Desktop (≥1024px)
- Grid ocupa largura total
- Charts side-by-side (2-3 colunas)
- Filtros em linha horizontal

### Layout Tablet (768px-1023px)
- Grid com scroll horizontal
- Charts em 2 colunas
- Filtros empilhados

### Layout Mobile (<768px)
- Grid com scroll horizontal
- Charts em 1 coluna (stack vertical)
- Filtros empilhados verticalmente
- Cards de resumo em 2 colunas

---

## 10. Acessibilidade

- **Contraste**: Suporte a dark mode completo
- **Foco**: Anéis laranja em campos focados
- **Navegação**: AG-Grid suporta navegação por teclado
- **Labels**: Placeholders descritivos
- **Tooltips**: Informações adicionais ao hover

---

## 11. Segurança

### Autenticação
- Tela acessível apenas com JWT válido
- Token anexado automaticamente pelo Supabase Client

### Autorização
- RLS aplicado em todas as tabelas
- Usuários só visualizam projetos que têm permissão

### Sanitização
- HTML renderizado via HtmlCellRenderer (sanitização automática do React)
- WYSIWYG editor (ReactQuill) escapa código malicioso
- CSV parseado com validação de tipos

---

## 12. Integração com Outras Telas/Sistemas

### Height (Sistema Externo)
- **Trigger**: Clique em tarefa
- **URL**: `https://height.app/{workspace}/T-{task_id}`
- **Dados**: Apenas leitura (visualização)

### Projects.tsx
- **Navegação**: Botão "Voltar" retorna para listagem
- **Callback**: `onBack()` limpa estado selectedProject

### Supabase Storage
- **Upload**: CSV armazenado em bucket `ProjectProgress`
- **Nomenclatura**: Padrão definido para facilitar busca

---

## 13. Fluxo de Dados Completo

```
[ProjectDetail Monta]
        ↓
[useEffect: fetchTasks]
        ↓
[RPC: get_tasks_with_assignees]
        ↓
[setTasks(data)]
        ↓
[useEffect: fetchTimeWorked]
        ↓
[Query: time_worked]
        ↓
[Agrupa por user_id]
        ↓
[setTimeWorkedData(aggregated)]
        ↓
[useEffect: fetchPhases]
        ↓
[Query: projects_phase]
        ↓
[setProjectPhases(data)]
        ↓
[useEffect: fetchRisks]
        ↓
[Query: risks]
        ↓
[Enriquece com domains]
        ↓
[setRisks(enriched)]
        ↓
[useMemo: Calculate all derived data]
        ↓
[Renderização Final]
```
