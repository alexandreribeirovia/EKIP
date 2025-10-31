# 🔒 Correção de Segurança - Notificações

## Problema Identificado

O sistema de notificações está funcionando mas **NÃO está seguro** porque:

```
🔑 JWT Token presente: false
👤 User ID: undefined
⏰ Token expira em: N/A
```

Isso indica que as **políticas RLS** (Row Level Security) não estão validando corretamente o JWT token do Supabase Auth.

---

## ✅ Solução (Passo a Passo)

### 1. Verificar Realtime Habilitado

No **Supabase Dashboard**:
1. Acesse **Database → Replication**
2. Procure a tabela `notifications`
3. Certifique-se de que o **toggle está LIGADO** (verde)

**OU** execute no SQL Editor:

```sql
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
```

---

### 2. Executar SQL de Correção de Segurança

Abra o **Supabase SQL Editor** e execute o seguinte SQL:

```sql
-- ========================================
-- CORREÇÃO COMPLETA DE SEGURANÇA RLS
-- ========================================

-- 1. REMOVER POLÍTICAS ANTIGAS
DROP POLICY IF EXISTS "Service role can insert notifications" ON notifications;
DROP POLICY IF EXISTS "Users can view their notifications" ON notifications;
DROP POLICY IF EXISTS "Users can update their notifications" ON notifications;
DROP POLICY IF EXISTS "Users can delete their notifications" ON notifications;
DROP POLICY IF EXISTS "Authenticated users can insert notifications" ON notifications;

-- 2. GARANTIR QUE RLS ESTÁ HABILITADO
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- 3. CRIAR POLÍTICAS RLS SEGURAS
-- ========================================

-- 3.1. SELECT: Usuário vê apenas suas notificações ou globais
CREATE POLICY "Users can view their notifications"
ON notifications
FOR SELECT
USING (
  -- Notificações do usuário específico
  (audience = 'user' AND auth.uid()::text = user_id)
  OR
  -- Notificações globais
  (audience = 'all')
);

-- 3.2. INSERT: Apenas usuários autenticados podem criar
CREATE POLICY "Authenticated users can insert notifications"
ON notifications
FOR INSERT
WITH CHECK (
  -- Usuário autenticado
  auth.role() = 'authenticated'
);

-- 3.3. UPDATE: Usuário só atualiza suas próprias notificações
CREATE POLICY "Users can update their notifications"
ON notifications
FOR UPDATE
USING (
  (audience = 'user' AND auth.uid()::text = user_id)
  OR
  (audience = 'all')
)
WITH CHECK (
  (audience = 'user' AND auth.uid()::text = user_id)
  OR
  (audience = 'all')
);

-- 3.4. DELETE: Usuário só deleta suas próprias notificações
CREATE POLICY "Users can delete their notifications"
ON notifications
FOR DELETE
USING (
  audience = 'user' AND 
  auth.uid()::text = user_id
);

-- 4. VERIFICAR CONFIGURAÇÃO
-- ========================================

-- Verificar se RLS está habilitado
SELECT 
  schemaname, 
  tablename, 
  rowsecurity as "RLS_HABILITADO"
FROM pg_tables
WHERE tablename = 'notifications';

-- Listar todas as políticas
SELECT 
  policyname as "POLITICA",
  cmd as "COMANDO",
  permissive as "PERMISSIVA",
  qual as "USING",
  with_check as "WITH_CHECK"
FROM pg_policies
WHERE tablename = 'notifications'
ORDER BY cmd, policyname;
```

---

### 3. Verificar JWT Token no Frontend

Abra o **DevTools** (F12) no navegador:

```javascript
// Cole no Console do navegador:
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

---

### 4. Testar Segurança

#### Teste 1: Criar Notificação de Teste

No **Supabase SQL Editor**, **com você logado no frontend**:

```sql
-- Criar notificação para seu usuário
INSERT INTO notifications (
  title, 
  message, 
  type_id, 
  type, 
  audience, 
  user_id,
  source_type
)
SELECT 
  '✅ Teste de Segurança',
  'Se você está vendo esta notificação, o JWT está funcionando!',
  id,
  'success',
  'user',
  '78897131-e73e-4584-8931-495218c78f28', -- SEU USER ID
  'system'
FROM domains
WHERE type = 'notification_type' AND value = 'success'
LIMIT 1;
```

**Resultado esperado:** Notificação aparece **instantaneamente** no frontend!

---

#### Teste 2: Tentar Acessar Notificações de Outro Usuário

```sql
-- Tentar buscar notificações de outro usuário (deve retornar vazio)
SELECT * FROM notifications 
WHERE user_id != '78897131-e73e-4584-8931-495218c78f28' 
  AND audience = 'user';
