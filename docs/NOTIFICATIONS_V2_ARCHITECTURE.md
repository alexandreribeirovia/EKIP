# 🔔 Nova Arquitetura de Notificações - Gerenciamento Individual Universal

## 📋 Visão Geral

O sistema de notificações foi **completamente reestruturado** para usar **gerenciamento individual de estados** para **TODAS as notificações** (`audience='user'` e `audience='all'`). 

**🎯 Mudança Principal:**
- ❌ **Removido:** Colunas `is_read` e `read_at` da tabela `notifications`
- ✅ **Novo:** Tabela auxiliar `notifications_all_users_state` gerencia estados de **TODAS** as notificações

---

## 🏗️ Arquitetura

### Tabelas

#### 1. **notifications** (Tabela Principal)
Armazena todas as notificações (pessoais e globais) **SEM estados de leitura/delete**.

**Colunas principais:**
- `id` - ID da notificação
- `audience` - `'user'` (pessoal) ou `'all'` (global)
- `auth_user_id` - UUID do usuário (apenas para `audience='user'`)
- ~~`is_read`~~ - **REMOVIDO** (agora na tabela auxiliar)
- ~~`read_at`~~ - **REMOVIDO** (agora na tabela auxiliar)
- `title`, `message`, `type`, etc.

#### 2. **notifications_all_users_state** (Tabela Auxiliar - NOVA)
Gerencia o estado individual de cada usuário para **TODAS as notificações** (user e all).

**Colunas principais:**
- `notification_id` - FK para `notifications.id`
- `auth_user_id` - UUID do usuário no Supabase Auth
- `is_read` - Se o usuário marcou como lida
- `read_at` - Quando foi marcada como lida
- `is_deleted` - Se o usuário "deletou" (ocultou) esta notificação
- `deleted_at` - Quando foi "deletada"

**Constraint única:** `(notification_id, auth_user_id)` - um estado por usuário por notificação.

**⚠️ IMPORTANTE:** Esta tabela agora gerencia estados de **TODAS** as notificações, não apenas globais.

---

## 🔄 Comportamento Universal (User e All)

### ⚡ Funcionamento Unificado

**🎯 Mudança:** Agora **TODAS as notificações** usam a mesma lógica de gerenciamento via tabela auxiliar.

| Ação | Comportamento (IDÊNTICO para 'user' e 'all') |
|------|----------------------------------------------|
| **Buscar** | JOIN entre `notifications` e `notifications_all_users_state` |
| **Marcar como lida** | UPSERT na tabela `notifications_all_users_state` |
| **Deletar** | UPSERT marcando `is_deleted=true` (nunca delete físico) |
| **Realtime** | Escuta inserts na tabela `notifications` |

**SQL Exemplo (funciona para AMBOS user e all):**
```sql
-- Buscar TODAS as notificações com estado do usuário
SELECT 
  n.*,
  COALESCE(s.is_read, false) as is_read,
  s.read_at,
  COALESCE(s.is_deleted, false) as is_deleted
FROM notifications n
LEFT JOIN notifications_all_users_state s 
  ON n.id = s.notification_id 
  AND s.auth_user_id = '78897131-e73e-4584-8931-495218c78f28'
WHERE 
  -- Notificações pessoais do usuário
  (n.audience = 'user' AND n.auth_user_id = '78897131-e73e-4584-8931-495218c78f28')
  OR
  -- Notificações globais
  (n.audience = 'all')
  -- Filtrar deletadas
  AND COALESCE(s.is_deleted, false) = false;

-- Marcar como lida (funciona para user e all)
INSERT INTO notifications_all_users_state (notification_id, auth_user_id, is_read, read_at)
VALUES (123, '78897131-e73e-4584-8931-495218c78f28', true, NOW())
ON CONFLICT (notification_id, auth_user_id) 
DO UPDATE SET is_read = true, read_at = NOW();

-- "Deletar" (ocultar, funciona para user e all)
INSERT INTO notifications_all_users_state (notification_id, auth_user_id, is_deleted, deleted_at)
VALUES (123, '78897131-e73e-4584-8931-495218c78f28', true, NOW())
ON CONFLICT (notification_id, auth_user_id) 
DO UPDATE SET is_deleted = true, deleted_at = NOW();
```

### 📝 Diferenças na Limpeza Automática

Embora o gerenciamento seja idêntico, a **limpeza automática** diferencia por audience:

| Audience | Critério de Limpeza |
|----------|---------------------|
| **'user'** | Remove se o usuário dono marcou como `is_deleted=true` |
| **'all'** | Remove apenas se **TODOS** os usuários marcaram como `is_deleted=true` |

---

## 📊 Fluxo de Dados

### 1. Criar Notificação Global

