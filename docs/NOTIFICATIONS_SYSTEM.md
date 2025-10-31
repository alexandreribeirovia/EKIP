# Sistema de Notificações - EKIP

## 📋 Visão Geral

O sistema de notificações do EKIP utiliza **Supabase Realtime** para entregar notificações em tempo real aos usuários. As notificações podem ser direcionadas a usuários específicos ou enviadas globalmente para todos.

## 🗄️ Estrutura da Tabela

```sql
notifications (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  title VARCHAR NOT NULL,
  message TEXT NOT NULL,
  type_id int8 NOT NULL, -- vínculo com domínio 'notification_type'
  type VARCHAR NOT NULL, -- 'info', 'success', 'warning', 'error'
  source_type VARCHAR NULL, -- 'feedback', 'evaluation', 'task', 'system'
  source_id VARCHAR NULL, -- ID do registro de origem
  audience TEXT NOT NULL DEFAULT 'all', -- 'all' ou 'user'
  user_id VARCHAR NULL, -- ID do usuário destinatário (se audience = 'user')
  link_url VARCHAR NULL, -- URL para redirecionar ao clicar
  is_read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMPTZ NULL
);
```

## 🎨 Componentes Criados

### 1. **Types** (`frontend/src/types.ts`)
- `Notification`: Interface completa da notificação
- `CreateNotificationParams`: Parâmetros para criar notificações

### 2. **Store** (`frontend/src/stores/notificationStore.ts`)
Gerencia o estado das notificações com Zustand:
- `fetchNotifications()`: Busca notificações do backend
- `markAsRead(id)`: Marca notificação como lida
- `markAllAsRead()`: Marca todas como lidas
- `deleteNotification(id)`: Remove notificação
- `subscribeToNotifications(userId)`: Inscreve no Realtime
- `unsubscribeFromNotifications()`: Remove inscrição

### 3. **Componente** (`frontend/src/components/NotificationBell.tsx`)
Sino de notificações com:
- Badge animado mostrando contador de não lidas
- Dropdown com lista de notificações
- Marcação individual ou em massa como lida
- Exclusão de notificações
- Navegação ao clicar
- Suporte a dark mode

### 4. **Helpers** (`frontend/src/lib/notifications.ts`)
Funções utilitárias para criar notificações em contextos específicos.

## 🚀 Como Usar

### Criar Notificação Genérica

```typescript
import { createNotification } from '@/lib/notifications'

// Notificação para usuário específico
await createNotification({
  title: 'Título da Notificação',
  message: 'Mensagem detalhada aqui',
  type_id: 123, // ID do domínio notification_type
  type: 'info', // 'info', 'success', 'warning', 'error'
  user_id: 'user-uuid-123',
  link_url: '/rota/destino',
  source_type: 'feedback',
  source_id: '456'
})

// Notificação global para todos
await createNotification({
  title: 'Manutenção Programada',
  message: 'Sistema estará em manutenção amanhã às 22h',
  type_id: 124,
  type: 'warning',
  audience: 'all'
})
```

### Usar Funções Pré-Definidas

```typescript
import { 
  notifyNewFeedback, 
  notifyEvaluationPending,
  notifyTaskAssigned,
  notifySystemMaintenance 
} from '@/lib/notifications'

// Notificar sobre novo feedback
await notifyNewFeedback(
  'user-id-123',
  'João Silva',
  feedbackId,
  notificationTypeId
)

// Notificar sobre avaliação pendente
await notifyEvaluationPending(
  'user-id-123',
  'Avaliação Semestral',
  evaluationId,
  notificationTypeId
)

// Notificar sobre tarefa atribuída
await notifyTaskAssigned(
  'user-id-123',
  'Implementar feature X',
  taskId,
  notificationTypeId
)

// Notificação global de manutenção
await notifySystemMaintenance(
  'Manutenção Programada',
  'O sistema estará indisponível por 2 horas',
  notificationTypeId
)
```

## 🔌 Integração com Features Existentes

### Exemplo: FeedbackModal

```typescript
import { notifyNewFeedback } from '@/lib/notifications'
import { useAuthStore } from '@/stores/authStore'

const FeedbackModal = () => {
  const { user } = useAuthStore()
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // ... lógica de salvar feedback
    
    if (!rpcError) {
      // Buscar type_id do domínio 'notification_type' onde value = 'info'
      const { data: notifType } = await supabase
        .from('domains')
        .select('id')
        .eq('type', 'notification_type')
        .eq('value', 'info')
        .single()
      
      // Notificar o consultor que recebeu feedback
      await notifyNewFeedback(
        selectedFeedbackUser.value, // user_id
        user.name, // nome do remetente
        feedbackData[0].id, // feedback_id
        notifType?.id || 1 // type_id
      )
      
      setSuccessNotification('Feedback enviado com sucesso!')
    }
  }
  
  // ... resto do componente
}
```

### Exemplo: EmployeeEvaluationModal

```typescript
import { notifyEvaluationPending } from '@/lib/notifications'

const EmployeeEvaluationModal = () => {
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // ... lógica de criar avaliação
    
    if (!error) {
      // Buscar type_id
      const { data: notifType } = await supabase
        .from('domains')
        .select('id')
        .eq('type', 'notification_type')
        .eq('value', 'warning')
        .single()
      
      // Notificar o avaliado
      await notifyEvaluationPending(
        formData.user_id,
        formData.name,
        evaluationData.id,
        notifType?.id || 1
      )
    }
  }
}
```

## 🎯 Funções Helper Disponíveis

