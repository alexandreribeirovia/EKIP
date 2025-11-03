# ProjectDetail - Desenho de Solução (DS)

## 1. Visão Arquitetural

### 1.1 Arquitetura de Componentes

```
┌─────────────────────────────────────────────────────────────────────────┐
│                       ProjectDetail (Container)                          │
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────┐    │
│  │                         State Management                        │    │
│  │                                                                 │    │
│  │  React Hooks:                                                   │    │
│  │  - useState (tasks, risks, phases, owners, filters, modals)    │    │
│  │  - useRef (hasLoaded flags × 6)                                │    │
│  │  - useMemo (filteredData, calculations, sCurve)                │    │
│  │  - useCallback (handlers, filters, calculations)               │    │
│  │  - useEffect (data fetching × 5)                               │    │
│  └────────────────────────────────────────────────────────────────┘    │
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────┐    │
│  │                    Sub-Components (Tabs)                        │    │
│  │                                                                 │    │
│  │  ├─→ Tracking Tab                                              │    │
│  │  │    ├─→ Period/Status Filters                                │    │
│  │  │    ├─→ Hours by Task Type (Accordion)                       │    │
│  │  │    ├─→ Tasks by Status (Pie Chart)                          │    │
│  │  │    └─→ Hours by Consultant (Pie Chart)                      │    │
│  │  │                                                              │    │
│  │  ├─→ Tasks Tab                                                 │    │
│  │  │    ├─→ Search/Filter Controls                               │    │
│  │  │    ├─→ Summary Cards                                        │    │
│  │  │    └─→ AG-Grid (Tasks)                                      │    │
│  │  │                                                              │    │
│  │  ├─→ Risks Tab                                                 │    │
│  │  │    ├─→ Search/Filter Controls                               │    │
│  │  │    ├─→ Add Risk Button                                      │    │
│  │  │    └─→ AG-Grid (Risks)                                      │    │
│  │  │                                                              │    │
│  │  ├─→ Status Report Tab                                         │    │
│  │  │    ├─→ Fullscreen Toggle                                    │    │
│  │  │    ├─→ S-Curve Chart (Recharts)                             │    │
│  │  │    └─→ Phase Progress Pies                                  │    │
│  │  │                                                              │    │
│  │  └─→ Progress Upload Tab                                       │    │
│  │       ├─→ Week Selector                                        │    │
│  │       └─→ Import Button                                        │    │
│  └────────────────────────────────────────────────────────────────┘    │
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────┐    │
│  │                      Modals & Overlays                          │    │
│  │                                                                 │    │
│  │  ├─→ RiskModal (CRUD de riscos)                                │    │
│  │  ├─→ ProjectProgressModal (Upload CSV)                         │    │
│  │  ├─→ DeleteConfirmModal (Exclusão de risco)                    │    │
│  │  └─→ NotificationToast (Feedback de ações)                     │    │
│  └────────────────────────────────────────────────────────────────┘    │
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────┐    │
│  │                   Cell Renderers (AG-Grid)                      │    │
│  │                                                                 │    │
│  │  ├─→ AssigneeCellRenderer (Avatares de atribuídos)             │    │
│  │  ├─→ HtmlCellRenderer (Renderiza HTML)                         │    │
│  │  ├─→ RiskTypeBadge (Badge colorido)                            │    │
│  │  ├─→ RiskPriorityBadge (Badge colorido)                        │    │
│  │  ├─→ RiskStatusBadge (Badge colorido)                          │    │
│  │  ├─→ RiskActionsRenderer (Botões Edit/Delete)                  │    │
│  │  └─→ ProgressBarRenderer (Barra de progresso)                  │    │
│  └────────────────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────────────────┘
                                 ↓
┌──────────────────────────────────────────────────────────────────────────┐
│                      Integration Layer (Supabase)                        │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│  ┌────────────────────┐  ┌──────────────────┐  ┌──────────────────┐    │
│  │  Query Builder     │  │  RPC Functions   │  │  Edge Functions  │    │
│  │                    │  │                  │  │                  │    │
│  │  - from()          │  │  - get_tasks_... │  │  - import_...    │    │
│  │  - select()        │  │                  │  │    projects_...  │    │
│  │  - insert()        │  │                  │  │                  │    │
│  │  - update()        │  │                  │  │                  │    │
│  │  - delete()        │  │                  │  │                  │    │
│  │  - eq()            │  │                  │  │                  │    │
│  └────────────────────┘  └──────────────────┘  └──────────────────┘    │
│                                                                           │
│  ┌───────────────────────────────────────────────────────────────┐      │
│  │                    Storage API                                 │      │
│  │                                                                │      │
│  │  - Bucket: ProjectProgress                                    │      │
│  │  - Upload CSV files                                           │      │
│  │  - Naming: project_{id}_week_{w}_{ts}.csv                    │      │
│  └───────────────────────────────────────────────────────────────┘      │
└──────────────────────────────────────────────────────────────────────────┘
                                 ↓
┌──────────────────────────────────────────────────────────────────────────┐
│                         Data Layer (PostgreSQL)                          │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌─────────────┐ │
│  │    tasks     │  │  time_worked │  │    risks     │  │   domains   │ │
│  │──────────────│  │──────────────│  │──────────────│  │─────────────│ │
│  │ task_id PK   │  │ id PK        │  │ id PK        │  │ id PK       │ │
│  │ project_id   │  │ project_id   │  │ project_id   │  │ type        │ │
│  │ title        │  │ user_id      │  │ type         │  │ value       │ │
│  │ type_name    │  │ user_name    │  │ priority     │  │ is_active   │ │
│  │ is_closed    │  │ time         │  │ description  │  │             │ │
│  │ time_worked  │  │              │  │ action_plan  │  │             │ │
│  │ estimate     │  │              │  │ status       │  │             │ │
│  │ gantt_start  │  │              │  │ start_date   │  │             │ │
│  │ gantt_end    │  │              │  │ forecast_... │  │             │ │
│  │ assignments  │  │              │  │ close_date   │  │             │ │
│  │ ...          │  │              │  │ manual_owner │  │             │ │
│  └──────────────┘  └──────────────┘  └──────────────┘  └─────────────┘ │
│                                                                           │
│  ┌──────────────────┐  ┌──────────────────┐                             │
│  │ projects_phase   │  │  projects_owner  │                             │
│  │──────────────────│  │──────────────────│                             │
│  │ id PK            │  │ id PK            │                             │
│  │ project_id       │  │ project_id FK    │                             │
│  │ domains_id       │  │ user_id FK       │                             │
│  │ phase_name       │  │                  │                             │
│  │ progress         │  │                  │                             │
│  │ expected         │  │                  │                             │
│  │ period (week)    │  │                  │                             │
│  │ order            │  │                  │                             │
│  └──────────────────┘  └──────────────────┘                             │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Modelo de Dados Detalhado

### 2.1 Entidades e Atributos

#### DbTask
```typescript
interface DbTask {
  task_id: number;                     // PK
  project_id: number;                  // FK → projects
  title: string;                       // Título da tarefa
  type_name: string | null;            // Tipo (Desenvolvimento, Homologação, etc.)
  board_stage_name: string | null;     // Status (Aberto, Fechado, etc.)
  is_closed: boolean;                  // Flag de fechamento
  gantt_bar_start_date: string | null; // Data de início (ISO 8601)
  gantt_bar_end_date: string | null;   // Data de fim (ISO 8601)
  current_estimate_seconds: number | null; // Horas estimadas (segundos)
  time_worked: number | null;          // Horas trabalhadas (segundos)
  created_at: string;                  // Data de criação
  assignments: DbAssignment[] | null;  // Atribuídos (join)
}

