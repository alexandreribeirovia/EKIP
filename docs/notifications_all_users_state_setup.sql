-- ========================================
-- TABELA AUXILIAR: notifications_all_users_state
-- ========================================
-- Esta tabela gerencia o estado individual de cada usuário para TODAS as notificações (user e all)
-- Permite que cada usuário marque como lida ou deletada sem afetar outros usuários
-- IMPORTANTE: As colunas is_read e read_at foram REMOVIDAS da tabela notifications
-- TODOS os estados de leitura/delete agora são gerenciados nesta tabela

-- 1. CRIAR TABELA notifications_all_users_state
-- ========================================

CREATE TABLE IF NOT EXISTS notifications_all_users_state (
  id SERIAL PRIMARY KEY,
  notification_id INTEGER NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
  auth_user_id VARCHAR NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT false,
  read_at TIMESTAMPTZ,
  is_deleted BOOLEAN NOT NULL DEFAULT false,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Constraint única: um usuário pode ter apenas um estado por notificação
  CONSTRAINT unique_notification_user UNIQUE (notification_id, auth_user_id)
);

-- 2. COMENTÁRIOS NA TABELA
-- ========================================

COMMENT ON TABLE notifications_all_users_state IS 'Estado individual de cada usuário para TODAS as notificações (user e all). Gerencia read/delete por usuário.';
COMMENT ON COLUMN notifications_all_users_state.notification_id IS 'ID da notificação (user ou all)';
COMMENT ON COLUMN notifications_all_users_state.auth_user_id IS 'UUID do usuário no Supabase Auth';
COMMENT ON COLUMN notifications_all_users_state.is_read IS 'Se o usuário marcou esta notificação como lida';
COMMENT ON COLUMN notifications_all_users_state.read_at IS 'Quando o usuário marcou esta notificação como lida';
COMMENT ON COLUMN notifications_all_users_state.is_deleted IS 'Se o usuário "deletou" (ocultou) esta notificação';
COMMENT ON COLUMN notifications_all_users_state.deleted_at IS 'Quando o usuário "deletou" (ocultou) esta notificação';

-- 3. CRIAR ÍNDICES PARA PERFORMANCE
-- ========================================

-- Índice para buscar estado de um usuário específico
CREATE INDEX IF NOT EXISTS idx_notifications_all_users_state_user 
ON notifications_all_users_state(auth_user_id);

-- Índice para buscar estado de uma notificação específica
CREATE INDEX IF NOT EXISTS idx_notifications_all_users_state_notification 
ON notifications_all_users_state(notification_id);

-- Índice composto para query principal (usuário + notificação)
CREATE INDEX IF NOT EXISTS idx_notifications_all_users_state_user_notification 
ON notifications_all_users_state(auth_user_id, notification_id);

-- Índice para buscar não deletadas de um usuário
CREATE INDEX IF NOT EXISTS idx_notifications_all_users_state_not_deleted 
ON notifications_all_users_state(auth_user_id, is_deleted) 
WHERE is_deleted = false;

-- 4. HABILITAR ROW LEVEL SECURITY (RLS)
-- ========================================

ALTER TABLE notifications_all_users_state ENABLE ROW LEVEL SECURITY;

-- 5. CRIAR POLÍTICAS RLS
-- ========================================

-- Política de SELECT: Usuário vê apenas seus próprios estados
DROP POLICY IF EXISTS "Users can view their own notification states" ON notifications_all_users_state;

CREATE POLICY "Users can view their own notification states"
ON notifications_all_users_state
FOR SELECT
USING (auth.uid()::text = auth_user_id);

-- Política de INSERT: Usuário pode criar estados apenas para si mesmo
DROP POLICY IF EXISTS "Users can insert their own notification states" ON notifications_all_users_state;

CREATE POLICY "Users can insert their own notification states"
ON notifications_all_users_state
FOR INSERT
WITH CHECK (auth.uid()::text = auth_user_id);

-- Política de UPDATE: Usuário só atualiza seus próprios estados
DROP POLICY IF EXISTS "Users can update their own notification states" ON notifications_all_users_state;

CREATE POLICY "Users can update their own notification states"
ON notifications_all_users_state
FOR UPDATE
USING (auth.uid()::text = auth_user_id)
WITH CHECK (auth.uid()::text = auth_user_id);

-- Política de DELETE: Usuário pode deletar seus próprios estados (caso necessário para limpeza)
DROP POLICY IF EXISTS "Users can delete their own notification states" ON notifications_all_users_state;

CREATE POLICY "Users can delete their own notification states"
ON notifications_all_users_state
FOR DELETE
USING (auth.uid()::text = auth_user_id);

-- 6. CRIAR FUNCTION PARA AUTO-ATUALIZAR updated_at
-- ========================================

CREATE OR REPLACE FUNCTION update_notifications_all_users_state_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 7. CRIAR TRIGGER PARA AUTO-ATUALIZAR updated_at
-- ========================================

DROP TRIGGER IF EXISTS trigger_notifications_all_users_state_updated_at ON notifications_all_users_state;

CREATE TRIGGER trigger_notifications_all_users_state_updated_at
BEFORE UPDATE ON notifications_all_users_state
FOR EACH ROW
EXECUTE FUNCTION update_notifications_all_users_state_updated_at();

-- 8. FUNÇÃO DE LIMPEZA AUTOMÁTICA (Para executar periodicamente)
-- ========================================
-- Esta função deleta notificações antigas (user e all) que já foram marcadas como deletadas

