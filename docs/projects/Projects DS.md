# Projects - Desenho de Solução (DS)

## 1. Visão Arquitetural

### 1.1 Arquitetura de Camadas

```
┌─────────────────────────────────────────────────────────────┐
│                    CAMADA DE APRESENTAÇÃO                    │
│                      (React Components)                       │
├─────────────────────────────────────────────────────────────┤
│  Projects.tsx (Container Component)                          │
│  │                                                            │
│  ├─→ Layout.tsx (Wrapper com navegação)                      │
│  ├─→ AG-Grid (Biblioteca de Grid)                            │
│  ├─→ ProjectOwnersGridRenderer (Cell Renderer)               │
│  └─→ ProjectDetail.tsx (Sub-componente de detalhes)          │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                   CAMADA DE ESTADO (State)                   │
├─────────────────────────────────────────────────────────────┤
│  React Hooks:                                                │
│  - useState (projects, searchTerm, statusFilter, etc.)       │
│  - useMemo (filteredProjects, totalStats)                    │
│  - useRef (hasLoadedInitially)                               │
│  - useEffect (fetchProjects lifecycle)                       │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                  CAMADA DE INTEGRAÇÃO                        │
├─────────────────────────────────────────────────────────────┤
│  Supabase Client (@supabase/supabase-js)                     │
│  - Autenticação JWT                                          │
│  - Query Builder                                             │
│  - Real-time subscriptions (não usado nesta tela)            │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                   CAMADA DE DADOS                            │
├─────────────────────────────────────────────────────────────┤
│  Supabase PostgreSQL Database                                │
│  - Tabela: projects                                          │
│  - Tabela: projects_owner                                    │
│  - Tabela: users                                             │
│  - RLS Policies aplicadas                                    │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Modelo de Dados

### 2.1 Entidades Principais

#### DbProject (Interface TypeScript)
```
DbProject {
  project_id: number (PK)
  name: string
  client_name: string
  start_date: string | null (ISO 8601)
  close_date: string | null (ISO 8601)
  is_closed: boolean
  tasks_count: number | null
  tasks_closed_count: number | null
  tasks_working_on_count: number | null
  tasks_queued_count: number | null
  time_total: number | null (segundos)
  created_at: string
  updated_at: string
  owners: DbProjectOwner[] (transformado)
}
```

#### DbProjectOwner (Interface TypeScript)
```
DbProjectOwner {
  id: number (PK)
  created_at: string
  updated_at: string
  project_id: number (FK → projects)
  user_id: number (FK → users)
  users: DbUser | null {
    user_id: number
    name: string
    avatar_large_url: string | null
  }
}
```

### 2.2 Relacionamentos

```
┌──────────────┐         ┌────────────────────┐         ┌──────────────┐
│   projects   │ 1     * │  projects_owner    │ *     1 │    users     │
│──────────────│◄────────│────────────────────│────────►│──────────────│
│ project_id   │         │ id                 │         │ user_id      │
│ name         │         │ project_id (FK)    │         │ name         │
│ client_name  │         │ user_id (FK)       │         │ avatar_...   │
│ start_date   │         │ created_at         │         │ ...          │
│ close_date   │         │ updated_at         │         │              │
│ is_closed    │         │                    │         │              │
│ tasks_count  │         │                    │         │              │
│ ...          │         │                    │         │              │
└──────────────┘         └────────────────────┘         └──────────────┘

Cardinalidade:
- 1 projeto pode ter N responsáveis (projects_owner)
- 1 usuário pode ser responsável por N projetos
- Relacionamento N:N via tabela associativa projects_owner
```

---

## 3. Fluxo de Dados

### 3.1 Query Strategy

**Tipo**: Eager Loading com Join

**Motivação**: 
- Minimizar round trips ao banco
- Carregar owners junto com projetos em uma única query
- Reduzir latência de rede

**Implementação**:
```
Query Supabase:
  from('projects')
  .select(`
    *,
    projects_owner(
      id, created_at, updated_at, project_id, user_id,
      users(user_id, name, avatar_large_url)
    )
  `)
  .order('name', { ascending: true })
```

**Transformação Pós-Query**:
1. Mapeia cada projeto
2. Para cada `projects_owner`, extrai dados de `users`
3. Lida com inconsistências (users como array vs objeto)
4. Filtra owners sem dados válidos de usuário
5. Retorna estrutura limpa e tipada

### 3.2 Data Flow Diagram

```
[Componente Monta]
        ↓