interface DbAssignment {
  user_id: number;
  name: string;
  avatar_large_url: string | null;
}
```

#### DbRisk
```typescript
interface DbRisk {
  id: number;                    // PK
  project_id: number;            // FK → projects
  type: string;                  // Tarefa, Informação, Problema, Risco
  priority: string;              // Baixa, Média, Alta, Bloqueante
  description: string;           // Descrição (HTML)
  action_plan: string | null;    // Plano de ação (HTML)
  start_date: string;            // Data de início (ISO 8601)
  forecast_date: string;         // Data de previsão (ISO 8601)
  close_date: string | null;     // Data de fechamento (ISO 8601)
  status: string;                // Aberto, Em Andamento, Concluído, Pendente
  manual_owner: string | null;   // Responsável (texto livre)
  created_at: string;
  updated_at: string;
}
```

#### DbProjectPhase
```typescript
interface DbProjectPhase {
  id: number;                    // PK
  project_id: number;            // FK → projects
  domains_id: number;            // FK → domains
  phase_name: string;            // Nome da fase
  progress: number;              // Progresso real (0-100)
  expected: number | null;       // Progresso esperado (0-100)
  period: number;                // Número da semana
  order: number | null;          // Ordem de exibição
  created_at: string;
  updated_at: string;
}
```

#### DbDomain
```typescript
interface DbDomain {
  id: number;                    // PK
  type: string;                  // risk_type, risk_priority, risk_status, etc.
  value: string;                 // Valor do domínio
  is_active: boolean;            // Ativo/Inativo
  created_at: string;
}
```

#### DbProjectOwner
```typescript
interface DbProjectOwner {
  id: number;                    // PK
  project_id: number;            // FK → projects
  user_id: number;               // FK → users
  users: DbUser | null;          // Join com users
  created_at: string;
  updated_at: string;
}

interface DbUser {
  user_id: number;
  name: string;
  avatar_large_url: string | null;
}
```

### 2.2 Relacionamentos

```
┌──────────────┐         ┌──────────────────┐
│   projects   │ 1     * │      tasks       │
│──────────────│◄────────│──────────────────│
│ project_id   │         │ task_id          │
│ name         │         │ project_id (FK)  │
│ ...          │         │ title            │
└──────────────┘         │ type_name        │
       │                 │ is_closed        │
       │                 │ ...              │
       │                 └──────────────────┘
       │
       │  1             * ┌──────────────────┐
       ├─────────────────►│      risks       │
       │                  │──────────────────│
       │                  │ id               │
       │                  │ project_id (FK)  │
       │                  │ type             │
       │                  │ priority         │
       │                  │ ...              │
       │                  └──────────────────┘
       │
       │  1             * ┌──────────────────┐
       ├─────────────────►│ projects_phase   │
       │                  │──────────────────│
       │                  │ id               │
       │                  │ project_id (FK)  │
       │                  │ phase_name       │
       │                  │ progress         │
       │                  │ period           │
       │                  └──────────────────┘
       │
       │  1             * ┌──────────────────┐
       └─────────────────►│ projects_owner   │
                          │──────────────────│
                          │ id               │
                          │ project_id (FK)  │
                          │ user_id (FK)     │
                          └──────────────────┘
                                  │
                                  │ *      1
                                  ▼
                          ┌──────────────────┐
                          │      users       │
                          │──────────────────│
                          │ user_id          │
                          │ name             │
                          │ avatar_...       │
                          └──────────────────┘

┌──────────────┐         ┌──────────────────┐
│    tasks     │ 1     * │  time_worked     │
│──────────────│◄────────│──────────────────│
│ task_id      │         │ id               │
│ project_id   │         │ project_id       │
└──────────────┘         │ user_id          │
                         │ time (seconds)   │
                         └──────────────────┘

