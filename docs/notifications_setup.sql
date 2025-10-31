-- ========================================
-- CONFIGURAÇÃO DO SISTEMA DE NOTIFICAÇÕES
-- ========================================
-- Execute este SQL no Supabase SQL Editor

-- 1. HABILITAR REALTIME NA TABELA
-- ========================================
-- No Supabase Dashboard:
-- 1. Vá em "Database" > "Replication"
-- 2. Encontre a tabela "notifications"
-- 3. Habilite o toggle de Realtime
-- OU execute via SQL:

ALTER PUBLICATION supabase_realtime ADD TABLE notifications;

-- 2. CRIAR ÍNDICES PARA PERFORMANCE
-- ========================================

-- Índice para buscar notificações de um usuário
CREATE INDEX IF NOT EXISTS idx_notifications_user_id 
ON notifications(user_id) 
WHERE audience = 'user';

-- Índice para buscar notificações globais
CREATE INDEX IF NOT EXISTS idx_notifications_audience 
ON notifications(audience) 
WHERE audience = 'all';

-- Índice para buscar não lidas
CREATE INDEX IF NOT EXISTS idx_notifications_is_read 
ON notifications(is_read) 
WHERE is_read = false;

-- Índice para ordenação por data
CREATE INDEX IF NOT EXISTS idx_notifications_created_at 
ON notifications(created_at DESC);

-- Índice composto para query principal (usuário + não lidas)
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread 
ON notifications(user_id, is_read, created_at DESC) 
WHERE audience = 'user';

-- 3. HABILITAR ROW LEVEL SECURITY (RLS)
-- ========================================

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- 4. CRIAR POLÍTICAS RLS
-- ========================================

-- Política de SELECT: Usuário vê suas notificações OU notificações globais
DROP POLICY IF EXISTS "Users can view their notifications" ON notifications;

CREATE POLICY "Users can view their notifications"
ON notifications
FOR SELECT
USING (
  -- Notificações do usuário específico
  (audience = 'user' AND auth.uid()::text = auth_user_id)
  OR
  -- Notificações globais
  (audience = 'all')
);

-- Política de UPDATE: Usuário só atualiza suas próprias notificações
DROP POLICY IF EXISTS "Users can update their notifications" ON notifications;

CREATE POLICY "Users can update their notifications"
ON notifications
FOR UPDATE
USING (auth.uid()::text = auth_user_id AND audience = 'user')
WITH CHECK (auth.uid()::text = auth_user_id AND audience = 'user');

-- Política de DELETE: Usuário só deleta suas próprias notificações
DROP POLICY IF EXISTS "Users can delete their notifications" ON notifications;

CREATE POLICY "Users can delete their notifications"
ON notifications
FOR DELETE
USING (auth.uid()::text = auth_user_id AND audience = 'user');

-- Política de INSERT: Sistema pode criar notificações (service_role)
-- Nota: Esta política deve ser mais restritiva em produção
DROP POLICY IF EXISTS "Service role can insert notifications" ON notifications;

CREATE POLICY "Service role can insert notifications"
ON notifications
FOR INSERT
WITH CHECK (true); -- ← Em produção, adicionar restrições aqui

-- 5. CRIAR FUNCTION PARA AUTO-ATUALIZAR updated_at
-- ========================================

CREATE OR REPLACE FUNCTION update_notifications_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 6. CRIAR TRIGGER PARA AUTO-ATUALIZAR updated_at
-- ========================================

DROP TRIGGER IF EXISTS trigger_notifications_updated_at ON notifications;

CREATE TRIGGER trigger_notifications_updated_at
BEFORE UPDATE ON notifications
FOR EACH ROW
EXECUTE FUNCTION update_notifications_updated_at();

-- 7. INSERIR DOMÍNIOS DE TIPO DE NOTIFICAÇÃO (se não existirem)
-- ========================================

-- Verificar se já existem
DO $$
BEGIN
  -- Inserir tipos de notificação se não existirem
  IF NOT EXISTS (
    SELECT 1 FROM domains 
    WHERE type = 'notification_type' AND value = 'info'
  ) THEN
    INSERT INTO domains (type, value, description, is_active)
    VALUES ('notification_type', 'info', 'Notificação informativa', true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM domains 
    WHERE type = 'notification_type' AND value = 'success'
  ) THEN
    INSERT INTO domains (type, value, description, is_active)
    VALUES ('notification_type', 'success', 'Notificação de sucesso', true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM domains 
    WHERE type = 'notification_type' AND value = 'warning'
  ) THEN
    INSERT INTO domains (type, value, description, is_active)
    VALUES ('notification_type', 'warning', 'Notificação de aviso', true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM domains 
    WHERE type = 'notification_type' AND value = 'error'
  ) THEN
    INSERT INTO domains (type, value, description, is_active)
    VALUES ('notification_type', 'error', 'Notificação de erro', true);
  END IF;
END $$;

-- 8. CRIAR NOTIFICAÇÃO DE TESTE (OPCIONAL)
-- ========================================

-- Descomente e execute para testar (substitua 'USER_ID_AQUI' pelo ID real)
/*
INSERT INTO notifications (
  title, 
  message, 
  type_id, 
  type, 
  audience, 
  auth_user_id, 
  link_url,
  source_type
)
SELECT 
  'Bem-vindo ao Sistema de Notificações! 🎉',
  'Este é um exemplo de notificação em tempo real. Clique para explorar o dashboard.',
  id,
  'success',
  'user',
  'USER_ID_AQUI', -- ← Substituir pelo auth_user_id real
  '/dashboard',
  'system'
FROM domains
WHERE type = 'notification_type' AND value = 'success'
LIMIT 1;
*/

-- 9. CRIAR NOTIFICAÇÃO GLOBAL DE TESTE (OPCIONAL)
-- ========================================

-- Descomente para testar notificação global
/*
INSERT INTO notifications (
  title, 
  message, 
  type_id, 
  type, 
  audience,
  source_type
)
SELECT 
  '📢 Anúncio para Todos',
  'Esta é uma notificação global que todos os usuários receberão em tempo real!',
  id,
  'info',
  'all',
  'system'
FROM domains
WHERE type = 'notification_type' AND value = 'info'
LIMIT 1;
*/

-- 10. VERIFICAR CONFIGURAÇÃO
-- ========================================

-- Verificar se RLS está habilitado
SELECT schemaname, tablename, rowsecurity
FROM pg_tables
WHERE tablename = 'notifications';

-- Verificar políticas criadas
SELECT policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE tablename = 'notifications';

-- Verificar índices criados
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'notifications'
ORDER BY indexname;

-- Verificar domínios de notification_type
SELECT id, type, value, description, is_active
FROM domains
WHERE type = 'notification_type'
ORDER BY value;

-- Contar notificações existentes
SELECT 
  audience,
  type,
  is_read,
  COUNT(*) as total
FROM notifications
GROUP BY audience, type, is_read
ORDER BY audience, type, is_read;

-- ========================================
-- 🎉 CONFIGURAÇÃO COMPLETA!
-- ========================================
-- 
-- Próximos passos:
-- 1. Verifique se o Realtime está habilitado na tabela
-- 2. Teste criando uma notificação manualmente
-- 3. Abra o frontend e veja a notificação aparecer em tempo real
-- 4. Integre notificações nos fluxos do sistema (feedbacks, avaliações, etc.)
-- 
-- Documentação completa em:
-- - docs/NOTIFICATIONS_SYSTEM.md
-- - docs/NOTIFICATIONS_INTEGRATION_EXAMPLE.md
-- ========================================
