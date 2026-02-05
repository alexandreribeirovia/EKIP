-- ============================================================================
-- MIGRAÇÃO 001: Renomear public.users para public.employees
-- ============================================================================
-- EKIP - Separação de conceitos:
--   - public.users (NOVA) = Usuários da plataforma (acesso)
--   - public.employees (RENOMEADA) = Dados de funcionários (negócio)
-- ============================================================================

-- ATENÇÃO: Execute este script em ambiente de TESTE primeiro!
-- Faça backup do banco antes de executar em produção.

BEGIN;

-- ============================================================================
-- PASSO 1: Remover Foreign Keys que referenciam public.users
-- ============================================================================

ALTER TABLE public.access_platforms 
  DROP CONSTRAINT IF EXISTS access_platforms_user_id_fkey;

ALTER TABLE public.feedbacks 
  DROP CONSTRAINT IF EXISTS feedbacks_feedback_user_id_fkey;

ALTER TABLE public.projects_owner 
  DROP CONSTRAINT IF EXISTS projects_owner_user_id_fkey;

ALTER TABLE public.quiz_attempt 
  DROP CONSTRAINT IF EXISTS quiz_attempt_user_id_fkey;

ALTER TABLE public.quiz_participant 
  DROP CONSTRAINT IF EXISTS quiz_participant_user_id_fkey;

ALTER TABLE public.risks_owner 
  DROP CONSTRAINT IF EXISTS risks_owner_user_id_fkey;

ALTER TABLE public.users_skill 
  DROP CONSTRAINT IF EXISTS users_skill_user_id_fkey;

-- ============================================================================
-- PASSO 2: Renomear tabela users para employees
-- ============================================================================

ALTER TABLE public.users RENAME TO employees;

-- Renomear constraint de PK
ALTER TABLE public.employees 
  RENAME CONSTRAINT users_pkey TO employees_pkey;

-- ============================================================================
-- PASSO 3: Renomear tabela users_skill para employees_skill
-- ============================================================================

ALTER TABLE public.users_skill RENAME TO employees_skill;

-- Renomear constraint de PK
ALTER TABLE public.employees_skill 
  RENAME CONSTRAINT users_skill_pkey TO employees_skill_pkey;

-- ============================================================================
-- PASSO 4: Recriar Foreign Keys apontando para employees
-- ============================================================================

ALTER TABLE public.access_platforms 
  ADD CONSTRAINT access_platforms_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES public.employees(user_id);

ALTER TABLE public.feedbacks 
  ADD CONSTRAINT feedbacks_feedback_user_id_fkey 
  FOREIGN KEY (feedback_user_id) REFERENCES public.employees(user_id);

ALTER TABLE public.projects_owner 
  ADD CONSTRAINT projects_owner_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES public.employees(user_id);

ALTER TABLE public.quiz_attempt 
  ADD CONSTRAINT quiz_attempt_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES public.employees(user_id);

ALTER TABLE public.quiz_participant 
  ADD CONSTRAINT quiz_participant_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES public.employees(user_id);

ALTER TABLE public.risks_owner 
  ADD CONSTRAINT risks_owner_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES public.employees(user_id);

-- FK para employees_skill (referencia employees)
ALTER TABLE public.employees_skill 
  ADD CONSTRAINT employees_skill_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES public.employees(user_id);

-- Manter FK para skills
ALTER TABLE public.employees_skill 
  ADD CONSTRAINT employees_skill_skill_id_fkey 
  FOREIGN KEY (skill_id) REFERENCES public.skills(id);

-- ============================================================================
-- PASSO 5: Criar nova tabela public.users (Usuários da Plataforma)
-- ============================================================================

CREATE TABLE public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Dados do usuário da plataforma
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  avatar_url VARCHAR(500),
  
  -- Controle de acesso
  role VARCHAR(50) NOT NULL DEFAULT 'user',  -- 'admin', 'user', 'viewer'
  profile_id BIGINT REFERENCES public.access_profiles(id),
  is_active BOOLEAN NOT NULL DEFAULT true,
  
  -- Vínculo opcional com funcionário
  employee_id VARCHAR REFERENCES public.employees(user_id)
);

-- Índices para performance
CREATE INDEX idx_users_email ON public.users(email);
CREATE INDEX idx_users_employee_id ON public.users(employee_id);
CREATE INDEX idx_users_profile_id ON public.users(profile_id);

-- Comentários para documentação
COMMENT ON TABLE public.users IS 'Usuários da plataforma (acesso). Pode ou não estar vinculado a um funcionário.';
COMMENT ON COLUMN public.users.id IS 'UUID do auth.users (Supabase Auth)';
COMMENT ON COLUMN public.users.employee_id IS 'Vínculo opcional com funcionário (slug RunRun)';
COMMENT ON COLUMN public.users.profile_id IS 'Perfil de acesso para permissões';

-- ============================================================================
-- PASSO 6: Migrar dados de usuários existentes
-- ============================================================================
-- Cria registros em public.users para cada usuário que já tem sessão ativa
-- Vincula ao funcionário correspondente pelo email

INSERT INTO public.users (id, email, name, avatar_url, role, profile_id, employee_id)
SELECT DISTINCT ON (s.user_id)
  s.user_id,  -- auth.users UUID
  s.email,
  COALESCE(e.name, split_part(s.email, '@', 1)),  -- Nome do funcionário ou parte do email
  e.avatar_large_url,
  'user',  -- Role padrão
  e.profile_id,  -- Profile do funcionário (se existir)
  e.user_id  -- Slug do funcionário
FROM public.sessions s
LEFT JOIN public.employees e ON LOWER(e.email) = LOWER(s.email)
WHERE s.is_valid = true
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- PASSO 7: Remover coluna profile_id de employees (se existir)
-- ============================================================================
-- profile_id agora fica em public.users (controle de acesso)

ALTER TABLE public.employees 
  DROP COLUMN IF EXISTS profile_id;

-- ============================================================================
-- PASSO 8: Trigger para atualizar updated_at
-- ============================================================================

CREATE OR REPLACE FUNCTION update_users_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION update_users_updated_at();

COMMIT;

-- ============================================================================
-- VERIFICAÇÃO (execute após o commit)
-- ============================================================================
-- 
-- -- Verificar se tabelas foram renomeadas
-- SELECT table_name FROM information_schema.tables 
-- WHERE table_schema = 'public' AND table_name IN ('users', 'employees', 'employees_skill');
-- 
-- -- Verificar estrutura da nova tabela users
-- \d public.users
-- 
-- -- Verificar quantos usuários foram migrados
-- SELECT COUNT(*) FROM public.users;
-- 
-- -- Verificar FKs
-- SELECT conname, conrelid::regclass, confrelid::regclass 
-- FROM pg_constraint 
-- WHERE contype = 'f' AND confrelid::regclass::text = 'employees';
-- ============================================================================
