# 🔒 Verificação de Segurança - Sistema de Notificações

## ✅ Checklist de Implementação

### 1. SQL Executado
- [ ] `docs/notifications_setup.sql` - Configuração inicial
- [ ] `docs/notifications_security_fix.sql` - Correções de segurança

### 2. Arquivos Atualizados
- [x] `frontend/src/stores/notificationStore.ts` - JWT automático + logs
- [x] `frontend/src/components/NotificationBell.tsx` - Verificação de sessão

### 3. Como Verificar se JWT está Sendo Enviado

#### Passo 1: Abrir DevTools
1. Abra o navegador (Chrome/Edge)
2. Pressione `F12` para abrir DevTools
3. Vá para a aba **Console**

#### Passo 2: Fazer Login
1. Faça login no sistema
2. Observe os logs no console:

```
🔑 JWT Token presente: true
👤 User ID: uuid-do-usuario
⏰ Token expira em: 30/10/2025, 15:30:00
📡 Iniciando subscrição de notificações para usuário: uuid-do-usuario
📊 Status do canal de notificações: SUBSCRIBED
✅ Canal de notificações conectado com sucesso!
```

#### Passo 3: Verificar WebSocket no Network
1. Vá para a aba **Network** (Rede)
2. Filtre por **WS** (WebSocket)
3. Clique na conexão `websocket?apikey=...`
4. Vá para a sub-aba **Messages** (Mensagens)
5. Procure pela mensagem de handshake inicial
6. **IMPORTANTE**: O JWT não aparece na URL, mas está nos headers internos

#### Passo 4: Testar Notificação
Execute no Supabase SQL Editor (substitua `USER_ID_AQUI`):

```sql
INSERT INTO notifications (title, message, type_id, type, user_id, audience, link_url)
SELECT 
  '🔔 Teste de Segurança',
  'Se você viu esta notificação, o JWT está funcionando!',
  id,
  'success',
  'USER_ID_AQUI', -- ← Substituir pelo seu user_id
  'user',
  '/dashboard'
FROM domains
WHERE type = 'notification_type' AND value = 'success'
LIMIT 1;
```

**Resultado esperado:**
- Console mostra: `🔔 Nova notificação pessoal recebida: {...}`
- Notificação aparece no sino instantaneamente
- Contador atualiza automaticamente

## 🧪 Testes de Segurança

### Teste 1: RLS Está Bloqueando Acesso Não Autorizado

Execute no Supabase SQL Editor **estando logado como User A**:

```sql
-- Tente buscar notificações de outro usuário
SELECT * FROM notifications 
WHERE user_id = 'USER_B_ID' -- ID de outro usuário
  AND audience = 'user';
```

**Resultado esperado:** `Nenhum registro` (RLS bloqueou)

### Teste 2: Usuário Não Pode Criar Notificações para Outros

```sql
-- Tente criar notificação para outro usuário
INSERT INTO notifications (title, message, type_id, type, user_id, audience)
VALUES (
  'Tentativa de Hack',
  'Tentando criar notificação para outro usuário',
  1,
  'info',
  'OUTRO_USER_ID', -- ← ID de outro usuário
  'user'
);
```

**Resultado esperado:** `Erro: new row violates row-level security policy`

### Teste 3: Usuário Não Pode Deletar Notificações Globais

```sql
-- Criar notificação global (como admin)
INSERT INTO notifications (title, message, type_id, type, audience)
SELECT 'Notificação Global', 'Teste', id, 'info', 'all'
FROM domains WHERE type = 'notification_type' AND value = 'info' LIMIT 1;

-- Tentar deletar como usuário comum
DELETE FROM notifications WHERE audience = 'all';
```

**Resultado esperado:** `Erro: policy violation` ou `0 rows affected`

### Teste 4: WebSocket Não Envia Notificações de Outros Usuários

1. Abra o sistema em **dois navegadores** com usuários diferentes
2. No navegador A (User A): Abra o console
3. No Supabase, crie notificação para User B:

```sql
INSERT INTO notifications (title, message, type_id, type, user_id, audience)
SELECT 'Só para User B', 'Teste', id, 'info', 'USER_B_ID', 'user'
FROM domains WHERE type = 'notification_type' AND value = 'info' LIMIT 1;
```

**Resultado esperado:**
- ✅ User B recebe notificação instantaneamente
- ❌ User A **NÃO** recebe a notificação (RLS bloqueou no WebSocket)

### Teste 5: Notificações Globais Chegam para Todos

```sql
INSERT INTO notifications (title, message, type_id, type, audience)
SELECT '📢 Anúncio Geral', 'Esta mensagem é para todos!', id, 'info', 'all'
FROM domains WHERE type = 'notification_type' AND value = 'info' LIMIT 1;
```

**Resultado esperado:**
- ✅ User A recebe notificação
- ✅ User B recebe notificação
- ✅ Console mostra: `🌍 Nova notificação global recebida: {...}`

