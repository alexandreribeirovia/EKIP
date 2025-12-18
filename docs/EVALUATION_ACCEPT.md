# Aceite de Avaliação - Documentação Técnica

## Visão Geral

O **Aceite de Avaliação** é uma funcionalidade que permite ao funcionário confirmar formalmente que revisou e aceita sua avaliação de desempenho. O fluxo é baseado em **links temporários com tokens seguros**, garantindo que apenas o destinatário correto possa realizar o aceite.

### Características Principais

- ✅ **Token seguro**: 64 caracteres hexadecimais (256 bits)
- ✅ **Armazenamento hash**: Token é hasheado com SHA-256 antes de salvar no banco
- ✅ **Expiração**: Link válido por 24 horas
- ✅ **Uso único**: Token invalidado após primeiro uso
- ✅ **Um token ativo por vez**: Ao gerar novo link, o anterior é automaticamente invalidado
- ✅ **Histórico completo**: Todas as sessões de aceite são preservadas para auditoria
- ✅ **Página isolada**: Carrega apenas o necessário (lazy loading otimizado)

---

## Arquitetura

### Diagrama de Fluxo

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│    Gestor       │     │    Backend      │     │   Funcionário   │
│  (EvaluationRes │     │   (API)         │     │ (EvaluationAcc  │
│   ponse.tsx)    │     │                 │     │   ept.tsx)      │
└────────┬────────┘     └────────┬────────┘     └────────┬────────┘
         │                       │                       │
         │ 1. Clica "Gerar Link" │                       │
         │──────────────────────>│                       │
         │                       │                       │
         │                       │ 2. Gera token (32 bytes)
         │                       │    Hash SHA-256       │
         │                       │    Salva no banco     │
         │                       │                       │
         │ 3. Retorna URL        │                       │
         │<──────────────────────│                       │
         │                       │                       │
         │ 4. Copia e envia      │                       │
         │   link ao funcionário │                       │
         │─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─│─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─>│
         │                       │                       │
         │                       │ 5. Acessa link        │
         │                       │<──────────────────────│
         │                       │                       │
         │                       │ 6. Valida token       │
         │                       │    (hash e compara)   │
         │                       │                       │
         │                       │ 7. Retorna dados      │
         │                       │   da avaliação        │
         │                       │──────────────────────>│
         │                       │                       │
         │                       │ 8. Clica "Aceitar"    │
         │                       │<──────────────────────│
         │                       │                       │
         │                       │ 9. Marca accepted=true│
         │                       │    Invalida token     │
         │                       │                       │
         │                       │ 10. Confirma aceite   │
         │                       │──────────────────────>│
         │                       │                       │
```

### Estrutura de Arquivos

```
EKIP/
├── backend/src/
│   ├── routes/
│   │   └── evaluationAccept.ts      # Endpoints de aceite
│   └── lib/
│       └── encryption.ts            # Funções de hash e token
│
├── frontend/src/
│   ├── App.tsx                      # Roteador principal (lazy loading)
│   ├── AuthenticatedApp.tsx         # App autenticado (separado)
│   └── pages/
│       ├── EvaluationAccept.tsx     # Página pública de aceite
│       ├── EvaluationResponse.tsx   # Detalhe da avaliação (gestor)
│       ├── Evaluations.tsx          # Lista de avaliações
│       └── EmployeeDetail.tsx       # Detalhe do funcionário
│
└── docs/migrations/
    └── 20241218_evaluation_accept_session.sql  # Migração SQL
```

---

## Banco de Dados

### Campos na Tabela `employee_evaluations`

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `accepted` | `boolean` | Se a avaliação foi aceita (default: `false`) |
| `accepted_at` | `timestamptz` | Data/hora do aceite |

### Tabela `evaluation_accept_session`

Armazena o histórico de todas as sessões de aceite geradas.

```sql
CREATE TABLE IF NOT EXISTS evaluation_accept_session (
  id SERIAL PRIMARY KEY,
  evaluation_id INTEGER NOT NULL REFERENCES employee_evaluations(id) ON DELETE CASCADE,
  token_hash VARCHAR(64) NOT NULL,           -- SHA-256 do token (64 chars hex)
  expires_at TIMESTAMPTZ NOT NULL,           -- Expiração (24h após criação)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id), -- Quem gerou o link
  used_at TIMESTAMPTZ,                       -- Quando foi usado (NULL = não usado)
  is_active BOOLEAN DEFAULT true             -- Se está ativo (false = invalidado)
);

