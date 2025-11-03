# ProjectDetail - Fluxo Funcional

## Fluxo Principal - Abertura do ProjectDetail

```
[Usuário clica em projeto na listagem]
  ↓
[Projects.tsx captura onRowClicked]
  ↓
[setSelectedProject(project)]
  ↓
[React renderiza ProjectDetail]
  ↓
[ProjectDetail recebe props: project, onBack]
  ↓
[Inicialização de Estados]
  ├─→ tasks: []
  ├─→ risks: []
  ├─→ phases: []
  ├─→ owners: []
  ├─→ activeTab: 'tracking'
  └─→ flags de loading: true
  ↓
[useEffect: Carregamento Paralelo de Dados]
  ├─→ [fetchTasks()] → hasLoadedTasks.current = true
  ├─→ [fetchTimeWorked()] → hasLoadedTimeWorked.current = true
  ├─→ [fetchPhases()] → hasLoadedPhases.current = true
  ├─→ [fetchDomains()] → hasLoadedDomains.current = true
  └─→ [fetchProjectOwners()] → hasLoadedOwners.current = true
  ↓
[Aguarda conclusão de todas as queries]
  ↓
[useMemo: Cálculos Derivados]
  ├─→ filteredTasks
  ├─→ filteredRisks
  ├─→ filteredTrackingData
  ├─→ consolidatedPhases
  ├─→ sCurveData
  └─→ summaryCounts
  ↓
[Renderiza Interface Completa]
  ├─→ Cabeçalho com projeto
  ├─→ Tabs (Acompanhamento, Tarefas, Riscos, Status Report, Upload)
  └─→ Conteúdo da aba ativa
  ↓
[Estado Idle - Aguarda interação]
```

---

## Fluxo de Carregamento de Tarefas

```
[useEffect triggered (project_id mudou)]
  ↓
[Verifica hasLoadedTasks.current]
  ↓
  ├─→ JÁ CARREGOU → [Skip]
  │
  └─→ PRIMEIRA VEZ
        ↓
  [setIsLoadingTasks(true)]
        ↓
  [RPC: get_tasks_with_assignees(p_project_id)]
        ↓
  [PostgreSQL Function executa]
        ↓
        ├─→ ERRO
        │     ↓
        │   [console.error()]
        │     ↓
        │   [setTasks([])]
        │     ↓
        │   [setIsLoadingTasks(false)]
        │     ↓
        │   FIM
        │
        └─→ SUCESSO
              ↓
        [Retorna tasks com assignments]
              ↓
        [setTasks(data)]
              ↓
        [hasLoadedTasks.current = true]
              ↓
        [setIsLoadingTasks(false)]
              ↓
        FIM
```

---

## Fluxo de Filtros na Aba Acompanhamento

```
[Usuário altera filtro de período OU status]
  ↓
[setTrackingPeriodFilter(value)] OU [setTrackingStatusFilter(value)]
  ↓
[useMemo: filteredTrackingData recalcula]
  ↓
[getFilteredTasks(tasks) executado]
  ↓
  ├─→ Filtro de Período
  │     ↓
  │   [getDateRange(trackingPeriodFilter)]
  │     ↓
  │   [Calcula startDate baseado no período]
  │     ├─→ 'all' → 01/01/2020
  │     ├─→ 'current_week' → Segunda-feira da semana
  │     ├─→ 'current_month' → Primeiro dia do mês
  │     ├─→ 'last_3_months' → 90 dias atrás
  │     └─→ 'current_year' → 01/01 do ano
  │     ↓
  │   [Filtra tasks onde created_at >= startDate]
  │
  └─→ Filtro de Status
        ↓
      [Verifica trackingStatusFilter]
        ├─→ 'open' → [Filtra !is_closed]
        ├─→ 'closed' → [Filtra is_closed]
        └─→ 'all' → [Sem filtro]
  ↓
[filtered tasks retornado]
  ↓
[Calcula horas por tipo de tarefa]
  ↓
[Para cada task em filtered]
    ↓
  [Agrupa por type_name]
    ↓
  [Soma estimated_seconds e time_worked]
    ↓
  [Agrupa consultores dentro de cada tipo]
    ↓
  [Converte para array TaskTypeHours]
  ↓
[Calcula contagem por status]
  ↓
[Para cada task em filtered]
    ↓
  [Agrupa por board_stage_name]
    ↓
  [Conta ocorrências]
    ↓
  [Converte para array TaskStatusCount]
  ↓
[Calcula horas por consultor]
  ↓
[Para cada task em filtered]
    ↓
  [Itera sobre assignments]
    ↓
  [Agrupa por user_id]
    ↓
  [Soma time_worked]
    ↓
  [Converte para array ConsultorHours]
  ↓
[Retorna { taskTypeHours, taskStatusCounts, consultors }]
  ↓
[React re-renderiza componentes afetados]
  ↓
  ├─→ Seção "Horas por Tipo" atualizada
  ├─→ Gráfico "Tarefas por Status" atualizado
  └─→ Gráfico "Horas por Consultor" atualizado
  ↓
FIM
```

