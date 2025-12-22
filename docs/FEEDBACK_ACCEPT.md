# Aceite de Feedback - Documentação Técnica

## Visão Geral

O **Aceite de Feedback** é uma funcionalidade que permite ao colaborador confirmar formalmente que revisou e aceita um feedback recebido. O fluxo é baseado em **links temporários com tokens seguros**, garantindo que apenas o destinatário correto possa realizar o aceite.

### Características Principais

- ✅ **Token seguro**: 64 caracteres hexadecimais (256 bits)
- ✅ **Armazenamento hash**: Token é hasheado com SHA-256 antes de salvar no banco
- ✅ **Expiração configurável**: Link válido por tempo definido pelo gestor (padrão 24h)
- ✅ **Acessos configuráveis**: Número máximo de acessos definido pelo gestor (padrão 1)
- ✅ **Um token ativo por vez**: Ao gerar novo link, o anterior é automaticamente invalidado
- ✅ **Histórico completo**: Todas as sessões de aceite são preservadas para auditoria
- ✅ **Página isolada**: Carrega apenas o necessário (lazy loading otimizado)
- ✅ **Somente o owner pode encerrar**: Apenas quem criou o feedback pode encerrá-lo

---

## Arquitetura

### Diagrama de Fluxo

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│    Gestor       │     │    Backend      │     │   Colaborador   │
│  (FeedbackModal │     │   (API)         │     │ (FeedbackAccept │
│   .tsx)         │     │                 │     │   .tsx)         │
└────────┬────────┘     └────────┬────────┘     └────────┬────────┘
         │                       │                       │
         │ 1. Clica "Encerrar"   │                       │
         │──────────────────────>│                       │
         │                       │                       │
         │                       │ 2. Define is_closed   │
         │                       │    = true             │
         │                       │                       │
         │ 3. Retorna sucesso    │                       │
         │<──────────────────────│                       │
         │                       │                       │
         │ 4. Clica "Gerar Link" │                       │
         │   (define max_access  │                       │
         │    e expiresInHours)  │                       │
         │──────────────────────>│                       │
         │                       │                       │
         │                       │ 5. Gera token (32 bytes)
         │                       │    Hash SHA-256       │
         │                       │    Salva no banco     │
         │                       │                       │
         │ 6. Retorna URL        │                       │
         │<──────────────────────│                       │
         │                       │                       │
         │ 7. Copia e envia      │                       │
         │   link ao colaborador │                       │
         │─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─│─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─>│
         │                       │                       │
         │                       │ 8. Acessa link        │
         │                       │<──────────────────────│
         │                       │                       │
         │                       │ 9. Valida token       │
         │                       │    Incrementa access  │
         │                       │    _count             │
         │                       │                       │
         │                       │ 10. Retorna dados     │
         │                       │   do feedback         │
         │                       │──────────────────────>│
         │                       │                       │
         │                       │ 11. Clica "Aceitar"   │
         │                       │<──────────────────────│
         │                       │                       │
         │                       │ 12. Marca accepted    │
         │                       │    = true             │
         │                       │    Invalida token     │
         │                       │                       │
         │                       │ 13. Confirma aceite   │
         │                       │──────────────────────>│
         │                       │                       │
```

### Estrutura de Arquivos

```
EKIP/
├── backend/src/
│   ├── routes/
│   │   └── feedbackAccept.ts        # Endpoints de aceite de feedback
│   └── lib/
│       └── encryption.ts            # Funções de hash e token
│
├── frontend/src/
│   ├── App.tsx                      # Roteador principal (lazy loading)
│   ├── AuthenticatedApp.tsx         # App autenticado (separado)
│   ├── types.ts                     # Interfaces TypeScript
│   └── pages/
│       ├── FeedbackAccept.tsx       # Página pública de aceite
│       └── Feedbacks.tsx            # Lista de feedbacks
│   └── components/
│       └── FeedbackModal.tsx        # Modal de feedback (encerrar/gerar link)
│
└── docs/
    └── FEEDBACK_ACCEPT.md           # Esta documentação