[useEffect triggered]
        ↓
[Verifica hasLoadedInitially.current]
        ↓
        ├─→ JÁ CARREGOU → [Skip]
        │
        └─→ PRIMEIRA VEZ
                ↓
        [fetchProjects()]
                ↓
        [Supabase Query com Joins]
                ↓
        [PostgreSQL executa]
                ↓
        [Retorna JSON com nested objects]
                ↓
        [Transform owners structure]
                ↓
        [setProjects(transformedData)]
                ↓
        [hasLoadedInitially.current = true]
                ↓
        [React Re-render]
                ↓
        [useMemo: filteredProjects]
                ↓
        [useMemo: totalStats]
                ↓
        [AG-Grid recebe rowData]
                ↓
        [Renderização Final]
```

---

## 4. Componentes e Responsabilidades

### 4.1 Projects (Container Component)

**Responsabilidades**:
- Gerenciar estado da listagem
- Executar fetch de dados
- Aplicar filtros e busca
- Calcular estatísticas
- Orquestrar navegação entre listagem e detalhes

**Hooks Utilizados**:
- `useState`: Estado mutável (projects, searchTerm, statusFilter, selectedProject)
- `useMemo`: Cálculos derivados (filteredProjects, totalStats)
- `useRef`: Controle de lifecycle (hasLoadedInitially)
- `useEffect`: Side effects (fetch inicial)

**Props Recebidas**: Nenhuma (route component)

**Props Enviadas**:
- Para ProjectDetail: `project`, `onBack`
- Para AG-Grid: `columnDefs`, `rowData`, callbacks

### 4.2 ProjectOwnersGridRenderer (Cell Renderer)

**Responsabilidades**:
- Renderizar avatares dos responsáveis
- Exibir fallback quando não há avatar
- Limitar exibição visual (max 3 avatares visíveis)

**Props**:
- `data`: DbProject (linha completa do grid)

**Renderização**:
- Itera sobre `data.owners`
- Exibe imagem circular para cada owner com avatar
- Exibe inicial do nome se não há avatar
- Usa Tooltip para mostrar nome completo

### 4.3 AG-Grid Configuration

**Configurações Globais**:
- `pagination`: false (scroll infinito)
- `rowSelection`: 'single'
- `animateRows`: true
- `rowHeight`: 48px
- `headerHeight`: 48px
- `defaultColDef`: { sortable: true, filter: true, resizable: true }

**Column Definitions**:
- Cada coluna com headerName, field, flex/width, minWidth
- Colunas numéricas: type='numericColumn' (alinhamento à direita)
- Formatadores customizados: valueFormatter para datas e horas
- Cell Renderers: ProjectOwnersGridRenderer para owners

---

## 5. Segurança

### 5.1 Autenticação

**Mecanismo**: Supabase Auth com JWT

**Fluxo**:
1. Usuário faz login via Supabase Auth
2. Token JWT armazenado em localStorage
3. Zustand store gerencia sessão
4. `<ProtectedRoute>` wrapper verifica autenticação
5. Supabase Client anexa token automaticamente em todas as requests

**Proteção de Rotas**:
```
<ProtectedRoute>
  <Projects />