┌──────────────┐         ┌──────────────────┐
│    domains   │ 1     * │      risks       │
│──────────────│────────►│──────────────────│
│ id           │         │ type (value)     │
│ type         │         │ priority (value) │
│ value        │         │ status (value)   │
└──────────────┘         └──────────────────┘

Cardinalidade:
- 1 projeto possui N tarefas
- 1 projeto possui N riscos
- 1 projeto possui N fases (por período)
- 1 projeto possui N owners (N:N via projects_owner)
- 1 tarefa possui N registros de time_worked
- Domains são tabela de referência (lookups)
```

---

## 3. Estratégias de Queries

### 3.1 Query de Tarefas (RPC Function)

**Função**: `get_tasks_with_assignees(p_project_id)`

**Motivação**: 
- Combinar tarefas com múltiplos assignments em uma única query
- Evitar N+1 queries
- Agregação de time_worked no banco

**Implementação Estimada** (SQL):
```sql
SELECT 
  t.*,
  json_agg(
    json_build_object(
      'user_id', u.user_id,
      'name', u.name,
      'avatar_large_url', u.avatar_large_url
    )
  ) FILTER (WHERE u.user_id IS NOT NULL) as assignments
FROM tasks t
LEFT JOIN task_assignments ta ON t.task_id = ta.task_id
LEFT JOIN users u ON ta.user_id = u.user_id
WHERE t.project_id = p_project_id
GROUP BY t.task_id
ORDER BY t.created_at DESC
```

**Resultado**: Array de tasks com assignments já agregados

### 3.2 Query de time_worked

**Query Simples**:
```typescript
supabase
  .from('time_worked')
  .select('user_id, user_name, time')
  .eq('project_id', projectId)
```

**Agregação no Frontend**:
- GroupBy user_id
- Sum time (segundos)
- Conversão para horas

**Alternativa** (caso cresça volume): Criar RPC function para agregar no banco

### 3.3 Query de Riscos com Domains

**Query Base**:
```typescript
supabase
  .from('risks')
  .select('*')
  .eq('project_id', projectId)
```

**Enriquecimento no Frontend**:
- Carrega domains separadamente (tabela pequena, pode ser cacheada)
- Não necessário join no banco (valores são strings)

### 3.4 Query de Fases

**Query Simples**:
```typescript
supabase
  .from('projects_phase')
  .select('*')
  .eq('project_id', projectId)
  .order('period', { ascending: true })
  .order('order', { ascending: true })
```

**Consolidação no Frontend**:
- useMemo para agrupar por domains_id
- Calcula fases mais recentes ou médias

### 3.5 Query de Owners

**Query com Join**:
```typescript
supabase
  .from('projects_owner')
  .select(`
    id, created_at, updated_at, project_id, user_id,
    users(user_id, name, avatar_large_url)
  `)
  .eq('project_id', projectId)
```

**Eager Loading**: Busca users junto com owners em uma query

---

## 4. Algoritmos Complexos

### 4.1 Cálculo da Curva S - Progresso Planejado

**Entrada**:
- tasks: Array de tarefas com gantt_bar_start_date e gantt_bar_end_date
- phaseMapping: Mapeamento de tipos para fases
- phaseWeights: Pesos de cada fase

**Saída**:
- Array de pontos (semana, percentual acumulado)

**Algoritmo**:

```
FUNÇÃO calculateWeeklyAccumulativePlannedProgress(
  currentDate, projectStartDate, projectEndDate,
  phaseSchedule, cumulativeWeights
):
  
  VAR accumulatedProgress = 0
  
  PARA CADA fase EM phaseSchedule:
    SE fase.startDate E fase.endDate EXISTEM:
      SE currentDate >= fase.startDate:
        
        SE currentDate >= fase.endDate:
          // Fase completamente dentro do período
          phaseProgress = 100%
        SENÃO:
          // Fase parcialmente completada
          totalDuration = fase.endDate - fase.startDate
          elapsed = currentDate - fase.startDate
          phaseProgress = (elapsed / totalDuration) * 100%
        
        // Aplicar peso da fase
        phaseWeight = cumulativeWeights[fase.name]
        weightedProgress = phaseProgress * (phaseWeight / 100)
        
        accumulatedProgress += weightedProgress
  
  RETORNAR min(accumulatedProgress, 100)
FIM
```

**Complexidade**: O(n × p) onde n = número de semanas, p = número de fases

**Otimização**: Pre-calcular phaseSchedule e cumulativeWeights

### 4.2 Cálculo da Curva S - Progresso Real

**Entrada**:
- projectPhases: Array de fases cadastradas (progress, period)
- cumulativeWeights: Pesos acumulados das fases

**Saída**:
- Percentual de progresso real para a semana

**Algoritmo**:

```
FUNÇÃO calculateRealProgressForDate(
  targetDate, phaseSchedule, cumulativeWeights
):
  
  VAR targetWeek = calcularSemana(targetDate)
  VAR registeredPhases = FILTRAR projectPhases ONDE period = targetWeek
  
  SE registeredPhases.length = 0:
    RETORNAR 0
  
  VAR weightedProgress = 0
  
  PARA CADA registeredPhase EM registeredPhases:
    VAR phaseName = registeredPhase.phase_name
    VAR phaseProgress = registeredPhase.progress
    VAR phaseWeight = cumulativeWeights[phaseName]
    
    weightedProgress += (phaseProgress * phaseWeight) / 100
  
  RETORNAR min(weightedProgress, 100)