```

**Resultado esperado:** **VAZIO** (RLS bloqueou)

---

#### Teste 3: Verificar Logs no Console

No **DevTools → Console**, você deve ver:

```
🔑 JWT Token presente: true
👤 User ID: 78897131-e73e-4584-8931-495218c78f28
⏰ Token expira em: 30/10/2025, 14:30:00
📡 Iniciando subscrição de notificações para usuário: 78897131-e73e-4584-8931-495218c78f28
📊 Status do canal de notificações: SUBSCRIBED
✅ Canal de notificações conectado com sucesso!
```

---

## 🎯 Como o Supabase Realtime Funciona

### Fluxo de Autenticação

```
┌─────────────┐
│  Frontend   │
│  (React)    │
└──────┬──────┘
       │ 1. Login (email/senha)
       │
       ▼
┌─────────────────┐
│ Supabase Auth   │
│                 │
│ ✅ Retorna JWT  │
└────────┬────────┘
         │ 2. JWT armazenado em localStorage
         │
         ▼
┌─────────────────────────┐
│ supabaseClient.ts       │
│                         │
│ - persistSession: true  │
│ - autoRefreshToken: true│
└──────────┬──────────────┘
           │ 3. JWT incluído automaticamente em:
           │    - Query SQL (.from().select())
           │    - Realtime (.channel().subscribe())
           │
           ▼
┌──────────────────────┐
│  Supabase Backend    │
│                      │
│  RLS Policies        │
│  ✅ auth.uid()       │
│  ✅ auth.role()      │
└──────────────────────┘
```

---

## 🔍 Debugging

### Se o JWT não aparecer:

1. **Fazer logout e login novamente:**
   ```typescript
   await supabase.auth.signOut()
   // Fazer login novamente
   ```

2. **Limpar localStorage:**
   ```javascript
   // Cole no Console do navegador
   localStorage.clear()
   location.reload()
   ```

3. **Verificar .env:**
   ```bash
   VITE_SUPABASE_URL=https://seu-projeto.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   ```

4. **Reiniciar servidor Vite:**
   ```powershell
   cd frontend
   npm run dev
   ```

---

## 📊 Monitoramento de Segurança

### Verificar notificações não autorizadas:

```sql
-- Notificações sem user_id mas audience = 'user' (ERRADO)
SELECT 
  id, 
  title, 
  audience, 
  user_id,
  created_at
FROM notifications
WHERE audience = 'user' AND user_id IS NULL
ORDER BY created_at DESC
LIMIT 10;
```

### Verificar tentativas de acesso negadas:

No **Supabase Dashboard → Logs → Postgres Logs**, procure por:
- `row-level security policy`
- `permission denied`

---

## ✅ Checklist Final

- [ ] **Realtime habilitado** na tabela `notifications`
- [ ] **Políticas RLS criadas** (4 políticas: SELECT, INSERT, UPDATE, DELETE)
- [ ] **JWT token presente** no console (`🔑 JWT Token presente: true`)
- [ ] **Notificação de teste** aparece em tempo real
- [ ] **Teste de segurança** (não consegue ver notificações de outros usuários)
- [ ] **Logs sem erros** no Console do navegador

---

## 🎉 Resultado Esperado

Após executar todas as correções, você deve ver no console:

```
🔑 JWT Token presente: true
👤 User ID: 78897131-e73e-4584-8931-495218c78f28
⏰ Token expira em: 30/10/2025, 14:30:00
📡 Iniciando subscrição de notificações para usuário: 78897131-e73e-4584-8931-495218c78f28
📊 Status do canal de notificações: SUBSCRIBED
✅ Canal de notificações conectado com sucesso!
```

E ao criar uma notificação no SQL Editor, ela aparecerá **instantaneamente** no frontend! 🚀

---

## 🆘 Troubleshooting

### Erro: `new row violates row-level security policy`

**Causa:** Tentativa de criar notificação sem JWT válido.

**Solução:**
1. Fazer logout e login novamente
2. Verificar se `auth.uid()` retorna valor no SQL:
   ```sql
   SELECT auth.uid();
   ```

### Erro: `CHANNEL_ERROR` no console

**Causa:** Realtime não habilitado ou políticas RLS muito restritivas.

**Solução:**
1. Habilitar Realtime na tabela `notifications`
2. Verificar políticas RLS no SQL Editor

### Notificações não aparecem em tempo real

**Causa:** Canal Realtime não conectado corretamente.

**Solução:**
1. Verificar logs no console (`📊 Status do canal`)
2. Abrir DevTools → Network → WS (WebSocket) → Procurar por `realtime`
3. Verificar se há erros de conexão

---

## 📚 Documentação Relacionada

- [Supabase Row Level Security](https://supabase.com/docs/guides/auth/row-level-security)
- [Supabase Realtime](https://supabase.com/docs/guides/realtime)
- [NOTIFICATIONS_SYSTEM.md](./NOTIFICATIONS_SYSTEM.md)
- [NOTIFICATIONS_INTEGRATION_EXAMPLE.md](./NOTIFICATIONS_INTEGRATION_EXAMPLE.md)

---

**Data:** 30/10/2025  
**Status:** 🔴 CRÍTICO - Implementar imediatamente