-- Índices para performance
CREATE INDEX idx_eval_accept_token_hash ON evaluation_accept_session(token_hash);
CREATE INDEX idx_eval_accept_eval_id ON evaluation_accept_session(evaluation_id);
CREATE INDEX idx_eval_accept_active ON evaluation_accept_session(evaluation_id, is_active) 
  WHERE is_active = true;
```

### Diagrama ER

```
┌─────────────────────────┐       ┌─────────────────────────┐
│   employee_evaluations  │       │ evaluation_accept_session│
├─────────────────────────┤       ├─────────────────────────┤
│ id (PK)                 │◄──────│ evaluation_id (FK)      │
│ user_id                 │       │ id (PK)                 │
│ owner_id                │       │ token_hash              │
│ evaluation_id           │       │ expires_at              │
│ period_start            │       │ created_at              │
│ period_end              │       │ created_by (FK → users) │
│ is_closed               │       │ used_at                 │
│ accepted ◄──────────────│───────│ is_active               │
│ accepted_at             │       └─────────────────────────┘
└─────────────────────────┘
```

---

## API Endpoints

### Base URL: `/api/evaluation-accept`

### 1. Verificar Token (Público)

Valida se o token é válido e retorna dados da avaliação.

```
GET /api/evaluation-accept/verify/:token
```

**Request:**
- `token`: Token de 64 caracteres hexadecimais

**Response (Sucesso):**
```json
{
  "success": true,
  "data": {
    "evaluation": {
      "id": 123,
      "name": "Avaliação Trimestral Q4 2024",
      "userName": "João Silva",
      "ownerName": "Maria Santos",
      "periodStart": "2024-10-01",
      "periodEnd": "2024-12-31"
    },
    "expiresAt": "2024-12-19T14:30:00.000Z"
  }
}
```

**Response (Erros):**
```json
// Token inválido
{ "success": false, "error": { "message": "Token inválido", "code": "INVALID_TOKEN" } }

// Token não encontrado
{ "success": false, "error": { "message": "Token não encontrado ou inválido", "code": "TOKEN_NOT_FOUND" } }

// Token expirado
{ "success": false, "error": { "message": "Este link expirou. Solicite um novo link ao seu gestor.", "code": "TOKEN_EXPIRED" } }

// Token já usado
{ "success": false, "error": { "message": "Este link já foi utilizado", "code": "TOKEN_ALREADY_USED" } }

