# Exemplo de Integração - Sistema de Notificações

## 📋 Exemplo Completo: FeedbackModal

Este exemplo mostra como integrar notificações ao enviar um novo feedback.

### Código Completo

```typescript
import { useState, useEffect } from 'react';
import { X, ThumbsUp, MessageCircle, Trophy, TrendingUp } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import Select from 'react-select';
import { useAuthStore } from '../stores/authStore';
import { notifyNewFeedback } from '../lib/notifications'; // ← Import
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';

const FeedbackModal = ({ isOpen, onClose, onSuccess, preSelectedUser = null, feedbackToEdit = null }) => {
  const { user } = useAuthStore();
  
  // ... estados existentes ...
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      if (!selectedFeedbackUser) {
        setError('Selecione um consultor');
        setIsSubmitting(false);
        return;
      }

      const feedbackTypeName = feedbackTypes.find(t => t.id === selectedType)?.name || '';

      const feedbackDataPayload = {
        feedback_user_id: selectedFeedbackUser.value,
        feedback_user_name: selectedFeedbackUser.label,
        owner_user_id: user?.id || '',
        owner_user_name: user?.name || '',
        feedback_date: feedbackDate,
        type_id: selectedType,
        type: feedbackTypeName,
        public_comment: publicComment.trim(),
        private_comment: privateComment.trim() || null,
      };

      let feedbackId: number | null = null;
      let rpcError;

      if (feedbackToEdit) {
        // Modo edição
        const { error } = await supabase
          .from('feedbacks')
          .update(feedbackDataPayload)
          .eq('id', feedbackToEdit.id);
        rpcError = error;
        feedbackId = feedbackToEdit.id;
      } else {
        // Modo criação
        const { data, error } = await supabase
          .from('feedbacks')
          .insert(feedbackDataPayload)
          .select('id')
          .single();
        
        rpcError = error;
        feedbackId = data?.id || null;
      }

      if (rpcError) {
        setError(rpcError.message || 'Erro ao salvar feedback. Tente novamente.');
        return;
      }

      // ========================================
      // 🔔 ENVIAR NOTIFICAÇÃO
      // ========================================
      if (feedbackId && !feedbackToEdit) { // Só notifica em criações novas
        try {
          // 1. Buscar type_id do domínio 'notification_type' onde value = 'info'
          const { data: notifType } = await supabase
            .from('domains')
            .select('id')
            .eq('type', 'notification_type')
            .eq('value', 'info')
            .single();

          if (notifType) {
            // 2. Enviar notificação para o consultor que recebeu feedback
            await notifyNewFeedback(
              selectedFeedbackUser.value, // user_id do consultor
              user?.name || 'Seu gestor', // nome do remetente
              feedbackId, // ID do feedback
              notifType.id // type_id do domínio
            );
          }
        } catch (notifError) {
          console.error('Erro ao enviar notificação:', notifError);
          // Não bloqueia o fluxo se notificação falhar
        }
      }
      // ========================================

      // Sucesso
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Erro ao salvar feedback. Tente novamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ... resto do componente
};

export default FeedbackModal;
```

## 🎯 Pontos Importantes

### 1. **Import do Helper**
```typescript
import { notifyNewFeedback } from '../lib/notifications';
```

### 2. **Buscar type_id do Domínio**
```typescript
const { data: notifType } = await supabase
  .from('domains')
  .select('id')
  .eq('type', 'notification_type')
  .eq('value', 'info') // 'info', 'success', 'warning', 'error'
  .single();
```

### 3. **Chamar Helper de Notificação**
```typescript
await notifyNewFeedback(
  selectedFeedbackUser.value, // Para quem
  user?.name || 'Seu gestor', // De quem
  feedbackId, // ID do registro
  notifType.id // Tipo da notificação
);
```

### 4. **Try-Catch Independente**
```typescript
try {
  // Código de notificação
} catch (notifError) {
  console.error('Erro ao enviar notificação:', notifError);
  // Não bloqueia o fluxo principal
}
```

## 🚀 Outros Exemplos de Integração

### Exemplo 2: EmployeeEvaluationModal

