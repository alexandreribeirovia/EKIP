# 🔐 Como o JWT é Transmitido no Supabase Realtime WebSocket

## ❓ A Dúvida

Ao inspecionar a conexão WebSocket no DevTools, vemos:

```bash
wss://gylgbwyjlwfcssjhultw.supabase.co/realtime/v1/websocket?apikey=sb_publishable_...&vsn=1.0.0
```

**Pergunta:** Onde está o JWT token? Só vejo a `apikey` (anon key) na URL!

---

## ✅ A Resposta

O JWT token **NÃO é enviado nos headers HTTP do handshake WebSocket inicial**. Em vez disso, ele é transmitido **dentro de mensagens Phoenix após a conexão ser estabelecida**.

### Fluxo de Autenticação do Supabase Realtime

```
1. HANDSHAKE INICIAL (HTTP → WebSocket)
   ┌─────────────────────────────────────────────────────┐
   │ wss://projeto.supabase.co/realtime/v1/websocket    │
   │ ?apikey=ANON_KEY                                    │
   │                                                      │
   │ Headers:                                             │
   │   - Upgrade: websocket                              │
   │   - Connection: Upgrade                             │
   │   - Sec-WebSocket-Key: ...                          │
   │                                                      │
   │ ❌ JWT Token NÃO está aqui!                         │
   └─────────────────────────────────────────────────────┘
                           │
                           ▼
2. CONEXÃO WEBSOCKET ESTABELECIDA
   ┌─────────────────────────────────────────────────────┐
   │ WebSocket aberto e conectado                        │
   └─────────────────────────────────────────────────────┘
                           │
                           ▼
3. MENSAGEM DE JOIN COM JWT (Protocolo Phoenix)
   ┌─────────────────────────────────────────────────────┐
   │ Cliente envia mensagem Phoenix:                     │
   │                                                      │
   │ {                                                    │
   │   "topic": "realtime:notifications:78897131...",    │
   │   "event": "phx_join",                              │
   │   "payload": {                                       │
   │     "config": {                                      │
   │       "postgres_changes": [...],                    │
   │       "broadcast": { "self": false },               │
   │       "presence": { "key": "78897131..." }          │
   │     },                                               │
   │     "access_token": "eyJhbGciOiJIUzI1NiIsInR5..." ✅│
   │   },                                                 │
   │   "ref": "1"                                         │
   │ }                                                    │
   │                                                      │
   │ ✅ JWT Token enviado AQUI!                          │
   └─────────────────────────────────────────────────────┘
                           │
                           ▼
4. SERVIDOR VALIDA JWT E APLICA RLS
   ┌─────────────────────────────────────────────────────┐
   │ Supabase Realtime Server:                           │
   │   1. Decodifica JWT token                           │
   │   2. Extrai auth.uid() e auth.role()                │
   │   3. Aplica RLS policies na subscrição              │
   │   4. Retorna apenas dados autorizados               │
   │                                                      │
   │ Resposta:                                            │
   │ {                                                    │
   │   "event": "phx_reply",                             │
   │   "payload": {                                       │
   │     "status": "ok",                                  │
   │     "response": {}                                   │
   │   },                                                 │
   │   "ref": "1"                                         │
   │ }                                                    │
   └─────────────────────────────────────────────────────┘
                           │
                           ▼
5. DADOS EM TEMPO REAL (COM RLS APLICADO)
   ┌─────────────────────────────────────────────────────┐
   │ Cliente recebe APENAS notificações autorizadas:     │
   │   - audience='user' AND user_id='78897131...'       │
   │   - audience='all'                                   │
   │                                                      │
   │ ✅ RLS policies funcionando!                        │
   └─────────────────────────────────────────────────────┘
```

---

## 🔍 Como Verificar se o JWT Está Sendo Enviado

### Método 1: Logs no Console (Implementado)

Após fazer login, você verá no console:

```javascript
🔐 WebSocket será autenticado com JWT
🔑 Access Token (primeiros 50 chars): eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhdWQiOi...
👤 User ID do JWT: 78897131-e73e-4584-8931-495218c78f28
⏰ Token expira em: 30/10/2025, 14:30:00
```

### Método 2: DevTools Network → WS (WebSocket Messages)

1. Abra DevTools (F12)
2. Vá para a aba **Network**
3. Filtre por **WS** (WebSocket)
4. Clique na conexão `websocket?apikey=...`
5. Vá para a sub-aba **Messages**
6. Procure pela primeira mensagem enviada pelo cliente