---

## Fluxo de Criação de Risco

```
[Usuário clica "Adicionar Risco"]
  ↓
[openAddRiskModal() executado]
  ↓
[setSelectedRisk(null)]
  ↓
[setIsRiskModalOpen(true)]
  ↓
[RiskModal renderiza (modo criação)]
  ↓
[Usuário preenche campos]
  ├─→ Tipo (dropdown)
  ├─→ Prioridade (dropdown)
  ├─→ Descrição (WYSIWYG)
  ├─→ Plano de Ação (WYSIWYG)
  ├─→ Data Início (date picker)
  ├─→ Data Previsão (date picker)
  ├─→ Status (dropdown)
  └─→ Responsável (text input)
  ↓
[Usuário clica "Salvar"]
  ↓
[handleSubmit() no RiskModal]
  ↓
[Valida campos obrigatórios]
  ↓
  ├─→ INVÁLIDO
  │     ↓
  │   [Exibe erro no modal]
  │     ↓
  │   [Retorna sem fechar]
  │     ↓
  │   FIM
  │
  └─→ VÁLIDO
        ↓
  [Prepara payload]
        ↓
  [INSERT: supabase.from('risks').insert(payload)]
        ↓
        ├─→ ERRO
        │     ↓
        │   [Exibe erro no modal]
        │     ↓
        │   FIM
        │
        └─→ SUCESSO
              ↓
        [setIsRiskModalOpen(false)]
              ↓
        [reloadRisks() callback executado]
              ↓
        [Query risks novamente]
              ↓
        [Enriquece com domains]
              ↓
        [setRisks(newData)]
              ↓
        [showSuccessNotification('Risco salvo com sucesso!')]
              ↓
        [NotificationToast renderiza]
              ↓
        [Grid de riscos atualiza automaticamente]
              ↓
        FIM
```

---

## Fluxo de Edição de Risco

```
[Usuário clica ícone Editar na linha do risco]
  ↓
[RiskActionsRenderer captura click]
  ↓
[e.stopPropagation()] (evita seleção da linha)
  ↓
[onEdit(data.id) chamado]
  ↓
[openEditRiskModal(riskId) executado]
  ↓
[Busca risco em risks array]
  ↓
[const risk = risks.find(r => r.id === riskId)]
  ↓
  ├─→ NÃO ENCONTRADO → [console.error] → FIM
  │
  └─→ ENCONTRADO
        ↓
  [setSelectedRisk(risk)]
        ↓
  [setIsRiskModalOpen(true)]
        ↓
  [RiskModal renderiza (modo edição)]
        ↓
  [Campos preenchidos com valores do risco]
        ↓
  [Usuário altera campos]
        ↓
  [Clica "Salvar"]
        ↓
  [Valida campos]
        ↓
        ├─→ INVÁLIDO → [Exibe erro] → FIM
        │
        └─→ VÁLIDO
              ↓
        [UPDATE: supabase.from('risks').update(payload).eq('id', risk.id)]
              ↓
              ├─→ ERRO → [Exibe erro] → FIM
              │
              └─→ SUCESSO
                    ↓
              [Fecha modal]
                    ↓
              [reloadRisks()]
                    ↓
              [showSuccessNotification('Risco atualizado com sucesso!')]
                    ↓
              [NotificationToast renderiza]
                    ↓
              [Grid atualiza]
                    ↓
              FIM
```