## 🔍 Análise de Logs

### Logs Normais (✅)

```
🔑 JWT Token presente: true
👤 User ID: abc-123-def-456
⏰ Token expira em: 30/10/2025, 16:45:00
📡 Iniciando subscrição de notificações para usuário: abc-123-def-456
📊 Status do canal de notificações: SUBSCRIBED
✅ Canal de notificações conectado com sucesso!
🔔 Nova notificação pessoal recebida: { id: 123, title: "Teste", ... }
```

### Logs com Problema (❌)

```
🔑 JWT Token presente: false  ← PROBLEMA: Sem JWT
👤 User ID: undefined          ← PROBLEMA: Sem user_id
📡 Iniciando subscrição de notificações para usuário: undefined
📊 Status do canal de notificações: CHANNEL_ERROR
❌ Erro no canal de notificações: { message: "Unauthorized" }
```

**Solução:** Fazer logout e login novamente para renovar o JWT.

## 🛠️ Troubleshooting

### Problema: "JWT Token presente: false"

**Causa:** Sessão expirou ou usuário não está autenticado

**Solução:**
1. Fazer logout
2. Fazer login novamente
3. Verificar se `useAuthStore` tem `user` válido

### Problema: Notificações não aparecem em tempo real

**Verificar:**
1. Console mostra `✅ Canal de notificações conectado com sucesso!`?
2. RLS está habilitado na tabela? (Executar query abaixo)
3. Realtime está habilitado no Supabase?

```sql
-- Verificar RLS
SELECT tablename, rowsecurity FROM pg_tables WHERE tablename = 'notifications';

-- Verificar Realtime
-- Ir no Supabase Dashboard > Database > Replication > Habilitar "notifications"
```

### Problema: "CHANNEL_ERROR" no console

**Causa:** Conexão WebSocket falhou

**Soluções:**
1. Verificar se Realtime está habilitado na tabela
2. Verificar se há políticas RLS bloqueando
3. Aguardar 5 segundos (sistema tenta reconectar automaticamente)

### Problema: Erro "new row violates row-level security policy"

**Causa:** Tentou criar notificação não autorizada

**Solução:** Isso é **esperado**! A política está funcionando corretamente.

Se precisar criar notificações de sistema, use Edge Function com `service_role` key.

## 📊 Queries de Monitoramento

```sql
-- 1. Verificar políticas RLS ativas
SELECT policyname, cmd, qual 
FROM pg_policies 
WHERE tablename = 'notifications';

-- 2. Notificações criadas na última hora
SELECT 
  id, title, audience, user_id, created_at,
  EXTRACT(EPOCH FROM (NOW() - created_at)) / 60 as minutos_atras
FROM notifications
WHERE created_at > NOW() - INTERVAL '1 hour'
ORDER BY created_at DESC;

-- 3. Taxa de leitura de notificações
SELECT 
  ROUND(
    COUNT(*) FILTER (WHERE is_read = true) * 100.0 / NULLIF(COUNT(*), 0),
    2
  ) as "Taxa de Leitura %"
FROM notifications;

-- 4. Usuários mais ativos (que mais recebem notificações)
SELECT 
  user_id,
  COUNT(*) as total_notificacoes,
  COUNT(*) FILTER (WHERE is_read = false) as nao_lidas
FROM notifications
WHERE audience = 'user'
GROUP BY user_id
ORDER BY total_notificacoes DESC
LIMIT 10;
```

## ✅ Checklist Final de Segurança

- [ ] RLS habilitado na tabela `notifications`
- [ ] Políticas RLS criadas e testadas
- [ ] JWT token sendo enviado no WebSocket (logs confirmam)
- [ ] Teste 1 passou: Não acessa notificações de outros
- [ ] Teste 2 passou: Não cria notificações para outros
- [ ] Teste 3 passou: Não deleta notificações globais
- [ ] Teste 4 passou: WebSocket respeita RLS
- [ ] Teste 5 passou: Notificações globais chegam para todos
- [ ] Console mostra logs de conexão bem-sucedida
- [ ] Notificações aparecem em tempo real
- [ ] Reconexão automática funciona (testar desconectando WiFi)

## 🎉 Sistema Seguro!

Se todos os testes passaram, seu sistema de notificações está **100% seguro** com:

- ✅ JWT token enviado automaticamente
- ✅ RLS policies protegendo dados
- ✅ Validação de `auth.uid()` em todas as operações
- ✅ WebSocket seguro e autenticado
- ✅ Logs detalhados para debugging
- ✅ Reconexão automática em caso de falha

**Documentação completa:**
- `docs/NOTIFICATIONS_SYSTEM.md`
- `docs/NOTIFICATIONS_INTEGRATION_EXAMPLE.md`
- `docs/notifications_setup.sql`
- `docs/notifications_security_fix.sql`
