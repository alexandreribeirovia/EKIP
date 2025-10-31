# 🚀 Próximos Passos - Migração Notificações v3.0

## 📋 Resumo da Mudança

**Antes:**
- Notificações 'user': is_read e read_at na tabela `notifications`
- Notificações 'all': is_read e read_at na tabela auxiliar `notifications_all_users_state`

**Agora:**
- **TODAS as notificações** (user e all): estados na tabela auxiliar `notifications_all_users_state`
- Tabela `notifications` **SEM** colunas is_read e read_at

---

## ✅ O Que Já Foi Feito

- ✅ `notificationStore.ts` atualizado para usar tabela auxiliar
- ✅ `fetchNotifications()` busca estados de TODAS notificações
- ✅ `markAsRead()` sempre usa tabela auxiliar
- ✅ `markAllAsRead()` sempre usa tabela auxiliar
- ✅ `deleteNotification()` sempre marca is_deleted=true (nunca delete físico)
- ✅ SQL setup atualizado (`notifications_all_users_state_setup.sql`)
- ✅ Função de limpeza atualizada (`cleanup_old_notifications()`)
- ✅ Documentação completa criada (`NOTIFICATIONS_V2_ARCHITECTURE.md`)
- ✅ Script de migração criado (`notifications_migration_remove_columns.sql`)

---

## 🎯 Próximos Passos (Execute Nesta Ordem)

### 1. Backup do Banco de Dados ⚠️

**No Supabase Dashboard:**
1. Vá em **Database → Backups**
2. Clique em **Create Backup**
3. Aguarde conclusão do backup

---

### 2. Criar Tabela Auxiliar

**Execute no Supabase SQL Editor:**

```bash
# Arquivo: docs/notifications_all_users_state_setup.sql
```

**O que faz:**
- Cria tabela `notifications_all_users_state`
- Cria 4 índices para performance
- Configura RLS policies
- Cria trigger para `updated_at`
- Cria função `cleanup_old_notifications()`

**Verificar:**
```sql
-- Tabela criada?
SELECT table_name FROM information_schema.tables 
WHERE table_name = 'notifications_all_users_state';

-- Índices criados?
SELECT indexname FROM pg_indexes 
WHERE tablename = 'notifications_all_users_state';
```

---

### 3. Testar Sistema COM Tabela Auxiliar (Colunas ainda existem)

**Importante:** Nesta fase, as colunas `is_read` e `read_at` AINDA existem na tabela `notifications`, mas o frontend já está usando a tabela auxiliar.

**Testes:**

#### A) Criar Notificação Pessoal
```sql
INSERT INTO notifications (title, message, type_id, type, audience, auth_user_id, source_type)
SELECT 
  '🧪 Teste Notificação User',
  'Teste de notificação pessoal',
  id, 'info', 'user', 'SEU_USER_UUID_AQUI', 'system'
FROM domains
WHERE type = 'notification_type' AND value = 'info'
LIMIT 1;
```

**Verificar:**
- [ ] Notificação aparece no frontend?
- [ ] Marcação como lida funciona?
- [ ] Delete funciona (desaparece apenas para o usuário)?
- [ ] Estado criado na tabela auxiliar?

```sql
SELECT * FROM notifications_all_users_state 
WHERE auth_user_id = 'SEU_USER_UUID_AQUI'
ORDER BY created_at DESC;
```

#### B) Criar Notificação Global
```sql
INSERT INTO notifications (title, message, type_id, type, audience, source_type)
SELECT 
  '🧪 Teste Notificação Global',
  'Teste de notificação para todos',
  id, 'info', 'all', 'system'
FROM domains
WHERE type = 'notification_type' AND value = 'info'
LIMIT 1;
```

**Verificar:**
- [ ] Notificação aparece para TODOS os usuários?
- [ ] Cada usuário pode marcar como lida independentemente?
- [ ] Cada usuário pode deletar independentemente?
- [ ] Estados criados na tabela auxiliar por usuário?

---

### 4. Migrar Dados Existentes (Opcional)

**Se você tem notificações antigas com `is_read=true`:**

```bash
# Arquivo: docs/notifications_migration_remove_columns.sql
# Execute APENAS a seção 1 (MIGRAR DADOS EXISTENTES)
```

**Verificar:**
```sql
-- Quantos estados foram migrados?
SELECT COUNT(*) FROM notifications_all_users_state
WHERE is_read = true;
```

---

### 5. Remover Colunas is_read e read_at ⚠️

**⚠️ ATENÇÃO: Esta operação é IRREVERSÍVEL!**

**Execute no Supabase SQL Editor:**

```bash
# Arquivo: docs/notifications_migration_remove_columns.sql
# Execute a seção 3 (REMOVER COLUNAS)
```

**Comandos:**
```sql
ALTER TABLE notifications DROP COLUMN IF EXISTS is_read;
ALTER TABLE notifications DROP COLUMN IF EXISTS read_at;
```

