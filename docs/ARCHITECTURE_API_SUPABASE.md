# EKIP - Arquitetura API: Frontend → Backend → Supabase

## Visão Geral

O EKIP utiliza uma arquitetura de três camadas com **autenticação baseada em sessões** onde o **frontend React** se comunica exclusivamente com o **backend Express**, que por sua vez acessa o **Supabase** (PostgreSQL). Os tokens do Supabase ficam **criptografados no banco de dados**, nunca expostos ao frontend.

### Arquitetura REST (HTTP)

```
┌─────────────────┐    X-Session-Id    ┌─────────────────┐   supabaseAdmin    ┌─────────────────┐
│                 │ ─────────────────► │                 │ ─────────────────► │                 │
│    Frontend     │   + httpOnly       │     Backend     │   + sessions       │    Supabase     │
│  (React/Vite)   │     cookies        │    (Express)    │     (encrypted)    │   (PostgreSQL)  │
│                 │ ◄───────────────── │                 │ ◄───────────────── │                 │
└─────────────────┘    JSON Response   └─────────────────┘    Query Result    └─────────────────┘
     :3000                                  :5000                              Cloud Database
                                              │
                                    ┌─────────┴─────────┐
                                    │  tabela sessions  │
                                    │  (tokens AES-256) │
                                    └───────────────────┘
```

### Arquitetura WebSocket (Notificações em Tempo Real)

```
┌─────────────────┐   Socket.IO        ┌─────────────────┐  Supabase Realtime ┌─────────────────┐
│                 │   (sessionId)      │                 │   (server-side)    │                 │
│    Frontend     │ ◄────────────────► │     Backend     │ ◄────────────────► │    Supabase     │
│  (React/Vite)   │   ws://localhost   │  (Express+WS)   │   (admin key)      │   (PostgreSQL)  │
│                 │        :5000       │                 │                    │                 │
└─────────────────┘                    └─────────────────┘                    └─────────────────┘
                                              │
                                    ┌─────────┴─────────┐
                                    │  postgres_changes │
                                    │  (INSERT on       │
                                    │   notifications)  │
                                    └───────────────────┘
```

**Fluxo WebSocket:**
1. Frontend conecta ao Socket.IO com `auth: { sessionId }`
2. Backend valida sessão via `socketAuth` middleware
3. Backend escuta Supabase Realtime (server-side com `supabaseAdmin`)
4. Novas notificações são roteadas: `user:${userId}` ou broadcast


### Agora (Sessões com tokens criptografados)
```typescript
// ✅ Frontend recebe apenas sessionId, tokens ficam no servidor
const response = await apiClient.post('/api/auth/login', { email, password })
// response.data.sessionId = "uuid-da-sessao" (NÃO contém tokens!)
```

**Benefícios:**
- Tokens Supabase **nunca expostos** ao frontend
- Criptografia AES-256-GCM no banco de dados
- Refresh token em cookie httpOnly (proteção XSS)
- Controle total de sessões (invalidar, listar, auditar)
- Suporte a múltiplas sessões por usuário

---

## Componentes da Arquitetura

### 1. Frontend - apiClient (`frontend/src/lib/apiClient.ts`)

Wrapper que encapsula todas as chamadas HTTP para o backend com **autenticação automática via sessionId**:

```typescript
import apiClient from '../lib/apiClient'

// GET request - sessionId enviado automaticamente via header X-Session-Id
const response = await apiClient.get('/api/projects')
if (response.success) {
  setProjects(response.data)
}

// POST request
const response = await apiClient.post('/api/projects', { name: 'Novo Projeto' })

// PATCH request
const response = await apiClient.patch(`/api/projects/${id}`, { status: 'active' })

// DELETE request
const response = await apiClient.del(`/api/projects/${id}`)
```

