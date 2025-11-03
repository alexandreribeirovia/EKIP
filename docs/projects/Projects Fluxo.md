# Projects - Fluxo Funcional

## Fluxo Principal - Listagem de Projetos

```mermaid
flowchart TD
    Start([INÍCIO]) --> Access[Usuário acessa /projects]
    Access --> Auth{Sistema verifica<br/>autenticação}
    Auth -->|NÃO AUTENTICADO| Login[Redireciona para Login]
    Auth -->|AUTENTICADO| CheckLoaded{Já carregou dados?<br/>hasLoadedInitially}
    CheckLoaded -->|JÁ CARREGOU| Cache[Mantém dados em cache]
    CheckLoaded -->|PRIMEIRA VEZ| Fetch[Executa fetchProjects]
    
    Fetch --> Query[Query Supabase:<br/>projects + join projects_owner + users]
    Query --> Order[Ordena por nome ascending]
    Order --> Transform[Transforma dados de owners]
    Transform --> CheckError{Erro?}
    
    CheckError -->|ERRO| ErrorLog[Console.error]
    ErrorLog --> EmptyArray[Mantém array vazio]
    CheckError -->|SUCESSO| SetProjects[setProjects<br/>data transformado]
    SetProjects --> SetFlag[Define hasLoadedInitially = true]
    
    Cache --> Stats
    EmptyArray --> Stats
    SetFlag --> Stats[Calcula estatísticas<br/>totais useMemo]
    
    Stats --> CalcTotal[Total: projects.length]
    Stats --> CalcOpen[Abertos: count is_closed=false]
    Stats --> CalcClosed[Fechados: count is_closed=true]
    
    CalcTotal --> Filters
    CalcOpen --> Filters
    CalcClosed --> Filters[Aplica filtros<br/>useMemo filteredProjects]
    
    Filters --> StatusFilter{Filtro de Status}
    StatusFilter -->|open| FilterOpen[Filtra !is_closed]
    StatusFilter -->|closed| FilterClosed[Filtra is_closed]
    StatusFilter -->|all| NoStatusFilter[Sem filtro]
    
    FilterOpen --> SearchFilter
    FilterClosed --> SearchFilter
    NoStatusFilter --> SearchFilter{searchTerm vazio?}
    
    SearchFilter -->|NÃO| SearchName[Busca em project.name<br/>OU client_name]
    SearchFilter -->|SIM| Render
    SearchName --> Render[Renderiza Interface]
    
    Render --> RenderFilters[Card de Filtros:<br/>Input busca + Dropdown status]
    Render --> RenderStats[Cards de Estatísticas:<br/>Total + Abertos + Fechados]
    Render --> RenderGrid[AG-Grid com<br/>projetos filtrados]
    
    RenderFilters --> Idle
    RenderStats --> Idle
    RenderGrid --> Idle[Aguarda interação<br/>do usuário]
    Idle --> End([FIM - Estado Idle])
    
    style Start fill:#90EE90
    style End fill:#90EE90
    style Auth fill:#FFD700
    style CheckLoaded fill:#FFD700
    style CheckError fill:#FFD700
    style StatusFilter fill:#FFD700
    style SearchFilter fill:#FFD700
    style ErrorLog fill:#FF6B6B
    style Idle fill:#DDA0DD
```

---

## Fluxo de Busca Textual

```mermaid
flowchart TD
    Start([Usuário digita<br/>no campo de busca]) --> OnChange[Evento onChange<br/>capturado]
    OnChange --> Handler[handleSearch value<br/>executado]
    Handler --> SetTerm[setSearchTerm value]
    SetTerm --> Memo[useMemo filteredProjects<br/>recalcula automaticamente]
    
    Memo --> Check{searchTerm<br/>vazio?}
    Check -->|SIM| ReturnStatus[Retorna statusFiltered]
    Check -->|NÃO| Filter[Filtra projects]
    
    Filter --> CheckName[Verifica name.includes searchTerm]
    CheckName --> CheckClient[OU verifica<br/>client_name.includes searchTerm]
    CheckClient --> ReturnFiltered[Retorna array filtrado]
    
    ReturnStatus --> Update
    ReturnFiltered --> Update[AG-Grid atualiza<br/>automaticamente com novos dados]
    Update --> Animate[Animação de linhas<br/>executada animateRows: true]
    Animate --> End([FIM])
    
    style Start fill:#90EE90
    style End fill:#90EE90
    style Check fill:#FFD700
```