```

---

## Banco de Dados

### Campos na Tabela `feedbacks`

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `is_closed` | `boolean` | Se o feedback foi encerrado (default: `false`) |
| `closed_at` | `timestamptz` | Data/hora do encerramento |
| `accepted` | `boolean` | Se o feedback foi aceito (default: `false`) |
| `accepted_at` | `timestamptz` | Data/hora do aceite |

### Tabela `temp_session`

Armazena o histórico de todas as sessões temporárias (aceite de avaliação, feedback, etc).

```sql
CREATE TABLE IF NOT EXISTS temp_session (
  id SERIAL PRIMARY KEY,
  entity_id INTEGER NOT NULL,                -- ID da entidade (feedback, avaliação, etc)
  type VARCHAR(50) NOT NULL,                 -- Tipo: 'accept_feedback', 'accept_evaluation', etc
  token_hash VARCHAR(64) NOT NULL,           -- SHA-256 do token (64 chars hex)
  expires_at TIMESTAMPTZ NOT NULL,           -- Expiração configurável
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id), -- Quem gerou o link
  used_at TIMESTAMPTZ,                       -- Quando foi usado (NULL = não usado)
  is_active BOOLEAN DEFAULT true,            -- Se está ativo (false = invalidado)
  max_access INTEGER DEFAULT 1,              -- Máximo de acessos permitidos
  access_count INTEGER DEFAULT 0             -- Contador de acessos
);

-- Índices para performance
CREATE INDEX idx_temp_session_token ON temp_session(token_hash);
CREATE INDEX idx_temp_session_entity ON temp_session(entity_id, type);
CREATE INDEX idx_temp_session_active ON temp_session(entity_id, type, is_active) 
  WHERE is_active = true;
```

### Diagrama ER

```
┌─────────────────────────┐       ┌─────────────────────────┐
│       feedbacks         │       │      temp_session       │
├─────────────────────────┤       ├─────────────────────────┤
│ id (PK)                 │◄──────│ entity_id               │
│ feedback_user_id        │       │ id (PK)                 │
│ owner_user_id           │       │ type = 'accept_feedback'│
│ feedback_date           │       │ token_hash              │
│ type                    │       │ expires_at              │
│ public_comment          │       │ created_at              │
│ is_closed ◄─────────────│───────│ created_by (FK → users) │
│ closed_at               │       │ used_at                 │
│ accepted ◄──────────────│───────│ is_active               │
│ accepted_at             │       │ max_access              │
└─────────────────────────┘       │ access_count            │
                                  └─────────────────────────┘
```

---

## API Endpoints

### Base URL: `/api/feedback-accept`

### 1. Verificar Token (Público)

Valida se o token é válido e retorna dados do feedback.

```
GET /api/feedback-accept/verify/:token
```

**Request:**
- `token`: Token de 64 caracteres hexadecimais

**Response (Sucesso):**
```json
{
  "success": true,
  "data": {
    "feedback": {
      "id": 123,
      "feedbackUserName": "João Silva",
      "ownerName": "Maria Santos",
      "feedbackDate": "2024-12-18",
      "type": "Positivo",
      "typeId": 1,
      "publicComment": "<p>Excelente trabalho no projeto!</p>"
    },
    "expiresAt": "2024-12-19T14:30:00.000Z"
  }
}
```

**Response (Erros):**
```json
// Token inválido (formato)
{ "success": false, "error": { "message": "Token inválido", "code": "INVALID_TOKEN" } }

// Token não encontrado
{ "success": false, "error": { "message": "Token não encontrado ou inválido", "code": "TOKEN_NOT_FOUND" } }

// Token expirado
{ "success": false, "error": { "message": "Este link expirou. Solicite um novo link ao responsável.", "code": "TOKEN_EXPIRED" } }