**Características:**
- Envia `sessionId` automaticamente via header `X-Session-Id`
- Cookies httpOnly enviados com `credentials: 'include'`
- Refresh automático de sessão quando retorna 401
- Retorna formato padronizado: `{ success: boolean, data?: T, error?: Error }`

### 2. Backend - Session Store (`backend/src/lib/sessionStore.ts`)

Gerencia sessões com tokens criptografados no Supabase:

```typescript
import { createSession, getSessionById, invalidateSession } from '@/lib/sessionStore'

// Criar sessão (login)
const { sessionId, backendRefreshToken } = await createSession({
  userId: user.id,
  email: user.email,
  supabaseAccessToken: session.access_token,    // Será criptografado
  supabaseRefreshToken: session.refresh_token,  // Será criptografado
  expiresAt: session.expires_at
})

// Buscar sessão (descriptografa tokens automaticamente)
const session = await getSessionById(sessionId)
// session.supabaseAccessToken = token original (descriptografado)

// Invalidar sessão (logout)
await invalidateSession(sessionId)
```

**Tabela `sessions` no Supabase:**
```sql
CREATE TABLE sessions (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL,
    email TEXT NOT NULL,
    access_token TEXT NOT NULL,           -- Criptografado AES-256-GCM
    refresh_token TEXT NOT NULL,          -- Criptografado AES-256-GCM
    backend_refresh_token TEXT NOT NULL,  -- Hash SHA-256
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE,
    last_used_at TIMESTAMP WITH TIME ZONE,
    user_agent TEXT,
    ip_address TEXT,
    is_valid BOOLEAN DEFAULT TRUE
);
```

### 3. Middleware sessionAuth (`backend/src/middleware/sessionAuth.ts`)

Valida sessões e injeta cliente Supabase autenticado:

```typescript
import { sessionAuth } from '@/middleware/sessionAuth'

router.get('/protected-route', sessionAuth, async (req, res) => {
  // Dados disponíveis após sessionAuth:
  console.log(req.sessionId)      // UUID da sessão
  console.log(req.session)        // { userId, email, expiresAt }
  console.log(req.supabaseUser)   // Cliente Supabase com JWT do usuário (aplica RLS)
  console.log(req.supabaseToken)  // Access token descriptografado
  
  // Query com RLS do usuário
  const { data } = await req.supabaseUser.from('my_table').select('*')
  
  res.json({ success: true, data })
})
```

### 4. Express Routes (`backend/src/routes/*.ts`)

Rotas Express que usam `supabaseAdmin` (bypass RLS) ou `req.supabaseUser` (com RLS):

```typescript
import { Router, Request, Response, NextFunction } from 'express'
import { supabaseAdmin } from '../lib/supabaseAdmin'
import { sessionAuth } from '../middleware/sessionAuth'

const router = Router()

// Middleware de autenticação por sessão
router.use(sessionAuth)

// Query com supabaseAdmin (bypass RLS) - para dados globais
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('projects')
      .select('*')
      .order('name')

    if (error) {
      return res.status(500).json({
        success: false,
        error: { message: error.message, code: 'SUPABASE_ERROR' }
      })
    }

    return res.json({ success: true, data: data || [] })
  } catch (err) {
    return next(err)
  }
})

// Query com req.supabaseUser (aplica RLS) - para dados do usuário
router.get('/my-data', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { data, error } = await req.supabaseUser!
      .from('user_data')
      .select('*')
    // RLS garante que só retorna dados do usuário autenticado

    return res.json({ success: true, data: data || [] })
  } catch (err) {
    return next(err)
  }
})

export default router
```