---

## Fluxo de Exclusão de Risco

```
[Usuário clica ícone Excluir na linha do risco]
  ↓
[RiskActionsRenderer captura click]
  ↓
[e.stopPropagation()]
  ↓
[onDelete(data.id) chamado]
  ↓
[deleteRisk(riskId) executado]
  ↓
[Busca risco em risks array]
  ↓
[const risk = risks.find(r => r.id === riskId)]
  ↓
  ├─→ NÃO ENCONTRADO → FIM
  │
  └─→ ENCONTRADO
        ↓
  [setRiskToDelete(risk)]
        ↓
  [setIsDeleteRiskConfirmModalOpen(true)]
        ↓
  [Modal de Confirmação renderiza]
        ↓
  [Exibe: "Tem certeza que deseja excluir este risco?"]
        ↓
  [Aguarda ação do usuário]
        ↓
        ├─→ CANCELAR
        │     ↓
        │   [setIsDeleteRiskConfirmModalOpen(false)]
        │     ↓
        │   [setRiskToDelete(null)]
        │     ↓
        │   FIM
        │
        └─→ CONFIRMAR
              ↓
        [handleConfirmDeleteRisk() executado]
              ↓
        [Verifica riskToDelete !== null]
              ↓
              ├─→ NULL → FIM
              │
              └─→ VÁLIDO
                    ↓
              [DELETE: supabase.from('risks').delete().eq('id', risk.id)]
                    ↓
                    ├─→ ERRO
                    │     ↓
                    │   [showErrorNotification('Erro ao excluir risco')]
                    │     ↓
                    │   [Fecha modal]
                    │     ↓
                    │   FIM
                    │
                    └─→ SUCESSO
                          ↓
                    [Fecha modal de confirmação]
                          ↓
                    [setRiskToDelete(null)]
                          ↓
                    [reloadRisks()]
                          ↓
                    [showSuccessNotification('Risco excluído com sucesso!')]
                          ↓
                    [NotificationToast renderiza]
                          ↓
                    [Grid de riscos atualiza]
                          ↓
                    FIM
```

---

## Fluxo de Upload de Progresso (CSV)

```
[Usuário acessa aba "Upload de Progresso"]
  ↓
[Seleciona semana no dropdown]
  ↓
[setSelectedWeek(weekNumber)]
  ↓
[Clica "Importar Progress"]
  ↓
[setIsProgressModalOpen(true)]
  ↓
[ProjectProgressModal renderiza]
  ↓
  Props:
    - projectId: project.project_id
    - selectedWeek: selectedWeek
    - onClose: () => setIsProgressModalOpen(false)
    - onSuccess: callback para recarregar
  ↓
[Usuário clica "Escolher Arquivo"]
  ↓
[Input type="file" abre]
  ↓
[Usuário seleciona CSV]
  ↓
[onChange captura file]
  ↓
[setSelectedFile(file)]
  ↓
[Exibe nome do arquivo na UI]
  ↓
[Usuário clica "Importar"]
  ↓
[handleUpload() executado]
  ↓
[Valida selectedFile !== null]
  ↓
  ├─→ NULL → [Exibe erro "Selecione um arquivo"] → FIM
  │
  └─→ VÁLIDO
        ↓
  [setIsUploading(true)]
        ↓
  [FileReader lê arquivo como texto]
        ↓
  [reader.onload triggered]
        ↓
  [csvText = reader.result]
        ↓
  [parseCSV(csvText) executado]
        ↓
        ├─→ Auto-detecta delimitador (vírgula ou ponto-e-vírgula)
        │
        └─→ Parse linhas
              ↓
        [Separa header e rows]
              ↓
        [Valida header: "phase_name,progress,expected"]
              ↓
              ├─→ INVÁLIDO
              │     ↓
              │   [throw Error('Header inválido')]
              │     ↓
              │   [Capturado no catch]
              │     ↓
              │   [showErrorNotification('Formato de CSV inválido')]
              │     ↓
              │   [setIsUploading(false)]
              │     ↓
              │   FIM
              │
              └─→ VÁLIDO
                    ↓
              [Para cada row, cria objeto]
                    ↓
              [Valida valores (progress e expected entre 0-100)]
                    ↓
              [parsedData = array de objetos]
        ↓
  [Prepara payload para edge function]
        ↓
  [POST: supabase.functions.invoke('import_projects_phase', { body })]
        ↓
        ├─→ ERRO
        │     ↓
        │   [showErrorNotification('Erro ao importar: ' + error.message)]
        │     ↓
        │   [setIsUploading(false)]
        │     ↓
        │   FIM
        │
        └─→ SUCESSO
              ↓
        [Upload arquivo para Storage]
              ↓
        [filePath = `project_${projectId}_week_${week}_${timestamp}.csv`]
              ↓
        [supabase.storage.from('ProjectProgress').upload(filePath, file)]
              ↓
              ├─→ ERRO → [Log warning] (não bloqueia sucesso)
              │
              └─→ SUCESSO → [Log success]
              ↓
        [setIsUploading(false)]
              ↓
        [setIsProgressModalOpen(false)]
              ↓
        [onSuccess() callback executado]
              ↓
        [Recarrega projectPhases]
              ↓
        [showSuccessNotification('Progresso importado com sucesso!')]
              ↓
        [NotificationToast renderiza]
              ↓
        [Aba Status Report atualiza automaticamente]
              ↓
        FIM
```