**Você verá algo assim:**

```json
{
  "topic": "realtime:notifications:78897131-e73e-4584-8931-495218c78f28",
  "event": "phx_join",
  "payload": {
    "config": {
      "postgres_changes": [
        {
          "event": "INSERT",
          "schema": "public",
          "table": "notifications",
          "filter": "user_id=eq.78897131-e73e-4584-8931-495218c78f28"
        }
      ],
      "broadcast": { "self": false },
      "presence": { "key": "78897131-e73e-4584-8931-495218c78f28" }
    },
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhdWQiOiJhdXRoZW50aWNhdGVkIiwiZXhwIjoxNzMwMzE0ODAwLCJpYXQiOjE3MzAzMTEyMDAsImlzcyI6Imh0dHBzOi8vZ3lsZ2J3eWpsd2Zjc3NqaHVsdHcuc3VwYWJhc2UuY28vYXV0aC92MSIsInN1YiI6Ijc4ODk3MTMxLWU3M2UtNDU4NC04OTMxLTQ5NTIxOGM3OGYyOCIsImVtYWlsIjoiYWxleGFuZHJlLnJpYmVpcm9AdmlhY29uc3VsdGluZy5jb20uYnIiLCJwaG9uZSI6IiIsImFwcF9tZXRhZGF0YSI6eyJwcm92aWRlciI6ImVtYWlsIiwicHJvdmlkZXJzIjpbImVtYWlsIl19LCJ1c2VyX21ldGFkYXRhIjp7Im5hbWUiOiJBbGV4YW5kcmUgUmliZWlybyIsInJvbGUiOiJhZG1pbiJ9LCJyb2xlIjoiYXV0aGVudGljYXRlZCIsImFhbCI6ImFhbDEiLCJhbXIiOlt7Im1ldGhvZCI6InBhc3N3b3JkIiwidGltZXN0YW1wIjoxNzMwMzExMjAwfV0sInNlc3Npb25faWQiOiI1YzhhZGQ4Yi04MjNkLTRlYmItOGE1Yy0wZjA2NTY3YjNiYzIifQ.5nGHw0KXqL5pZQR7F8YmH8X9Nq3wJ5K1L2M3N4O5P6Q"
  },
  "ref": "1"
}
```

**✅ Veja! O `access_token` está na mensagem `phx_join`!**

### Método 3: Decodificar o JWT e Verificar Payload

Cole no console do navegador:

```javascript
// Obter sessão atual
const { data: { session } } = await supabase.auth.getSession()

// Decodificar JWT (payload está no meio, entre os pontos)
const token = session.access_token
const payload = JSON.parse(atob(token.split('.')[1]))

console.log('📦 Payload do JWT:', payload)
console.log('👤 User ID (sub):', payload.sub)
console.log('📧 Email:', payload.email)
console.log('🎭 Role:', payload.role)
console.log('⏰ Expira em:', new Date(payload.exp * 1000).toLocaleString('pt-BR'))
```

**Resultado esperado:**

```javascript
{
  aud: "authenticated",
  exp: 1730314800,
  iat: 1730311200,
  iss: "https://gylgbwyjlwfcssjhultw.supabase.co/auth/v1",
  sub: "78897131-e73e-4584-8931-495218c78f28",
  email: "seu@email.com",
  role: "authenticated",
  user_metadata: {
    name: "Seu Nome",
    role: "admin"
  }
}
```

---

## 🛡️ Como o RLS é Aplicado no Realtime

### 1. Cliente Subscreve ao Canal

```javascript
const channel = supabase.channel('notifications:user_id')
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'notifications',
    filter: 'user_id=eq.78897131-e73e-4584-8931-495218c78f28'
  }, (payload) => {
    console.log('Nova notificação:', payload.new)
  })
  .subscribe()
```

### 2. Supabase Realtime Server Recebe JWT

O servidor extrai:
- `sub` (User ID): `78897131-e73e-4584-8931-495218c78f28`
- `role`: `authenticated`

### 3. RLS Policy é Aplicada

```sql
-- Política RLS no servidor
CREATE POLICY "Users can view their notifications"
ON notifications
FOR SELECT
USING (
  (audience = 'user' AND auth.uid()::text = user_id)
  OR
  (audience = 'all')
);
```

O servidor substitui `auth.uid()` pelo `sub` do JWT token.

### 4. Dados Filtrados São Enviados

O cliente recebe **APENAS**:
- Notificações com `user_id = '78897131-e73e-4584-8931-495218c78f28'`
- Notificações com `audience = 'all'`

