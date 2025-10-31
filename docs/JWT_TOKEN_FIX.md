# 🔒 Correção JWT Token - Sistema de Notificações

## 🔴 Problema Identificado

O sistema de notificações estava mostrando:
```
🔑 JWT Token presente: false
👤 User ID: undefined
⏰ Token expira em: N/A
```

**Causa raiz:** O login da aplicação estava chamando o backend Node.js (`/api/auth/login`), que autenticava corretamente via Supabase Auth, **MAS** não estava configurando a sessão no cliente Supabase do frontend. Isso resultava em:

- ✅ Backend autenticado (token válido)
- ❌ Frontend Supabase sem sessão (sem JWT nas queries)
- ❌ Notificações Realtime sem autenticação JWT
- ❌ RLS policies não funcionando corretamente

---

## ✅ Solução Implementada

### Fluxo ANTES (Incorreto):

```
┌─────────────┐
│  Login.tsx  │
└──────┬──────┘
       │ 1. POST /api/auth/login
       │
       ▼
┌──────────────┐
│  Backend API │ ──► Supabase Auth (signInWithPassword)
└──────┬───────┘
       │ 2. Retorna: { user, session: { access_token, refresh_token } }
       │
       ▼
┌──────────────────┐
│  authStore.ts    │
│  login(user, session) ❌ Apenas armazena no Zustand
└──────────────────┘

PROBLEMA: Cliente Supabase do frontend não tem a sessão!
```

### Fluxo DEPOIS (Correto):

```
┌─────────────┐
│  Login.tsx  │
└──────┬──────┘
       │ 1. POST /api/auth/login
       │
       ▼
┌──────────────┐
│  Backend API │ ──► Supabase Auth (signInWithPassword)
└──────┬───────┘
       │ 2. Retorna: { user, session: { access_token, refresh_token } }
       │
       ▼
┌─────────────────────────────────────────────┐
│  Login.tsx                                  │
│                                             │
│  ✅ supabase.auth.setSession({              │
│       access_token,                         │
│       refresh_token                         │
│     })                                      │
│                                             │
│  ✅ login(user, session)                    │
└─────────────────────────────────────────────┘
       │
       ▼
┌────────────────────────────────────────────┐
│  Cliente Supabase tem JWT Token!           │
│  ✅ Queries incluem JWT automaticamente     │
│  ✅ Realtime usa JWT no WebSocket           │
│  ✅ RLS policies funcionam corretamente     │
└────────────────────────────────────────────┘
```

---

## 📝 Código Modificado

### `frontend/src/pages/Login.tsx`

**ANTES:**
```typescript
const result = await response.json()

if (!response.ok || !result.success) {
  setError(result.error?.message || 'Erro ao fazer login');
  return;
}

// Armazenar usuário e token no Zustand
login(result.data.user, result.data.session) // ❌ Sessão não configurada no Supabase
```

**DEPOIS:**
```typescript
const result = await response.json()

if (!response.ok || !result.success) {
  setError(result.error?.message || 'Erro ao fazer login');
  return;
}

// CRÍTICO: Setar a sessão no cliente Supabase do frontend
// Isso garante que o JWT token será incluído automaticamente em todas as requisições
const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
  access_token: result.data.session.access_token,
  refresh_token: result.data.session.refresh_token,
})

if (sessionError) {
  console.error('Erro ao setar sessão no Supabase:', sessionError)
  setError('Erro ao configurar sessão de autenticação')
  return
}

console.log('✅ Sessão Supabase configurada com sucesso!')
console.log('🔑 JWT Token:', sessionData.session?.access_token ? 'PRESENTE' : 'AUSENTE')
console.log('👤 User ID:', sessionData.user?.id)

// Armazenar usuário e sessão no Zustand
login(result.data.user, sessionData.session!) // ✅ Sessão configurada corretamente
```

---

## 🧪 Testes

### Teste 1: Verificar JWT Token no Console

Após fazer login, o console deve mostrar:

```
✅ Sessão Supabase configurada com sucesso!
🔑 JWT Token: PRESENTE
👤 User ID: 78897131-e73e-4584-8931-495218c78f28
🔑 JWT Token presente: true  ✅
👤 User ID: 78897131-e73e-4584-8931-495218c78f28  ✅
⏰ Token expira em: 30/10/2025, 14:30:00  ✅
📡 Iniciando subscrição de notificações para usuário: 78897131-e73e-4584-8931-495218c78f28
📊 Status do canal de notificações: SUBSCRIBED
✅ Canal de notificações conectado com sucesso!
```

### Teste 2: Verificar Sessão no DevTools

No Console do navegador:

```javascript
const { data: { session } } = await supabase.auth.getSession()
console.log('JWT Token:', session?.access_token)
console.log('User ID:', session?.user?.id)
console.log('Expira em:', new Date(session?.expires_at * 1000).toLocaleString('pt-BR'))
```

**Resultado esperado:**
```
JWT Token: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
User ID: 78897131-e73e-4584-8931-495218c78f28
Expira em: 30/10/2025, 14:30:00
```

### Teste 3: Criar Notificação de Teste

No **Supabase SQL Editor**:

```sql
INSERT INTO notifications (title, message, type_id, type, audience, user_id, source_type)
SELECT 
  '🔐 JWT Token Funcionando!',
  'Se você está vendo esta notificação, o JWT está configurado corretamente!',
  id, 'success', 'user', '78897131-e73e-4584-8931-495218c78f28', 'system'
FROM domains
WHERE type = 'notification_type' AND value = 'success'
LIMIT 1;
```

**Resultado esperado:** Notificação aparece **instantaneamente** no sino de notificações! 🔔

---

## 🔧 Como Usar

### 1. Fazer Logout e Login Novamente

```typescript
// No navegador:
await supabase.auth.signOut()
// OU clicar no botão de Logout
```

### 2. Fazer Login Novamente

- Acesse a página de login
- Digite seu email e senha
- Clique em "LOGIN"

### 3. Verificar Logs no Console

Abra DevTools (F12) e verifique:
- ✅ `Sessão Supabase configurada com sucesso!`
- ✅ `JWT Token presente: true`
- ✅ `Canal de notificações conectado com sucesso!`

---

## 🎯 Benefícios da Correção

### 1. **Segurança Aprimorada**
- RLS policies agora funcionam corretamente
- JWT token validado em todas as requisições Supabase
- Usuários só veem suas próprias notificações

### 2. **Realtime Funcionando**
- WebSocket autentica com JWT
- Notificações chegam em tempo real
- Reconexão automática em caso de erro

### 3. **Consistência de Dados**
- Mesmo usuário no backend e frontend
- Sessão sincronizada entre localStorage e Supabase
- Auto-refresh de token funcionando

### 4. **Debugging Facilitado**
- Logs claros no console
- Estado da sessão visível
- Erros descritivos

---

## 📊 Arquitetura Final

```
┌───────────────────────────────────────────────────────────────┐
│                         FRONTEND                              │
├───────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌─────────────────┐      ┌──────────────────┐              │
│  │  Login.tsx      │──1──►│  Backend API     │              │
│  │                 │      │  /api/auth/login │              │
│  │  - Email        │      │                  │              │
│  │  - Password     │◄─2───│  Supabase Auth   │              │
│  └─────────────────┘      │  (signIn)        │              │
│           │               └──────────────────┘              │
│           │ 3. setSession({ access_token, refresh_token })  │
│           ▼                                                  │
│  ┌─────────────────────────────────────────────┐            │
│  │  supabaseClient.ts                          │            │
│  │  ✅ JWT Token armazenado                    │            │
│  │  ✅ Auto incluído em:                       │            │
│  │     - .from().select()                      │            │
│  │     - .channel().subscribe()                │            │
│  │     - .storage.from()                       │            │
│  └─────────────────────────────────────────────┘            │
│           │                                                  │
│           ├──────────────────┬────────────────────┐         │
│           ▼                  ▼                    ▼         │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────┐   │
│  │ Notifications│   │   Projects   │   │   Employees  │   │
│  │ (Realtime)   │   │   (Query)    │   │   (Query)    │   │
│  │              │   │              │   │              │   │
│  │ ✅ JWT Token │   │ ✅ JWT Token │   │ ✅ JWT Token │   │
│  └──────────────┘   └──────────────┘   └──────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                      SUPABASE                               │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────────────────────────────────────────┐          │
│  │  Row Level Security (RLS) Policies           │          │
│  │  ✅ auth.uid() = user_id                     │          │
│  │  ✅ auth.role() = 'authenticated'            │          │
│  └──────────────────────────────────────────────┘          │
│                                                             │
│  ┌──────────────────────────────────────────────┐          │
│  │  Realtime (WebSocket)                        │          │
│  │  ✅ JWT Token na conexão                     │          │
│  │  ✅ RLS aplicado em tempo real               │          │
│  └──────────────────────────────────────────────┘          │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 🆘 Troubleshooting

### Problema: Ainda mostra "JWT Token presente: false"

**Solução:**
1. Limpar localStorage:
   ```javascript
   localStorage.clear()
   location.reload()
   ```
2. Fazer logout e login novamente
3. Verificar se `.env` tem as variáveis corretas:
   ```
   VITE_SUPABASE_URL=https://seu-projeto.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJhbGc...
   ```

### Problema: Notificações não aparecem em tempo real

**Solução:**
1. Verificar se Realtime está habilitado na tabela `notifications` (Supabase Dashboard → Database → Replication)
2. Verificar políticas RLS (executar SQL de `FIX_NOTIFICATIONS_SECURITY.md`)
3. Verificar logs no console do navegador

### Problema: Erro "Invalid JWT"

**Solução:**
1. Token expirado - fazer logout e login novamente
2. Verificar se `SUPABASE_ANON_KEY` está correto no `.env`
3. Verificar se o servidor Vite foi reiniciado após mudanças no `.env`

---

## 📚 Documentação Relacionada

- [SUPABASE_AUTH.md](./SUPABASE_AUTH.md) - Documentação completa do sistema de autenticação
- [FIX_NOTIFICATIONS_SECURITY.md](./FIX_NOTIFICATIONS_SECURITY.md) - Políticas RLS para notificações
- [NOTIFICATIONS_SYSTEM.md](./NOTIFICATIONS_SYSTEM.md) - Sistema de notificações completo

---

**Status:** ✅ **IMPLEMENTADO**  
**Data:** 30/10/2025  
**Impacto:** 🔴 CRÍTICO - Afeta segurança e funcionalidade do sistema