---

## Fluxo de Cálculo da Curva S

```
[useMemo: calculateSCurveData executado]
  ↓
[Define mapeamento de tipos de tarefa para fases]
  ↓
  Mapeamento:
    - Levantamento → [Desenho Funcional, Desenho Técnico]
    - Desenvolvimento → [Desenvolvimento]
    - Homologação → [Certificação]
    - Deploy → [Implantação]
    - Acompanhamento → [Acompanhamento]
  ↓
[Define pesos padrão das fases]
  ↓
  Pesos:
    - Levantamento: 10%
    - Desenvolvimento: 50%
    - Homologação: 20%
    - Deploy: 10%
    - Acompanhamento: 10%
  ↓
[Identifica fases existentes no projeto]
  ↓
[Para cada fase em getConsolidatedPhases]
    ↓
  [Extrai phase_name]
  ↓
[Distribui pesos entre fases existentes]
  ↓
[Calcula pesos cumulativos]
  ↓
[Calcula cronograma de cada fase baseado em tarefas]
  ↓
[Para cada fase]
    ↓
  [Busca tipos de tarefa correspondentes]
    ↓
  [Filtra tasks por type_name]
    ↓
  [Extrai gantt_bar_start_date e gantt_bar_end_date]
    ↓
  [Encontra data de início mais cedo]
    ↓
  [Encontra data de fim mais tarde]
    ↓
  [Calcula progresso atual da fase]
    ↓
    [closedTasks / totalTasks]
    ↓
  [Armazena em phaseSchedule]
  ↓
[Retorna { phaseSchedule, cumulativeWeights, distributedWeights }]
  ↓
FIM
```

---

## Fluxo de Geração de Dados para Gráfico Curva S

