# 🔔 Sistema de Notificações - Quick Start

## ✅ O que foi implementado

- ✅ **Zustand Store** com Supabase Realtime
- ✅ **NotificationBell Component** integrado no Layout
- ✅ **Helpers de notificação** para casos de uso comuns
- ✅ **Tipos TypeScript** completos
- ✅ **Documentação detalhada**

## 🚀 Como usar (3 passos)

### 1️⃣ Configurar o Banco de Dados

Execute o SQL no Supabase SQL Editor:

```bash
# Arquivo: docs/notifications_setup.sql
```

Esse script irá:
- Habilitar Realtime na tabela `notifications`
- Criar índices para performance
- Configurar RLS policies
- Inserir domínios `notification_type`

### 2️⃣ Importar Helper

```typescript
import { notifyNewFeedback } from '@/lib/notifications'
```

### 3️⃣ Chamar no seu Código

```typescript
// Exemplo: Após criar um feedback
const { data: notifType } = await supabase
  .from('domains')
  .select('id')
  .eq('type', 'notification_type')
  .eq('value', 'info')
  .single()

if (notifType && feedbackId) {
  await notifyNewFeedback(
    userId,        // Para quem
    senderName,    // De quem
    feedbackId,    // ID do registro
    notifType.id   // Tipo
  )
}
```

## 📦 Arquivos Criados

```
frontend/src/
├── types.ts                        ← Interfaces Notification
├── stores/
│   └── notificationStore.ts        ← Zustand store com Realtime
├── components/
│   └── NotificationBell.tsx        ← Sino de notificações
└── lib/
    └── notifications.ts            ← Helpers de notificação

docs/
├── NOTIFICATIONS_SYSTEM.md         ← Documentação completa
├── NOTIFICATIONS_INTEGRATION_EXAMPLE.md  ← Exemplos práticos
└── notifications_setup.sql         ← SQL de configuração
```

## 🎯 Helpers Disponíveis

| Helper | Uso |
|--------|-----|
| `notifyNewFeedback` | Feedback recebido |
| `notifyEvaluationPending` | Avaliação aguardando resposta |
| `notifyEvaluationCompleted` | Avaliação concluída |
| `notifyTaskAssigned` | Tarefa atribuída |
| `notifyTaskOverdue` | Tarefa atrasada |
| `notifyTimeEntryReminder` | Lembrete de horas |
| `notifyPDICreated` | PDI criado |
| `notifySystemMaintenance` | Manutenção (global) |
| `notifySystemAnnouncement` | Anúncio (global) |

## 🧪 Testar

### Criar notificação de teste:

```sql
-- No Supabase SQL Editor
INSERT INTO notifications (title, message, type_id, type, user_id, audience, link_url)
SELECT 
  'Teste de Notificação',
  'Esta é uma notificação de teste',
  id,
  'info',
  'SEU_USER_ID_AQUI',
  'user',
  '/dashboard'
FROM domains
WHERE type = 'notification_type' AND value = 'info'
LIMIT 1;
```

**Resultado esperado:**
- Notificação aparece instantaneamente no sino
- Contador atualiza automaticamente
- Badge anima (pulse)
- Funciona em múltiplas abas

## 📚 Documentação Completa

- **Sistema completo**: `docs/NOTIFICATIONS_SYSTEM.md`
- **Exemplos de integração**: `docs/NOTIFICATIONS_INTEGRATION_EXAMPLE.md`
- **SQL de setup**: `docs/notifications_setup.sql`

## 🎨 Visual

### NotificationBell
- Sino com badge animado (contador de não lidas)
- Dropdown com notificações
- Formatação de data relativa ("há 5 minutos")
- Suporte a dark mode
- Ícones por tipo (✅ 🛈 ⚠️ ❌)
- Badge "Global" para notificações de todos

### Tipos de Notificação
- **Info** (azul): Informações gerais
- **Success** (verde): Sucesso
- **Warning** (amarelo): Avisos
- **Error** (vermelho): Erros

## ⚡ Realtime

- ✅ Atualização instantânea via Supabase Realtime
- ✅ Funciona em múltiplas abas
- ✅ Sem polling ou refresh manual
- ✅ Notificações globais + individuais

## 🔐 Segurança

- RLS habilitado na tabela
- Usuário só vê suas notificações + globais
- Usuário só pode marcar/deletar suas próprias
- Políticas configuradas no SQL setup

## 💡 Próximos Passos

1. Execute o SQL de setup (`notifications_setup.sql`)
2. Teste criando notificação manual
3. Integre nos fluxos existentes (feedbacks, avaliações, etc.)
4. Configure cron jobs para lembretes automáticos
5. (Opcional) Crie página `/notifications` para histórico completo

---

**Dúvidas?** Consulte `docs/NOTIFICATIONS_SYSTEM.md` para documentação detalhada.