FIM
```

**Complexidade**: O(m) onde m = número de fases cadastradas por semana

### 4.3 Filtragem Avançada de Tarefas (Tracking Tab)

**Entrada**:
- tasks: Array completo de tarefas
- trackingPeriodFilter: 'all' | 'current_week' | 'current_month' | 'last_3_months' | 'current_year'
- trackingStatusFilter: 'open' | 'closed' | 'all'

**Saída**:
- Tasks filtradas + Dados agregados (horas por tipo, status, consultor)

**Algoritmo**:

```
FUNÇÃO getFilteredTasks(tasks, periodFilter, statusFilter):
  
  VAR filtered = CÓPIA DE tasks
  
  // Filtro de Período
  VAR {startDate, endDate} = getDateRange(periodFilter)
  filtered = FILTRAR filtered ONDE task.created_at >= startDate
  
  // Filtro de Status
  SE statusFilter = 'open':
    filtered = FILTRAR filtered ONDE !task.is_closed
  SENÃO SE statusFilter = 'closed':
    filtered = FILTRAR filtered ONDE task.is_closed
  
  RETORNAR filtered
FIM

FUNÇÃO calculateTrackingData(filteredTasks):
  
  // 1. Horas por Tipo de Tarefa
  VAR typeHoursMap = NEW Map<string, {estimated, worked, consultors}>()
  
  PARA CADA task EM filteredTasks:
    VAR type = task.type_name OU 'Sem Tipo'
    
    SE !typeHoursMap.has(type):
      typeHoursMap.set(type, {estimated: 0, worked: 0, consultors: new Map()})
    
    VAR typeData = typeHoursMap.get(type)
    typeData.estimated += task.current_estimate_seconds OU 0
    typeData.worked += task.time_worked OU 0
    
    // Detalhar por consultor
    SE task.assignments:
      PARA CADA assignment EM task.assignments:
        VAR consultor = assignment.name
        SE !typeData.consultors.has(consultor):
          typeData.consultors.set(consultor, {name: consultor, worked: 0})
        
        VAR consultorWorked = calcularHorasPorConsultor(task, assignment.user_id)
        typeData.consultors.get(consultor).worked += consultorWorked
  
  VAR taskTypeHours = CONVERTER typeHoursMap PARA Array E ORDENAR
  
  // 2. Contagem por Status
  VAR statusCountMap = NEW Map<string, number>()
  
  PARA CADA task EM filteredTasks:
    VAR status = task.board_stage_name OU 'Sem Status'
    statusCountMap.set(status, (statusCountMap.get(status) OU 0) + 1)
  
  VAR taskStatusCounts = CONVERTER statusCountMap PARA Array E ORDENAR
  
  // 3. Horas por Consultor
  VAR consultorHoursMap = NEW Map<number, {name, total}>()
  
  PARA CADA task EM filteredTasks:
    SE task.assignments:
      PARA CADA assignment EM task.assignments:
        SE !consultorHoursMap.has(assignment.user_id):
          consultorHoursMap.set(assignment.user_id, {name: assignment.name, total: 0})
        
        VAR consultor = consultorHoursMap.get(assignment.user_id)
        consultor.total += calcularHorasPorConsultor(task, assignment.user_id)
  
  VAR consultors = CONVERTER consultorHoursMap PARA Array E ORDENAR
  
  RETORNAR {taskTypeHours, taskStatusCounts, consultors}