```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│  FLUXO DE AUTENTICAÇÃO (Session-Based)                                                 │
│                                                                                        │
│  ┌──────────┐   sessionId    ┌──────────┐  tokens criptografados  ┌──────────┐         │
│  │ Frontend │ ─────────────► │ Backend  │ ◄────────────────────── │ Supabase │         │
│  └──────────┘  (X-Session-Id)└─────┬────┘     (tabela sessions)   └──────────┘         │
│                                    │                                                   │
│                         sessionAuth descriptografa                                     │
│                          tokens e injeta req.supabaseUser                              │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

| Cliente | Quando Usar | RLS |
|---------|-------------|-----|
| **supabaseAdmin** | Dados globais, operações admin, queries complexas | ❌ Bypass |
| **req.supabaseUser** | Dados do usuário, operações que devem aplicar RLS | ✅ Aplica |

**Exemplos:**
```typescript
// supabaseAdmin - Lista todos os projetos (admin)
const { data } = await supabaseAdmin.from('projects').select('*')

// req.supabaseUser - Lista apenas dados do usuário (RLS)
const { data } = await req.supabaseUser!.from('user_settings').select('*')
```

---

## Padrão de Resposta da API

Todas as rotas retornam JSON no formato padronizado:

### Sucesso
```json
{
  "success": true,
  "data": [
    { "id": 1, "name": "Projeto A" },
    { "id": 2, "name": "Projeto B" }
  ]
}
```

### Erro
```json
{
  "success": false,
  "error": {
    "message": "Projeto não encontrado",
    "code": "NOT_FOUND"
  }
}
```

### Códigos de Erro de Sessão

| Código | HTTP | Descrição |
|--------|------|-----------|
| `SESSION_MISSING` | 401 | Header X-Session-Id não fornecido |
| `SESSION_INVALID_FORMAT` | 401 | sessionId não é um UUID válido |
| `SESSION_INVALID` | 401 | Sessão não encontrada ou já invalidada |
| `SESSION_EXPIRED` | 401 | Sessão expirou, precisa fazer login novamente |
| `SESSION_ERROR` | 500 | Erro interno ao validar sessão |

---

## Fluxo Completo de uma Requisição

### Diagrama do Caminho da Chamada

```
┌─────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                              FLUXO DE REQUISIÇÃO COM SESSION-BASED AUTH                                 │
└─────────────────────────────────────────────────────────────────────────────────────────────────────────┘

 ┌──────────────────────────────────────────────────────────────────────────────────────────────────────┐
 │  FRONTEND (React/Vite) - localhost:3000                                                              │
 │                                                                                                      │
 │  ┌─────────────────────┐    ┌─────────────────────────────────────────────────────────────────────┐  │
 │  │  ProjectDetail.tsx  │    │  apiClient.ts                                                       │  │
 │  │                     │    │                                                                     │  │
 │  │  useEffect(() => {  │───►│  const sessionId = getSessionId() // Do Zustand store               │  │
 │  │    apiClient.get()  │    │  return fetch(API_URL + url, {                                      │  │
 │  │  })                 │    │    headers: { 'X-Session-Id': sessionId },                          │  │
 │  │                     │    │    credentials: 'include' // Envia httpOnly cookies                 │  │
 │  │                     │    │  })                                                                 │  │
 │  └─────────────────────┘    └───────────────────────────────────┬─────────────────────────────────┘  │
 └─────────────────────────────────────────────────────────────────┼────────────────────────────────────┘
                                                                   │
                                                                   │ HTTP GET /api/projects/123/tasks
                                                                   │ Header: X-Session-Id: uuid-da-sessao
                                                                   │ Cookie: ekip_refresh_token (httpOnly)
                                                                   ▼
 ┌──────────────────────────────────────────────────────────────────────────────────────────────────────┐
 │  BACKEND (Express) - localhost:5000                                                                  │
 │                                                                                                      │
 │  ┌─────────────────────────────────────────────────────────────────────────────────────────────────┐ │
 │  │  index.ts (Entry Point)                                                                         │ │
 │  │                                                                                                 │ │
 │  │  app.use('/api/projects', projectsRouter)  ─────────────────────────────────────────────────┐   │ │
 │  └─────────────────────────────────────────────────────────────────────────────────────────────┼───┘ │
 │                                                                                                │     │
 │  ┌─────────────────────────────────────────────────────────────────────────────────────────────┼──┐  │
 │  │  middleware/sessionAuth.ts                                                                  │  │  │
 │  │                                                                                             │  │  │
 │  │  1. Extrai sessionId do header X-Session-Id (ou cookie)                                     │  │  │
 │  │  2. Busca sessão no banco: getSessionById(sessionId)                                        │  │  │
 │  │  3. Descriptografa tokens com AES-256-GCM (ENCRYPTION_KEY)                                  │  │  │
 │  │  4. Se válido: injeta req.session, req.supabaseUser, next()                                 │  │  │
 │  │  5. Se inválido: return 401 SESSION_INVALID                                                 │  │  │
 │  └─────────────────────────────────────────────────────────────────────────────────────────────┼──┘  │
 │                                                                                                │     │
 │  ┌─────────────────────────────────────────────────────────────────────────────────────────────▼──┐  │
 │  │  routes/projects.ts                                                                            │  │
 │  │                                                                                                │  │
 │  │  router.get('/:id/tasks', async (req, res) => {                                                │  │
 │  │    const id = req.params['id']                                                                 │  │
 │  │    // Pode usar req.supabaseUser (com RLS) ou supabaseAdmin (bypass RLS)                       │  │
 │  │    const { data, error } = await supabaseAdmin                                                 │  │
 │  │      .rpc('get_tasks_with_assignees', { p_project_id: parseInt(id) })                          │  │
 │  │    return res.json({ success: true, data })                                                    │  │
 │  │  })                                                                                            │  │
 │  └────────────────────────────────────────────────────────────────┬───────────────────────────────┘  │
 └───────────────────────────────────────────────────────────────────┼──────────────────────────────────┘
                                                                     │
                                                                     │ supabaseAdmin.rpc(...)
                                                                     │ Header: apikey: SERVICE_ROLE_KEY
                                                                     ▼
 ┌──────────────────────────────────────────────────────────────────────────────────────────────────────┐
 │  SUPABASE (PostgreSQL Cloud)                                                                         │
 │                                                                                                      │
 │  ┌────────────────────────────────────────────┐  ┌───────────────────────────────────────────────┐   │
 │  │  Tabela: sessions                          │  │  Function: get_tasks_with_assignees           │   │
 │  │                                            │  │                                               │   │
 │  │  id: uuid                                  │  │  SELECT t.*, u.name as assignee_name          │   │
 │  │  user_id: uuid                             │  │  FROM tasks t                                 │   │
 │  │  access_token: "iv:tag:encrypted..."       │  │  LEFT JOIN users u ON t.assignee_id = u.id    │   │
 │  │  refresh_token: "iv:tag:encrypted..."      │  │  WHERE t.project_id = p_project_id            │   │
 │  │  expires_at: timestamp                     │  │                                               │   │
 │  │  is_valid: boolean                         │  │  RETURNS: [{ id: 1, title: 'Task 1', ... }]   │   │
 │  └────────────────────────────────────────────┘  └───────────────────────────────────────────────┘   │
 └──────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