// Limite de acessos atingido
{ "success": false, "error": { "message": "Este link atingiu o limite de acessos", "code": "MAX_ACCESS_REACHED" } }

// Feedback já aceito
{ "success": false, "error": { "message": "Este feedback já foi aceito anteriormente", "code": "ALREADY_ACCEPTED" } }
```

### 2. Confirmar Aceite (Público)

Registra o aceite do feedback.

```
POST /api/feedback-accept/confirm/:token
```

**Request:**
- `token`: Token de 64 caracteres hexadecimais

**Response (Sucesso):**
```json
{
  "success": true,
  "data": {
    "message": "Feedback aceito com sucesso",
    "acceptedAt": "2024-12-18T15:45:00.000Z"
  }
}
```

### 3. Encerrar Feedback (Autenticado)

Encerra o feedback para permitir geração de link de aceite.

```
PATCH /api/feedback-accept/:id/close
```

**Headers:**
- `X-Session-Id`: ID da sessão autenticada

**Request:**
- `id`: ID do feedback

**Response (Sucesso):**
```json
{
  "success": true,
  "data": {
    "message": "Feedback encerrado com sucesso",
    "closedAt": "2024-12-18T15:00:00.000Z"
  }
}
```

**Validações:**
- Apenas o owner (criador) do feedback pode encerrá-lo
- Feedback não pode já estar fechado

### 4. Gerar Link de Aceite (Autenticado)

Gera um novo link de aceite para um feedback.

```
POST /api/feedback-accept/:id/generate
```

**Headers:**
- `X-Session-Id`: ID da sessão autenticada

**Request Body:**
```json
{
  "maxAccess": 1,       // Opcional, default: 1
  "expiresInHours": 24  // Opcional, default: 24
}
```

**Response (Sucesso):**
```json
{
  "success": true,
  "data": {
    "token": "a1b2c3d4e5f6...",
    "url": "http://localhost:3000/feedback-accept/a1b2c3d4e5f6...",
    "expiresAt": "2024-12-19T15:45:00.000Z",
    "expiresInHours": 24,
    "maxAccess": 1,
    "feedback": {
      "id": 123,
      "userName": "João Silva"
    }
  }
}
```

**Validações:**
- Apenas o owner (criador) do feedback pode gerar link
- Feedback deve estar encerrado (`is_closed = true`)
- Feedback não pode já ter sido aceito

### 5. Obter Status do Link (Autenticado)

Retorna informações sobre o link de aceite e status de aceite.

```
GET /api/feedback-accept/:id/link
```

**Response (Sucesso):**
```json
{
  "success": true,
  "data": {
    "isClosed": true,
    "closedAt": "2024-12-18T15:00:00.000Z",
    "accepted": false,
    "acceptedAt": null,
    "hasValidLink": true,
    "linkExpiresAt": "2024-12-19T15:45:00.000Z"
  }
}
```

### 6. Obter Status de Aceite (Autenticado)

Retorna apenas informações de aceite do feedback.

```
GET /api/feedback-accept/:id/status
```

**Response (Sucesso):**
```json
{
  "success": true,
  "data": {
    "isClosed": true,
    "closedAt": "2024-12-18T15:00:00.000Z",
    "accepted": true,
    "acceptedAt": "2024-12-18T16:30:00.000Z"
  }
}
```

---

## Segurança

### Geração de Token

```typescript
import crypto from 'crypto';

// Gera 32 bytes aleatórios = 64 caracteres hex
const token = crypto.randomBytes(32).toString('hex');