FIM
```

**Complexidade**: O(n × a) onde n = número de tarefas, a = média de assignments por tarefa

**Otimização**: Usar Map para agregações (O(1) lookup)

---

## 5. Gerenciamento de Estado

### 5.1 Estados Locais (useState)

| Estado | Tipo | Descrição |
|--------|------|-----------|
| tasks | DbTask[] | Lista de tarefas do projeto |
| isLoadingTasks | boolean | Flag de loading de tarefas |
| risks | DbRisk[] | Lista de riscos do projeto |
| isLoadingRisks | boolean | Flag de loading de riscos |
| domains | DbDomain[] | Tabela de domínios (lookups) |
| projectOwners | DbProjectOwner[] | Responsáveis do projeto |
| isLoadingProjectOwners | boolean | Flag de loading de owners |
| projectPhases | DbProjectPhase[] | Fases cadastradas |
| isLoadingPhases | boolean | Flag de loading de fases |
| expandedTypes | Set<string> | Tipos expandidos no accordion |
| activeTab | string | Aba ativa (tracking, tasks, risks, etc.) |
| isFullScreen | boolean | Estado de fullscreen do gráfico |
| taskSearchTerm | string | Termo de busca de tarefas |
| selectedTypes | SelectOption[] | Tipos selecionados (filtro) |
| statusFilter | 'Aberto'\|'Fechado'\|'Todos' | Filtro de status de tarefas |
| riskSearchTerm | string | Termo de busca de riscos |
| selectedRiskStatuses | SelectOption[] | Status selecionados (filtro) |
| errorNotification | string\|null | Mensagem de erro para toast |
| successNotification | string\|null | Mensagem de sucesso para toast |
| timeWorkedData | ConsultorHours[] | Dados agregados de time_worked |
| isRiskModalOpen | boolean | Controle de modal de risco |
| selectedRisk | DbRisk\|null | Risco sendo editado |
| trackingPeriodFilter | string | Filtro de período (tracking) |
| trackingStatusFilter | string | Filtro de status (tracking) |
| isProgressModalOpen | boolean | Controle de modal de upload |
| selectedWeek | number | Semana selecionada para upload |
| projectWeeks | {value,label}[] | Lista de semanas do projeto |
| isDeleteRiskConfirmModalOpen | boolean | Controle de modal de confirmação |
| riskToDelete | DbRisk\|null | Risco a ser excluído |

### 5.2 Refs (useRef)

| Ref | Propósito |
|-----|-----------|
| hasLoadedTasks | Evita re-fetch de tarefas |
| hasLoadedTimeWorked | Evita re-fetch de time_worked |
| hasLoadedPhases | Evita re-fetch de fases |
| hasLoadedRisks | Evita re-fetch de riscos |
| hasLoadedDomains | Evita re-fetch de domains |
| hasLoadedOwners | Evita re-fetch de owners |
| statusReportRef | Referência para div do gráfico (fullscreen) |

**Pattern**: Flags booleanas para controlar useEffect

### 5.3 Dados Derivados (useMemo)

| useMemo | Dependências | Propósito |
|---------|--------------|-----------|
| filteredTasks | tasks, taskSearchTerm, selectedTypes, statusFilter | Filtra tarefas para aba Tasks |
| summaryCounts | tasks | Calcula total, ativas, entregues |
| taskHoursSummary | tasks | Soma horas planejadas e trabalhadas |
| filteredTrackingData | tasks, trackingPeriodFilter, trackingStatusFilter | Calcula dados para aba Tracking |
| typeOptions | tasks | Extrai tipos únicos para filtro |
| riskStatusOptions | domains | Extrai status de riscos |
| filteredRisks | risks, riskSearchTerm, selectedRiskStatuses | Filtra riscos para aba Risks |
| progressValue | taskHoursSummary | Calcula % de progresso |
| getConsolidatedPhases | projectPhases | Agrupa fases por domains_id |
| calculateSCurveData | tasks, projectPhases, calculateProjectWeeks | Calcula dados para curva S |
| generateSCurveChartData | calculateSCurveData | Gera pontos para gráfico |
| getCurrentWeekPhases | projectPhases, getCurrentProjectWeek | Fases da semana atual |

**Motivação**: Evitar recalcular dados em cada render

### 5.4 Callbacks (useCallback)

| useCallback | Dependências | Propósito |
|-------------|--------------|-----------|
| getDateRange | trackingPeriodFilter | Calcula startDate/endDate |
| getFilteredTasks | trackingPeriodFilter, trackingStatusFilter, getDateRange | Filtra tarefas tracking |
| toggleTypeExpansion | - | Expande/colapsa accordion |
| handleOwnerChange | project.project_id | Adiciona owner |
| handleOwnerRemove | - | Remove owner |
| calculateProjectWeeks | tasks | Calcula semanas do projeto |
| getCurrentProjectWeek | calculateProjectWeeks, tasks | Determina semana atual |
| calculateRealProgressForDate | projectPhases, tasks | Progresso real de uma data |
| calculateWeeklyAccumulativePlannedProgress | projectPhases | Progresso planejado acumulado |
| calculateDefaultPlannedProgress | - | Progresso padrão (fallback) |
| showErrorNotification | - | Exibe toast de erro |
| showSuccessNotification | - | Exibe toast de sucesso |
| openAddRiskModal | - | Abre modal de criação |
| openEditRiskModal | risks | Abre modal de edição |
| deleteRisk | risks | Abre confirmação de exclusão |
| handleConfirmDeleteRisk | riskToDelete, showErrorNotification, showSuccessNotification | Executa exclusão |
| reloadRisks | project.project_id, domains, showSuccessNotification | Recarrega lista de riscos |

---

## 6. Performance e Otimização

### 6.1 Memoization Strategy

**Níveis de Memoization**:
1. **useMemo**: Cálculos pesados (filtros, agregações, curva S)
2. **useCallback**: Handlers reutilizados (evita re-render de children)
3. **React.memo**: Componentes de cell renderers (evita re-render desnecessário)

**Custo vs. Benefício**:
- useMemo para filteredTasks: **Alto benefício** (evita O(n) em cada render)
- useMemo para calculateSCurveData: **Altíssimo benefício** (complexidade O(n × p × w))
- useCallback para handlers: **Médio benefício** (evita re-criação de funções)

### 6.2 Lazy Loading de Dados

**Estratégia**: Carregar dados apenas quando necessário

**Implementação**:
- useEffect com flags hasLoaded
- Dados carregados uma única vez
- Re-fetch manual após mutations

**Alternativa Futura**: Implementar React Query
- Cache automático
- Invalidação inteligente
- Background refetch

### 6.3 Virtual Scrolling (AG-Grid)

**AG-Grid automaticamente**:
- Renderiza apenas linhas visíveis
- DOM reciclado para linhas fora da viewport
- Column virtualization para muitas colunas

**Configuração**:
```
rowBuffer: 10 (default)
- Renderiza 10 linhas extras acima e abaixo
```

### 6.4 Debouncing de Busca

**Não Implementado Atualmente**:
- Busca é instantânea (onChange direto)
- Para datasets pequenos (<1000), OK
- Para datasets grandes (>1000), implementar debounce de 300ms

**Implementação Sugerida**:
```typescript
import { useDebouncedCallback } from 'use-debounce';