</ProtectedRoute>
```

Se não autenticado → Redirect para /login

### 5.2 Autorização

**Row Level Security (RLS)** aplicado no Supabase:

**Tabela `projects`**:
- Policy: Permitir SELECT para usuários autenticados
- Verificação: `auth.uid()` não é null

**Tabela `projects_owner`**:
- Policy: Permitir SELECT para usuários autenticados
- Join permitido via FK

**Tabela `users`**:
- Policy: Permitir SELECT de dados públicos (name, avatar)
- Dados sensíveis (senha, email) não retornados

### 5.3 Sanitização de Dados

**Entrada de Usuário**:
- Busca textual: Sanitizada via `.toLowerCase()` e `.includes()`
- Nenhum input é enviado diretamente ao banco (não há SQL injection risk)

**Saída de Dados**:
- Datas: Validadas antes de conversão
- Números: Verificação de null/undefined antes de operações
- Strings: Renderizadas via React (auto-escaping de XSS)

### 5.4 Proteção contra Vulnerabilidades

**XSS (Cross-Site Scripting)**:
- React escapa automaticamente strings em JSX
- Nenhum uso de `dangerouslySetInnerHTML`
- Dados de usuário não executados como código

**CSRF (Cross-Site Request Forgery)**:
- Supabase usa tokens JWT (stateless)
- Token não armazenado em cookies (immune a CSRF)

**SQL Injection**:
- Supabase Query Builder usa prepared statements
- Nenhuma concatenação manual de SQL

---

## 6. Performance e Otimização

### 6.1 Estratégias de Memoization

**useMemo para filteredProjects**:
- **Dependências**: `searchTerm`, `statusFilter`, `projects`
- **Benefício**: Evita recalcular filtros em cada render
- **Custo**: O(n) onde n = número de projetos

**useMemo para totalStats**:
- **Dependências**: `projects`
- **Benefício**: Estatísticas calculadas apenas quando projects muda
- **Custo**: O(n) com 3 iterações

### 6.2 Lazy Loading

**Dados**:
- Não implementado (carrega todos os projetos de uma vez)
- **Consideração futura**: Implementar paginação server-side para projetos > 1000

**Componentes**:
- ProjectDetail carregado apenas quando selecionado
- Renderização condicional evita instanciar componente desnecessário

### 6.3 AG-Grid Optimizations

**Virtual Scrolling**:
- AG-Grid renderiza apenas linhas visíveis
- DOM reciclado para linhas fora da viewport

**Column Virtualization**:
- Apenas colunas visíveis são renderizadas
- Scroll horizontal otimizado

### 6.4 Network Optimization

**Single Query Strategy**:
- 1 request para buscar projects + owners + users
- Evita N+1 query problem

**Payload Size**:
- Select apenas campos necessários
- Avatars carregados via CDN (não incluídos no payload JSON)

### 6.5 Re-render Prevention

**useRef para hasLoadedInitially**:
- Evita re-fetch desnecessário
- Não causa re-render quando atualizado

**useCallback para handlers** (não implementado):
- **Oportunidade de melhoria**: Adicionar useCallback para handleSearch, handleRowClick

---

## 7. Tratamento de Erros

### 7.1 Estratégia de Error Handling

**Erro de Rede/Supabase**:
- Capturado via verificação de `error` no retorno
- Logado no console (desenvolvimento)
- Estado não atualizado (mantém array vazio)
- Grid exibe mensagem padrão "No Rows To Show"

**Erro de Transformação de Dados**:
- Validações defensivas (verificar null/undefined)
- Filtros para remover dados inválidos
- Nunca lança exceções não tratadas

### 7.2 Error Boundaries

**Não Implementado**:
- Componente não possui Error Boundary
- **Recomendação**: Adicionar Error Boundary no nível de rota

**Implementação Sugerida**:
```
<ErrorBoundary fallback={<ErrorFallback />}>
  <Projects />