CREATE OR REPLACE FUNCTION cleanup_old_notifications()
RETURNS TABLE(deleted_count INTEGER) AS $$
DECLARE
  v_deleted_count INTEGER := 0;
  v_notification_id INTEGER;
  v_audience VARCHAR;
  v_total_users INTEGER;
  v_deleted_users INTEGER;
BEGIN
  -- Iterar sobre TODAS as notificações com mais de 30 dias
  FOR v_notification_id, v_audience IN 
    SELECT id, audience FROM notifications 
    WHERE created_at < NOW() - INTERVAL '30 days'
  LOOP
    IF v_audience = 'user' THEN
      -- Notificações pessoais: deletar se o usuário marcou como deletada
      SELECT COUNT(*) INTO v_deleted_users
      FROM notifications_all_users_state
      WHERE notification_id = v_notification_id
        AND is_deleted = true;
      
      IF v_deleted_users > 0 THEN
        DELETE FROM notifications WHERE id = v_notification_id;
        v_deleted_count := v_deleted_count + 1;
      END IF;
      
    ELSIF v_audience = 'all' THEN
      -- Notificações globais: deletar apenas se TODOS os usuários marcaram como deletada
      SELECT COUNT(DISTINCT id) INTO v_total_users
      FROM auth.users
      WHERE deleted_at IS NULL;
      
      SELECT COUNT(*) INTO v_deleted_users
      FROM notifications_all_users_state
      WHERE notification_id = v_notification_id
        AND is_deleted = true;
      
      IF v_deleted_users >= v_total_users AND v_total_users > 0 THEN
        DELETE FROM notifications WHERE id = v_notification_id;
        v_deleted_count := v_deleted_count + 1;
      END IF;
    END IF;
  END LOOP;
  
  RETURN QUERY SELECT v_deleted_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION cleanup_old_notifications() IS 'Remove notificações antigas já marcadas como deletadas (user: se deletada pelo usuário, all: se todos deletaram)';

-- 9. QUERIES DE TESTE E MONITORAMENTO
-- ========================================

-- Verificar estados de um usuário específico
/*
SELECT 
  n.id,
  n.title,
  n.created_at,
  COALESCE(s.is_read, false) as is_read,
  COALESCE(s.is_deleted, false) as is_deleted
FROM notifications n
LEFT JOIN notifications_all_users_state s 
  ON n.id = s.notification_id 
  AND s.auth_user_id = auth.uid()::text
WHERE n.audience = 'all'
ORDER BY n.created_at DESC;
*/

-- Contar notificações globais por estado
/*
SELECT 
  COUNT(*) FILTER (WHERE s.is_read = true) as lidas,
  COUNT(*) FILTER (WHERE s.is_read = false OR s.is_read IS NULL) as nao_lidas,
  COUNT(*) FILTER (WHERE s.is_deleted = true) as deletadas,
  COUNT(*) as total
FROM notifications n
LEFT JOIN notifications_all_users_state s 
  ON n.id = s.notification_id 
  AND s.auth_user_id = auth.uid()::text
WHERE n.audience = 'all';
*/

-- Verificar notificações que podem ser limpas
/*
SELECT 
  n.id,
  n.title,
  n.audience,
  n.created_at,
  COUNT(s.id) FILTER (WHERE s.is_deleted = true) as usuarios_que_deletaram,
  (SELECT COUNT(*) FROM auth.users WHERE deleted_at IS NULL) as total_usuarios
FROM notifications n
LEFT JOIN notifications_all_users_state s ON n.id = s.notification_id
WHERE n.created_at < NOW() - INTERVAL '30 days'
GROUP BY n.id
ORDER BY n.created_at;
*/

-- 10. VERIFICAR CONFIGURAÇÃO
-- ========================================

-- Verificar se RLS está habilitado
SELECT schemaname, tablename, rowsecurity
FROM pg_tables
WHERE tablename = 'notifications_all_users_state';

-- Verificar políticas criadas
SELECT policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE tablename = 'notifications_all_users_state';

-- Verificar índices criados
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'notifications_all_users_state'
ORDER BY indexname;

-- Verificar constraint única
SELECT conname, contype, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'notifications_all_users_state'::regclass;

-- ========================================
-- 🎉 CONFIGURAÇÃO COMPLETA!
-- ========================================
-- 
-- O que foi implementado:
-- ✅ Tabela auxiliar para estados individuais de TODAS as notificações (user e all)
-- ✅ Constraint única (um estado por usuário por notificação)
-- ✅ Índices para performance otimizada
-- ✅ RLS policies para segurança individual
-- ✅ Trigger para auto-atualizar updated_at
-- ✅ Função de limpeza automática para notificações antigas
-- 
-- IMPORTANTE: MUDANÇA DE ARQUITETURA
-- ⚠️ As colunas is_read e read_at foram REMOVIDAS da tabela notifications
-- ⚠️ TODAS as notificações (user e all) usam a tabela auxiliar para estados
-- 
-- Comportamento NOVO:
-- - Notificações 'user': Estado gerenciado na tabela auxiliar (como 'all')
-- - Notificações 'all': Estado gerenciado na tabela auxiliar
-- - Deletar QUALQUER notificação apenas oculta para o usuário específico
-- - Função de limpeza remove notificações antigas:
--   * 'user': remove se o usuário dono marcou como deletada
--   * 'all': remove apenas se TODOS os usuários marcaram como deletada
-- 
-- Para executar limpeza manual:
-- SELECT * FROM cleanup_old_notifications();
-- 
-- Para agendar limpeza automática, criar um cron job no Supabase:
-- Database → Cron Jobs → New Cron Job
-- Schedule: 0 2 * * * (todo dia às 2h da manhã)
-- Query: SELECT cleanup_old_notifications();
-- 
-- ========================================