const debouncedSearch = useDebouncedCallback(
  (value) => setTaskSearchTerm(value),
  300
);
```

### 6.5 Bundle Size Optimization

**Bibliotecas Pesadas**:
- AG-Grid Community: ~500KB
- Recharts: ~200KB
- React Quill: ~150KB

**Estratégias de Redução**:
1. **Code Splitting**: Lazy load tabs
   ```typescript
   const TrackingTab = lazy(() => import('./TrackingTab'));
   const TasksTab = lazy(() => import('./TasksTab'));
   ```

2. **Tree Shaking**: Importar apenas componentes necessários
   ```typescript
   import { PieChart, Pie } from 'recharts';
   // Não: import * as Recharts from 'recharts';
   ```

3. **AG-Grid Modules**: Usar módulos específicos (não implementado)
   - Reduz bundle de 500KB para ~200KB

---

## 7. Segurança

### 7.1 Camadas de Segurança

```
┌─────────────────────────────────────────────────────────────┐
│                  Camada 1: Frontend                          │
│  - Validação de inputs                                       │
│  - Sanitização de HTML (React auto-escaping)                │
│  - WYSIWYG editor (ReactQuill) com whitelist                │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                  Camada 2: Supabase Client                   │
│  - JWT Token anexado automaticamente                         │
│  - HTTPS obrigatório                                         │
│  - Query Builder (previne SQL injection)                     │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                  Camada 3: Supabase Backend                  │
│  - Validação de JWT                                          │
│  - Rate Limiting                                             │
│  - RLS (Row Level Security)                                  │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                  Camada 4: PostgreSQL                        │
│  - RLS Policies aplicadas em SELECT/INSERT/UPDATE/DELETE    │
│  - Foreign Key constraints                                   │
│  - Check constraints                                         │
└─────────────────────────────────────────────────────────────┘
```

### 7.2 RLS Policies

**Tabela: tasks**
```sql
CREATE POLICY "Users can view tasks of their projects"
  ON tasks FOR SELECT
  USING (
    project_id IN (
      SELECT project_id FROM projects_owner
      WHERE user_id = auth.uid()
    )
    OR
    auth.uid() IN (SELECT user_id FROM users WHERE role = 'admin')
  );
```

**Tabela: risks**
```sql
CREATE POLICY "Users can manage risks of their projects"
  ON risks FOR ALL
  USING (
    project_id IN (
      SELECT project_id FROM projects_owner
      WHERE user_id = auth.uid()
    )
  );
```

**Tabela: projects_phase**
```sql
CREATE POLICY "Users can manage phases of their projects"
  ON projects_phase FOR ALL
  USING (
    project_id IN (
      SELECT project_id FROM projects_owner
      WHERE user_id = auth.uid()
    )
  );
```

### 7.3 Sanitização de HTML

**ReactQuill (WYSIWYG Editor)**:
- Whitelist de tags permitidas
- Remoção de scripts e event handlers
- Sanitização automática na renderização

**HtmlCellRenderer**:
- Usa `dangerouslySetInnerHTML` (necessário)
- HTML vem de banco (validado na inserção)
- Nunca aceita HTML de usuário diretamente

**Recomendação**: Adicionar DOMPurify
```typescript
import DOMPurify from 'dompurify';

const cleanHTML = DOMPurify.sanitize(dirtyHTML);
```

### 7.4 Validação de Inputs

**Frontend (RiskModal)**:
- Tipo: Obrigatório, deve estar em domains
- Prioridade: Obrigatória, deve estar em domains
- Descrição: Obrigatória, min 10 caracteres
- Datas: Validação de range (início ≤ previsão)
- HTML: Escapado pelo React/ReactQuill

**Backend (Edge Function - import_projects_phase)**:
- Validação de projectId (número positivo)
- Validação de week (número positivo)
- Validação de progress (0-100)
- Validação de expected (0-100)
- Validação de phase_name (string não vazia)

### 7.5 Proteção contra Ataques

**XSS (Cross-Site Scripting)**:
- ✅ React escapa strings automaticamente
- ✅ WYSIWYG com whitelist
- ⚠️ Adicionar DOMPurify em HtmlCellRenderer

**SQL Injection**:
- ✅ Query Builder usa prepared statements
- ✅ Nenhuma concatenação manual de SQL

**CSRF (Cross-Site Request Forgery)**:
- ✅ JWT em header (não em cookie)
- ✅ SameSite cookie policy (Supabase)

**DOS (Denial of Service)**:
- ⚠️ Rate limiting no Supabase (default)
- ⚠️ Implementar debounce em buscas
- ⚠️ Limitar tamanho de CSV upload (max 10MB)

---

## 8. Tratamento de Erros

### 8.1 Estratégia Global

**Hierarquia de Tratamento**:
1. **Try-Catch Local**: Em operações assíncronas
2. **Error State**: Armazenado em errorNotification
3. **NotificationToast**: Feedback visual ao usuário
4. **Console.error**: Log para debugging
5. **Error Boundary**: Fallback para erros não tratados (não implementado)

### 8.2 Categorias de Erros

**Erros de Rede**:
```
Erro ao buscar tarefas: {error.message}
Erro ao buscar riscos: {error.message}
Erro ao carregar fases: {error.message}
```
- **Ação**: Log + Toast + Estado não atualizado

**Erros de Validação**:
```
Por favor, preencha todos os campos obrigatórios
Data de previsão deve ser maior que data de início
Arquivo CSV inválido: {detalhes}
```
- **Ação**: Toast + Manter modal aberto

**Erros de Mutation**:
```
Erro ao salvar risco: {error.message}
Erro ao excluir risco: {error.message}
Erro ao importar progresso: {error.message}
```
- **Ação**: Toast + Rollback de estado

### 8.3 Fallbacks

**Dados Vazios**:
- Grid AG-Grid: "No Rows To Show"
- Gráficos: Mensagem "Sem dados para exibir"
- Accordion: Lista vazia

**Dados Inválidos**:
- Datas null: "-"
- Números null: 0 ou "00h00"
- Strings vazias: "Sem informação"

**Erros Silenciosos**:
- Upload para Storage falha: Log warning (não bloqueia sucesso)
- Domains não carregados: Usa valores raw

---

## 9. Testes

### 9.1 Estratégia de Testes

**Pirâmide de Testes**:
```
        /\
       /  \      E2E (10%)
      /____\
     /      \    Integration (30%)
    /________\
   /          \  Unit (60%)
  /____________\