// Hash SHA-256 para armazenamento
const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
```

### Validação de Token

1. Recebe token via URL
2. Valida formato (64 caracteres hex)
3. Calcula hash SHA-256
4. Busca no banco por `token_hash` + `type = 'accept_feedback'`
5. Verifica se `is_active = true`
6. Verifica se não expirou (`expires_at > now()`)
7. Verifica se `access_count < max_access`
8. Incrementa `access_count`
9. Retorna dados do feedback

### Invalidação Automática

- Quando um novo link é gerado, todos os anteriores são invalidados (`is_active = false`)
- Após aceite, o token é invalidado (`is_active = false`)
- Tokens expirados são mantidos para auditoria

---

## Frontend

### Página de Aceite (`FeedbackAccept.tsx`)

Página pública (sem autenticação) que:
1. Extrai token da URL
2. Chama `/verify/:token` para validar
3. Exibe dados do feedback (tipo, comentário, responsável)
4. Mostra tempo restante para aceite
5. Botão "Aceitar Feedback" chama `/confirm/:token`
6. Exibe mensagem de sucesso ou erro

### FeedbackModal (`FeedbackModal.tsx`)

Modal de edição de feedback com:
1. Banner de status quando fechado
2. Botão "Encerrar Feedback" (apenas para owner)
3. Seção de aceite com botão "Gerar Link"
4. Modal de configuração de link (max_access, expiresInHours)
5. Modal de exibição de link com botão copiar

### Grids de Feedback

Colunas adicionadas em `Feedbacks.tsx` e `EmployeeDetail.tsx`:
- **Status**: Aberto / Encerrado
- **Aceite**: - / Pendente / Aceito

---

## Fluxo Completo

### 1. Gestor Cria Feedback
- Abre modal, preenche dados, salva
- Feedback criado com `is_closed = false`

### 2. Gestor Encerra Feedback
- Abre modal do feedback
- Clica em "Encerrar Feedback"
- Feedback atualizado com `is_closed = true`, `closed_at = now()`

### 3. Gestor Gera Link
- Na seção de aceite, clica em "Gerar Link"
- Define max_access e expiresInHours (opcional)
- Backend gera token, salva hash na `temp_session`
- Link é copiado para área de transferência

### 4. Colaborador Acessa Link
- Recebe link por e-mail/chat
- Acessa página `/feedback-accept/:token`
- Visualiza dados do feedback
- Clica em "Aceitar Feedback"

### 5. Confirmação
- Backend marca `accepted = true`, `accepted_at = now()`
- Token é invalidado
- Colaborador vê mensagem de sucesso

---

## Diferenças: Avaliação vs Feedback

| Aspecto | Avaliação | Feedback |
|---------|-----------|----------|
| Tabela sessão | `temp_session` (type=accept_evaluation) | `temp_session` (type=accept_feedback) |
| Entidade | `employee_evaluations` | `feedbacks` |
| Pré-requisito | `is_closed = true` | `is_closed = true` |
| Quem encerra | Gestor (qualquer) | Apenas owner |
| Quem gera link | Gestor (qualquer) | Apenas owner |
| max_access | Configurável | Configurável |
| expiresInHours | Configurável | Configurável |
| Rota frontend | `/evaluation-accept/:token` | `/feedback-accept/:token` |
| Rota API | `/api/evaluation-accept/*` | `/api/feedback-accept/*` |

---

## Testes

### Cenários de Teste

1. **Gerar link com sucesso**
   - Feedback existe e está fechado
   - Usuário é o owner
   - Link é gerado e copiado

2. **Acessar link válido**
   - Token existe e está ativo
   - Não expirou
   - access_count < max_access
   - Feedback não foi aceito

3. **Limite de acessos**
   - Acessar link múltiplas vezes
   - Verificar incremento do access_count
   - Erro quando atinge max_access

4. **Aceitar feedback**
   - Token válido
   - Feedback marcado como aceito
   - Token invalidado

5. **Tentativa de aceite duplo**
   - Tentar aceitar feedback já aceito
   - Erro "Feedback já foi aceito"

6. **Link expirado**
   - Acessar após expires_at
   - Erro "Link expirado"

7. **Novo link invalida anterior**
   - Gerar link
   - Gerar outro link
   - Primeiro link deve falhar