| Função | Descrição | Tipo | Link |
|--------|-----------|------|------|
| `notifyNewFeedback` | Notifica sobre novo feedback recebido | info | `/employee/{userId}` |
| `notifyEvaluationPending` | Notifica sobre avaliação pendente | warning | `/evaluation-response/{id}` |
| `notifyEvaluationCompleted` | Notifica sobre avaliação concluída | success | `/employee/{userId}` |
| `notifyTaskAssigned` | Notifica sobre tarefa atribuída | info | `/tasks/{taskId}` |
| `notifyTaskOverdue` | Notifica sobre tarefa vencida | error | `/tasks/{taskId}` |
| `notifyTimeEntryReminder` | Lembrete de lançamento de horas | warning | `/time-entries` |
| `notifyPDICreated` | Notifica sobre novo PDI | info | `/pdi/{pdiId}` |
| `notifySystemMaintenance` | Manutenção (global) | warning | - |
| `notifySystemAnnouncement` | Anúncio (global) | success | opcional |

## 🎨 Estilos de Notificação

### Tipos e Cores

- **Info** (info): Azul - Informações gerais
- **Success** (success): Verde - Ações bem-sucedidas
- **Warning** (warning): Amarelo - Avisos e lembretes
- **Error** (error): Vermelho - Erros e problemas

### Visual no Dropdown

- **Borda colorida** à esquerda indica o tipo
- **Emoji** representa visualmente o tipo
- **Badge "Global"** para notificações audience='all'
- **Fundo azul claro** para não lidas
- **Timestamp relativo** (ex: "há 5 minutos")
- **Ícone de link** quando há URL de destino

## 🔔 Comportamento do Realtime

### Inscrições Ativas

O sistema se inscreve em dois canais:

1. **Canal de usuário**: Notificações onde `user_id = current_user_id`
2. **Canal global**: Notificações onde `audience = 'all'`

### Auto-atualização

- ✅ Notificações aparecem **instantaneamente** sem refresh
- ✅ Contador atualiza automaticamente
- ✅ Badge anima ao receber nova notificação
- ✅ Funciona em múltiplas abas simultaneamente

## 🛡️ Segurança (RLS)

### Políticas Recomendadas

```sql
-- Usuário só vê suas notificações ou as globais
CREATE POLICY "Users can view their notifications"
  ON notifications FOR SELECT
  USING (
    auth.uid()::text = user_id OR audience = 'all'
  );

-- Usuário pode marcar como lida apenas suas notificações
CREATE POLICY "Users can update their notifications"
  ON notifications FOR UPDATE
  USING (auth.uid()::text = user_id)
  WITH CHECK (auth.uid()::text = user_id);

-- Usuário pode deletar apenas suas notificações
CREATE POLICY "Users can delete their notifications"
  ON notifications FOR DELETE
  USING (auth.uid()::text = user_id);
```

## 📊 Exemplos de Queries

### Buscar notificações não lidas

```typescript
const { data } = await supabase
  .from('notifications')
  .select('*')
  .or(`and(audience.eq.user,user_id.eq.${userId}),audience.eq.all`)
  .eq('is_read', false)
  .order('created_at', { ascending: false })
```

### Marcar todas como lidas

```typescript
const { error } = await supabase
  .from('notifications')
  .update({ is_read: true, read_at: new Date().toISOString() })
  .or(`and(audience.eq.user,user_id.eq.${userId}),audience.eq.all`)
  .eq('is_read', false)
```

## 🧪 Como Testar

### 1. Criar Notificação de Teste (Supabase SQL Editor)

```sql
-- Notificação para usuário específico
INSERT INTO notifications (title, message, type_id, type, user_id, audience, link_url)
VALUES (
  'Teste de Notificação',
  'Esta é uma notificação de teste',
  1, -- ID do domínio notification_type
  'info',
  'user-uuid-aqui',
  'user',
  '/dashboard'
);

-- Notificação global
INSERT INTO notifications (title, message, type_id, type, audience)
VALUES (
  'Anúncio Global',
  'Esta notificação aparece para todos',
  1,
  'success',
  'all'
);
```

### 2. Verificar no Frontend

1. Abra o sistema em duas abas diferentes
2. Execute o INSERT acima no Supabase
3. A notificação deve aparecer **instantaneamente** em ambas as abas
4. O contador deve atualizar automaticamente

## 🔧 Troubleshooting

### Notificações não aparecem em tempo real

1. Verificar se o Realtime está habilitado na tabela no Supabase
2. Verificar políticas RLS
3. Checar console do navegador por erros de conexão
4. Confirmar que `subscribeToNotifications()` foi chamado

### Contador incorreto

- Execute `fetchNotifications()` manualmente
- Verifique filtros na query

### Erro ao criar notificação

- Verificar se `type_id` existe na tabela `domains`
- Confirmar que campos obrigatórios estão preenchidos
- Checar permissões RLS para INSERT

## 📝 Próximos Passos

- [ ] Criar página `/notifications` para ver histórico completo
- [ ] Adicionar sons de notificação (opcional)
- [ ] Implementar filtros por tipo no dropdown
- [ ] Adicionar notificações push (PWA)
- [ ] Criar dashboard admin para enviar notificações em massa
- [ ] Implementar preferências de notificação por usuário

## 🎓 Boas Práticas

1. **Sempre use as funções helper** em vez de `createNotification()` diretamente
2. **Busque o type_id do domínio** dinamicamente antes de criar notificação
3. **Forneça link_url** sempre que possível para melhor UX
4. **Use audience='all' com moderação** para não poluir
5. **Teste em ambiente local** antes de enviar notificações em produção
6. **Mantenha mensagens curtas** (ideal: 1-2 linhas)
