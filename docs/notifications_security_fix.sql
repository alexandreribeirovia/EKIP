-- ========================================
-- CORREÇÃO DE SEGURANÇA - NOTIFICAÇÕES
-- ========================================
-- Execute este SQL após o notifications_setup.sql

-- 1. REMOVER POLÍTICAS ANTIGAS (se existirem)
-- ========================================

DROP POLICY IF EXISTS "Service role can insert notifications" ON notifications;

-- 2. POLÍTICAS DE SEGURANÇA APRIMORADAS
-- ========================================

-- 2.1. SELECT: Usuário vê apenas suas notificações ou globais
-- IMPORTANTE: auth.uid() só funciona com JWT válido
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

-- 2.2. INSERT: Restringir criação de notificações
-- Apenas usuários autenticados podem criar notificações
DROP POLICY IF EXISTS "Authenticated users can insert notifications" ON notifications;

CREATE POLICY "Authenticated users can insert notifications"
ON notifications
FOR INSERT
WITH CHECK (
  -- Usuário autenticado
  auth.role() = 'authenticated' AND
  (
    -- Pode criar notificações para si mesmo
    (audience = 'user' AND auth.uid()::text = auth_user_id)
    OR
    -- OU notificações globais (apenas service_role em produção)
    (audience = 'all' AND auth.role() = 'service_role')
  )
);

-- 2.3. UPDATE: Usuário só atualiza suas próprias notificações
DROP POLICY IF EXISTS "Users can update their notifications" ON notifications;

CREATE POLICY "Users can update their notifications"
ON notifications
FOR UPDATE
USING (
  audience = 'user' AND 
  auth.uid()::text = auth_user_id
)
WITH CHECK (
  audience = 'user' AND 
  auth.uid()::text = auth_user_id
);

-- 2.4. DELETE: Usuário só deleta suas próprias notificações
-- Bloquear delete de notificações globais
DROP POLICY IF EXISTS "Users can delete their notifications" ON notifications;

CREATE POLICY "Users can delete their notifications"
ON notifications
FOR DELETE
USING (
  audience = 'user' AND 
  auth.uid()::text = auth_user_id
);

-- 3. VERIFICAR CONFIGURAÇÃO
-- ========================================

-- Verificar se RLS está habilitado
SELECT 
  schemaname, 
  tablename, 
  rowsecurity as "RLS Habilitado?"
FROM pg_tables
WHERE tablename = 'notifications';

-- Listar todas as políticas
SELECT 
  policyname as "Nome da Política",
  cmd as "Comando",
  permissive as "Permissiva?",
  roles as "Roles",
  qual as "Condição USING",
  with_check as "Condição WITH CHECK"
FROM pg_policies
WHERE tablename = 'notifications'
ORDER BY cmd, policyname;

-- 4. TESTE DE SEGURANÇA
-- ========================================

-- Execute este teste estando LOGADO como um usuário comum:

-- Teste 1: Buscar notificações (deve retornar apenas as suas + globais)
SELECT 
  id, 
  title, 
  audience, 
  auth_user_id,
  created_at
FROM notifications
ORDER BY created_at DESC
LIMIT 5;

-- Teste 2: Tentar acessar notificações de outro usuário
-- (Substitua 'OUTRO_USER_ID' por um ID válido diferente do seu)
/*
SELECT * FROM notifications 
WHERE auth_user_id = 'OUTRO_USER_ID' AND audience = 'user';
-- Resultado esperado: Vazio (RLS bloqueou)
*/

-- Teste 3: Tentar criar notificação para outro usuário
/*
INSERT INTO notifications (title, message, type_id, type, auth_user_id, audience)
VALUES ('Teste Hack', 'Tentativa de criar notificação para outro usuário', 1, 'info', 'OUTRO_USER_ID', 'user');
-- Resultado esperado: Erro de RLS
*/

-- 5. QUERIES DE MONITORAMENTO
-- ========================================

-- Contar notificações por tipo e audience
SELECT 
  type,
  audience,
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE is_read = false) as nao_lidas
FROM notifications
GROUP BY type, audience
ORDER BY type, audience;

-- Usuários com mais notificações não lidas
SELECT 
  auth_user_id,
  COUNT(*) as nao_lidas
FROM notifications
WHERE is_read = false AND audience = 'user'
GROUP BY auth_user_id
ORDER BY nao_lidas DESC
LIMIT 10;

-- Notificações criadas nas últimas 24h
SELECT 
  COUNT(*) as total_24h,
  COUNT(*) FILTER (WHERE audience = 'all') as globais,
  COUNT(*) FILTER (WHERE audience = 'user') as individuais
FROM notifications
WHERE created_at > NOW() - INTERVAL '24 hours';

-- ========================================
-- 🔒 SEGURANÇA CONFIGURADA!
-- ========================================
-- 
-- O que foi implementado:
-- ✅ RLS policies aprimoradas com validação de auth.uid()
-- ✅ JWT token automaticamente incluído pelo Supabase no WebSocket
-- ✅ Usuários só veem suas próprias notificações
-- ✅ Bloqueio de criação/edição/exclusão não autorizada
-- ✅ Logs detalhados no console do navegador
-- ✅ Reconexão automática em caso de erro
-- 
-- Próximos passos:
-- 1. Abra o navegador com DevTools (F12)
-- 2. Vá para a aba Console
-- 3. Verifique os logs: "🔑 JWT Token presente: true"
-- 4. Crie uma notificação de teste e veja aparecer em tempo real
-- 
-- ========================================