### Diagrama do Fluxo de Login

```
┌─────────────┐         ┌─────────────┐         ┌─────────────┐         ┌─────────────┐
│   Browser   │         │  authStore  │         │   Express   │         │  Supabase   │
│  (Usuário)  │         │  (Zustand)  │         │  (Backend)  │         │    (DB)     │
└──────┬──────┘         └──────┬──────┘         └──────┬──────┘         └──────┬──────┘
       │                       │                       │                       │
       │  Digita email/senha   │                       │                       │
       │──────────────────────►│                       │                       │
       │                       │                       │                       │
       │                       │  POST /api/auth/login │                       │
       │                       │  { email, password }  │                       │
       │                       │──────────────────────►│                       │
       │                       │                       │                       │
       │                       │                       │  supabase.auth        │
       │                       │                       │  .signInWithPassword  │
       │                       │                       │──────────────────────►│
       │                       │                       │                       │
       │                       │                       │  { access_token,      │
       │                       │                       │    refresh_token }    │
       │                       │                       │◄──────────────────────│
       │                       │                       │                       │
       │                       │                       │  createSession()      │
       │                       │                       │  - Criptografa tokens │
       │                       │                       │  - Salva em sessions  │
       │                       │                       │──────────────────────►│
       │                       │                       │                       │
       │                       │                       │  { sessionId }        │
       │                       │                       │◄──────────────────────│
       │                       │                       │                       │
       │                       │  Set-Cookie:          │                       │
       │                       │  ekip_refresh_token   │                       │
       │                       │  ekip_session_id      │                       │
       │                       │  (httpOnly)           │                       │
       │                       │                       │                       │
       │                       │  { sessionId, user }  │                       │
       │                       │◄──────────────────────│                       │
       │                       │                       │                       │
       │                       │  Salva sessionId      │                       │
       │                       │  no Zustand store     │                       │
       │                       │                       │                       │
       │  Redireciona para     │                       │                       │
       │  /dashboard           │                       │                       │
       │◄──────────────────────│                       │                       │
       │                       │                       │                       │
```