---

## Fluxo de Filtro de Status

```mermaid
flowchart TD
    Start([Usuário seleciona<br/>opção no dropdown]) --> OnChange[Evento onChange<br/>capturado]
    OnChange --> SetFilter[setStatusFilter value]
    SetFilter --> Memo[useMemo filteredProjects<br/>recalcula]
    
    Memo --> Check{Valor do filtro}
    Check -->|open| FilterOpen[Retorna projects.filter<br/>!is_closed]
    Check -->|closed| FilterClosed[Retorna projects.filter<br/>is_closed]
    Check -->|all| FilterAll[Retorna todos os projects]
    
    FilterOpen --> ApplySearch
    FilterClosed --> ApplySearch
    FilterAll --> ApplySearch[Aplica filtro de busca<br/>textual se existir]
    
    ApplySearch --> Update[AG-Grid atualiza<br/>com novos dados]
    Update --> End([FIM])
    
    style Start fill:#90EE90
    style End fill:#90EE90
    style Check fill:#FFD700
```

---

## Fluxo de Ordenação de Coluna

```mermaid
flowchart TD
    Start([Usuário clica no<br/>cabeçalho da coluna]) --> Capture[AG-Grid captura<br/>evento de sort]
    Capture --> Check[Verifica sortable: true<br/>na ColDef]
    Check --> Sort[Ordena dados internamente<br/>gerenciado pelo AG-Grid]
    
    Sort --> ClickCount{Número de<br/>cliques}
    ClickCount -->|1º clique| Asc[Ordem crescente]
    ClickCount -->|2º clique| Desc[Ordem decrescente]
    ClickCount -->|3º clique| Remove[Remove ordenação]
    
    Asc --> Render
    Desc --> Render
    Remove --> Render[AG-Grid renderiza<br/>novamente com nova ordem]
    
    Render --> Indicator[Indicador visual de ordenação<br/>atualizado no header]
    Indicator --> End([FIM])
    
    style Start fill:#90EE90
    style End fill:#90EE90
    style ClickCount fill:#FFD700
```

---

## Fluxo de Seleção de Projeto

```mermaid
flowchart TD
    Start([Usuário clica em<br/>qualquer célula da linha]) --> Capture[Evento onRowClicked<br/>capturado]
    Capture --> Handler[handleRowClick event<br/>executado]
    Handler --> Extract[Extrai event.data<br/>DbProject]
    Extract --> SetSelected[setSelectedProject<br/>event.data]
    SetSelected --> Rerender[React re-renderiza<br/>componente]
    
    Rerender --> Check{selectedProject<br/>!== null?}
    Check -->|SIM| RenderDetail[Renderiza ProjectDetail<br/>no lugar da listagem]
    
    RenderDetail --> Props[Props passadas:<br/>project: selectedProject<br/>onBack: handleGoBackToList]
    Props --> LoadDetail[ProjectDetail carrega<br/>e exibe detalhes]
    LoadDetail --> Wait[Aguarda ação<br/>do usuário]
    
    Wait --> Action{Ação do usuário}
    Action -->|Clica Voltar| GoBack[handleGoBackToList]
    Action -->|Navega para outra rota| Router[React Router gerencia]
    
    GoBack --> ClearSelected[setSelectedProject null]
    ClearSelected --> RenderList[Renderiza listagem<br/>novamente]
    
    RenderList --> End1([FIM])
    Router --> End2([FIM])
    
    style Start fill:#90EE90
    style End1 fill:#90EE90
    style End2 fill:#90EE90
    style Check fill:#FFD700
    style Action fill:#FFD700
    style Wait fill:#DDA0DD
```

---

## Fluxo de Cálculo de Estatísticas