</ErrorBoundary>
```

### 7.3 Fallbacks

**Dados Vazios**:
- Grid exibe mensagem nativa do AG-Grid
- Cards de estatísticas mostram 0

**Dados Inválidos**:
- Datas null → "-"
- Números null → 0 ou "0.00h"
- Arrays vazios → Renderização vazia (sem erro)

---

## 8. Testes

### 8.1 Estratégia de Testes (Recomendada)

**Unit Tests**:
- Testar funções puras: `formatDate`, `formatSecondsToHours`
- Testar lógica de filtros: `filteredProjects` logic
- Testar cálculos: `totalStats` logic
- Testar transformação de owners

**Integration Tests**:
- Testar fetchProjects com mock do Supabase
- Testar interação entre filtros e grid
- Testar navegação para ProjectDetail

**E2E Tests**:
- Testar fluxo completo: Login → Projects → Busca → Seleção → Detalhes
- Testar responsividade em diferentes viewports

### 8.2 Mocking Strategy

**Supabase Mock**:
```
Mock da biblioteca @supabase/supabase-js
Retornar { data: mockProjects, error: null }
Simular delays de rede
Testar cenários de erro
```

**AG-Grid Mock**:
```
Não mockar AG-Grid (renderizar componente real)
Testar interações via eventos simulados
```

---

## 9. Acessibilidade (a11y)

### 9.1 WCAG 2.1 Compliance

**Nível AA** (parcialmente implementado):

**Perceivable**:
- ✅ Contraste de cores adequado (light/dark mode)
- ✅ Texto escalável (rem units)
- ⚠️ Alt text em avatares (faltando)

**Operable**:
- ✅ Navegação por teclado (AG-Grid suporta)
- ✅ Focus visível (ring laranja)
- ⚠️ Skip links (não implementado)

**Understandable**:
- ✅ Labels descritivos (placeholders)
- ✅ Mensagens de erro claras
- ⚠️ Instruções para screen readers (faltando)

**Robust**:
- ✅ HTML semântico
- ✅ ARIA roles (AG-Grid gerencia)
- ⚠️ Testes com screen readers (não realizados)

### 9.2 Melhorias Recomendadas

1. Adicionar `alt` text em avatares
2. Adicionar `aria-label` em botões sem texto
3. Implementar skip links
4. Adicionar anúncios para screen readers ao filtrar
5. Testar com NVDA/JAWS

---

## 10. Escalabilidade

### 10.1 Considerações de Escala

**Volume de Dados**:
- **Atual**: ~100-500 projetos
- **Limite Soft**: ~1000 projetos (performance aceitável)
- **Limite Hard**: ~5000 projetos (necessário paginação)

**Soluções para Crescimento**:
1. **Server-Side Pagination**:
   - Implementar cursor-based pagination no Supabase
   - Carregar 50 projetos por página
   - Lazy load ao fazer scroll

2. **Server-Side Filtering**:
   - Mover filtros para query SQL
   - Reduzir payload de rede

3. **Caching Strategy**:
   - Implementar React Query ou SWR
   - Cache de 5 minutos para projetos
   - Invalidação ao criar/editar projeto

### 10.2 Horizontal Scaling

**Frontend**:
- React app é stateless (pode escalar horizontalmente)
- CDN para assets estáticos

**Backend (Supabase)**:
- PostgreSQL com read replicas
- Connection pooling (Supavisor)
- CDN para avatares (já implementado)

---

## 11. Monitoramento e Observabilidade

### 11.1 Logging

**Atual**:
- `console.error` para erros de fetch
- Sem logging estruturado

**Recomendado**:
- Integrar Sentry ou LogRocket
- Logar performance de queries
- Capturar erros de usuário

### 11.2 Métricas

**Frontend Metrics**:
- Time to Interactive (TTI)
- First Contentful Paint (FCP)
- Tempo de load da query
- Taxa de erro de fetch

**User Behavior**:
- Termos de busca mais usados
- Filtros mais aplicados
- Projetos mais acessados

---

## 12. Dependências Externas

### 12.1 Bibliotecas

| Biblioteca | Versão | Propósito | Criticidade |
|-----------|--------|-----------|-------------|
| React | 18.x | UI Framework | Alta |
| AG-Grid React | Latest | Data Grid | Alta |
| AG-Grid Community | Latest | Grid Core | Alta |
| Supabase JS | Latest | Backend Client | Alta |
| Lucide React | Latest | Ícones | Média |
| Tailwind CSS | 3.x | Styling | Média |
| React Router | 6.x | Routing | Alta |

### 12.2 Riscos de Dependências

**AG-Grid**:
- **Risco**: Mudanças de API em major versions
- **Mitigação**: Fixar version minor, testar antes de upgrade

**Supabase**:
- **Risco**: Downtime do serviço
- **Mitigação**: Implementar fallbacks, circuit breakers

---

## 13. Diagrama de Arquitetura Completo

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              FRONTEND (React)                            │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────┐    │
│  │                    Projects.tsx (Container)                     │    │
│  │                                                                 │    │
│  │  ┌──────────────┐  ┌──────────────┐  ┌───────────────────┐   │    │
│  │  │   State      │  │  Memoized    │  │  Event Handlers   │   │    │
│  │  │              │  │  Computed    │  │                   │   │    │
│  │  │ - projects   │  │  Values      │  │ - handleSearch    │   │    │
│  │  │ - searchTerm │  │              │  │ - handleRowClick  │   │    │
│  │  │ - filters    │  │ - filtered   │  │ - handleGoBack    │   │    │
│  │  │ - selected   │  │ - stats      │  │                   │   │    │
│  │  └──────────────┘  └──────────────┘  └───────────────────┘   │    │
│  │                                                                 │    │
│  │  ┌──────────────────────────────────────────────────────────┐ │    │
│  │  │                  Conditional Rendering                    │ │    │
│  │  │                                                            │ │    │
│  │  │  selectedProject === null                                 │ │    │
│  │  │    ├─→ Render Listagem                                    │ │    │
│  │  │    │   ├─→ Filtros                                        │ │    │
│  │  │    │   ├─→ Stats Cards                                    │ │    │
│  │  │    │   └─→ AG-Grid                                        │ │    │
│  │  │    │                                                       │ │    │
│  │  │  selectedProject !== null                                 │ │    │
│  │  │    └─→ Render ProjectDetail                               │ │    │
│  │  │        └─→ Props: project, onBack                         │ │    │
│  │  └──────────────────────────────────────────────────────────┘ │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                         AG-Grid Component                        │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │   │
│  │  │  Column Defs │  │   Row Data   │  │  Cell Renderers      │  │   │
│  │  │              │  │              │  │                      │  │   │
│  │  │ - headerName │  │ filtered     │  │ - ProjectOwners...   │  │   │
│  │  │ - field      │  │ Projects     │  │ - formatters         │  │   │
│  │  │ - formatters │  │              │  │                      │  │   │
│  │  └──────────────┘  └──────────────┘  └──────────────────────┘  │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                          │
└──────────────────────────────┬───────────────────────────────────────────┘
                               │
                               │ HTTPS + JWT Token
                               │
┌──────────────────────────────▼───────────────────────────────────────────┐
│                     SUPABASE CLIENT LIBRARY                              │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│  ┌─────────────────┐  ┌──────────────────┐  ┌────────────────────────┐ │
│  │  Auth Module    │  │  Query Builder   │  │  Real-time (unused)    │ │
│  │                 │  │                  │  │                        │ │
│  │ - JWT Token     │  │ - .from()        │  │ - subscriptions        │ │
│  │ - Session Mgmt  │  │ - .select()      │  │                        │ │
│  │ - Auto-refresh  │  │ - .eq()          │  │                        │ │
│  └─────────────────┘  └──────────────────┘  └────────────────────────┘ │
│                                                                           │
└──────────────────────────────┬────────────────────────────────────────────┘
                               │
                               │ PostgreSQL Protocol (port 5432)
                               │
┌──────────────────────────────▼────────────────────────────────────────────┐
│                       SUPABASE POSTGRESQL                                 │
├───────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│  ┌──────────────────────┐                                                 │
│  │   Database Schema    │                                                 │
│  │                      │                                                 │
│  │  ┌────────────────┐  │  ┌─────────────────────┐  ┌───────────────┐  │
│  │  │   projects     │◄─┼──┤  projects_owner     │──┼─►│    users     │  │
│  │  │                │  │  │                     │  │  │              │  │
│  │  │ project_id PK  │  │  │ id PK               │  │  │ user_id PK   │  │
│  │  │ name           │  │  │ project_id FK       │  │  │ name         │  │
│  │  │ client_name    │  │  │ user_id FK          │  │  │ avatar_...   │  │
│  │  │ is_closed      │  │  │                     │  │  │              │  │
│  │  │ tasks_count    │  │  │                     │  │  │              │  │
│  │  │ time_total     │  │  │                     │  │  │              │  │
│  │  │ ...            │  │  │                     │  │  │              │  │
│  │  └────────────────┘  │  └─────────────────────┘  └───────────────┘  │
│  │                      │                                                 │
│  └──────────────────────┘                                                 │
│                                                                            │
│  ┌──────────────────────────────────────────────────────────────────┐    │
│  │                    Row Level Security (RLS)                       │    │
│  │                                                                   │    │
│  │  Policy: projects_select                                         │    │
│  │    USING (auth.uid() IS NOT NULL)                                │    │
│  │                                                                   │    │
│  │  Policy: projects_owner_select                                   │    │
│  │    USING (auth.uid() IS NOT NULL)                                │    │
│  │                                                                   │    │
│  │  Policy: users_select_public                                     │    │
│  │    USING (true) - apenas colunas públicas                        │    │
│  └──────────────────────────────────────────────────────────────────┘    │
│                                                                            │
│  ┌──────────────────────────────────────────────────────────────────┐    │
│  │                         Indexes                                   │    │
│  │                                                                   │    │
│  │  - projects_pkey (project_id)                                    │    │
│  │  - idx_projects_name (name)                                      │    │
│  │  - idx_projects_is_closed (is_closed)                            │    │
│  │  - idx_projects_owner_project_id (project_id)                    │    │
│  │  - idx_projects_owner_user_id (user_id)                          │    │
│  └──────────────────────────────────────────────────────────────────┘    │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

---

## 14. Decisões Arquiteturais (ADRs)

### ADR-001: Uso de AG-Grid para Listagem

**Contexto**: Necessário exibir lista de projetos com filtros, ordenação e busca.

**Decisão**: Utilizar AG-Grid Community Edition.

**Alternativas Consideradas**:
- TanStack Table (React Table v8)
- Material-UI DataGrid
- Implementação custom

**Justificativa**:
- AG-Grid oferece melhor performance para grandes datasets
- Virtual scrolling nativo
- Ampla documentação e comunidade
- Já utilizado em outras partes do sistema (consistência)

**Consequências**:
- Dependência de biblioteca externa robusta
- Bundle size aumentado (~500KB)
- Necessário aprender API específica

---

### ADR-002: Eager Loading de Owners

**Contexto**: Projetos possuem múltiplos responsáveis que precisam ser exibidos.

**Decisão**: Carregar owners junto com projetos em uma única query (join).

**Alternativas Consideradas**:
- Lazy loading (fetch owners ao expandir/hover)
- Endpoint separado para owners
- Sem carregar owners (apenas IDs)

**Justificativa**:
- Reduz round trips ao banco (N+1 problem)
- Melhora perceived performance (dados prontos imediatamente)
- Payload adicional é pequeno (~5KB para 100 owners)

**Consequências**:
- Query mais complexa
- Transformação de dados necessária
- Payload ligeiramente maior

---

### ADR-003: Filtros Client-Side

**Contexto**: Usuários precisam filtrar e buscar projetos.

**Decisão**: Implementar filtros no client-side usando useMemo.

**Alternativas Consideradas**:
- Filtros server-side (query parameters)
- Debounced search com server request
- Hybrid approach

**Justificativa**:
- Volume de dados é pequeno (<1000 projetos)
- Filtragem instantânea (melhor UX)
- Reduz load no servidor
- Simplicidade de implementação

**Consequências**:
- Não escala para >5000 projetos
- Necessário carregar todos os dados upfront
- Facilita implementação de filtros complexos

---

### ADR-004: Stateful Component (sem Context/Redux)

**Contexto**: Estado de projetos precisa ser gerenciado.

**Decisão**: Usar useState local no componente, sem state management global.

**Alternativas Consideradas**:
- Redux/Redux Toolkit
- Context API
- Zustand (já usado para auth)

**Justificativa**:
- Estado é local à tela (não compartilhado)
- Simplicidade de implementação
- Não há necessidade de sincronização entre componentes
- Zustand é usado apenas para auth (separação de concerns)

**Consequências**:
- Estado perdido ao desmontar componente
- Necessário re-fetch ao retornar à tela
- Não há cache de dados

---

## 15. Roadmap de Melhorias

### Curto Prazo (Sprint Atual)
1. ✅ Implementar NotificationToast para erros
2. ⏳ Adicionar loading spinner durante fetch
3. ⏳ Implementar Error Boundary

### Médio Prazo (Próximos 3 Meses)
1. Adicionar paginação server-side
2. Implementar React Query para cache
3. Adicionar filtros avançados (multi-select)
4. Exportar para Excel/CSV
5. Melhorar acessibilidade (WCAG AA completo)

### Longo Prazo (6+ Meses)
1. Migrar para AG-Grid Enterprise (se necessário)
2. Implementar real-time updates (Supabase subscriptions)
3. Adicionar visualizações alternativas (Kanban, Calendar)
4. Implementar bulk actions (editar/deletar múltiplos)
5. Dashboard de analytics de projetos

---

## 16. Considerações de Manutenibilidade

### 16.1 Code Organization

**Estrutura Atual**:
```
frontend/src/pages/Projects.tsx (Container)
frontend/src/components/ProjectOwnersGridRenderer.tsx (Cell Renderer)
frontend/src/types.ts (Interfaces compartilhadas)
```

**Sugestão de Refatoração**:
```
frontend/src/features/projects/
  ├─ Projects.tsx (Container)
  ├─ components/
  │   ├─ ProjectsGrid.tsx (AG-Grid wrapper)
  │   ├─ ProjectsFilters.tsx (Filtros isolados)
  │   ├─ ProjectsStats.tsx (Cards de estatísticas)
  │   └─ ProjectOwnersCell.tsx (Cell Renderer)
  ├─ hooks/
  │   ├─ useProjects.ts (Lógica de fetch)
  │   └─ useProjectsFilters.ts (Lógica de filtros)
  ├─ utils/
  │   └─ formatters.ts (formatDate, formatHours)
  └─ types.ts (Interfaces locais)
```

### 16.2 Testing Strategy

**Prioridade Alta**:
- Unit tests para formatters
- Integration tests para filtros
- E2E test para fluxo crítico

**Prioridade Média**:
- Snapshot tests para componentes visuais
- Performance tests (Lighthouse)

**Prioridade Baixa**:
- Visual regression tests