```typescript
// Backend ou Frontend
await supabase.from('notifications').insert({
  title: 'Manutenção Programada',
  message: 'O sistema ficará indisponível amanhã das 2h às 4h',
  type_id: 2,
  type: 'warning',
  audience: 'all', // ← Global
  auth_user_id: null, // ← Sempre NULL para notificações globais
  source_type: 'system'
})
```

**Resultado:**
- ✅ Notificação criada na tabela `notifications`
- ✅ Realtime dispara para TODOS os usuários conectados
- ✅ Cada usuário vê a notificação (estado inicial: não lida, não deletada)

---

### 2. Usuário Marca como Lida

```typescript
// Frontend
await notificationStore.markAsRead(notificationId)
```

**Backend (Supabase):**
```sql
-- Se audience = 'user': atualiza diretamente
UPDATE notifications SET is_read = true WHERE id = 123;

-- Se audience = 'all': cria/atualiza estado
INSERT INTO notifications_all_users_state (notification_id, auth_user_id, is_read, read_at)
VALUES (456, 'user-uuid', true, NOW())
ON CONFLICT (notification_id, auth_user_id) 
DO UPDATE SET is_read = true, read_at = NOW();
```

**Resultado:**
- ✅ Apenas o usuário atual vê como lida
- ✅ Outros usuários continuam vendo como não lida

---

### 3. Usuário "Delete" a Notificação

```typescript
// Frontend
await notificationStore.deleteNotification(notificationId)
```

**Backend (Supabase):**
```sql
-- Se audience = 'user': deleta fisicamente
DELETE FROM notifications WHERE id = 123;

-- Se audience = 'all': marca como deletada (oculta)
INSERT INTO notifications_all_users_state (notification_id, auth_user_id, is_deleted, deleted_at)
VALUES (456, 'user-uuid', true, NOW())
ON CONFLICT (notification_id, auth_user_id) 
DO UPDATE SET is_deleted = true, deleted_at = NOW();
```

**Resultado:**
- ✅ Notificação desaparece para o usuário atual
- ✅ Notificação permanece no banco (outros usuários ainda veem)
- ✅ Frontend filtra notificações com `is_deleted=true`

---

## 🧹 Limpeza Automática

### Função de Limpeza

Uma função SQL remove notificações antigas baseado no audience:

```sql
SELECT * FROM cleanup_old_notifications();
```

**Critérios:**
- ✅ Notificações criadas há mais de 30 dias
- **Se `audience='user'`:** Remove se o usuário dono marcou `is_deleted=true`
- **Se `audience='all'`:** Remove apenas se **TODOS** os usuários marcaram `is_deleted=true`

**Resultado:**
- ✅ Notificação é deletada fisicamente do banco
- ✅ Estados da tabela auxiliar são deletados automaticamente (CASCADE)

---

### Agendar Limpeza no Supabase

No **Supabase Dashboard**:

1. Vá em **Database → Cron Jobs**
2. Clique em **New Cron Job**
3. Configure:
   - **Name:** `cleanup_old_notifications`
   - **Schedule:** `0 2 * * *` (todo dia às 2h da manhã)
   - **SQL:** `SELECT cleanup_old_notifications();`

---

## 🔒 Segurança (RLS)

### Tabela `notifications`

**Políticas (READ-ONLY para usuários):**
```sql
-- SELECT: usuário vê suas notificações pessoais OU globais
CREATE POLICY "Users can view their notifications"
ON notifications FOR SELECT
USING (
  (audience = 'user' AND auth.uid()::text = auth_user_id)
  OR (audience = 'all')
);

-- ⚠️ UPDATE/DELETE: NÃO são mais usados pelos usuários
-- Estados são gerenciados na tabela auxiliar
-- Apenas sistema/backend pode modificar a tabela notifications
```

### Tabela `notifications_all_users_state` (NOVA)

**Políticas:**
```sql
-- SELECT: usuário vê apenas seus próprios estados
CREATE POLICY "Users can view their own notification states"
ON notifications_all_users_state FOR SELECT
USING (auth.uid()::text = auth_user_id);

-- INSERT: usuário cria estados apenas para si
CREATE POLICY "Users can insert their own notification states"
ON notifications_all_users_state FOR INSERT
WITH CHECK (auth.uid()::text = auth_user_id);

-- UPDATE: usuário atualiza apenas seus estados
CREATE POLICY "Users can update their own notification states"
ON notifications_all_users_state FOR UPDATE
USING (auth.uid()::text = auth_user_id);
```

---

## 📱 Implementação no Frontend

### Tipos TypeScript