// Avaliação já aceita
{ "success": false, "error": { "message": "Esta avaliação já foi aceita anteriormente", "code": "ALREADY_ACCEPTED" } }
```

### 2. Confirmar Aceite (Público)

Registra o aceite da avaliação.

```
POST /api/evaluation-accept/confirm/:token
```

**Request:**
- `token`: Token de 64 caracteres hexadecimais

**Response (Sucesso):**
```json
{
  "success": true,
  "data": {
    "message": "Avaliação aceita com sucesso",
    "acceptedAt": "2024-12-18T15:45:00.000Z"
  }
}
```

### 3. Gerar Link de Aceite (Autenticado)

Gera um novo link de aceite para uma avaliação.

```
POST /api/evaluation-accept/:id/generate
```

**Headers:**
- `X-Session-Id`: ID da sessão autenticada

**Request:**
- `id`: ID da avaliação (employee_evaluation)

**Response (Sucesso):**
```json
{
  "success": true,
  "data": {
    "url": "http://localhost:3000/evaluation-accept/a1b2c3d4e5f6...",
    "expiresAt": "2024-12-19T15:45:00.000Z",
    "expiresIn": "24 horas"
  }
}
```

**Validações:**
- Avaliação deve existir
- Avaliação deve estar fechada (`is_closed = true`)
- Avaliação não pode já ter sido aceita

### 4. Obter Status do Link (Autenticado)

Retorna informações sobre o link de aceite ativo.

```
GET /api/evaluation-accept/:id/status
```

**Response (Sucesso - Link ativo):**
```json
{
  "success": true,
  "data": {
    "hasActiveLink": true,
    "expiresAt": "2024-12-19T15:45:00.000Z",
    "createdAt": "2024-12-18T15:45:00.000Z",
    "accepted": false,
    "acceptedAt": null
  }
}
```

**Response (Sucesso - Sem link ativo):**
```json
{
  "success": true,
  "data": {
    "hasActiveLink": false,
    "expiresAt": null,
    "createdAt": null,
    "accepted": true,
    "acceptedAt": "2024-12-18T16:30:00.000Z"
  }
}
```

### 5. Obter Link Ativo (Autenticado)

Retorna a URL do link ativo (para reenvio).

```
GET /api/evaluation-accept/:id/link
```

**Response (Sucesso):**
```json
{
  "success": true,
  "data": {
    "url": "http://localhost:3000/evaluation-accept/a1b2c3d4e5f6...",
    "expiresAt": "2024-12-19T15:45:00.000Z"
  }
}
```

**Nota:** Este endpoint regenera a URL a partir do token armazenado. Por segurança, o token original não é armazenado - apenas seu hash.

---

## Frontend

### Página de Aceite (`EvaluationAccept.tsx`)

**Rota:** `/evaluation-accept/:token`

**Características:**
- Página pública (não requer autenticação)
- **Lazy loading isolado**: Não carrega authStore, Layout, supabaseClient
- Visual consistente com Login (logo, cores, rodapé)
- Estados: loading, valid, success, error

**Estados de Erro:**
| Código | Título | Mensagem |
|--------|--------|----------|
| `TOKEN_EXPIRED` | Link Expirado | Entre em contato com seu gestor... |
| `TOKEN_ALREADY_USED` | Link Já Utilizado | Esta avaliação já foi aceita... |
| `ALREADY_ACCEPTED` | Avaliação Já Aceita | Esta avaliação já foi aceita... |
| `TOKEN_NOT_FOUND` | Link Inválido | Token não encontrado ou inválido |
| `INVALID_TOKEN` | Link Inválido | Token inválido |

### Seção de Link na Resposta (`EvaluationResponse.tsx`)

Adicionado um card na página de detalhe da avaliação:

**Condições de exibição:**
- Avaliação fechada (`is_closed = true`)

**Funcionalidades:**
- Gerar novo link
- Copiar URL para clipboard
- Visualizar tempo restante
- Badge de status (Aceito/Pendente)

### Badges nas Listagens

Coluna "Aceite" adicionada em:
- **Evaluations.tsx** - Lista geral de avaliações
- **EmployeeDetail.tsx** - Aba de avaliações do funcionário

| Status | Badge | Cor |
|--------|-------|-----|
| Aceito | ✓ Aceito | Verde |
| Pendente | Pendente | Amarelo |
| Não fechado | - | Cinza |

---

## Segurança

### Geração de Token

```typescript
import crypto from 'crypto'

// Gera 32 bytes aleatórios (256 bits) → 64 caracteres hex
const token = crypto.randomBytes(32).toString('hex')
// Exemplo: "a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2"
```

### Hash SHA-256

```typescript
import crypto from 'crypto'

// Hash do token para armazenamento seguro
const tokenHash = crypto.createHash('sha256').update(token).digest('hex')
// Armazenado no banco: apenas o hash, nunca o token original
```

### Validação

1. Token recebido na URL
2. Backend calcula hash do token
3. Busca no banco por `token_hash` correspondente
4. Valida `is_active = true` e `expires_at > NOW()`
5. Valida `used_at IS NULL`

### Por que hash?

- **Se banco for comprometido**: Atacante vê apenas hashes, não tokens válidos
- **Tokens não podem ser reconstruídos**: SHA-256 é one-way
- **Cada token é único**: Colisões são praticamente impossíveis

---

## Lazy Loading

### Problema Original

Quando funcionário acessava `/evaluation-accept/:token`, o browser carregava:
- Todas as 18+ páginas da aplicação
- AG-Grid, Recharts, ReactQuill
- authStore, supabaseClient
- Layout, ProtectedRoute

**Total: ~14.7 MB de recursos**

### Solução Implementada

Separação em dois níveis:

**App.tsx (Ultra-leve):**
```tsx
// Apenas verifica rota
if (location.pathname.startsWith('/evaluation-accept/')) {
  return <Suspense><EvaluationAccept /></Suspense>
}
// Senão, carrega app completo
return <Suspense><AuthenticatedApp /></Suspense>
```

**AuthenticatedApp.tsx:**
- Contém toda lógica de auth
- Lazy loading de todas as páginas

**Resultado: ~5.1 MB de recursos** (redução de ~65%)

---

## Configuração

### Variáveis de Ambiente

**Backend (.env):**
```env
FRONTEND_URL=http://localhost:3000
```

**Frontend (.env):**
```env
VITE_API_URL=http://localhost:5000
```

### Migração SQL

Execute em ordem:

```sql
-- 1. Adicionar campos na tabela employee_evaluations
ALTER TABLE employee_evaluations 
ADD COLUMN IF NOT EXISTS accepted BOOLEAN DEFAULT false;