```typescript
import { notifyEvaluationPending } from '@/lib/notifications';

const EmployeeEvaluationModal = () => {
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // ... lógica de criar avaliação
    
    const { data: evaluationData, error } = await supabase
      .from('employee_evaluations')
      .insert({
        name: formData.name,
        user_id: formData.user_id,
        owner_id: user?.id,
        period_start: formData.period_start,
        period_end: formData.period_end,
        evaluation_model_id: formData.evaluation_model_id
      })
      .select()
      .single();
    
    if (!error && evaluationData) {
      // Buscar type_id
      const { data: notifType } = await supabase
        .from('domains')
        .select('id')
        .eq('type', 'notification_type')
        .eq('value', 'warning')
        .single();
      
      // Notificar o avaliado
      if (notifType) {
        await notifyEvaluationPending(
          formData.user_id,
          formData.name,
          evaluationData.id,
          notifType.id
        );
      }
    }
  };
};
```

### Exemplo 3: Notificação Global de Manutenção

```typescript
import { notifySystemMaintenance } from '@/lib/notifications';

const AdminPanel = () => {
  const scheduleMaintenance = async () => {
    // Buscar type_id
    const { data: notifType } = await supabase
      .from('domains')
      .select('id')
      .eq('type', 'notification_type')
      .eq('value', 'warning')
      .single();
    
    if (notifType) {
      await notifySystemMaintenance(
        'Manutenção Programada',
        'O sistema estará em manutenção amanhã das 22h às 00h',
        notifType.id
      );
    }
  };
};
```

### Exemplo 4: Notificação Após Criar PDI

```typescript
import { notifyPDICreated } from '@/lib/notifications';

const PDIModal = () => {
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const { data: pdiData, error } = await supabase
      .from('pdi')
      .insert({
        user_id: formData.user_id,
        owner_id: user?.id,
        start_date: formData.start_date,
        end_date: formData.end_date
      })
      .select()
      .single();
    
    if (!error && pdiData) {
      const { data: notifType } = await supabase
        .from('domains')
        .select('id')
        .eq('type', 'notification_type')
        .eq('value', 'info')
        .single();
      
      if (notifType) {
        await notifyPDICreated(
          formData.user_id,
          pdiData.id,
          notifType.id
        );
      }
    }
  };
};
```

### Exemplo 5: Lembrete de Lançamento de Horas (Cron Job)

```typescript
import { notifyTimeEntryReminder } from '@/lib/notifications';

// Backend: Executar diariamente às 17h
const sendTimeEntryReminders = async () => {
  const today = new Date().toLocaleDateString('pt-BR');
  
  // Buscar usuários que não lançaram horas hoje
  const { data: users } = await supabase
    .from('users')
    .select('user_id, name')
    .eq('log_hours', true)
    .eq('is_active', true);
  
  const { data: notifType } = await supabase
    .from('domains')
    .select('id')
    .eq('type', 'notification_type')
    .eq('value', 'warning')
    .single();
  
  if (users && notifType) {
    for (const user of users) {
      // Verificar se já lançou horas hoje
      const { data: entries } = await supabase
        .from('time_worked')
        .select('id')
        .eq('user_id', user.user_id)
        .eq('date', new Date().toISOString().split('T')[0])
        .limit(1);
      
      if (!entries || entries.length === 0) {
        await notifyTimeEntryReminder(
          user.user_id,
          today,
          notifType.id
        );
      }
    }
  }
};
```

## 🎨 Boas Práticas

### ✅ DO (Faça)

```typescript
// 1. Sempre busque type_id do domínio
const { data: notifType } = await supabase
  .from('domains')
  .select('id')
  .eq('type', 'notification_type')
  .eq('value', 'info')
  .single();

// 2. Use try-catch independente
try {
  if (notifType) {
    await notifyNewFeedback(...);
  }
} catch (err) {
  console.error('Notificação falhou:', err);
  // Não bloqueia o fluxo principal
}

// 3. Só notifique em operações novas (não em edições)
if (feedbackId && !feedbackToEdit) {
  await notifyNewFeedback(...);
}

// 4. Forneça links úteis
await createNotification({
  ...
  link_url: `/employee/${userId}` // ← Link direto para o contexto
});
```