```mermaid
flowchart TD
    Start([projects array<br/>atualizado]) --> Memo[useMemo totalStats<br/>executado]
    Memo --> CalcTotal[Calcula total:<br/>projects.length]
    CalcTotal --> CalcOpen[Calcula open:<br/>projects.filter !is_closed.length]
    CalcOpen --> CalcClosed[Calcula closed:<br/>projects.filter is_closed.length]
    CalcClosed --> Return[Retorna objeto<br/>total open closed]
    Return --> Render[React renderiza cards<br/>com novos valores]
    Render --> End([FIM])
    
    style Start fill:#90EE90
    style End fill:#90EE90
```

---

## Fluxo de Transformação de Owners

```mermaid
flowchart TD
    Start([Recebe data<br/>do Supabase]) --> ForEach[Para cada project<br/>em data]
    ForEach --> MapOwner[Mapeia<br/>project.projects_owner]
    MapOwner --> ForEachOwner[Para cada ownerData<br/>em projects_owner]
    
    ForEachOwner --> CheckArray{ownerData.users<br/>é array com<br/>length > 0?}
    CheckArray -->|SIM| GetFirst[userData =<br/>ownerData.users 0]
    CheckArray -->|NÃO| GetDirect[userData =<br/>ownerData.users]
    
    GetFirst --> CreateOwner
    GetDirect --> CreateOwner[Cria objeto owner formatado]
    
    CreateOwner --> SetId[id: ownerData.id]
    CreateOwner --> SetCreated[created_at: ownerData.created_at]
    CreateOwner --> SetUpdated[updated_at: ownerData.updated_at]
    CreateOwner --> SetProjectId[project_id: ownerData.project_id]
    CreateOwner --> SetUserId[user_id: ownerData.user_id]
    CreateOwner --> SetUsers[users: user_id, name,<br/>avatar_large_url]
    
    SetId --> Filter
    SetCreated --> Filter
    SetUpdated --> Filter
    SetProjectId --> Filter
    SetUserId --> Filter
    SetUsers --> Filter[Filtra owners<br/>onde users !== null]
    
    Filter --> Return[Retorna<br/>projectsWithOwners]
    Return --> SetProjects[setProjects<br/>projectsWithOwners]
    SetProjects --> End([FIM])
    
    style Start fill:#90EE90
    style End fill:#90EE90
    style CheckArray fill:#FFD700
```

---

## Fluxo de Formatação de Dados

### Formatação de Datas
```mermaid
flowchart TD
    Start([Recebe dateString]) --> CheckNull{dateString<br/>é null?}
    CheckNull -->|SIM| ReturnDash[Retorna -]
    CheckNull -->|NÃO| NewDate[new Date dateString]
    NewDate --> ToLocal[toLocaleDateString pt-BR]
    ToLocal --> ReturnFormatted[Retorna DD/MM/YYYY]
    
    ReturnDash --> End([FIM])
    ReturnFormatted --> End
    
    style Start fill:#90EE90
    style End fill:#90EE90
    style CheckNull fill:#FFD700
```

### Formatação de Horas
```mermaid
flowchart TD
    Start([Recebe seconds]) --> CheckZero{seconds é<br/>null ou 0?}
    CheckZero -->|SIM| ReturnZero[Retorna 0.00h]
    CheckZero -->|NÃO| Calc[Calcula: seconds / 3600]
    Calc --> Fixed[hours.toFixed 2]
    Fixed --> ReturnFormatted[Retorna X.XXh]
    
    ReturnZero --> End([FIM])
    ReturnFormatted --> End
    
    style Start fill:#90EE90
    style End fill:#90EE90
    style CheckZero fill:#FFD700
```

---

## Fluxo de Tratamento de Erro

```mermaid
flowchart TD
    Start([fetchProjects<br/>executado]) --> Query[Query Supabase retorna]
    Query --> CheckError{error !== null?}
    
    CheckError -->|ERRO| LogError[console.error<br/>Erro ao buscar projetos]
    LogError --> NoUpdate[Não atualiza state]
    NoUpdate --> EmptyArray[projects permanece<br/>como array vazio]
    EmptyArray --> ShowEmpty[Grid exibe<br/>No Rows To Show]
    ShowEmpty --> End1([FIM])
    
    CheckError -->|SUCESSO| Process[Processa e<br/>transforma dados]
    Process --> SetProjects[setProjects data]
    SetProjects --> End2([FIM])
    
    style Start fill:#90EE90
    style End1 fill:#90EE90
    style End2 fill:#90EE90
    style CheckError fill:#FFD700
    style LogError fill:#FF6B6B
    style NoUpdate fill:#FF6B6B
    style EmptyArray fill:#FF6B6B
    style ShowEmpty fill:#FF6B6B
```