```

### 9.2 Unit Tests

**Funções Puras**:
- formatDate(dateString)
- formatSecondsToHM(seconds)
- getDateRange(period)
- calculateProjectWeeks(tasks)

**Exemplo**:
```typescript
describe('formatSecondsToHM', () => {
  it('should format 3600 seconds as 01h00', () => {
    expect(formatSecondsToHM(3600)).toBe('01h00');
  });
  
  it('should handle null values', () => {
    expect(formatSecondsToHM(null)).toBe('00h00');
  });
  
  it('should round to nearest minute', () => {
    expect(formatSecondsToHM(3630)).toBe('01h01'); // 3630s = 60.5min
  });
});
```

### 9.3 Integration Tests

**Fluxos Completos**:
- Criar risco → Salvar → Verificar grid atualizado
- Filtrar tarefas → Verificar dados de tracking atualizados
- Upload CSV → Verificar fases atualizadas

**Exemplo com React Testing Library**:
```typescript
it('should filter tasks by search term', async () => {
  const { getByPlaceholderText, getAllByRole } = render(
    <ProjectDetail project={mockProject} onBack={jest.fn()} />
  );
  
  const searchInput = getByPlaceholderText('Buscar tarefas...');
  fireEvent.change(searchInput, { target: { value: 'Desenvolvimento' } });
  
  await waitFor(() => {
    const rows = getAllByRole('row');
    expect(rows).toHaveLength(5); // Apenas tarefas de desenvolvimento
  });
});
```

### 9.4 E2E Tests (Cypress/Playwright)

**Fluxo Crítico**:
```typescript
describe('ProjectDetail - Risk Management', () => {
  it('should create, edit and delete a risk', () => {
    cy.visit('/projects');
    cy.contains('Projeto A').click();
    
    cy.contains('Riscos').click();
    cy.contains('Adicionar Risco').click();
    
    // Preencher modal
    cy.get('[name="type"]').select('Problema');
    cy.get('[name="priority"]').select('Alta');
    cy.get('.ql-editor').type('Descrição do problema');
    // ... mais campos
    
    cy.contains('Salvar').click();
    
    cy.contains('Risco salvo com sucesso!').should('be.visible');
    cy.contains('Descrição do problema').should('be.visible');
    
    // Editar
    cy.get('[title="Editar risco"]').first().click();
    cy.get('.ql-editor').clear().type('Descrição atualizada');
    cy.contains('Salvar').click();
    
    cy.contains('Descrição atualizada').should('be.visible');
    
    // Excluir
    cy.get('[title="Excluir risco"]').first().click();
    cy.contains('Confirmar').click();
    
    cy.contains('Risco excluído com sucesso!').should('be.visible');
    cy.contains('Descrição atualizada').should('not.exist');
  });
});
```

---

## 10. Monitoramento e Observabilidade

### 10.1 Métricas Recomendadas

**Frontend**:
- **Time to Interactive (TTI)**: Tempo até componente ser interativo
- **Largest Contentful Paint (LCP)**: Tempo até maior elemento renderizar
- **First Input Delay (FID)**: Tempo até primeira interação
- **Cumulative Layout Shift (CLS)**: Estabilidade visual

**Queries**:
- **Query Duration**: Tempo de execução de cada query
- **Error Rate**: % de queries que falham
- **Retry Count**: Número de retentativas

**User Behavior**:
- **Tab Switching**: Qual aba é mais acessada
- **Filter Usage**: Quais filtros são mais usados
- **Risk CRUD**: Taxa de criação/edição/exclusão de riscos

### 10.2 Logging Strategy

**Ferramentas Sugeridas**:
- **Sentry**: Captura de erros e performance
- **LogRocket**: Replay de sessões
- **Mixpanel/Amplitude**: Analytics de comportamento

**Implementação**:
```typescript
// Error logging
try {
  await supabase.from('risks').insert(payload);
} catch (error) {
  console.error('Erro ao salvar risco:', error);
  Sentry.captureException(error, {
    tags: {
      component: 'ProjectDetail',
      action: 'save_risk',
      projectId: project.project_id
    }
  });
  showErrorNotification('Erro ao salvar risco');
}

// Performance logging
const startTime = performance.now();
const data = await fetchTasks();
const duration = performance.now() - startTime;

if (duration > 2000) {
  console.warn('Slow query detected:', {
    function: 'fetchTasks',
    duration,
    projectId: project.project_id
  });
}
```

---

## 11. Escalabilidade

### 11.1 Limites Atuais

**Tarefas**:
- Limite Soft: 500 tarefas por projeto
- Limite Hard: 2000 tarefas (performance degrada)

**Riscos**:
- Limite Soft: 100 riscos por projeto
- Limite Hard: 500 riscos

**Fases**:
- Limite: ~100 registros (semanas × fases)

### 11.2 Soluções de Escalabilidade

**Paginação Server-Side**:
```typescript
// Implementar cursor-based pagination
const { data, error } = await supabase
  .from('tasks')
  .select('*')
  .eq('project_id', projectId)
  .range(0, 49) // Página 1: 0-49
  .order('created_at', { ascending: false });

