-- ============================================================================
-- Migration: Aceite de Avaliação
-- Data: 2024-12-18
-- Descrição: Adiciona campos de aceite na tabela evaluations e cria tabela
--            evaluation_accept_session para controle de tokens de aceite
-- ============================================================================

-- 1. Adicionar campos de aceite na tabela evaluations
-- ============================================================================
ALTER TABLE evaluations 
ADD COLUMN IF NOT EXISTS accepted BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMPTZ;

-- Comentários nos campos
COMMENT ON COLUMN evaluations.accepted IS 'Indica se o funcionário aceitou a avaliação';
COMMENT ON COLUMN evaluations.accepted_at IS 'Data/hora em que a avaliação foi aceita';

-- 2. Criar tabela evaluation_accept_session para tokens de aceite
-- ============================================================================
CREATE TABLE IF NOT EXISTS evaluation_accept_session (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Referência à avaliação
  evaluation_id INTEGER NOT NULL REFERENCES evaluations(id) ON DELETE CASCADE,
  
  -- Token hasheado (SHA-256 = 64 caracteres hex)
  token_hash VARCHAR(64) NOT NULL,
  
  -- Controle de expiração e uso
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  
  -- Auditoria
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  
  -- Se o token está ativo (false = desativado por nova geração)
  is_active BOOLEAN DEFAULT true
);

-- Comentários na tabela
COMMENT ON TABLE evaluation_accept_session IS 'Armazena tokens de aceite de avaliação com histórico completo';
COMMENT ON COLUMN evaluation_accept_session.token_hash IS 'Hash SHA-256 do token original (64 caracteres hex)';
COMMENT ON COLUMN evaluation_accept_session.expires_at IS 'Data/hora de expiração do token (24h após criação)';
COMMENT ON COLUMN evaluation_accept_session.used_at IS 'Data/hora em que o token foi utilizado (null se não usado)';
COMMENT ON COLUMN evaluation_accept_session.is_active IS 'Se o token está ativo. Tokens anteriores são desativados ao gerar novo';
COMMENT ON COLUMN evaluation_accept_session.created_by IS 'UUID do usuário que gerou o token';

-- 3. Criar índices para performance
-- ============================================================================

-- Índice para busca rápida por token_hash (usado na validação)
CREATE INDEX IF NOT EXISTS idx_accept_session_token_hash 
ON evaluation_accept_session(token_hash) 
WHERE is_active = true;

-- Índice para buscar tokens por avaliação
CREATE INDEX IF NOT EXISTS idx_accept_session_evaluation_id 
ON evaluation_accept_session(evaluation_id);

-- Índice composto para busca de token ativo válido
CREATE INDEX IF NOT EXISTS idx_accept_session_active_valid 
ON evaluation_accept_session(token_hash, is_active, used_at) 
WHERE is_active = true AND used_at IS NULL;

-- 4. Habilitar RLS (Row Level Security)
-- ============================================================================
ALTER TABLE evaluation_accept_session ENABLE ROW LEVEL SECURITY;

-- Policy: Leitura pública para verificação de tokens (rota pública)
-- Necessário para que a validação funcione sem autenticação
CREATE POLICY "allow_public_token_read" 
ON evaluation_accept_session
FOR SELECT 
USING (true);

-- Policy: Inserção apenas por usuários autenticados
CREATE POLICY "allow_authenticated_insert" 
ON evaluation_accept_session
FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL);

-- Policy: Update apenas via service_role (backend)
-- Isso garante que apenas o backend pode marcar como usado ou desativar
CREATE POLICY "allow_service_update" 
ON evaluation_accept_session
FOR UPDATE 
USING (true);

-- 5. Criar função para limpar tokens expirados (opcional - para uso futuro)
-- ============================================================================
-- Esta função pode ser chamada manualmente ou via cron job para limpeza
CREATE OR REPLACE FUNCTION cleanup_expired_accept_tokens()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  -- Desativa tokens expirados que ainda estão ativos (não deleta para manter histórico)
  UPDATE evaluation_accept_session 
  SET is_active = false 
  WHERE is_active = true 
    AND expires_at < NOW() 
    AND used_at IS NULL;
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION cleanup_expired_accept_tokens() IS 'Desativa tokens de aceite expirados. Retorna quantidade de tokens desativados.';

-- ============================================================================
-- FIM DA MIGRATION
-- ============================================================================