---

## 🧪 Teste de Segurança

### Teste 1: Criar Notificação para Outro Usuário

No **Supabase SQL Editor**:

```sql
-- Criar notificação para OUTRO usuário
INSERT INTO notifications (title, message, type_id, type, audience, user_id, source_type)
SELECT 
  '🔒 Teste de Segurança',
  'Esta notificação é para outro usuário',
  id, 'info', 'user', 'OUTRO_USER_ID_AQUI', 'system'
FROM domains
WHERE type = 'notification_type' AND value = 'info'
LIMIT 1;
```

**Resultado esperado:** Você **NÃO** verá esta notificação no sino, pois o RLS bloqueou!

### Teste 2: Criar Notificação para Você

```sql
-- Criar notificação para SEU usuário
INSERT INTO notifications (title, message, type_id, type, audience, user_id, source_type)
SELECT 
  '✅ Teste de Segurança',
  'Esta notificação é para você!',
  id, 'success', 'user', '78897131-e73e-4584-8931-495218c78f28', 'system'
FROM domains
WHERE type = 'notification_type' AND value = 'success'
LIMIT 1;
```

**Resultado esperado:** Notificação aparece **INSTANTANEAMENTE** no sino! 🔔

### Teste 3: Criar Notificação Global

```sql
-- Criar notificação global (todos os usuários)
INSERT INTO notifications (title, message, type_id, type, audience, source_type)
SELECT 
  '🌍 Anúncio Global',
  'Esta notificação é para todos os usuários',
  id, 'warning', 'all', 'system'
FROM domains
WHERE type = 'notification_type' AND value = 'warning'
LIMIT 1;
```

**Resultado esperado:** Todos os usuários conectados veem a notificação!

---

## 📊 Diferença: Anon Key vs JWT Token

| Aspecto | Anon Key | JWT Token |
|---------|----------|-----------|
| **O que é** | Chave pública do projeto | Token de autenticação do usuário |
| **Onde vai** | Query string da URL do WebSocket | Payload da mensagem `phx_join` |
| **Propósito** | Identificar o projeto Supabase | Identificar o usuário autenticado |
| **RLS** | Não aplica RLS personalizado | Aplica RLS com `auth.uid()` |
| **Segurança** | Baixa (chave pública) | Alta (token assinado e com expiração) |
| **Exemplo** | `?apikey=eyJhbGc...` | `"access_token": "eyJhbGc..."` |

### Por Que Precisamos de Ambos?

1. **Anon Key** → Identifica o projeto Supabase (qual banco de dados conectar)
2. **JWT Token** → Identifica o usuário (qual RLS policy aplicar)

---

## 🔒 Checklist de Segurança

- [x] **JWT token presente na sessão** (verificar no console)
- [x] **JWT token enviado no `phx_join`** (verificar no DevTools → WS → Messages)
- [x] **RLS policies criadas** (SELECT, INSERT, UPDATE, DELETE)
- [x] **Teste de segurança realizado** (notificação de outro usuário não aparece)
- [x] **Realtime habilitado** na tabela `notifications`
- [x] **Logs sem erros** no console do navegador

---

## 🎯 Resumo

### ✅ O que está acontecendo (correto):

1. **Login** → Backend autentica via Supabase Auth
2. **setSession()** → Cliente Supabase recebe JWT token
3. **WebSocket handshake** → Conexão inicial com `?apikey=ANON_KEY`
4. **Mensagem phx_join** → JWT token enviado no payload
5. **Servidor valida JWT** → Extrai `auth.uid()` e `auth.role()`
6. **RLS aplicado** → Apenas dados autorizados são enviados
7. **Cliente recebe dados** → Notificações em tempo real (seguras)

### ❌ O que NÃO está acontecendo (errado):

- ❌ JWT no header HTTP do handshake (não é assim que funciona)
- ❌ JWT na URL do WebSocket (seria inseguro)
- ❌ Dados não filtrados (RLS está ativo)

---

## 📚 Referências

- [Supabase Realtime: Authorization](https://supabase.com/docs/guides/realtime/authorization)
- [Phoenix Channels: Authentication](https://hexdocs.pm/phoenix/channels.html#authenticating-users)
- [JWT Token Structure](https://jwt.io/)

---

**Status:** ✅ **SEGURO**  
**Data:** 30/10/2025  
**Conclusão:** O JWT token está sendo transmitido corretamente no payload da mensagem Phoenix `phx_join`, e o RLS está funcionando como esperado.