### ❌ DON'T (Não Faça)

```typescript
// 1. Não use type_id hardcoded
await createNotification({
  type_id: 1, // ❌ Pode mudar no banco
  ...
});

// 2. Não bloqueie o fluxo principal
await notifyNewFeedback(...); // ❌ Se falhar, bloqueia tudo
onSuccess();

// 3. Não notifique em edições (spam)
await notifyNewFeedback(...); // ❌ Toda vez que editar

// 4. Não deixe erros silenciosos sem log
try {
  await notifyNewFeedback(...);
} catch (err) {
  // ❌ Sem log, impossível debugar
}
```

## 🧪 Como Testar

### 1. Criar Domínio de Teste

```sql
-- No Supabase SQL Editor
INSERT INTO domains (type, value, description, is_active)
VALUES 
  ('notification_type', 'info', 'Notificação informativa', true),
  ('notification_type', 'success', 'Notificação de sucesso', true),
  ('notification_type', 'warning', 'Notificação de aviso', true),
  ('notification_type', 'error', 'Notificação de erro', true);
```

### 2. Testar Fluxo Completo

1. Abra o sistema em **duas abas/navegadores** com usuários diferentes
2. No usuário A (gestor): Envie feedback para usuário B
3. No usuário B (consultor): Veja a notificação aparecer **instantaneamente**
4. Clique na notificação → deve navegar para a página correta
5. Marque como lida → contador deve atualizar

### 3. Verificar no Banco

```sql
-- Ver notificações criadas
SELECT * FROM notifications 
ORDER BY created_at DESC 
LIMIT 10;

-- Ver contador de não lidas por usuário
SELECT user_id, COUNT(*) as unread_count
FROM notifications
WHERE is_read = false
GROUP BY user_id;
```

## 📊 Monitoramento

### Queries Úteis

```sql
-- Notificações mais enviadas (por tipo)
SELECT type, COUNT(*) as total
FROM notifications
GROUP BY type
ORDER BY total DESC;

-- Taxa de leitura
SELECT 
  COUNT(*) FILTER (WHERE is_read = true) * 100.0 / COUNT(*) as read_rate
FROM notifications;

-- Usuários com mais notificações não lidas
SELECT user_id, COUNT(*) as unread
FROM notifications
WHERE is_read = false
GROUP BY user_id
ORDER BY unread DESC
LIMIT 10;

-- Tempo médio até ler notificação
SELECT 
  AVG(EXTRACT(EPOCH FROM (read_at - created_at))) / 3600 as avg_hours_to_read
FROM notifications
WHERE read_at IS NOT NULL;
```

## 🔧 Troubleshooting

### Problema: Notificação não aparece

**Solução:**
1. Verifique o console do navegador por erros
2. Confirme que Realtime está habilitado na tabela `notifications` no Supabase
3. Verifique políticas RLS
4. Teste com notificação global (`audience='all'`)

### Problema: type_id NULL

**Solução:**
```typescript
// Adicione validação
const { data: notifType } = await supabase
  .from('domains')
  .select('id')
  .eq('type', 'notification_type')
  .eq('value', 'info')
  .single();

if (!notifType) {
  console.error('Domínio notification_type não encontrado!');
  return;
}
```

### Problema: Notificações duplicadas

**Solução:**
```typescript
// Use flag para evitar duplicatas
if (feedbackId && !feedbackToEdit) { // ← Verifica se não é edição
  await notifyNewFeedback(...);
}
```

## 📝 Checklist de Integração

- [ ] Importar helper de notificação
- [ ] Buscar type_id do domínio
- [ ] Validar se type_id existe
- [ ] Chamar função helper com parâmetros corretos
- [ ] Usar try-catch independente
- [ ] Não bloquear fluxo principal
- [ ] Testar em ambiente local
- [ ] Verificar se notificação aparece em tempo real
- [ ] Confirmar link_url funciona corretamente
- [ ] Adicionar logs para debugging
