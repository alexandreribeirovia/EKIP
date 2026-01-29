# EKIP - Documento de Segurança da Plataforma

> **Versão:** 1.1.0  
> **Data:** Janeiro 2026  
> **Última Atualização:** 29/01/2026 - Adicionadas proteções de login (CAPTCHA, Rate Limiting, Validação de Senha)  
> **Classificação:** Confidencial

## Índice

1. [Visão Geral da Arquitetura de Segurança](#1-visão-geral-da-arquitetura-de-segurança)
2. [Autenticação](#2-autenticação)
3. [Gerenciamento de Sessões](#3-gerenciamento-de-sessões)
4. [Criptografia](#4-criptografia)
5. [Armazenamento de Chaves e Tokens](#5-armazenamento-de-chaves-e-tokens)
6. [Autorização e Controle de Acesso](#6-autorização-e-controle-de-acesso)
7. [Proteções contra Ataques](#7-proteções-contra-ataques)
   - 7.1 CSRF
   - 7.2 XSS
   - 7.3 Rate Limiting
   - 7.4 Injection Attacks
   - 7.5 Proteção contra Brute Force e Ataques de Login
   - 7.6 Cloudflare Turnstile (CAPTCHA)
   - 7.7 Prevenção de Enumeração de Usuários
   - 7.8 Validação de Força de Senha
   - 7.9 Session Hijacking
8. [Segurança WebSocket](#8-segurança-websocket)
9. [Segurança do Frontend](#9-segurança-do-frontend)
10. [Segurança do Backend](#10-segurança-do-backend)
11. [Variáveis de Ambiente](#11-variáveis-de-ambiente)
12. [Boas Práticas e Recomendações](#12-boas-práticas-e-recomendações)
13. [Checklist de Segurança](#13-checklist-de-segurança)

---

## 1. Visão Geral da Arquitetura de Segurança

### 1.1 Princípios de Design

O EKIP foi projetado seguindo os princípios de **Defense in Depth** (Defesa em Profundidade):

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            FRONTEND (React)                                 │
│  ┌─────────────┐  ┌─────────────────┐  ┌────────────────────────────────┐   │
│  │  Zustand    │  │   API Client    │  │      Protected Routes          │   │
│  │  AuthStore  │  │  (X-Session-Id) │  │   (isAuthenticated check)      │   │
│  └──────┬──────┘  └────────┬────────┘  └────────────────────────────────┘   │
│         │                   │                                               │
│         │    sessionId      │   httpOnly cookies                            │
│         │    (localStorage) │   (refresh_token)                             │
└─────────┴───────────────────┴───────────────────────────────────────────────┘
                              │
                              │ HTTPS (TLS 1.3)
                              ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                            BACKEND (Express)                                │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                    Middleware Stack                                   │  │
│  │  ┌─────────┐  ┌──────────┐  ┌───────────┐  ┌────────────────────────┐ │  │
│  │  │ Helmet  │→ │   CORS   │→ │Rate Limit │→ │    Session Auth        │ │  │
│  │  │(Headers)│  │(Origins) │  │(100/15min)│  │ (sessionId → tokens)   │ │  │
│  │  └─────────┘  └──────────┘  └───────────┘  └────────────────────────┘ │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  ┌────────────────────┐  ┌─────────────────────────────────────────────────┐│
│  │   Session Store    │  │                Encryption Layer                 ││
│  │  (PostgreSQL)      │  │   AES-256-GCM (tokens criptografados)           ││
│  └─────────┬──────────┘  └─────────────────────────────────────────────────┘│
│            │                                                                │
└────────────┼────────────────────────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          SUPABASE (PostgreSQL)                              │
│  ┌─────────────┐  ┌────────────────────┐  ┌──────────────────────────────┐  │
│  │   Auth      │  │  Row Level         │  │     Database                 │  │
│  │   Service   │  │  Security (RLS)    │  │   (users, projects, etc)     │  │
│  └─────────────┘  └────────────────────┘  └──────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 1.2 Fluxo de Dados Seguro

```
┌─────────┐         ┌─────────┐         ┌─────────────┐        ┌──────────┐
│ Browser │───────▶ │ Backend│────────▶│Session Store│──────▶│ Supabase │
└─────────┘         └─────────┘         └─────────────┘        └──────────┘
     │                  │                     │                     │
     │  1. POST /login  │                     │                     │
     │  {email, pass}   │                     │                     │
     │─────────────────▶│                     │                     │
     │                  │ 2. Auth via         │                     │
     │                  │    Supabase         │                     │
     │                  │────────────────────────────────────────▶│
     │                  │                     │  3. JWT tokens      │
     │                  │◀────────────────────────────────────────│
     │                  │                     │                     │
     │                  │ 4. Encrypt tokens   │                     │
     │                  │    (AES-256-GCM)    │                     │
     │                  │────────────────────▶│                     │
     │                  │     Store session   │                     │
     │                  │◀────────────────────│                     │
     │                  │                     │                     │
     │ 5. sessionId     │                     │                     │
     │    + httpOnly    │                     │                     │
     │    cookie        │                     │                     │
     │◀─────────────────│                     │                     │
     │                  │                     │                     │
```

---

## 2. Autenticação

### 2.1 Fluxo de Login

O processo de autenticação segue um fluxo seguro em múltiplas etapas:

```typescript
// backend/src/routes/auth.ts

router.post('/login', async (req, res) => {
  const { email, password } = req.body

  // 1. Validação de entrada
  if (!email || !password) {
    return res.status(400).json({
      success: false,
      error: { message: 'Email e senha são obrigatórios' }
    })
  }

  // 2. Autenticação via Supabase Auth
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  })

  // 3. Criar sessão segura no banco (tokens criptografados)
  const sessionResult = await createSession({
    userId,
    email: userEmail,
    supabaseAccessToken: data.session.access_token,
    supabaseRefreshToken: data.session.refresh_token,
    expiresAt: data.session.expires_at,
    userAgent: req.headers['user-agent'],
    ipAddress: req.ip
  })

  // 4. Configurar cookies httpOnly
  res.cookie(SESSION_ID_COOKIE_NAME, sessionId, {
    httpOnly: true,
    secure: isProduction,    // HTTPS only em produção
    sameSite: 'strict',      // Proteção CSRF
    maxAge: SESSION_MAX_AGE, // 7 dias
    path: '/'
  })

  // 5. Retornar sessionId (SEM tokens Supabase)
  return res.json({
    success: true,
    data: {
      user: { id, email, name, role },
      sessionId
    }
  })
})
```

### 2.2 Características de Segurança do Login

| Característica | Implementação |
|----------------|---------------|
| **Validação de Credenciais** | Supabase Auth (bcrypt com salt) |
| **Tokens JWT** | Armazenados no servidor, NUNCA no frontend |
| **Session ID** | UUID v4 gerado com `crypto.randomBytes()` |
| **Cookies** | `httpOnly`, `secure`, `sameSite: 'strict'` |
| **Metadados** | User-Agent e IP registrados para auditoria |

### 2.3 Rotas Públicas vs Protegidas

```typescript
// Rotas públicas (sem sessionAuth)
router.post('/login', ...)
router.post('/refresh', ...)
router.post('/forgot-password', ...)

// Rotas protegidas (com sessionAuth)
router.get('/me', sessionAuth, ...)
router.post('/logout', sessionAuth, ...)
router.post('/logout-all', sessionAuth, ...)
```

---

## 3. Gerenciamento de Sessões

### 3.1 Tabela de Sessões (PostgreSQL)

```sql
CREATE TABLE sessions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id),
  email         TEXT NOT NULL,
  access_token  TEXT NOT NULL,  -- Criptografado AES-256-GCM
  refresh_token TEXT NOT NULL,  -- Criptografado AES-256-GCM
  backend_refresh_token TEXT NOT NULL,  -- Hash SHA-256
  expires_at    TIMESTAMPTZ NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT now(),
  last_used_at  TIMESTAMPTZ DEFAULT now(),
  user_agent    TEXT,
  ip_address    INET,
  is_valid      BOOLEAN DEFAULT true
);

-- Índices para performance
CREATE INDEX idx_sessions_user_id ON sessions(user_id);
CREATE INDEX idx_sessions_is_valid ON sessions(is_valid);
CREATE INDEX idx_sessions_expires_at ON sessions(expires_at);
```

### 3.2 Ciclo de Vida da Sessão

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   LOGIN     │────▶│   ACTIVE    │────▶│   REFRESH   │────▶│   LOGOUT    │
│  (create)   │     │  (in-use)   │     │  (renew)    │     │  (invalid)  │
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
                           │                   │
                           │   Token expirando │
                           │   (< 5 min)       │
                           └───────────────────┘
```

### 3.3 Refresh Automático de Sessão

O backend renova automaticamente tokens quando estão próximos de expirar:

```typescript
// backend/src/lib/sessionStore.ts

export const refreshSessionIfNeeded = async (sessionId: string) => {
  const session = await getSessionById(sessionId)
  
  // Verificar se precisa renovar (margem de 5 minutos)
  const now = Math.floor(Date.now() / 1000)
  const margin = 5 * 60 // 5 minutos
  
  if (session.expiresAt - margin > now) {
    // Ainda não precisa renovar
    return session
  }
  
  // Usar refresh token para obter novos tokens
  const { data, error } = await supabaseAdmin.auth.refreshSession({
    refresh_token: session.supabaseRefreshToken
  })
  
  // Atualizar tokens no banco (criptografados)
  await updateSessionTokens(
    sessionId,
    data.session.access_token,
    data.session.refresh_token,
    newExpiresAt
  )
  
  return updatedSession
}
```

### 3.4 Invalidação de Sessões

```typescript
// Logout único (sessão atual)
await invalidateSession(sessionId)

// Logout de todos os dispositivos
await invalidateAllUserSessions(userId)

// Logout de outros dispositivos (exceto atual)
await invalidateAllUserSessions(userId, exceptSessionId: currentSessionId)
```

### 3.5 Limpeza Automática de Sessões

```sql
-- Função de cleanup no PostgreSQL
CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS TABLE(invalidated int, deleted int)
LANGUAGE plpgsql
AS $$
DECLARE
  v_invalidated int;
  v_deleted int;
BEGIN
  -- Invalidar sessões expiradas
  WITH updated AS (
    UPDATE sessions
    SET is_valid = false
    WHERE is_valid = true
      AND expires_at < NOW()
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_invalidated FROM updated;
  
  -- Deletar sessões antigas (> 30 dias)
  WITH deleted AS (
    DELETE FROM sessions
    WHERE is_valid = false
      AND updated_at < NOW() - INTERVAL '30 days'
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_deleted FROM deleted;
  
  RETURN QUERY SELECT v_invalidated, v_deleted;
END;
$$;
```

---

## 4. Criptografia

### 4.1 Algoritmo: AES-256-GCM

O EKIP utiliza **AES-256-GCM** (Galois/Counter Mode) para criptografar tokens sensíveis:

| Característica | Especificação |
|----------------|---------------|
| **Algoritmo** | AES (Advanced Encryption Standard) |
| **Tamanho da Chave** | 256 bits (32 bytes) |
| **Modo de Operação** | GCM (Galois/Counter Mode) |
| **IV (Nonce)** | 128 bits (16 bytes), único por operação |
| **Auth Tag** | 128 bits (16 bytes) |

### 4.2 Por que AES-256-GCM?

1. **Confidencialidade**: Criptografia forte com chave de 256 bits
2. **Integridade**: Auth tag garante que dados não foram alterados
3. **Autenticidade**: Verifica que os dados vieram de fonte confiável
4. **Performance**: Hardware acceleration em CPUs modernas

### 4.3 Implementação

```typescript
// backend/src/lib/encryption.ts

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 16  // 128 bits
const AUTH_TAG_LENGTH = 16  // 128 bits

/**
 * Criptografa texto usando AES-256-GCM
 * 
 * Formato de saída: iv:authTag:ciphertext (hex)
 */
export function encrypt(plaintext: string): string {
  const key = getEncryptionKey()
  
  // IV único para cada criptografia (CRÍTICO para segurança)
  const iv = crypto.randomBytes(IV_LENGTH)
  
  // Criar cipher
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv)
  
  // Criptografar
  let encrypted = cipher.update(plaintext, 'utf8', 'hex')
  encrypted += cipher.final('hex')
  
  // Obter tag de autenticação
  const authTag = cipher.getAuthTag()
  
  // Formato: iv:authTag:ciphertext
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`
}

/**
 * Descriptografa texto criptografado com AES-256-GCM
 */
export function decrypt(encryptedData: string): string {
  const [ivHex, authTagHex, ciphertext] = encryptedData.split(':')
  
  const key = getEncryptionKey()
  const iv = Buffer.from(ivHex, 'hex')
  const authTag = Buffer.from(authTagHex, 'hex')
  
  // Criar decipher
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(authTag)
  
  // Descriptografar
  let decrypted = decipher.update(ciphertext, 'hex', 'utf8')
  decrypted += decipher.final('utf8')
  
  return decrypted
}
```

### 4.4 Hashing de Tokens

O `backendRefreshToken` é armazenado como hash SHA-256:

```typescript
export function hashSHA256(text: string): string {
  return crypto.createHash('sha256').update(text).digest('hex')
}
```

**Por que hash e não criptografia?**
- Refresh token do backend é usado apenas para lookup (comparação)
- Hash é irreversível - mesmo com acesso ao banco, não é possível recuperar o token original
- Mesma técnica usada para armazenar senhas

---

## 5. Armazenamento de Chaves e Tokens

### 5.1 Hierarquia de Segurança

```
┌────────────────────────────────────────────────────────────────────────┐
│                        NÍVEL 1: AMBIENTE                               │
│                                                                        │
│   Variáveis de ambiente (.env) - Nunca commitadas no Git              │
│   ┌──────────────────────────────────────────────────────────────┐    │
│   │ ENCRYPTION_KEY           (32 bytes hex = 64 caracteres)      │    │
│   │ SUPABASE_SERVICE_ROLE_KEY (JWT longo, acesso admin)          │    │
│   │ JWT_SECRET               (legado, para compatibilidade)      │    │
│   └──────────────────────────────────────────────────────────────┘    │
└────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        NÍVEL 2: BANCO DE DADOS                         │
│                                                                        │
│   Tabela sessions - Tokens criptografados com ENCRYPTION_KEY          │
│   ┌──────────────────────────────────────────────────────────────┐    │
│   │ access_token:  iv:authTag:ciphertext (AES-256-GCM)          │    │
│   │ refresh_token: iv:authTag:ciphertext (AES-256-GCM)          │    │
│   │ backend_refresh_token: sha256(token) (Hash irreversível)    │    │
│   └──────────────────────────────────────────────────────────────┘    │
└────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        NÍVEL 3: RUNTIME (MEMÓRIA)                      │
│                                                                        │
│   Tokens descriptografados apenas em memória durante uso              │
│   ┌──────────────────────────────────────────────────────────────┐    │
│   │ req.supabaseToken  (token descriptografado, só durante req) │    │
│   │ req.supabaseUser   (cliente Supabase com JWT)               │    │
│   └──────────────────────────────────────────────────────────────┘    │
└────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        NÍVEL 4: FRONTEND (CLIENTE)                     │
│                                                                        │
│   Apenas sessionId - Nunca tokens Supabase                            │
│   ┌──────────────────────────────────────────────────────────────┐    │
│   │ localStorage:  sessionId (UUID, não sensível)               │    │
│   │ Cookie:        ekip_refresh_token (httpOnly, não acessível) │    │
│   │ Cookie:        ekip_session_id (httpOnly, não acessível)    │    │
│   └──────────────────────────────────────────────────────────────┘    │
└────────────────────────────────────────────────────────────────────────┘
```

### 5.2 O que NUNCA é Armazenado no Frontend

| Dado | Localização | Frontend Acessa? |
|------|-------------|------------------|
| Supabase Access Token | Backend (criptografado) | ❌ NÃO |
| Supabase Refresh Token | Backend (criptografado) | ❌ NÃO |
| Backend Refresh Token | Cookie httpOnly | ❌ NÃO (JS não acessa) |
| ENCRYPTION_KEY | .env do backend | ❌ NÃO |
| SERVICE_ROLE_KEY | .env do backend | ❌ NÃO |
| Session ID | localStorage + header | ✅ SIM (UUID não sensível) |

### 5.3 Geração da ENCRYPTION_KEY

```bash
# Gerar chave segura (64 caracteres hex = 32 bytes)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Exemplo de saída:
# a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef12345678
```

**Requisitos da ENCRYPTION_KEY:**
- Exatamente 64 caracteres hexadecimais
- Gerada com CSPRNG (Cryptographically Secure Pseudo-Random Number Generator)
- Única por ambiente (dev, staging, production)
- Nunca commitada no Git

---

## 6. Autorização e Controle de Acesso

### 6.1 Row Level Security (RLS)

O Supabase aplica RLS automaticamente quando usado o token do usuário:

```typescript
// Cliente com RLS (restringe dados ao usuário autenticado)
const supabaseUser = createUserClient(decryptedAccessToken)

// Cliente Admin (bypassa RLS - para operações administrativas)
const supabaseAdmin = getSupabaseAdmin()
```

### 6.2 Dual Client Pattern

```typescript
// backend/src/lib/supabaseUserClient.ts

export function createUserClient(userAccessToken: string): SupabaseClient {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: {
      headers: {
        Authorization: `Bearer ${userAccessToken}`
      }
    },
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })
}
```

```typescript
// backend/src/lib/supabaseAdmin.ts

// Service Role Key - bypassa RLS
_supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})
```

### 6.3 Middleware de Autorização

```typescript
// backend/src/middleware/sessionAuth.ts

export const sessionAuth = async (req, res, next) => {
  // 1. Extrair sessionId do request
  const sessionId = extractSessionId(req)
  
  // 2. Validar formato UUID
  if (!isUUID(sessionId)) {
    return res.status(401).json({ error: 'SESSION_INVALID_FORMAT' })
  }
  
  // 3. Buscar sessão (com refresh automático se necessário)
  const session = await refreshSessionIfNeeded(sessionId)
  
  // 4. Criar cliente Supabase com token do usuário
  const supabaseClient = createUserClient(session.supabaseAccessToken)
  
  // 5. Injetar no request
  req.sessionId = sessionId
  req.session = { userId, email, expiresAt }
  req.supabaseUser = supabaseClient
  req.supabaseToken = session.supabaseAccessToken
  
  next()
}
```

### 6.4 Verificação de Roles (Futuro)

```typescript
// Preparado para implementação futura
export const requireRole = (role: string) => {
  return async (req, res, next) => {
    if (!req.session) {
      return res.status(401).json({ error: 'UNAUTHORIZED' })
    }
    
    // TODO: Verificar role do usuário
    // const userRole = await getUserRole(req.session.userId)
    // if (userRole !== role) return res.status(403).json(...)
    
    next()
  }
}
```

---

## 7. Proteções contra Ataques

### 7.1 Cross-Site Request Forgery (CSRF)

**Proteções implementadas:**

1. **SameSite Cookies**: `sameSite: 'strict'` previne envio de cookies em requests cross-origin
2. **Origin Validation**: CORS restringe origens permitidas
3. **Custom Header**: `X-Session-Id` exigido em todas as requisições

```typescript
// Cookie com proteção CSRF
res.cookie(SESSION_ID_COOKIE_NAME, sessionId, {
  httpOnly: true,
  secure: isProduction,
  sameSite: 'strict',  // Proteção CSRF
  maxAge: SESSION_MAX_AGE,
  path: '/'
})
```

### 7.2 Cross-Site Scripting (XSS)

**Proteções implementadas:**

1. **httpOnly Cookies**: JavaScript não pode acessar tokens
2. **Helmet**: Headers de segurança (Content-Security-Policy, X-XSS-Protection)
3. **Sem Tokens no Frontend**: Tokens Supabase nunca expostos ao cliente

```typescript
// Helmet adiciona headers de segurança
app.use(helmet())

// Headers adicionados:
// - Content-Security-Policy
// - X-Content-Type-Options: nosniff
// - X-Frame-Options: DENY
// - X-XSS-Protection: 1; mode=block
// - Strict-Transport-Security (HSTS)
```

### 7.3 Rate Limiting

```typescript
// 100 requests por IP a cada 15 minutos
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 100,
  message: 'Too many requests from this IP, please try again later.'
})

// Slow down após 50 requests
const speedLimiter = slowDown({
  windowMs: 15 * 60 * 1000,
  delayAfter: 50,
  delayMs: () => 500  // 500ms de delay adicional
})

app.use(limiter)
app.use(speedLimiter)
```

### 7.4 Injection Attacks

**SQL Injection:**
- Supabase usa queries parametrizadas automaticamente
- Nunca concatenar valores de usuário em queries

```typescript
// ✅ Seguro - Query parametrizada
const { data } = await supabase
  .from('users')
  .select('*')
  .eq('email', userEmail)  // Automaticamente escapado

// ❌ NUNCA fazer isso
const query = `SELECT * FROM users WHERE email = '${userEmail}'`
```

### 7.5 Proteção contra Brute Force e Ataques de Login

O EKIP implementa múltiplas camadas de proteção para a tela de login:

#### 7.5.1 Arquitetura de Proteção

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      PROTEÇÃO DA TELA DE LOGIN                              │
└─────────────────────────────────────────────────────────────────────────────┘

  Tentativa 1-2: Login normal
       │
       ▼
┌─────────────┐
│  Formulário │  ← Sem CAPTCHA
│   Normal    │
└──────┬──────┘
       │ Falha
       ▼
  Tentativa 3-4: CAPTCHA ativado
       │
       ▼
┌─────────────┐     ┌─────────────────┐
│  Formulário │────▶│   Cloudflare    │
│ + Turnstile │     │   Turnstile     │
└──────┬──────┘     │   Validation    │
       │            └─────────────────┘
       │ Falha
       ▼
  Tentativa 5+: Bloqueio temporário
       │
       ▼
┌─────────────┐
│  Rate Limit │  ← Aguardar 15 minutos
│   (429)     │
└─────────────┘
```

#### 7.5.2 Tabela de Rastreamento de Tentativas

```sql
-- Supabase: Tabela login_attempts
CREATE TABLE login_attempts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_address      TEXT NOT NULL,
  email           TEXT,
  attempt_count   INTEGER DEFAULT 1,
  first_attempt_at TIMESTAMPTZ DEFAULT now(),
  last_attempt_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(ip_address)
);

-- Índices para performance
CREATE INDEX idx_login_attempts_ip ON login_attempts(ip_address);
CREATE INDEX idx_login_attempts_last ON login_attempts(last_attempt_at);

-- Função para limpar tentativas antigas (mais de 15 minutos)
CREATE OR REPLACE FUNCTION cleanup_old_login_attempts()
RETURNS void AS $$
BEGIN
  DELETE FROM login_attempts 
  WHERE last_attempt_at < NOW() - INTERVAL '15 minutes';
END;
$$ LANGUAGE plpgsql;
```

#### 7.5.3 Configurações de Limite

| Parâmetro | Valor | Descrição |
|-----------|-------|-----------|
| **WINDOW_MS** | 15 minutos | Janela de tempo para contagem |
| **CAPTCHA_THRESHOLD** | 3 tentativas | CAPTCHA aparece após 3 falhas |
| **MAX_ATTEMPTS** | 5 tentativas | Bloqueio após 5 falhas |

#### 7.5.4 Implementação Backend

```typescript
// backend/src/lib/loginAttemptStore.ts

const WINDOW_MS = 15 * 60 * 1000 // 15 minutos
const CAPTCHA_THRESHOLD = 3
const MAX_ATTEMPTS = 5

// Obter tentativas de login para um IP
export async function getLoginAttempts(ipAddress: string): Promise<LoginAttemptResult> {
  // Limpar tentativas antigas
  const cutoffTime = new Date(Date.now() - WINDOW_MS).toISOString()
  await supabase.from('login_attempts').delete().lt('last_attempt_at', cutoffTime)

  // Buscar tentativas atuais
  const { data } = await supabase
    .from('login_attempts')
    .select('attempt_count, first_attempt_at')
    .eq('ip_address', ipAddress)
    .single()

  return {
    attemptCount: data?.attempt_count || 0,
    requiresCaptcha: (data?.attempt_count || 0) >= CAPTCHA_THRESHOLD,
    isBlocked: (data?.attempt_count || 0) >= MAX_ATTEMPTS,
  }
}

// Incrementar tentativas após falha
export async function incrementLoginAttempts(ipAddress: string, email?: string) {
  // Upsert: incrementa se existe, cria se não existe
  // ...
}

// Resetar tentativas após login bem-sucedido
export async function resetLoginAttempts(ipAddress: string) {
  await supabase.from('login_attempts').delete().eq('ip_address', ipAddress)
}
```

#### 7.5.5 Rate Limiter Específico para Login

```typescript
// backend/src/routes/auth.ts

import rateLimit from 'express-rate-limit'

// Rate limiter específico para login (mais restritivo que global)
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  limit: 5, // Máximo 5 tentativas por IP
  message: {
    success: false,
    error: {
      message: 'Muitas tentativas de login. Aguarde 15 minutos.',
      code: 'RATE_LIMIT_EXCEEDED',
    },
  },
  standardHeaders: true,
  keyGenerator: (req) => req.ip || req.headers['x-forwarded-for']?.toString().split(',')[0] || 'unknown',
})

// Aplicar na rota de login
router.post('/login', loginLimiter, async (req, res) => {
  // ...
})
```

#### 7.5.6 Fluxo Completo de Login com Proteções

```typescript
// backend/src/routes/auth.ts

router.post('/login', loginLimiter, async (req, res) => {
  const { email, password, captchaToken } = req.body
  const clientIp = req.ip || 'unknown'

  // 1. Verificar tentativas anteriores
  const loginAttempts = await getLoginAttempts(clientIp)

  // 2. Se bloqueado, rejeitar
  if (loginAttempts.isBlocked) {
    return res.status(429).json({
      success: false,
      error: { message: 'Muitas tentativas. Aguarde 15 minutos.' },
    })
  }

  // 3. Se precisa CAPTCHA e não foi fornecido, exigir
  if (loginAttempts.requiresCaptcha && !captchaToken) {
    return res.status(400).json({
      success: false,
      error: { message: 'Verificação de segurança necessária', code: 'CAPTCHA_REQUIRED' },
      requiresCaptcha: true,
      failedAttempts: loginAttempts.attemptCount,
    })
  }

  // 4. Autenticar via Supabase (passando captchaToken se fornecido)
  const signInOptions = captchaToken 
    ? { email, password, options: { captchaToken } }
    : { email, password }
  
  const { data, error } = await supabase.auth.signInWithPassword(signInOptions)

  if (error) {
    // 5. Incrementar contador de falhas
    const updatedAttempts = await incrementLoginAttempts(clientIp, email)
    
    return res.status(401).json({
      success: false,
      error: { message: 'Email ou senha inválidos' }, // Mensagem genérica!
      requiresCaptcha: updatedAttempts.requiresCaptcha,
      failedAttempts: updatedAttempts.attemptCount,
    })
  }

  // 6. Login bem-sucedido - resetar contador
  await resetLoginAttempts(clientIp)

  // 7. Criar sessão e retornar...
})
```

### 7.6 Cloudflare Turnstile (CAPTCHA)

O EKIP utiliza **Cloudflare Turnstile** como solução de CAPTCHA, integrado nativamente com Supabase Auth.

#### 7.6.1 Por que Turnstile?

| Característica | Turnstile | reCAPTCHA | hCaptcha |
|----------------|-----------|-----------|----------|
| **Integração Supabase** | ✅ Nativa | ❌ Manual | ✅ Nativa |
| **Privacidade** | ✅ Não rastreia | ⚠️ Google coleta dados | ✅ Não rastreia |
| **UX** | ✅ Invisível/baixa fricção | ⚠️ Puzzles frequentes | ⚠️ Puzzles |
| **Custo** | ✅ Grátis ilimitado | ✅ Grátis até 1M | ✅ Grátis até 1M |

#### 7.6.2 Configuração Supabase Dashboard

1. **Acessar**: Supabase Dashboard → Authentication → Bot and Abuse Protection
2. **Ativar**: "Enable Captcha protection"
3. **Selecionar**: "Turnstile by Cloudflare"
4. **Configurar**: Colar a `Secret Key` do Cloudflare
5. **Adicional**: Ativar "Prevent use of leaked passwords" (opcional)

#### 7.6.3 Implementação Frontend

```tsx
// frontend/src/pages/Login.tsx

import { Turnstile, type TurnstileInstance } from '@marsidev/react-turnstile'

const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY

const Login = () => {
  const [requiresCaptcha, setRequiresCaptcha] = useState(false)
  const [captchaToken, setCaptchaToken] = useState<string | null>(null)
  const turnstileRef = useRef<TurnstileInstance | null>(null)

  // Verificar tentativas ao carregar a página
  useEffect(() => {
    const checkAttempts = async () => {
      const response = await fetch(`${API_URL}/api/auth/login-attempts`, {
        credentials: 'include',
      })
      const result = await response.json()
      if (result.success) {
        setRequiresCaptcha(result.data.requiresCaptcha)
      }
    }
    checkAttempts()
  }, [])

  // Renderizar CAPTCHA condicional
  return (
    <form onSubmit={handleSubmit}>
      {/* Campos de email e senha */}

      {/* CAPTCHA aparece após 3 tentativas */}
      {requiresCaptcha && TURNSTILE_SITE_KEY && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-amber-600">
            <Shield className="w-4 h-4" />
            <span>Verificação de segurança necessária</span>
          </div>
          <Turnstile
            ref={turnstileRef}
            siteKey={TURNSTILE_SITE_KEY}
            onSuccess={(token) => setCaptchaToken(token)}
            onExpire={() => setCaptchaToken(null)}
            onError={() => setCaptchaToken(null)}
            options={{ theme: 'auto', size: 'normal' }}
          />
        </div>
      )}

      <button type="submit" disabled={requiresCaptcha && !captchaToken}>
        Login
      </button>
    </form>
  )
}
```

#### 7.6.4 Endpoint de Verificação de Tentativas

```typescript
// GET /api/auth/login-attempts

router.get('/login-attempts', async (req, res) => {
  const clientIp = req.ip || 'unknown'
  const loginAttempts = await getLoginAttempts(clientIp)

  return res.json({
    success: true,
    data: {
      failedAttempts: loginAttempts.attemptCount,
      requiresCaptcha: loginAttempts.requiresCaptcha,
      isBlocked: loginAttempts.isBlocked,
    },
  })
})
```

#### 7.6.5 Variáveis de Ambiente

```bash
# frontend/.env
VITE_TURNSTILE_SITE_KEY="0x4AAAAAAA..."  # Obter no Cloudflare Dashboard

# backend/.env
# A Secret Key é configurada diretamente no Supabase Dashboard
# NÃO precisa estar no backend (Supabase valida automaticamente)
```

### 7.7 Prevenção de Enumeração de Usuários

Para evitar que atacantes descubram quais emails estão cadastrados:

#### 7.7.1 Mensagens de Erro Genéricas

```typescript
// ✅ Correto - Mensagem genérica
if (error) {
  return res.status(401).json({
    success: false,
    error: { message: 'Email ou senha inválidos' }, // Sempre igual
  })
}

// ❌ Errado - Revela informação
if (error.message === 'User not found') {
  return res.status(401).json({ error: 'Usuário não encontrado' }) // Revela que email não existe
}
```

#### 7.7.2 Recuperação de Senha

```typescript
// frontend/src/pages/ForgotPassword.tsx

// Mensagem SEMPRE a mesma, independente se email existe
setSuccess('Se o e-mail estiver correto, você receberá um link para redefinir sua senha em breve.')
```

### 7.8 Validação de Força de Senha

O EKIP implementa validação de senha forte tanto no frontend quanto no backend.

#### 7.8.1 Requisitos de Senha

| Requisito | Mínimo | Regex |
|-----------|--------|-------|
| **Comprimento** | 8 caracteres | `password.length >= 8` |
| **Maiúscula** | 1 | `/[A-Z]/` |
| **Minúscula** | 1 | `/[a-z]/` |
| **Número** | 1 | `/[0-9]/` |
| **Símbolo** | 1 | `/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~\`]/` |

#### 7.8.2 Implementação Backend

```typescript
// backend/src/lib/passwordValidation.ts

export function validatePasswordStrength(password: string): PasswordValidationResult {
  const errors: string[] = []

  if (password.length < 8) {
    errors.push('A senha deve ter pelo menos 8 caracteres')
  }
  if (!/[A-Z]/.test(password)) {
    errors.push('A senha deve conter pelo menos 1 letra maiúscula')
  }
  if (!/[a-z]/.test(password)) {
    errors.push('A senha deve conter pelo menos 1 letra minúscula')
  }
  if (!/[0-9]/.test(password)) {
    errors.push('A senha deve conter pelo menos 1 número')
  }
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]/.test(password)) {
    errors.push('A senha deve conter pelo menos 1 símbolo especial')
  }

  return {
    valid: errors.length === 0,
    errors,
    strength: calculateStrength(password),
  }
}
```

#### 7.8.3 Indicadores Visuais no Frontend

```tsx
// frontend/src/pages/ResetPassword.tsx

{/* Requisitos de senha com feedback visual */}
<ul className="space-y-1">
  <li className={requirements.minLength ? 'text-green-600' : 'text-gray-500'}>
    {requirements.minLength ? <Check /> : <X />} Mínimo 8 caracteres
  </li>
  <li className={requirements.hasUppercase ? 'text-green-600' : 'text-gray-500'}>
    {requirements.hasUppercase ? <Check /> : <X />} Letra maiúscula (A-Z)
  </li>
  {/* ... outros requisitos */}
</ul>
```

#### 7.8.4 Proteção Adicional: Leaked Passwords

O Supabase oferece opção de bloquear senhas vazadas em data breaches:
- Ativar em: Supabase Dashboard → Authentication → Bot and Abuse Protection
- "Prevent use of leaked passwords" → Enabled

### 7.9 Session Hijacking

**Proteções:**
- Tokens nunca expostos ao frontend
- Session ID é UUID não previsível
- Validação de IP e User-Agent (auditoria)
- Cookies httpOnly e secure

---

## 8. Segurança WebSocket

### 8.1 Autenticação WebSocket

```typescript
// backend/src/websocket/socketAuth.ts

export const socketAuthMiddleware = async (socket, next) => {
  // 1. Extrair sessionId do handshake
  const sessionId = socket.handshake.auth['sessionId']
    || socket.handshake.query['sessionId']
    || socket.handshake.headers['x-session-id']

  if (!sessionId) {
    return next(new Error('SESSION_MISSING'))
  }

  // 2. Validar formato UUID
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
  if (!uuidRegex.test(sessionId)) {
    return next(new Error('SESSION_INVALID_FORMAT'))
  }

  // 3. Buscar e validar sessão
  const session = await getSessionById(sessionId)

  if (!session || !session.isValid) {
    return next(new Error('SESSION_INVALID'))
  }

  // 4. Verificar expiração
  const now = Math.floor(Date.now() / 1000)
  if (session.expiresAt <= now) {
    return next(new Error('SESSION_EXPIRED'))
  }

  // 5. Injetar dados no socket
  socket.sessionId = sessionId
  socket.userId = session.userId
  socket.email = session.email

  next()
}
```

### 8.2 CORS WebSocket

```typescript
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: process.env['FRONTEND_URL'] || 'http://localhost:3000',
    credentials: true
  },
  pingTimeout: 60000,
  pingInterval: 25000
})
```

### 8.3 Rooms por Usuário

Notificações são enviadas apenas para o socket room do usuário:

```typescript
// Cada usuário autenticado entra em seu próprio room
socket.join(`user:${socket.userId}`)

// Notificações enviadas apenas para o usuário específico
io.to(`user:${targetUserId}`).emit('notification', data)
```

---

## 9. Segurança do Frontend

### 9.1 Armazenamento de Estado

```typescript
// frontend/src/stores/authStore.ts

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      sessionId: null,  // Apenas UUID, não sensível
      isAuthenticated: false,
      loading: true,
      
      // Tokens NUNCA armazenados no frontend
    }),
    {
      name: 'ekip-auth-storage',
      partialize: (state) => ({
        user: state.user,
        sessionId: state.sessionId,  // Apenas sessionId persiste
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
)
```

### 9.2 API Client Seguro

```typescript
// frontend/src/lib/apiClient.ts

const request = async (endpoint, options) => {
  const headers = {
    'Content-Type': 'application/json',
  }

  // Adiciona sessionId se disponível
  const sessionId = getSessionId()
  if (sessionId) {
    headers['X-Session-Id'] = sessionId
  }

  // Sempre envia cookies (refresh token httpOnly)
  return fetch(url, {
    ...options,
    headers,
    credentials: 'include',  // CRÍTICO para cookies
    body: body ? JSON.stringify(body) : undefined,
  })
}
```

### 9.3 Refresh Automático

```typescript
// Se recebe 401, tenta renovar sessão automaticamente
if (response.status === 401) {
  const refreshed = await refreshSession()
  
  if (refreshed) {
    // Refaz a requisição com novo sessionId
    return makeRequest()
  } else {
    // Redirect para login
    onAuthError()
  }
}
```

### 9.4 Protected Routes

```typescript
// frontend/src/components/ProtectedRoute.tsx

const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuthStore()

  if (loading) {
    return <LoadingSpinner />
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  return children
}
```

---

## 10. Segurança do Backend

### 10.1 Middleware Stack

```typescript
// backend/src/index.ts

// 1. Security Headers
app.use(helmet())

// 2. CORS restritivo
app.use(cors({
  origin: process.env['FRONTEND_URL'],
  credentials: true,
}))

// 3. Compression
app.use(compression())

// 4. Cookie Parser (httpOnly cookies)
app.use(cookieParser())

// 5. Logging
app.use(morgan('combined'))

// 6. Rate Limiting
app.use(limiter)
app.use(speedLimiter)

// 7. Body Parser com limite
app.use(express.json({ limit: '10mb' }))
```

### 10.2 Validação de Entrada

```typescript
// Sempre validar dados de entrada
router.post('/login', async (req, res) => {
  const { email, password } = req.body

  // Validação explícita
  if (!email || !password) {
    return res.status(400).json({
      success: false,
      error: { message: 'Email e senha são obrigatórios' }
    })
  }

  // Validação de formato
  if (!isValidEmail(email)) {
    return res.status(400).json({
      success: false,
      error: { message: 'Email inválido' }
    })
  }
})
```

### 10.3 Error Handling

```typescript
// backend/src/middleware/errorHandler.ts

export const errorHandler = (err, req, res, next) => {
  // Logar erro completo internamente
  console.error('Error:', err)

  // Retornar mensagem genérica para o cliente
  // (nunca expor stack traces ou detalhes internos)
  res.status(500).json({
    success: false,
    error: {
      message: 'Erro interno do servidor',
      code: 'INTERNAL_ERROR'
    }
  })
}
```

### 10.4 Logging e Auditoria

```typescript
// Sessões registram:
{
  user_id,
  email,
  user_agent,   // Browser/dispositivo
  ip_address,   // IP do cliente
  created_at,   // Quando foi criada
  last_used_at, // Última atividade
  is_valid      // Status
}
```

---

## 11. Variáveis de Ambiente

### 11.1 Backend (.env)

```bash
# ===========================================
# DATABASE
# ===========================================
DATABASE_URL="postgresql://user:pass@host:5432/ekip_db"

# ===========================================
# SUPABASE (CRÍTICO)
# ===========================================
SUPABASE_URL="https://your-project.supabase.co"

# ANON KEY - Acesso público limitado (usado com RLS)
SUPABASE_ANON_KEY="eyJ..."

# SERVICE ROLE KEY - Acesso admin (bypassa RLS)
# ⚠️ NUNCA expor no frontend
SUPABASE_SERVICE_ROLE_KEY="eyJ..."

# ===========================================
# ENCRYPTION (CRÍTICO)
# ===========================================
# Chave para criptografar tokens no banco
# Gerar: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
ENCRYPTION_KEY="a1b2c3d4..."  # 64 caracteres hex

# ===========================================
# SERVER
# ===========================================
PORT=5000
NODE_ENV=production
FRONTEND_URL=https://ekip.viaconsulting.com.br

# ===========================================
# JWT (Legado)
# ===========================================
JWT_SECRET="your-jwt-secret"
```

### 11.2 Frontend (.env)

```bash
# ===========================================
# API
# ===========================================
VITE_API_URL=https://api.ekip.viaconsulting.com.br

# ===========================================
# APP
# ===========================================
VITE_APP_NAME="EKIP"
VITE_APP_VERSION=1.0.0

# ⚠️ NUNCA colocar secrets no frontend
# Todas as chaves Supabase ficam no backend
```

### 11.3 Segurança de Variáveis de Ambiente

**✅ FAZER:**
- Usar arquivo `.env` (nunca `.env` no Git)
- Ter `.env.example` com placeholders
- Diferentes chaves por ambiente (dev/staging/prod)
- Rotacionar `ENCRYPTION_KEY` periodicamente

**❌ NUNCA:**
- Commitar `.env` no repositório
- Expor `SUPABASE_SERVICE_ROLE_KEY` no frontend
- Usar a mesma `ENCRYPTION_KEY` em todos os ambientes
- Logar variáveis de ambiente em produção

---

## 12. Boas Práticas e Recomendações

### 12.1 Desenvolvimento

```typescript
// ✅ Sempre usar apiClient no frontend
import apiClient from '@/lib/apiClient'
const response = await apiClient.get('/api/projects')

// ❌ Nunca usar fetch direto (perde autenticação)
const response = await fetch('/api/projects')  // Sem sessionId!

// ✅ Sempre usar sessionAuth nas rotas protegidas
router.get('/data', sessionAuth, async (req, res) => {
  const { data } = await req.supabaseUser!.from('table').select('*')
})

// ❌ Nunca ignorar autenticação
router.get('/data', async (req, res) => {  // Sem proteção!
  // ...
})
```

### 12.2 Produção

1. **HTTPS Obrigatório**: Certificado TLS válido
2. **Cookies Secure**: `secure: true` em produção
3. **CORS Restritivo**: Apenas domínio do frontend
4. **Rate Limiting**: Ajustar limites conforme necessidade
5. **Monitoramento**: Logs de sessões e erros
6. **Backup**: Estratégia de backup para sessions table

### 12.3 Rotação de Chaves

**ENCRYPTION_KEY:**
1. Gerar nova chave
2. Manter ambas as chaves temporariamente
3. Migrar sessões ativas (re-criptografar)
4. Remover chave antiga

**SUPABASE_SERVICE_ROLE_KEY:**
1. Regenerar no dashboard Supabase
2. Atualizar variável de ambiente
3. Reiniciar serviços

---

## 13. Checklist de Segurança

### 13.1 Configuração

- [ ] `.env` não está no Git (verificar `.gitignore`)
- [ ] `ENCRYPTION_KEY` tem 64 caracteres hex
- [ ] `SUPABASE_SERVICE_ROLE_KEY` é service_role (não anon)
- [ ] `NODE_ENV=production` em produção
- [ ] CORS aponta para domínio correto do frontend
- [ ] Certificado TLS/SSL válido

### 13.2 Autenticação

- [ ] Tokens Supabase NUNCA expostos ao frontend
- [ ] Cookies são `httpOnly`, `secure`, `sameSite: 'strict'`
- [ ] Session ID é UUID gerado com crypto
- [ ] Refresh automático funciona corretamente
- [ ] Logout invalida sessão no banco

### 13.3 Autorização

- [ ] Todas as rotas protegidas usam `sessionAuth`
- [ ] RLS está habilitado nas tabelas Supabase
- [ ] `supabaseAdmin` usado apenas quando necessário
- [ ] `req.supabaseUser` usado para queries do usuário

### 13.4 Proteções

- [ ] Helmet está habilitado
- [ ] Rate limiting global está ativo (100 req/15min)
- [ ] Rate limiting específico para login (5 req/15min)
- [ ] Validação de entrada em todas as rotas
- [ ] Erros não expõem informações sensíveis
- [ ] Logs não contêm tokens ou senhas

### 13.5 Proteção de Login

- [ ] CAPTCHA (Turnstile) configurado e funcionando
- [ ] `VITE_TURNSTILE_SITE_KEY` definido no frontend
- [ ] Tabela `login_attempts` criada no Supabase
- [ ] CAPTCHA aparece após 3 tentativas falhas
- [ ] Rate limiter bloqueia após 5 tentativas
- [ ] Mensagens de erro são genéricas (anti-enumeração)
- [ ] Validação de força de senha implementada
- [ ] Indicadores visuais de requisitos de senha

### 13.6 WebSocket

- [ ] Autenticação obrigatória para conexão
- [ ] SessionId validado no handshake
- [ ] CORS configurado corretamente
- [ ] Rooms segregam usuários

---

## Anexo A: Fluxo Completo de Autenticação

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                              FLUXO DE AUTENTICAÇÃO EKIP                                  │
└─────────────────────────────────────────────────────────────────────────────────────────┘

┌─────────┐                   ┌─────────┐                   ┌──────────┐
│ BROWSER │                   │ BACKEND │                   │ SUPABASE │
└────┬────┘                   └────┬────┘                   └────┬─────┘
     │                              │                              │
     │  1. POST /api/auth/login     │                              │
     │  {email, password}           │                              │
     │─────────────────────────────▶│                              │
     │                              │                              │
     │                              │  2. signInWithPassword()     │
     │                              │─────────────────────────────▶│
     │                              │                              │
     │                              │  3. {access_token,           │
     │                              │      refresh_token}          │
     │                              │◀─────────────────────────────│
     │                              │                              │
     │                              │  4. encrypt(access_token)    │
     │                              │     encrypt(refresh_token)   │
     │                              │     hash(backend_refresh)    │
     │                              │                              │
     │                              │  5. INSERT INTO sessions     │
     │                              │─────────────────────────────▶│
     │                              │                              │
     │  6. Set-Cookie:              │                              │
     │     ekip_session_id=UUID     │                              │
     │     ekip_refresh_token=...   │                              │
     │     (httpOnly, secure)       │                              │
     │                              │                              │
     │  7. {sessionId, user}        │                              │
     │◀─────────────────────────────│                              │
     │                              │                              │
     │  8. Store sessionId          │                              │
     │     (localStorage)           │                              │
     │                              │                              │
     │  ═══════════════════════════════════════════════════════   │
     │                        REQUISIÇÃO AUTENTICADA               │
     │  ═══════════════════════════════════════════════════════   │
     │                              │                              │
     │  9. GET /api/projects        │                              │
     │     X-Session-Id: UUID       │                              │
     │─────────────────────────────▶│                              │
     │                              │                              │
     │                              │  10. getSessionById(UUID)    │
     │                              │      decrypt(tokens)         │
     │                              │◀────────────────────────────▶│
     │                              │                              │
     │                              │  11. createUserClient(token) │
     │                              │      (aplica RLS)            │
     │                              │─────────────────────────────▶│
     │                              │                              │
     │  12. {success: true, data}   │                              │
     │◀─────────────────────────────│                              │
     │                              │                              │
```

---

## Anexo B: Estrutura de Arquivos de Segurança

```
backend/
├── src/
│   ├── lib/
│   │   ├── encryption.ts          # AES-256-GCM encrypt/decrypt
│   │   ├── sessionStore.ts        # Gerenciamento de sessões
│   │   ├── supabaseAdmin.ts       # Cliente admin (bypass RLS)
│   │   └── supabaseUserClient.ts  # Cliente com RLS
│   ├── middleware/
│   │   ├── sessionAuth.ts         # Middleware de autenticação
│   │   ├── errorHandler.ts        # Tratamento de erros
│   │   └── notFound.ts            # 404 handler
│   ├── websocket/
│   │   ├── socketAuth.ts          # Autenticação WebSocket
│   │   └── notificationSocket.ts  # Lógica de notificações
│   └── routes/
│       └── auth.ts                # Rotas de autenticação
│
frontend/
├── src/
│   ├── stores/
│   │   └── authStore.ts           # Estado de autenticação
│   ├── lib/
│   │   └── apiClient.ts           # Cliente HTTP seguro
│   └── components/
│       └── ProtectedRoute.tsx     # Proteção de rotas
```

---

## Histórico de Revisões

| Versão | Data | Autor | Descrição |
|--------|------|-------|-----------|
| 1.0.0 | Jan 2026 | EKIP Team | Versão inicial |
| 1.1.0 | Jan 2026 | EKIP Team | Proteções de Login: Rate limiting específico, CAPTCHA Turnstile condicional, tabela login_attempts, validação de senha forte, prevenção de enumeração de usuários |

---

> **Nota**: Este documento deve ser revisado e atualizado sempre que houver mudanças na arquitetura de segurança do EKIP.