---

## Fluxo de Responsividade

```mermaid
flowchart TD
    Start([Tela carregada]) --> Detect[TailwindCSS detecta<br/>viewport width]
    
    Detect --> CheckSize{Tamanho da tela}
    CheckSize -->|≥1024px DESKTOP| Desktop[Filtros em linha lg:flex-row<br/>Cards em grid 3 colunas<br/>Grid com largura total]
    CheckSize -->|768px-1023px TABLET| Tablet[Filtros empilhados<br/>Cards em grid 3 colunas<br/>Grid com scroll horizontal]
    CheckSize -->|<768px MOBILE| Mobile[Filtros empilhados flex-col<br/>Cards em grid 2 colunas<br/>Grid com scroll horizontal]
    
    Desktop --> Apply[CSS classes aplicadas<br/>automaticamente]
    Tablet --> Apply
    Mobile --> Apply
    
    Apply --> End([FIM])
    
    style Start fill:#90EE90
    style End fill:#90EE90
    style CheckSize fill:#FFD700
```

---

## Diagrama de Estados do Componente

```mermaid
stateDiagram-v2
    [*] --> EstadoInicial
    
    EstadoInicial: Estado Inicial
    note right of EstadoInicial
        projects: []
        searchTerm: ''
        statusFilter: 'open'
        selectedProject: null
        hasLoadedInitially.current: false
    end note
    
    EstadoInicial --> CarregandoDados
    
    CarregandoDados: Carregando Dados (useEffect)
    note right of CarregandoDados
        fetchProjects() executado
        hasLoadedInitially.current = true
    end note
    
    CarregandoDados --> ListagemAtiva
    
    ListagemAtiva: Listagem Ativa (Idle)
    note right of ListagemAtiva
        projects: DbProject[]
        filteredProjects calculado
        totalStats calculado
        Aguardando interações
    end note
    
    ListagemAtiva --> ListagemAtiva: Busca/Filtro\n(Recalcula filteredProjects)
    ListagemAtiva --> ListagemAtiva: Ordenação\n(AG-Grid ordena)
    ListagemAtiva --> DetalhesAbertos: Clique em Linha\n(selectedProject definido)
    
    DetalhesAbertos: Detalhes Abertos
    note right of DetalhesAbertos
        ProjectDetail ativo
        Listagem oculta
    end note
    
    DetalhesAbertos --> ListagemAtiva: Botão Voltar\n(selectedProject = null)
```

---

## Notas sobre os Diagramas Mermaid

### Visualização
- **VS Code**: Instale a extensão "Markdown Preview Mermaid Support" ou use a visualização nativa (preview disponível desde VS Code 1.72+)
- **GitHub**: Os diagramas Mermaid são renderizados automaticamente
- **GitLab**: Suporte nativo a Mermaid
- **Navegador**: Use extensões como "Markdown Viewer" com suporte Mermaid

### Legenda de Cores
- 🟢 **Verde** (#90EE90): Início/Fim dos fluxos
- 🟡 **Amarelo** (#FFD700): Decisões e pontos de escolha
- 🔴 **Vermelho** (#FF6B6B): Erros e estados de falha
- 🟣 **Roxo** (#DDA0DD): Estados de espera/idle
- 🔵 **Azul** (padrão): Processos normais

### Símbolos Utilizados
- **([texto])**: Início/Fim do fluxo (círculos arredondados)
- **[texto]**: Processo/Ação (retângulos)
- **{texto}**: Decisão/Condição (losangos)
- **Note**: Anotações explicativas

### Edição dos Diagramas
Para editar os diagramas, altere o conteúdo dentro dos blocos \`\`\`mermaid.
Documentação completa: https://mermaid.js.org/