### Exemplo: Buscar Projetos (Passo a Passo)

```
1. Frontend (ProjectDetail.tsx)
   └── apiClient.get('/api/projects/123/tasks')
       └── Adiciona header: X-Session-Id: <sessionId>
       └── Envia cookies: credentials: 'include'

2. Backend (routes/projects.ts)
   └── sessionAuth middleware:
       ├── Extrai sessionId do header
       ├── Busca sessão no banco (tabela sessions)
       ├── Descriptografa access_token com AES-256-GCM
       └── Injeta req.supabaseUser com token do usuário
   └── Handler extrai project_id dos params
   └── supabaseAdmin.rpc('get_tasks_with_assignees', { p_project_id: 123 })

3. Supabase
   └── Executa a função RPC
   └── Retorna dados

4. Backend
   └── Formata resposta: { success: true, data: [...] }

5. Frontend
   └── Recebe response.data
   └── Atualiza estado: setTasks(response.data)
```

---

## Estrutura de Arquivos

```
backend/
├── src/
│   ├── index.ts                 # Entry point, registra rotas
│   ├── lib/
│   │   ├── supabaseAdmin.ts     # Cliente Supabase admin (bypass RLS)
│   │   ├── supabaseUserClient.ts # Cria cliente com JWT do usuário
│   │   ├── sessionStore.ts      # Gerencia sessões criptografadas
│   │   └── encryption.ts        # AES-256-GCM para tokens
│   ├── middleware/
│   │   ├── sessionAuth.ts       # Validação de sessão (principal)
│   │   ├── jwtAuth.ts           # (LEGADO - mantido para compatibilidade)
│   │   └── errorHandler.ts      # Tratamento de erros
│   ├── routes/
│   │   ├── auth.ts              # /api/auth/* (login, logout, refresh)
│   │   ├── projects.ts          # /api/projects/*
│   │   ├── employees.ts         # /api/employees/*
│   │   ├── employeeDetail.ts    # /api/employee-detail/*
│   │   ├── evaluations.ts       # /api/evaluations/* (modelos)
│   │   ├── employeeEvaluations.ts # /api/employee-evaluations/*
│   │   ├── feedbacks.ts         # /api/feedbacks/*
│   │   ├── pdi.ts               # /api/pdi/*
│   │   ├── lookups.ts           # /api/lookups/*
│   │   ├── notifications.ts     # /api/notifications/*
│   │   ├── allocations.ts       # /api/allocations/*
│   │   ├── dashboard.ts         # /api/dashboard/*
│   │   ├── domains.ts           # /api/domains/*
│   │   └── users.ts             # /api/users/*
│   └── websocket/
│       ├── index.ts             # Re-exporta módulos WebSocket
│       ├── socketAuth.ts        # Middleware autenticação Socket.IO
│       └── notificationSocket.ts # Serviço de notificações real-time

frontend/
├── src/
│   ├── lib/
│   │   ├── apiClient.ts         # Wrapper HTTP com sessionId automático
│   │   └── supabaseClient.ts    # (LEGADO - evitar uso direto)
│   └── pages/
│       ├── Projects.tsx
│       ├── ProjectDetail.tsx
│       ├── Employees.tsx
│       └── ...
```

