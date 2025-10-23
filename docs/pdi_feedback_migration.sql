-- Migration: Adicionar coluna feedback_id à tabela PDI
-- Descrição: Permite vincular PDIs (Plano de Desenvolvimento Individual) aos feedbacks
-- Data: 2025-01-23

-- Adicionar coluna feedback_id se não existir
ALTER TABLE pdi 
ADD COLUMN IF NOT EXISTS feedback_id BIGINT;

-- Adicionar constraint de foreign key para a tabela feedbacks
-- Nota: Só execute se a tabela feedbacks existir com a coluna id
ALTER TABLE pdi 
ADD CONSTRAINT fk_pdi_feedback 
FOREIGN KEY (feedback_id) 
REFERENCES feedbacks(id)
ON DELETE SET NULL;

-- Criar índice para melhorar performance de consultas por feedback_id
CREATE INDEX IF NOT EXISTS idx_pdi_feedback_id ON pdi(feedback_id);

-- Comentários nas colunas para documentação
COMMENT ON COLUMN pdi.feedback_id IS 'Referência ao feedback que originou este PDI (opcional)';
COMMENT ON COLUMN pdi.evaluation_id IS 'Referência à avaliação que originou este PDI (opcional)';

-- Verificar estrutura atualizada
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'pdi'
AND column_name IN ('feedback_id', 'evaluation_id')
ORDER BY ordinal_position;

