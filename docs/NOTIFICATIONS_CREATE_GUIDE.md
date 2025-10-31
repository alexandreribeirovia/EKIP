# 🔧 Guia: Criar Notificações no Supabase

## ❌ Problema Comum: User ID Incorreto

Você tentou criar uma notificação com:

```sql
user_id = 'alexandre-ribeiro'  ❌ ERRADO
```

**Resultado:** Notificação não aparece no sino.

**Causa:** O `user_id` deve ser o **UUID do Supabase Auth**, não o nome do usuário!

---

## ✅ Solução: Como Descobrir Seu User ID

### Método 1: Pelo Console do Navegador (Mais Fácil)

1. Abra o DevTools (F12) no navegador
2. Vá para a aba **Console**
3. Cole este código:

```javascript
// Buscar user_id da sessão atual
const { data: { session } } = await supabase.auth.getSession()
console.log('👤 Seu User ID:', session?.user?.id)
console.log('📧 Email:', session?.user?.email)

// Copiar para clipboard
navigator.clipboard.writeText(session?.user?.id)
console.log('✅ User ID copiado para clipboard!')
```

**Resultado esperado:**
```
👤 Seu User ID: 78897131-e73e-4584-8931-495218c78f28
📧 Email: alexandre.ribeiro@viaconsulting.com.br
✅ User ID copiado para clipboard!
```

### Método 2: Pelo Supabase SQL Editor

Execute no **Supabase SQL Editor**:

```sql
-- Listar todos os usuários do Supabase Auth
SELECT 
  id as user_id,
  email,
  raw_user_meta_data->>'name' as name,
  raw_user_meta_data->>'role' as role,
  created_at
FROM auth.users
ORDER BY created_at DESC;
```

**Resultado:**
| user_id | email | name | role |
|---------|-------|------|------|
| 78897131-e73e-4584-8931-495218c78f28 | alexandre.ribeiro@... | Alexandre Ribeiro | admin |

---

## 🎯 SQL Correto: Criar Notificação para Usuário Específico

### Opção 1: User ID Hardcoded (Mais Direto)

```sql
-- Notificação para usuário específico
INSERT INTO notifications (
  title, 
  message, 
  type_id, 
  type, 
  audience, 
  user_id, 
  link_url,
  source_type
)
SELECT 
  'Bem-vindo ao Sistema de Notificações! 🎉',
  'Este é um exemplo de notificação em tempo real. Clique para explorar o dashboard.',
  id,
  'success',
  'user',
  '78897131-e73e-4584-8931-495218c78f28', -- ✅ UUID correto
  '/dashboard',
  'system'
FROM domains
WHERE type = 'notification_type' AND value = 'success'
LIMIT 1;
```

### Opção 2: Buscar User ID por Email (Automático)

```sql
-- Notificação buscando user_id automaticamente pelo email
INSERT INTO notifications (
  title, 
  message, 
  type_id, 
  type, 
  audience, 
  user_id, 
  link_url,
  source_type
)
SELECT 
  'Bem-vindo ao Sistema de Notificações! 🎉',
  'Este é um exemplo de notificação em tempo real. Clique para explorar o dashboard.',
  d.id,
  'success',
  'user',
  u.id, -- ✅ User ID buscado automaticamente
  '/dashboard',
  'system'
FROM domains d
CROSS JOIN auth.users u
WHERE d.type = 'notification_type' 
  AND d.value = 'success'
  AND u.email = 'alexandre.ribeiro@viaconsulting.com.br' -- Substitua pelo seu email
LIMIT 1;
```

### Opção 3: Notificação para Todos os Usuários

```sql
-- Notificação global (audience = 'all')
INSERT INTO notifications (
  title, 
  message, 
  type_id, 
  type, 
  audience, 
  user_id, 
  link_url,
  source_type
)
SELECT 
  '🌍 Anúncio Global',
  'Esta notificação é para todos os usuários conectados!',
  id,
  'info',
  'all', -- ✅ Audience = 'all'
  NULL,  -- ✅ user_id = NULL para notificações globais
  '/dashboard',
  'system'
FROM domains
WHERE type = 'notification_type' AND value = 'info'
LIMIT 1;
```