```typescript
export interface Notification {
  id: number;
  audience: 'all' | 'user';
  auth_user_id: string | null;
  is_read: boolean;
  read_at: string | null;
  is_deleted?: boolean; // Para 'all', indica se usuário deletou
  // ... outros campos
}

export interface NotificationAllUsersState {
  id: number;
  notification_id: number;
  auth_user_id: string;
  is_read: boolean;
  read_at: string | null;
  is_deleted: boolean;
  deleted_at: string | null;
}
```

### Store (Zustand)

```typescript
// Buscar TODAS as notificações (user e all) com estados
fetchNotifications: async () => {
  // 1. Buscar notificações pessoais
  const userNotifications = await supabase
    .from('notifications')
    .select('*')
    .eq('auth_user_id', userId)
    .eq('audience', 'user');

  // 2. Buscar notificações globais
  const allNotifications = await supabase
    .from('notifications')
    .select('*')
    .eq('audience', 'all');

  // 3. Buscar estados de TODAS as notificações (user + all)
  const allNotificationIds = [
    ...(userNotifications || []).map(n => n.id),
    ...(allNotifications || []).map(n => n.id)
  ];
  
  const states = await supabase
    .from('notifications_all_users_state')
    .select('*')
    .eq('auth_user_id', userId)
    .in('notification_id', allNotificationIds);

  // 4. Mesclar estados para TODAS as notificações e filtrar deletadas
  const allWithState = [
    ...(userNotifications || []),
    ...(allNotifications || [])
  ]
    .map(n => ({
      ...n,
      is_read: states.find(s => s.notification_id === n.id)?.is_read || false,
      read_at: states.find(s => s.notification_id === n.id)?.read_at || null,
      is_deleted: states.find(s => s.notification_id === n.id)?.is_deleted || false
    }))
    .filter(n => !n.is_deleted)
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  return allWithState;
}
```

---

## 🧪 Testes

### Teste 1: Criar Notificações (User e All)

```sql
-- Criar notificação PESSOAL
INSERT INTO notifications (title, message, type_id, type, audience, auth_user_id, source_type)
SELECT 
  '👤 Notificação Pessoal',
  'Esta notificação é apenas para você!',
  id, 'info', 'user', '78897131-e73e-4584-8931-495218c78f28', 'system'
FROM domains
WHERE type = 'notification_type' AND value = 'info'
LIMIT 1;

-- Criar notificação GLOBAL
INSERT INTO notifications (title, message, type_id, type, audience, source_type)
SELECT 
  '🌍 Notificação Global',
  'Esta notificação aparece para todos!',
  id, 'info', 'all', 'system'
FROM domains
WHERE type = 'notification_type' AND value = 'info'
LIMIT 1;
```

**Resultado esperado:**
- ✅ Notificação pessoal: apenas o usuário específico vê
- ✅ Notificação global: todos os usuários veem
- ✅ Ambas aparecem como "não lidas" inicialmente

---

### Teste 2: Marcar como Lida (Ambos Tipos)

**No frontend:**
```typescript
await notificationStore.markAsRead(notificationId)
```

**Resultado esperado:**
- ✅ Estado criado na tabela `notifications_all_users_state`
- ✅ Funciona igual para notificações 'user' e 'all'
- ✅ Outros usuários não são afetados

**Verificar no banco:**
```sql
SELECT * FROM notifications_all_users_state
WHERE notification_id = 123;
-- Resultado: is_read = true, read_at = timestamp
```

---

### Teste 3: "Deletar" Notificação (Ambos Tipos)

**No frontend:**
```typescript
await notificationStore.deleteNotification(notificationId)
```

**Resultado esperado:**
- ✅ Estado marcado como `is_deleted=true` na tabela auxiliar
- ✅ Notificação desaparece apenas para o usuário que deletou
- ✅ Notificação permanece na tabela `notifications` (não é delete físico)
- ✅ Outros usuários continuam vendo normalmente

**Verificar no banco:**
```sql
SELECT * FROM notifications WHERE id = 123;
-- Resultado: notificação EXISTE (não foi deletada)

SELECT * FROM notifications_all_users_state
WHERE notification_id = 123 AND auth_user_id = 'user-a-uuid';
-- Resultado: is_deleted = true, deleted_at = timestamp
```

---

### Teste 4: Limpeza Automática

**Cenário A:** Notificação 'user' criada há 31 dias e usuário marcou como deletada.

**Cenário B:** Notificação 'all' criada há 31 dias e **TODOS** os usuários marcaram como deletada.

**Executar limpeza:**
```sql
SELECT * FROM cleanup_old_notifications();
```

**Resultado esperado:**
- ✅ Cenário A: Notificação 'user' é deletada fisicamente
- ✅ Cenário B: Notificação 'all' é deletada fisicamente
- ✅ Estados são deletados automaticamente (CASCADE)
- ✅ Retorna: `deleted_count = 2`

---

## 📊 Monitoramento

### Dashboard de Notificações