```
[generateSCurveChartData() executado]
  ↓
[Recebe calculateSCurveData (phaseSchedule, cumulativeWeights)]
  ↓
[Encontra data de início e fim do projeto]
  ↓
[Extrai todas as datas de phaseSchedule]
  ↓
[projectStartDate = min(all dates)]
  ↓
[projectEndDate = max(all dates)]
  ↓
[Calcula semana atual]
  ↓
[today = new Date()]
  ↓
[weeksDiff = (today - projectStartDate) / 7 dias]
  ↓
[currentWeekNumber = floor(weeksDiff) + 1]
  ↓
[currentWeekLabel = `Sem ${currentWeekNumber}`]
  ↓
[Gera pontos da curva (loop semanal)]
  ↓
[currentDate = projectStartDate]
  ↓
[ENQUANTO currentDate <= projectEndDate]
    ↓
  [Calcula número da semana]
    ↓
  [weekNumber = floor((currentDate - projectStartDate) / 7) + 1]
    ↓
  [Calcula progresso planejado para currentDate]
    ↓
  [calculateWeeklyAccumulativePlannedProgress(currentDate, ...)]
    ↓
    [Para cada fase em phaseSchedule]
      ↓
    [Verifica se currentDate está dentro do range da fase]
      ↓
    [Calcula progresso proporcional]
      ↓
    [Aplica peso da fase]
      ↓
    [Acumula progresso]
    ↓
  [plannedProgress = soma acumulada]
    ↓
  [Calcula progresso real para currentDate]
    ↓
  [calculateRealProgressForDate(currentDate, ...)]
    ↓
    [Determina semana correspondente a currentDate]
      ↓
    [targetWeek = floor((currentDate - projectStartDate) / 7) + 1]
      ↓
    [Busca projectPhases onde period = targetWeek]
      ↓
      ├─→ NÃO ENCONTRADO → [Retorna 0]
      │
      └─→ ENCONTRADO
            ↓
      [Para cada fase cadastrada]
        ↓
      [Multiplica progress pelo peso da fase]
        ↓
      [Soma valores ponderados]
      ↓
    [actualProgress = soma ponderada]
    ↓
  [Adiciona ponto ao dataPoints]
    ↓
    dataPoint: {
      date: `Sem ${weekNumber}`,
      fullDate: currentDate.toLocaleDateString('pt-BR'),
      planned: Math.round(plannedProgress * 10) / 10,
      actual: Math.round(actualProgress * 10) / 10
    }
    ↓
  [Avança currentDate += 7 dias]
  ↓
[FIM DO LOOP]
  ↓
[Calcula barras de fases]
  ↓
[Para cada fase em phaseSchedule com datas válidas]
    ↓
  [Calcula startWeekNumber]
    ↓
  [Calcula endWeekNumber]
    ↓
  [Calcula width (endWeek - startWeek + 1)]
    ↓
  [Cria objeto phaseBar]
    ↓
    phaseBar: {
      name: phase_name,
      startWeekNumber,
      width,
      color
    }
  ↓
[Ordena phaseBars por startWeekNumber]
  ↓
[Retorna { dataPoints, currentWeek: currentWeekLabel, phaseBars }]
  ↓
FIM
```

---

## Fluxo de Gerenciamento de Responsáveis

### Adicionar Responsável

```
[Usuário clica no dropdown de ProjectOwnerRenderer]
  ↓
[Lista de usuários disponíveis carregada]
  ↓
[Usuário seleciona um owner]
  ↓
[handleOwnerChange(newOwner) chamado]
  ↓
[Verifica newOwner !== null]
  ↓
  ├─→ NULL → FIM
  │
  └─→ VÁLIDO
        ↓
  [INSERT: supabase.from('projects_owner').insert({
    project_id,
    user_id: newOwner.user_id
  })]
        ↓
        ├─→ ERRO
        │     ↓
        │   [showErrorNotification('Erro ao adicionar responsável')]
        │     ↓
        │   FIM
        │
        └─→ SUCESSO
              ↓
        [Busca dados completos do novo owner]
              ↓
        [Query: projects_owner com join users]
              ↓
        [Adiciona ao array projectOwners]
              ↓
        [setProjectOwners([...prev, newOwnerData])]
              ↓
        [showSuccessNotification('Responsável adicionado com sucesso!')]
              ↓
        [NotificationToast renderiza]
              ↓
        [Dropdown fecha]
              ↓
        [UI atualiza com novo avatar]
              ↓
        FIM
```

### Remover Responsável

```
[Usuário clica no X do avatar]
  ↓
[handleOwnerRemove(ownerId) chamado]
  ↓
[DELETE: supabase.from('projects_owner').delete().eq('id', ownerId)]
  ↓
  ├─→ ERRO
  │     ↓
  │   [showErrorNotification('Erro ao remover responsável')]
  │     ↓
  │   FIM
  │
  └─→ SUCESSO
        ↓
  [setProjectOwners(prev.filter(o => o.id !== ownerId))]
        ↓
  [showSuccessNotification('Responsável removido com sucesso!')]
        ↓
  [NotificationToast renderiza]
        ↓
  [UI atualiza (avatar desaparece)]
        ↓
  FIM
```