---



### Projects (`/api/projects`)

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/api/projects` | Lista todos os projetos com owners |
| GET | `/api/projects/domains` | Lista domínios ativos |
| GET | `/api/projects/:id/tasks` | Tarefas do projeto (RPC) |
| GET | `/api/projects/:id/time-worked` | Tempo trabalhado por usuário |
| GET | `/api/projects/:id/phases` | Fases do projeto |
| GET | `/api/projects/:id/risks` | Riscos com lookup de domínios |
| DELETE | `/api/projects/:id/risks/:riskId` | Deletar risco |
| GET | `/api/projects/:id/owners` | Responsáveis do projeto |
| GET | `/api/projects/:id/accesses` | Acessos via client |
| DELETE | `/api/projects/:id/accesses/:accessId` | Deletar acesso |

### Employees (`/api/employees`)

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/api/employees` | Lista todos funcionários |
| GET | `/api/employees/:id` | Detalhes de um funcionário |
| GET | `/api/employees/:id/skills` | Skills do funcionário |
| POST | `/api/employees/:id/skills` | Adicionar skill |
| DELETE | `/api/employees/:id/skills/:skillId` | Remover skill |

### Evaluations - Modelos (`/api/evaluations`)

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/api/evaluations` | Lista todos os modelos de avaliação |
| GET | `/api/evaluations/:id` | Obtém um modelo de avaliação por ID |
| POST | `/api/evaluations` | Cria um novo modelo de avaliação |
| PUT | `/api/evaluations/:id` | Atualiza um modelo de avaliação |
| PATCH | `/api/evaluations/:id/toggle-status` | Alterna status ativo/inativo |
| DELETE | `/api/evaluations/:id` | Deleta modelo (cascade: perguntas) |
| GET | `/api/evaluations/categories` | Lista categorias de avaliação |
| GET | `/api/evaluations/categories/:categoryId/subcategories` | Lista subcategorias |
| GET | `/api/evaluations/reply-types` | Lista tipos de resposta |
| GET | `/api/evaluations/:id/questions` | Lista perguntas de um modelo |
| POST | `/api/evaluations/:id/questions` | Adiciona pergunta ao modelo |
| PUT | `/api/evaluations/:id/questions/reorder` | Reordena perguntas (batch) |
| PUT | `/api/evaluations/:id/questions/:questionId` | Atualiza uma pergunta |
| DELETE | `/api/evaluations/:id/questions/:questionId` | Remove pergunta do modelo |
| GET | `/api/evaluations/:id/categories` | Lista categorias usadas no modelo |

### Employee Evaluations (`/api/employee-evaluations`)

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/api/employee-evaluations` | Lista avaliações com filtros |
| GET | `/api/employee-evaluations/:id` | Obtém avaliação com detalhes |
| POST | `/api/employee-evaluations` | Cria avaliação com projetos |
| DELETE | `/api/employee-evaluations/:id` | Deleta avaliação (cascade) |
| PATCH | `/api/employee-evaluations/:id/close` | Encerra uma avaliação |
| GET | `/api/employee-evaluations/:id/questions` | Obtém perguntas do modelo |
| GET | `/api/employee-evaluations/:id/responses` | Obtém respostas salvas |
| PUT | `/api/employee-evaluations/:id/responses` | Salva respostas (delete + insert) |

