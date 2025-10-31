-- ========================================
-- CRIAÇÃO RÁPIDA: notifications_all_users_state
-- ========================================
-- Execute este script se você ainda NÃO criou a tabela
-- Este é um script mais simples e direto

-- 1. CRIAR TABELA
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
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. CRIAR CONSTRAINT ÚNICA (ESSENCIAL!)
-- ========================================
-- Esta constraint é OBRIGATÓRIA para o ON CONFLICT funcionar

DO $$
BEGIN
  -- Tentar adicionar constraint se não existir
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'unique_notification_user' 
      AND conrelid = 'notifications_all_users_state'::regclass
  ) THEN
    ALTER TABLE notifications_all_users_state 
    ADD CONSTRAINT unique_notification_user 
    UNIQUE (notification_id, auth_user_id);
    
    RAISE NOTICE 'Constraint única criada com sucesso!';
  ELSE
    RAISE NOTICE 'Constraint única já existe.';
  END IF;
END $$;

-- 3. CRIAR ÍNDICES BÁSICOS
-- ========================================
CREATE INDEX IF NOT EXISTS idx_notifications_all_users_state_user 
ON notifications_all_users_state(auth_user_id);

CREATE INDEX IF NOT EXISTS idx_notifications_all_users_state_notification 
ON notifications_all_users_state(notification_id);

-- 4. HABILITAR RLS
-- ========================================
ALTER TABLE notifications_all_users_state ENABLE ROW LEVEL SECURITY;

-- 5. CRIAR POLÍTICAS RLS
-- ========================================

-- SELECT: Usuário vê apenas seus próprios estados
DROP POLICY IF EXISTS "Users can view their own notification states" ON notifications_all_users_state;
CREATE POLICY "Users can view their own notification states"
ON notifications_all_users_state FOR SELECT
USING (auth.uid()::text = auth_user_id);

-- INSERT: Usuário cria estados apenas para si
DROP POLICY IF EXISTS "Users can insert their own notification states" ON notifications_all_users_state;
CREATE POLICY "Users can insert their own notification states"
ON notifications_all_users_state FOR INSERT
WITH CHECK (auth.uid()::text = auth_user_id);

-- UPDATE: Usuário atualiza apenas seus estados
DROP POLICY IF EXISTS "Users can update their own notification states" ON notifications_all_users_state;
CREATE POLICY "Users can update their own notification states"
ON notifications_all_users_state FOR UPDATE
USING (auth.uid()::text = auth_user_id)
WITH CHECK (auth.uid()::text = auth_user_id);

-- DELETE: Usuário deleta apenas seus estados
DROP POLICY IF EXISTS "Users can delete their own notification states" ON notifications_all_users_state;
CREATE POLICY "Users can delete their own notification states"
ON notifications_all_users_state FOR DELETE
USING (auth.uid()::text = auth_user_id);

-- 6. VERIFICAÇÃO FINAL
-- ========================================

-- Verificar constraint única
SELECT 
  conname,
  pg_get_constraintdef(oid) as definition
FROM pg_constraint
WHERE conrelid = 'notifications_all_users_state'::regclass
  AND conname = 'unique_notification_user';

-- Deve retornar: UNIQUE (notification_id, auth_user_id)

-- ========================================
-- ✅ PRONTO!
-- ========================================
-- Agora você pode testar o sistema novamente.
-- O UPSERT deve funcionar corretamente.