```sql
-- Estatísticas de TODAS as notificações (user + all)
SELECT 
  n.id,
  n.title,
  n.audience,
  n.created_at,
  COUNT(s.id) FILTER (WHERE s.is_read = true) as usuarios_que_leram,
  COUNT(s.id) FILTER (WHERE s.is_deleted = true) as usuarios_que_deletaram,
  CASE 
    WHEN n.audience = 'all' THEN (SELECT COUNT(*) FROM auth.users WHERE deleted_at IS NULL)
    ELSE 1
  END as total_usuarios_relevantes
FROM notifications n
LEFT JOIN notifications_all_users_state s ON n.id = s.notification_id
GROUP BY n.id
ORDER BY n.created_at DESC;
```

### Notificações Candidatas à Limpeza

```sql
-- Notificações que podem ser limpas
SELECT 
  n.id,
  n.title,
  n.audience,
  n.created_at,
  AGE(NOW(), n.created_at) as idade,
  COUNT(s.id) FILTER (WHERE s.is_deleted = true) as usuarios_que_deletaram,
  CASE 
    WHEN n.audience = 'all' THEN (SELECT COUNT(*) FROM auth.users WHERE deleted_at IS NULL)
    ELSE 1
  END as total_usuarios_necessarios
FROM notifications n
LEFT JOIN notifications_all_users_state s ON n.id = s.notification_id
WHERE n.created_at < NOW() - INTERVAL '30 days'
GROUP BY n.id
ORDER BY n.created_at;
```

---

## ✅ Checklist de Implementação

### Backend/Database
- [x] Criar tabela `notifications_all_users_state`
- [x] Criar índices para performance
- [x] Configurar RLS policies
- [x] Criar função de limpeza automática `cleanup_old_notifications()`
- [ ] ⚠️ **REMOVER colunas is_read e read_at da tabela notifications**
- [ ] Executar SQL setup no Supabase
- [ ] Agendar cron job de limpeza

### Frontend
- [x] Atualizar tipos TypeScript
- [x] Modificar `notificationStore.ts` para usar tabela auxiliar
- [x] Atualizar `fetchNotifications()` para buscar estados
- [x] Atualizar `markAsRead()` para usar tabela auxiliar
- [x] Atualizar `markAllAsRead()` para usar tabela auxiliar
- [x] Atualizar `deleteNotification()` para usar tabela auxiliar
- [x] Atualizar subscrição Realtime

### Documentação
- [x] Documentar nova arquitetura (NOTIFICATIONS_V2_ARCHITECTURE.md)
- [x] Atualizar SQL setup com comentários

### Testes
- [ ] Testar notificações 'user' (criar, marcar lida, deletar)
- [ ] Testar notificações 'all' (criar, marcar lida, deletar)
- [ ] Testar com múltiplos usuários
- [ ] Validar isolamento de estados entre usuários
- [ ] Testar limpeza automática

---

## 🎯 Benefícios

✅ **Arquitetura Unificada**: Mesmo comportamento para notificações 'user' e 'all'  
✅ **Isolamento de Estados**: Cada usuário gerencia TODAS as suas notificações independentemente  
✅ **Sem Perda de Dados**: Deletar nunca remove do banco (apenas marca como deletada)  
✅ **Performance**: Índices otimizados para queries rápidas  
✅ **Segurança**: RLS garante que usuários vejam apenas seus estados  
✅ **Limpeza Inteligente**: Remove automaticamente com critérios por audience  
✅ **Escalabilidade**: Tabela `notifications` mais limpa (sem colunas de estado)  
✅ **Flexibilidade**: Fácil adicionar novos campos de estado por usuário  

---

## ⚠️ Mudanças Breaking Changes

### O que mudou:
1. **Removido:** Colunas `is_read` e `read_at` da tabela `notifications`
2. **Novo:** Tabela auxiliar `notifications_all_users_state` gerencia TODOS os estados
3. **Comportamento:** Deletar notificações nunca é físico (sempre marca `is_deleted=true`)
4. **Queries:** Sempre fazer JOIN com tabela auxiliar para obter estados

### Migração:
```sql
-- 1. Criar tabela auxiliar
-- Execute: notifications_all_users_state_setup.sql

-- 2. Migrar dados existentes (SE necessário)
INSERT INTO notifications_all_users_state (notification_id, auth_user_id, is_read, read_at)
SELECT id, auth_user_id, is_read, read_at
FROM notifications
WHERE audience = 'user' AND is_read = true;

-- 3. Remover colunas antigas
ALTER TABLE notifications DROP COLUMN is_read;
ALTER TABLE notifications DROP COLUMN read_at;
```

---

**Data:** 31/10/2025  
**Status:** ✅ **IMPLEMENTADO (Pendente migração DB)**  
**Versão:** 3.0