### Feedbacks (`/api/feedbacks`)

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/api/feedbacks` | Lista feedbacks com filtros (startDate, endDate obrigatórios) |
| GET | `/api/feedbacks/:id` | Busca feedback por ID |
| POST | `/api/feedbacks` | Cria novo feedback |
| PATCH | `/api/feedbacks/:id` | Atualiza feedback |
| DELETE | `/api/feedbacks/:id` | Deleta feedback |
| GET | `/api/feedbacks/:id/pdi` | Verifica se feedback tem PDI |
| PATCH | `/api/feedbacks/:id/pdi` | Atualiza flag is_pdi |

### PDI - Plano de Desenvolvimento Individual (`/api/pdi`)

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/api/pdi` | Lista PDIs com filtros (startDate, endDate obrigatórios) |
| GET | `/api/pdi/:id` | Busca PDI por ID com itens |
| GET | `/api/pdi/by-evaluation/:evaluationId` | Busca PDI por avaliação |
| GET | `/api/pdi/by-feedback/:feedbackId` | Busca PDI por feedback |
| POST | `/api/pdi` | Cria PDI com itens (RPC transacional) |
| PUT | `/api/pdi/:id` | Atualiza PDI com itens (RPC transacional) |
| DELETE | `/api/pdi/:id` | Deleta PDI (cascade: itens) |

### Lookups (`/api/lookups`)

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/api/lookups/users` | Lista usuários ativos para dropdowns |
| GET | `/api/lookups/managers` | Lista gestores (posição contendo "Gestor") |
| GET | `/api/lookups/evaluation-statuses` | Lista status de avaliação |
| GET | `/api/lookups/projects/active` | Lista projetos ativos |
| GET | `/api/lookups/evaluation-models/active` | Lista modelos de avaliação ativos |

### Notifications (`/api/notifications`)

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/api/notifications` | Lista notificações do usuário |
| PATCH | `/api/notifications/:id/read` | Marca notificação como lida |
| PATCH | `/api/notifications/read-all` | Marca todas como lidas |
| DELETE | `/api/notifications/:id` | Deleta notificação (soft delete) |
| GET | `/api/notifications/stats` | Estatísticas de notificações |

---

## Middleware de Autenticação

### sessionAuth (`backend/src/middleware/sessionAuth.ts`)

O middleware principal que valida sessões e injeta dados no request:

```typescript
import { Request, Response, NextFunction } from 'express'
import { refreshSessionIfNeeded } from '../lib/sessionStore'
import { createUserClient } from '../lib/supabaseUserClient'

export const sessionAuth = async (req: Request, res: Response, next: NextFunction) => {
  // 1. Extrai sessionId (header X-Session-Id ou cookie)
  const sessionId = extractSessionId(req)
  
  if (!sessionId) {
    return res.status(401).json({
      success: false,
      error: { message: 'Sessão não fornecida', code: 'SESSION_MISSING' }
    })
  }

  // 2. Busca sessão no banco (descriptografa tokens automaticamente)
  const session = await refreshSessionIfNeeded(sessionId)
  
  if (!session) {
    return res.status(401).json({
      success: false,
      error: { message: 'Sessão inválida ou expirada', code: 'SESSION_INVALID' }
    })
  }

  // 3. Injeta dados no request
  req.sessionId = sessionId
  req.session = { userId: session.userId, email: session.email, expiresAt: session.expiresAt }
  req.supabaseUser = createUserClient(session.supabaseAccessToken) // Cliente com RLS
  req.supabaseToken = session.supabaseAccessToken
  
  next()
}
```

### Dados disponíveis após sessionAuth

| Propriedade | Tipo | Descrição |
|-------------|------|-----------|
| `req.sessionId` | `string` | UUID da sessão atual |
| `req.session` | `{ userId, email, expiresAt }` | Dados básicos da sessão |
| `req.supabaseUser` | `SupabaseClient` | Cliente com JWT do usuário (aplica RLS) |
| `req.supabaseToken` | `string` | Access token descriptografado |