---

## Fluxo de Mudança de Aba

```
[Usuário clica em tab]
  ↓
[setActiveTab(tabName) executado]
  ↓
[React re-renderiza componente]
  ↓
[Renderização condicional baseada em activeTab]
  ↓
  ├─→ 'tracking'
  │     ↓
  │   [Renderiza filtros de período/status]
  │     ↓
  │   [Renderiza seção de horas por tipo]
  │     ↓
  │   [Renderiza gráficos de pizza]
  │
  ├─→ 'tasks'
  │     ↓
  │   [Renderiza filtros de busca/tipo/status]
  │     ↓
  │   [Renderiza cards de resumo]
  │     ↓
  │   [Renderiza AG-Grid com tarefas]
  │
  ├─→ 'risks'
  │     ↓
  │   [Renderiza filtros de busca/status]
  │     ↓
  │   [Renderiza botão "Adicionar Risco"]
  │     ↓
  │   [Renderiza AG-Grid com riscos]
  │
  ├─→ 'status-report'
  │     ↓
  │   [Renderiza botão fullscreen]
  │     ↓
  │   [Renderiza gráfico Curva S]
  │     ↓
  │   [Renderiza gráficos de pizza por fase]
  │
  └─→ 'progress-upload'
        ↓
  [Renderiza informações de semanas]
        ↓
  [Renderiza dropdown de seleção de semana]
        ↓
  [Renderiza botão "Importar Progress"]
  ↓
FIM
```

---

## Diagrama de Estados do Componente

```
┌──────────────────────────────────────────────────────┐
│              Estado Inicial                          │
│  - tasks: []                                         │
│  - risks: []                                         │
│  - phases: []                                        │
│  - activeTab: 'tracking'                             │
│  - todos os loading: true                            │
│  - todos os hasLoaded: false                         │
└────────────────────┬─────────────────────────────────┘
                     ↓
┌──────────────────────────────────────────────────────────┐
│           Carregando Dados (useEffect parallel)          │
│  - 5 queries executadas simultaneamente                  │
│  - flags hasLoaded evitam re-fetch                       │
└────────────────────┬─────────────────────────────────────┘
                     ↓
┌──────────────────────────────────────────────────────────┐
│              Dados Carregados (Idle)                     │
│  - tasks: DbTask[]                                       │
│  - risks: DbRisk[]                                       │
│  - phases: DbProjectPhase[]                              │
│  - useMemo calculou dados derivados                      │
│  - Aguardando interações                                 │
└──────┬───────────────────────────────────────────────────┘
       │
       ├─→ [Mudança de Aba] → [activeTab atualizado] → [Re-render] → [Volta Idle]
       │
       ├─→ [Filtros Alterados] → [useMemo recalcula] → [Re-render] → [Volta Idle]
       │
       ├─→ [Abrir Modal] → [Modal Aberto]
       │                      ↓
       │                [Aguarda ação (Salvar/Cancelar)]
       │                      ↓
       │                      ├─→ SALVAR → [Mutation no DB] → [Recarrega dados] → [Fecha Modal] → [Idle]
       │                      └─→ CANCELAR → [Fecha Modal] → [Idle]
       │
       ├─→ [Clique em Tarefa] → [Abre Height em nova aba] → [Idle]
       │
       └─→ [Botão Voltar] → [onBack() chamado] → [Volta para Projects] → [Desmonta Componente]
```

---

## Notas para Lucidchart

1. **Cores Sugeridas**:
   - Carregamento: Amarelo
   - Sucesso: Verde
   - Erro: Vermelho
   - Processos: Azul claro
   - Decisões: Laranja
   - Estados: Roxo

2. **Swimlanes** (Raias):
   - Raia 1: UI/Usuário
   - Raia 2: Componente React
   - Raia 3: Supabase Client
   - Raia 4: Banco de Dados

3. **Símbolos Especiais**:
   - Paralelogramo: Input/Output
   - Cilindro: Database
   - Nuvem: API externa (Height)

4. **Agrupamentos**:
   - Agrupar fluxos de cada aba
   - Agrupar fluxos de CRUD de riscos
   - Separar cálculos complexos (Curva S)