---

## 📊 Tipos de Notificações

### 1. Notificação Pessoal (user)

```sql
audience = 'user'
user_id = '78897131-e73e-4584-8931-495218c78f28' -- UUID obrigatório
```

**Quem vê:** Apenas o usuário específico

### 2. Notificação Global (all)

```sql
audience = 'all'
user_id = NULL
```

**Quem vê:** Todos os usuários conectados

---

## 🧪 Testes Completos

### Teste 1: Notificação de Sucesso (Verde)

```sql
INSERT INTO notifications (title, message, type_id, type, audience, user_id, source_type)
SELECT 
  '✅ Operação Concluída',
  'Sua solicitação foi processada com sucesso!',
  d.id, 'success', 'user', u.id, 'system'
FROM domains d
CROSS JOIN auth.users u
WHERE d.type = 'notification_type' AND d.value = 'success'
  AND u.email = 'seu-email@aqui.com'
LIMIT 1;
```

### Teste 2: Notificação de Aviso (Amarela)

```sql
INSERT INTO notifications (title, message, type_id, type, audience, user_id, source_type)
SELECT 
  '⚠️ Atenção Necessária',
  'Você tem tarefas pendentes para hoje!',
  d.id, 'warning', 'user', u.id, 'system'
FROM domains d
CROSS JOIN auth.users u
WHERE d.type = 'notification_type' AND d.value = 'warning'
  AND u.email = 'seu-email@aqui.com'
LIMIT 1;
```

### Teste 3: Notificação de Erro (Vermelha)

```sql
INSERT INTO notifications (title, message, type_id, type, audience, user_id, source_type)
SELECT 
  '❌ Erro Detectado',
  'Houve um problema ao processar sua solicitação.',
  d.id, 'error', 'user', u.id, 'system'
FROM domains d
CROSS JOIN auth.users u
WHERE d.type = 'notification_type' AND d.value = 'error'
  AND u.email = 'seu-email@aqui.com'
LIMIT 1;
```

### Teste 4: Notificação Informativa (Azul)

```sql
INSERT INTO notifications (title, message, type_id, type, audience, user_id, source_type)
SELECT 
  'ℹ️ Nova Atualização',
  'Uma nova versão do sistema está disponível.',
  d.id, 'info', 'user', u.id, 'system'
FROM domains d
CROSS JOIN auth.users u
WHERE d.type = 'notification_type' AND d.value = 'info'
  AND u.email = 'seu-email@aqui.com'
LIMIT 1;
```

### Teste 5: Notificação com Link Personalizado

```sql
INSERT INTO notifications (title, message, type_id, type, audience, user_id, link_url, source_type, source_id)
SELECT 
  '📋 Novo Feedback Recebido',
  'João Silva enviou um feedback para você. Clique para visualizar.',
  d.id, 'info', 'user', u.id, '/employee/' || u.id, 'feedback', '123'
FROM domains d
CROSS JOIN auth.users u
WHERE d.type = 'notification_type' AND d.value = 'info'
  AND u.email = 'seu-email@aqui.com'
LIMIT 1;
```

---

## 🔍 Debugging: Por Que Minha Notificação Não Aparece?

### Checklist de Diagnóstico

```sql
-- 1. Verificar se a notificação foi criada
SELECT 
  id, 
  title, 
  audience, 
  user_id,
  created_at
FROM notifications
ORDER BY created_at DESC
LIMIT 5;

-- 2. Verificar se o user_id existe no Supabase Auth
SELECT 
  id,
  email,
  raw_user_meta_data->>'name' as name
FROM auth.users
WHERE id = '78897131-e73e-4584-8931-495218c78f28'; -- Substituir pelo seu user_id

-- 3. Verificar políticas RLS
SELECT 
  policyname,
  cmd,
  qual as "USING condition"
FROM pg_policies
WHERE tablename = 'notifications';

-- 4. Testar RLS manualmente (execute estando LOGADO no frontend)
SELECT * FROM notifications
WHERE (audience = 'user' AND user_id = auth.uid()::text)
   OR (audience = 'all')
ORDER BY created_at DESC;
```

### Problemas Comuns

