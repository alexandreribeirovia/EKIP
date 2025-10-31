-- ========================================
-- MIGRAÇÃO: Remover is_read e read_at da tabela notifications
-- ========================================
-- 
-- Este script remove as colunas is_read e read_at da tabela notifications
-- pois agora TODAS as notificações usam a tabela auxiliar notifications_all_users_state
-- 
-- ⚠️ IMPORTANTE: Execute este script DEPOIS de:
-- 1. Executar notifications_all_users_state_setup.sql
-- 2. Testar o sistema com a nova tabela auxiliar
-- 3. Fazer backup do banco de dados
-- 
-- ========================================

-- 1. MIGRAR DADOS EXISTENTES (Opcional)
-- ========================================
-- Se você tem notificações 'user' com is_read=true, pode migrar os estados para a tabela auxiliar

DO $$
DECLARE
  v_migrated_count INTEGER := 0;
BEGIN
  -- Migrar estados de leitura de notificações pessoais
  INSERT INTO notifications_all_users_state (notification_id, auth_user_id, is_read, read_at, is_deleted, deleted_at)
  SELECT 
    id as notification_id,
    auth_user_id,
    COALESCE(is_read, false) as is_read,
    read_at,
    false as is_deleted, -- Não há campo is_deleted nas notificações antigas
    NULL as deleted_at
  FROM notifications
  WHERE audience = 'user'
    AND auth_user_id IS NOT NULL
    AND is_read = true -- Apenas migrar as que foram lidas (para economizar espaço)
  ON CONFLICT (notification_id, auth_user_id) DO NOTHING;

  GET DIAGNOSTICS v_migrated_count = ROW_COUNT;
  
  RAISE NOTICE 'Migração concluída: % estados de leitura migrados para a tabela auxiliar', v_migrated_count;
END $$;

-- 2. VERIFICAR DADOS ANTES DE REMOVER COLUNAS
-- ========================================

-- Ver quantas notificações têm is_read = true
SELECT 
  audience,
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE is_read = true) as lidas
FROM notifications
GROUP BY audience;

-- Ver se os dados foram migrados corretamente
SELECT 
  COUNT(*) as estados_migrados
FROM notifications_all_users_state
WHERE is_read = true;

-- 3. REMOVER COLUNAS (Irreversível!)
-- ========================================

-- ⚠️ ATENÇÃO: Esta operação é IRREVERSÍVEL!
-- ⚠️ Faça backup antes de executar!

-- Remover coluna is_read
ALTER TABLE notifications DROP COLUMN IF EXISTS is_read;

-- Remover coluna read_at
ALTER TABLE notifications DROP COLUMN IF EXISTS read_at;

-- 4. VERIFICAR ESTRUTURA FINAL
-- ========================================

-- Verificar colunas restantes da tabela notifications
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'notifications'
ORDER BY ordinal_position;

-- 5. ATUALIZAR COMENTÁRIOS DA TABELA
-- ========================================

COMMENT ON TABLE notifications IS 'Notificações do sistema (user e all). Estados de leitura/delete são gerenciados na tabela notifications_all_users_state.';

-- ========================================
-- 🎉 MIGRAÇÃO COMPLETA!
-- ========================================
-- 
-- Colunas removidas:
-- ❌ notifications.is_read
-- ❌ notifications.read_at
-- 
-- Novo comportamento:
-- ✅ TODOS os estados (is_read, read_at, is_deleted, deleted_at) agora na tabela auxiliar
-- ✅ Arquitetura unificada para notificações 'user' e 'all'
-- 
-- Próximos passos:
-- 1. Testar frontend (deve funcionar normalmente)
-- 2. Verificar queries no backend
-- 3. Monitorar logs de erro
-- 
-- ========================================