// AG-Grid com Infinite Scroll Model
gridOptions.rowModelType = 'infinite';
```

**Virtual Scrolling Aprimorado**:
- AG-Grid já implementa
- Considerar migrar para Enterprise (melhor performance)

**Caching de Dados**:
```typescript
// Implementar React Query
const { data: tasks, isLoading } = useQuery(
  ['tasks', projectId],
  () => fetchTasks(projectId),
  {
    staleTime: 5 * 60 * 1000, // 5 minutos
    cacheTime: 10 * 60 * 1000, // 10 minutos
  }
);
```

**Agregações no Banco**:
- Mover cálculo de horas por tipo para RPC function
- Reduzir payload de rede
- Processar no servidor (mais rápido)

---

## 12. Integração com Sistemas Externos

### 12.1 Height (Sistema de Tarefas)

**Tipo**: Read-only (visualização)

**Integração**:
```typescript
const handleTaskRowClick = (event: RowClickedEvent<DbTask>) => {
  if (event.data && event.data.task_id) {
    const url = `https://height.app/yourworkspace/T-${event.data.task_id}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  }
};
```

**Considerações**:
- Não há autenticação (URL público do Height)
- Usuário deve ter acesso ao workspace
- Nenhum dado é enviado ao Height

### 12.2 Supabase Edge Functions

**Função**: import_projects_phase

**Endpoint**: 
```
POST https://{project-ref}.supabase.co/functions/v1/import_projects_phase
```

**Payload**:
```json
{
  "projectId": 123,
  "week": 5,
  "phases": [
    {
      "phase_name": "Desenvolvimento",
      "progress": 75,
      "expected": 80
    }
  ]
}
```

**Response**:
```json
{
  "success": true,
  "insertedCount": 3,
  "updatedCount": 2
}
```

**Error Handling**:
- Status 400: Dados inválidos
- Status 401: Não autenticado
- Status 500: Erro interno

### 12.3 Supabase Storage

**Bucket**: ProjectProgress

**Policies**:
- Upload: Apenas usuários autenticados
- Download: Apenas usuários autenticados
- Delete: Apenas criador do arquivo

**Exemplo de Upload**:
```typescript
const filePath = `project_${projectId}_week_${week}_${Date.now()}.csv`;

const { data, error } = await supabase.storage
  .from('ProjectProgress')
  .upload(filePath, csvFile, {
    cacheControl: '3600',
    upsert: false
  });
```

---

## 13. Roadmap de Melhorias

### Curto Prazo (1 mês)
1. ✅ Adicionar Error Boundary
2. ✅ Implementar DOMPurify para HTML
3. ✅ Adicionar debounce em buscas
4. ⏳ Testes unitários (coverage 60%)

### Médio Prazo (3 meses)
1. Migrar para React Query (cache e invalidação)
2. Implementar paginação server-side
3. Adicionar Sentry para error tracking
4. Testes de integração (coverage 30%)
5. Otimizar bundle size (code splitting)

### Longo Prazo (6+ meses)
1. Migrar AG-Grid para Enterprise (melhor performance)
2. Implementar real-time updates (Supabase subscriptions)
3. Adicionar export de dados (PDF/Excel)
4. Dashboard de analytics do projeto
5. Integração bidirecional com Height
6. Testes E2E completos (coverage 10%)

---

## 14. Arquitetura de Refatoração Sugerida

### 14.1 Estrutura de Pastas

```
frontend/src/features/project-detail/
├─ ProjectDetail.tsx (Container)
├─ components/
│  ├─ tabs/
│  │  ├─ TrackingTab.tsx
│  │  ├─ TasksTab.tsx
│  │  ├─ RisksTab.tsx
│  │  ├─ StatusReportTab.tsx
│  │  └─ ProgressUploadTab.tsx
│  ├─ modals/
│  │  ├─ RiskModal.tsx
│  │  ├─ ProjectProgressModal.tsx
│  │  └─ DeleteConfirmModal.tsx
│  ├─ charts/
│  │  ├─ SCurveChart.tsx
│  │  ├─ PieChart.tsx
│  │  └─ PhaseProgressPies.tsx
│  ├─ grids/
│  │  ├─ TasksGrid.tsx
│  │  └─ RisksGrid.tsx
│  └─ cells/
│     ├─ RiskTypeBadge.tsx
│     ├─ RiskPriorityBadge.tsx
│     ├─ RiskStatusBadge.tsx
│     └─ RiskActionsRenderer.tsx
├─ hooks/
│  ├─ useProjectTasks.ts
│  ├─ useProjectRisks.ts
│  ├─ useProjectPhases.ts
│  ├─ useProjectOwners.ts
│  ├─ useTrackingFilters.ts
│  └─ useSCurveCalculations.ts
├─ utils/
│  ├─ formatters.ts
│  ├─ dateCalculations.ts
│  ├─ sCurveAlgorithms.ts
│  └─ csvParser.ts
└─ types.ts
```

### 14.2 Benefícios da Refatoração

1. **Separação de Concerns**: Cada arquivo tem responsabilidade única
2. **Testabilidade**: Componentes menores são mais fáceis de testar
3. **Reusabilidade**: Hooks e utils podem ser reutilizados
4. **Manutenibilidade**: Mais fácil encontrar e modificar código
5. **Performance**: Code splitting mais granular

---

## 15. Considerações Finais

### 15.1 Complexidade do Componente

**Métricas**:
- **Linhas de Código**: ~2700 linhas (muito alto)
- **Estados**: 27 estados (alto)
- **useEffects**: 5 (moderado)
- **useMemos**: 13 (alto)
- **Ciclomatic Complexity**: Alta (muitos branches)

**Recomendação**: Refatorar em componentes menores

### 15.2 Dívida Técnica

**Identificada**:
1. Componente monolítico (dificulta manutenção)
2. Sem testes automatizados
3. Sem error boundary
4. Sem sanitização de HTML (DOMPurify)
5. Cálculos complexos não otimizados (curva S)

**Priorização**:
1. ⚠️ **Alta**: Testes + Error Boundary
2. ⚠️ **Média**: Refatoração em componentes
3. ℹ️ **Baixa**: Otimizações de performance

### 15.3 Pontos Fortes

1. ✅ Uso extensivo de useMemo (evita recalcular)
2. ✅ useRef para controle de lifecycle
3. ✅ NotificationToast com auto-close e pause
4. ✅ Gráficos informativos e interativos
5. ✅ Filtros múltiplos e combinados
6. ✅ WYSIWYG editor para HTML
7. ✅ Upload de CSV com validação
8. ✅ Integração com Height
9. ✅ Dark mode completo
10. ✅ Responsivo

Essa tela é o coração do sistema e demonstra arquitetura sólida, apesar da complexidade.
