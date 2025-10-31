-- ========================================
-- VERIFICAÇÃO: Setup da tabela notifications_all_users_state
-- ========================================
-- Execute este script para verificar se tudo está configurado corretamente

-- 1. VERIFICAR SE TABELA EXISTE
-- ========================================
SELECT 
  table_name, 
  table_type
FROM information_schema.tables
WHERE table_schema = 'public' 
  AND table_name = 'notifications_all_users_state';

-- Se retornar vazio, a tabela NÃO existe!

-- 2. VERIFICAR CONSTRAINT ÚNICA (CRÍTICO!)
-- ========================================
SELECT 
  conname as constraint_name,
  contype as constraint_type,
  pg_get_constraintdef(oid) as definition
FROM pg_constraint
WHERE conrelid = 'public.notifications_all_users_state'::regclass
  AND contype IN ('u', 'p'); -- u = UNIQUE, p = PRIMARY KEY

-- Deve retornar:
-- constraint_name: unique_notification_user
-- constraint_type: u
-- definition: UNIQUE (notification_id, auth_user_id)

-- 3. VERIFICAR COLUNAS
-- ========================================
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'notifications_all_users_state'
ORDER BY ordinal_position;

-- Deve retornar 9 colunas:
-- id, notification_id, auth_user_id, is_read, read_at, is_deleted, deleted_at, created_at, updated_at

-- 4. VERIFICAR ÍNDICES
-- ========================================
SELECT 
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename = 'notifications_all_users_state'
ORDER BY indexname;

-- Deve retornar 5 índices (1 PK + 4 personalizados)

-- 5. VERIFICAR RLS
-- ========================================
SELECT 
  tablename,
  rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename = 'notifications_all_users_state';

-- rowsecurity deve ser TRUE

-- 6. VERIFICAR POLÍTICAS RLS
-- ========================================
SELECT 
  policyname,
  permissive,
  cmd,
  qual
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'notifications_all_users_state'
ORDER BY policyname;

-- Deve retornar 4 políticas (SELECT, INSERT, UPDATE, DELETE)

-- ========================================
-- SE A TABELA NÃO EXISTE OU CONSTRAINT ESTÁ FALTANDO:
-- Execute o arquivo: notifications_all_users_state_setup.sql
-- ========================================