ALTER TABLE employee_evaluations 
ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMPTZ;

-- 2. Criar tabela de sessões
CREATE TABLE IF NOT EXISTS evaluation_accept_session (
  id SERIAL PRIMARY KEY,
  evaluation_id INTEGER NOT NULL REFERENCES employee_evaluations(id) ON DELETE CASCADE,
  token_hash VARCHAR(64) NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  used_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true
);

-- 3. Criar índices
CREATE INDEX IF NOT EXISTS idx_eval_accept_token_hash 
  ON evaluation_accept_session(token_hash);
CREATE INDEX IF NOT EXISTS idx_eval_accept_eval_id 
  ON evaluation_accept_session(evaluation_id);
CREATE INDEX IF NOT EXISTS idx_eval_accept_active 
  ON evaluation_accept_session(evaluation_id, is_active) WHERE is_active = true;

-- 4. Habilitar RLS
ALTER TABLE evaluation_accept_session ENABLE ROW LEVEL SECURITY;

-- 5. Política para service role (backend)
CREATE POLICY "Service role full access" ON evaluation_accept_session
  FOR ALL USING (true) WITH CHECK (true);
```

---

## Testes

### Fluxo Completo

1. **Fechar avaliação**: Na página de resposta, clicar em "Fechar Avaliação"
2. **Gerar link**: Clicar em "Gerar Link de Aceite"
3. **Copiar URL**: Clicar no botão de copiar
4. **Abrir em aba anônima**: Colar URL em uma aba sem login
5. **Verificar página**: Deve mostrar dados da avaliação
6. **Aceitar**: Clicar em "Aceitar Avaliação"
7. **Verificar badge**: Na listagem, deve mostrar "Aceito"

### Cenários de Erro

| Teste | Ação | Resultado Esperado |
|-------|------|-------------------|
| Token inválido | Alterar caracteres da URL | "Link Inválido" |
| Token expirado | Esperar 24h+ ou alterar `expires_at` no banco | "Link Expirado" |
| Token usado | Usar mesmo link duas vezes | "Link Já Utilizado" |
| Regenerar link | Gerar novo link e usar o antigo | "Link Inválido" |

### Verificação de Performance

1. Abrir DevTools → Network
2. Acessar `/evaluation-accept/:token` em aba anônima
3. Verificar que NÃO carrega:
   - `authStore.ts`
   - `Layout.tsx`
   - `Dashboard.tsx`, `Employees.tsx`, etc.
   - `ag-grid`, `recharts`, `react-quill`

---

## Troubleshooting

### Link não gera

**Causas possíveis:**
- Avaliação não está fechada (`is_closed = false`)
- Avaliação já foi aceita
- Erro de conexão com banco

**Solução:**
- Verificar se avaliação está fechada
- Checar logs do backend

### Página carrega muito conteúdo

**Causa:** Lazy loading não está funcionando

**Solução:**
- Verificar se `App.tsx` usa a estrutura com `AuthenticatedApp` separado
- Verificar se há imports estáticos de stores/pages no `App.tsx`

### Token inválido mesmo sendo correto

**Causas possíveis:**
- Token foi invalidado por regeneração
- Caracteres especiais na URL
- Token expirou

**Solução:**
- Gerar novo link
- Verificar `evaluation_accept_session` no banco

---

## Histórico de Versões

| Data | Versão | Descrição |
|------|--------|-----------|
| 2024-12-18 | 1.0.0 | Implementação inicial |

---

## Referências

- [ARCHITECTURE_API_SUPABASE.md](./ARCHITECTURE_API_SUPABASE.md) - Padrão de API
- [Copilot Instructions](../.github/copilot-instructions.md) - Convenções do projeto
- [Backend Route: evaluationAccept.ts](../backend/src/routes/evaluationAccept.ts)
- [Frontend Page: EvaluationAccept.tsx](../frontend/src/pages/EvaluationAccept.tsx)