**Verificar:**
```sql
-- Colunas removidas?
SELECT column_name FROM information_schema.columns
WHERE table_name = 'notifications';
-- Resultado: is_read e read_at NÃO devem aparecer
```

---

### 6. Testar Sistema APÓS Remoção das Colunas

**Testar novamente:**
- [ ] Criar notificação 'user'
- [ ] Criar notificação 'all'
- [ ] Marcar como lida
- [ ] Deletar notificação
- [ ] Verificar Realtime (novas notificações aparecem?)

---

### 7. Configurar Limpeza Automática

**No Supabase Dashboard:**

1. Vá em **Database → Cron Jobs**
2. Clique em **New Cron Job**
3. Configure:
   - **Name:** `cleanup_old_notifications`
   - **Schedule:** `0 2 * * *` (todo dia às 2h da manhã)
   - **SQL:** 
   ```sql
   SELECT cleanup_old_notifications();
   ```
4. Salve

---

## 🧪 Checklist Final de Validação

### Frontend
- [ ] Notificações aparecem corretamente
- [ ] Badge de contador funciona
- [ ] Marcar como lida funciona
- [ ] Marcar todas como lidas funciona
- [ ] Deletar notificação funciona
- [ ] Realtime funciona (novas notificações aparecem instantaneamente)
- [ ] Som de notificação toca (opcional)

### Backend/Database
- [ ] Tabela `notifications_all_users_state` criada
- [ ] Índices criados
- [ ] RLS policies configuradas
- [ ] Colunas `is_read` e `read_at` removidas de `notifications`
- [ ] Função `cleanup_old_notifications()` criada
- [ ] Cron job configurado

### Segurança
- [ ] Usuários veem apenas suas próprias notificações 'user'
- [ ] Usuários veem TODAS as notificações 'all'
- [ ] Usuários NÃO veem estados de outros usuários
- [ ] RLS impede acesso não autorizado

---

## 📊 Monitoramento

### Verificar Estados por Usuário
```sql
SELECT 
  u.email,
  COUNT(*) as total_notificacoes,
  COUNT(*) FILTER (WHERE s.is_read = true) as lidas,
  COUNT(*) FILTER (WHERE s.is_deleted = true) as deletadas
FROM auth.users u
LEFT JOIN notifications_all_users_state s ON u.id::text = s.auth_user_id
WHERE u.deleted_at IS NULL
GROUP BY u.id, u.email
ORDER BY total_notificacoes DESC;
```

### Verificar Notificações Globais
```sql
SELECT 
  n.id,
  n.title,
  n.created_at,
  COUNT(s.id) as usuarios_com_estado,
  COUNT(s.id) FILTER (WHERE s.is_read = true) as leram,
  COUNT(s.id) FILTER (WHERE s.is_deleted = true) as deletaram
FROM notifications n
LEFT JOIN notifications_all_users_state s ON n.id = s.notification_id
WHERE n.audience = 'all'
GROUP BY n.id
ORDER BY n.created_at DESC
LIMIT 10;
```

---

## 🆘 Troubleshooting

### Problema: Notificações não aparecem

**Verificar:**
```sql
-- Frontend está buscando corretamente?
SELECT 
  n.*,
  s.is_read,
  s.is_deleted
FROM notifications n
LEFT JOIN notifications_all_users_state s 
  ON n.id = s.notification_id 
  AND s.auth_user_id = 'SEU_USER_UUID'
WHERE 
  (n.audience = 'user' AND n.auth_user_id = 'SEU_USER_UUID')
  OR (n.audience = 'all')
ORDER BY n.created_at DESC;
```

### Problema: Marcação como lida não funciona

**Verificar:**
```sql
-- Estado está sendo criado?
SELECT * FROM notifications_all_users_state
WHERE notification_id = 123 AND auth_user_id = 'SEU_USER_UUID';

-- RLS está bloqueando?
SELECT current_setting('role'), auth.uid();
```

### Problema: Delete não oculta notificação

**Verificar:**
```sql
-- is_deleted está true?
SELECT * FROM notifications_all_users_state
WHERE notification_id = 123 AND auth_user_id = 'SEU_USER_UUID';

-- Frontend está filtrando is_deleted?
-- Verificar código em notificationStore.ts linha ~73
```

---

## 📚 Documentação Completa

Consulte os seguintes documentos para detalhes:

1. **`NOTIFICATIONS_V2_ARCHITECTURE.md`** - Arquitetura completa
2. **`notifications_all_users_state_setup.sql`** - Setup da tabela auxiliar
3. **`notifications_migration_remove_columns.sql`** - Migração das colunas
4. **Este arquivo** - Guia de execução passo a passo

---

**Data:** 31/10/2025  
**Versão:** 3.0  
**Status:** 🚧 Aguardando execução no Supabase
