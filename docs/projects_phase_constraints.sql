-- SQL Script para adicionar constraints na tabela projects_phase
-- Este script garante que:
-- 1. Não seja possível gravar 2 domínios (fases) iguais no mesmo período para o mesmo projeto
-- 2. Não seja possível gravar 2 orders iguais no mesmo período para o mesmo projeto

-- ==========================================
-- CONSTRAINT 1: Unicidade de Fase por Período
-- ==========================================
-- Garante que cada projeto não tenha a mesma fase duplicada no mesmo período
-- Combinação única: (project_id, domains_id, period)

DO $$
BEGIN
    -- Verificar se a constraint já existe
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'unique_project_phase_period'
    ) THEN
        ALTER TABLE projects_phase 
        ADD CONSTRAINT unique_project_phase_period 
        UNIQUE (project_id, domains_id, period);
        
        RAISE NOTICE 'Constraint unique_project_phase_period criada com sucesso';
    ELSE
        RAISE NOTICE 'Constraint unique_project_phase_period já existe';
    END IF;
END $$;

-- ==========================================
-- CONSTRAINT 2: Unicidade de Ordem por Período
-- ==========================================
-- Garante que cada projeto não tenha a mesma ordem duplicada no mesmo período
-- Combinação única: (project_id, order, period)

DO $$
BEGIN
    -- Verificar se a constraint já existe
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'unique_project_order_period'
    ) THEN
        ALTER TABLE projects_phase 
        ADD CONSTRAINT unique_project_order_period 
        UNIQUE (project_id, "order", period);
        
        RAISE NOTICE 'Constraint unique_project_order_period criada com sucesso';
    ELSE
        RAISE NOTICE 'Constraint unique_project_order_period já existe';
    END IF;
END $$;

-- ==========================================
-- VERIFICAÇÃO DE DADOS EXISTENTES
-- ==========================================
-- Antes de aplicar as constraints, execute estas queries para verificar 
-- se já existem dados duplicados que violariam as regras

-- Verificar duplicatas de fase por período
SELECT 
    project_id, 
    domains_id, 
    period, 
    COUNT(*) as duplicates
FROM projects_phase
GROUP BY project_id, domains_id, period
HAVING COUNT(*) > 1;

-- Verificar duplicatas de ordem por período
SELECT 
    project_id, 
    "order", 
    period, 
    COUNT(*) as duplicates
FROM projects_phase
GROUP BY project_id, "order", period
HAVING COUNT(*) > 1;

-- ==========================================
-- LIMPEZA DE DUPLICATAS (SE NECESSÁRIO)
-- ==========================================
-- Se as queries acima retornarem resultados, você precisará limpar os duplicados
-- ATENÇÃO: Revise e ajuste conforme necessário antes de executar

-- Exemplo de limpeza de duplicatas de fase por período (mantém o mais recente):
/*
DELETE FROM projects_phase
WHERE id NOT IN (
    SELECT MAX(id)
    FROM projects_phase
    GROUP BY project_id, domains_id, period
);
*/

-- Exemplo de limpeza de duplicatas de ordem por período (mantém o mais recente):
/*
DELETE FROM projects_phase
WHERE id NOT IN (
    SELECT MAX(id)
    FROM projects_phase
    GROUP BY project_id, "order", period
);
*/

-- ==========================================
-- ÍNDICES PARA PERFORMANCE
-- ==========================================
-- Criar índices para melhorar a performance das queries

-- Índice para busca por projeto e período
CREATE INDEX IF NOT EXISTS idx_projects_phase_project_period 
ON projects_phase(project_id, period);

-- Índice para busca por projeto, fase e período
CREATE INDEX IF NOT EXISTS idx_projects_phase_project_domain_period 
ON projects_phase(project_id, domains_id, period);

-- ==========================================
-- INFORMAÇÕES ADICIONAIS
-- ==========================================

-- Visualizar todas as constraints da tabela projects_phase
/*
SELECT 
    con.conname AS constraint_name,
    con.contype AS constraint_type,
    pg_get_constraintdef(con.oid) AS constraint_definition
FROM pg_constraint con
JOIN pg_class rel ON rel.oid = con.conrelid
WHERE rel.relname = 'projects_phase';
*/

-- Remover constraints (se necessário no futuro)
/*
ALTER TABLE projects_phase DROP CONSTRAINT IF EXISTS unique_project_phase_period;
ALTER TABLE projects_phase DROP CONSTRAINT IF EXISTS unique_project_order_period;
*/