| Problema | Causa | Solução |
|----------|-------|---------|
| Notificação não aparece | `user_id` incorreto | Use UUID do Supabase Auth |
| Notificação não aparece | RLS bloqueou | Verificar políticas RLS |
| Notificação não aparece | `audience` errado | Use 'user' ou 'all' |
| Notificação não aparece | Realtime não habilitado | Habilitar no Dashboard |
| Notificação aparece para outro usuário | `user_id` de outro usuário | Verificar `user_id` no INSERT |

---

## 🎯 Template SQL Rápido

### Copie e cole este template (ajuste apenas o email):

```sql
-- 🚀 TEMPLATE RÁPIDO: Criar notificação para usuário específico
-- 
-- 1. Substitua 'seu-email@aqui.com' pelo seu email
-- 2. Ajuste title, message, type conforme necessário
-- 3. Execute no Supabase SQL Editor

INSERT INTO notifications (title, message, type_id, type, audience, user_id, link_url, source_type)
SELECT 
  '🎉 Título da Notificação',                    -- ← EDITE AQUI
  'Mensagem detalhada da notificação',           -- ← EDITE AQUI
  d.id,
  'success',                                      -- ← EDITE: success, warning, error, info
  'user',
  u.id,
  '/dashboard',                                   -- ← EDITE: link opcional
  'system'
FROM domains d
CROSS JOIN auth.users u
WHERE d.type = 'notification_type' 
  AND d.value = 'success'                         -- ← EDITE: success, warning, error, info
  AND u.email = 'alexandre.ribeiro@viaconsulting.com.br' -- ← EDITE SEU EMAIL AQUI
LIMIT 1;
```

---

## 📱 Integração no Código (Para Desenvolvedores)

### Criar Notificação via Frontend

```typescript
import { createNotification } from '@/lib/notifications'

// Exemplo 1: Notificação pessoal
await createNotification({
  title: 'Novo Feedback Recebido',
  message: 'João Silva enviou um feedback para você',
  type_id: 1, // ID do domain 'notification_type'
  type: 'info',
  audience: 'user',
  user_id: '78897131-e73e-4584-8931-495218c78f28', // UUID do usuário
  link_url: '/employee/78897131-e73e-4584-8931-495218c78f28',
  source_type: 'feedback',
  source_id: '123'
})

// Exemplo 2: Notificação global
await createNotification({
  title: 'Manutenção Programada',
  message: 'O sistema ficará indisponível amanhã das 2h às 4h',
  type_id: 2,
  type: 'warning',
  audience: 'all', // Para todos
  link_url: null
})
```

### Funções Helper Disponíveis

```typescript
// Feedback
await notifyNewFeedback(userId, senderName, feedbackId, typeId)

// Avaliação
await notifyEvaluationPending(userId, evaluationName, evaluationId, typeId)

// Tarefa
await notifyTaskAssigned(userId, taskTitle, taskId, typeId)

// Sistema
await notifySystemAnnouncement(title, message, typeId, linkUrl)
```

Veja exemplos completos em: `docs/NOTIFICATIONS_INTEGRATION_EXAMPLE.md`

---

## 📚 Documentação Relacionada

- [NOTIFICATIONS_SYSTEM.md](./NOTIFICATIONS_SYSTEM.md) - Sistema completo
- [SUPABASE_REALTIME_JWT.md](./SUPABASE_REALTIME_JWT.md) - Como funciona o JWT
- [FIX_NOTIFICATIONS_SECURITY.md](./FIX_NOTIFICATIONS_SECURITY.md) - Políticas RLS

---

## ✅ Checklist Final

Antes de criar uma notificação, certifique-se:

- [ ] **User ID é UUID** (não é nome ou email)
- [ ] **Audience correto** ('user' ou 'all')
- [ ] **Type_id válido** (existe na tabela domains)
- [ ] **RLS policies criadas** (SELECT, INSERT, UPDATE, DELETE)
- [ ] **Realtime habilitado** (Database → Replication)
- [ ] **Usuário está logado** no frontend

---

**Data:** 30/10/2025  
**Dica:** Sempre use o template SQL acima - ele busca o user_id automaticamente pelo email!