### jwtAuth (LEGADO)

> ⚠️ **Deprecated**: Mantido apenas para compatibilidade. Use `sessionAuth` em novas implementações.

O middleware `jwtAuth` ainda existe para rotas legadas que usam JWT diretamente.
```

---

## Boas Práticas

### 1. Sempre validar parâmetros
```typescript
const id = req.params['id'] as string
if (!id) {
  return res.status(400).json({ 
    success: false, 
    error: { message: 'ID é obrigatório', code: 'MISSING_ID' } 
  })
}
```

### 2. Usar try-catch e next(err)
```typescript
try {
  // código
} catch (err) {
  return next(err) // Passa para o errorHandler middleware
}
```

### 3. Logar erros do Supabase
```typescript
if (error) {
  console.error('Erro ao buscar dados:', error)
  return res.status(500).json({
    success: false,
    error: { message: error.message, code: 'SUPABASE_ERROR' }
  })
}
```

### 4. Retornar array vazio se não houver dados
```typescript
return res.json({
  success: true,
  data: data || []
})
```

### 5. Documentar com Swagger
```typescript
/**
 * @swagger
 * /api/projects/{id}/tasks:
 *   get:
 *     summary: Busca tarefas do projeto
 *     tags: [Projects]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: number
 *     responses:
 *       200:
 *         description: Lista de tarefas
 */
```

---

## Variáveis de Ambiente

### Backend (`backend/.env`)
```env
# Supabase
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Encryption (Session Store) - OBRIGATÓRIO
# Gere com: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
ENCRYPTION_KEY=sua_chave_hex_64_caracteres_aqui

# JWT (Legado - mantido para compatibilidade)
JWT_SECRET=sua_chave_secreta_aqui
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# Server
PORT=5000
NODE_ENV=development
```

### Frontend (`frontend/.env`)
```env
VITE_API_URL=http://localhost:5000
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

---

## Troubleshooting

### Erro 401 SESSION_MISSING
- Verifique se o header `X-Session-Id` está sendo enviado
- Confirme que `apiClient` está configurado com `configureApiClient()`

### Erro 401 SESSION_INVALID
- Sessão pode ter sido invalidada (logout em outro dispositivo)
- Sessão pode ter expirado e refresh falhou
- Verifique se a tabela `sessions` existe no Supabase

### Erro 500 "Erro ao criar sessão segura"
- Verifique se `ENCRYPTION_KEY` está configurada no `.env`
- A chave deve ter exatamente 64 caracteres hexadecimais
- Verifique se a tabela `sessions` existe no Supabase (execute o SQL de criação)
- SQL disponível em: `backend/sql/create_sessions_table.sql`

### Erro 500 SUPABASE_ERROR
- Verifique os logs do backend para detalhes
- Confirme que `SUPABASE_SERVICE_ROLE_KEY` está correta
- Verifique se a tabela/coluna existe no Supabase

### Erro de CORS
- Verifique a configuração de CORS no `backend/src/index.ts`
- Confirme que `VITE_API_URL` está correto no frontend

### Cookies não sendo enviados
- Confirme que `credentials: 'include'` está no fetch
- Verifique se frontend e backend estão no mesmo domínio (dev: localhost)
- Em produção, configure `sameSite` e `secure` adequadamente

---

## Referências

- [Supabase JavaScript Client](https://supabase.com/docs/reference/javascript/introduction)
- [Express.js Documentation](https://expressjs.com/)
- [Node.js Crypto (AES-256-GCM)](https://nodejs.org/api/crypto.html)
- Documentação interna:
  - `docs/API.md` - Endpoints da API
  - `backend/sql/create_sessions_table.sql` - Schema da tabela sessions
