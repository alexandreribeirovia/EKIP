# Atualização do Prisma Schema - Tabelas de Avaliação

## 📋 Resumo

O schema do Prisma foi atualizado para incluir todas as tabelas de avaliação que existem no banco de dados Supabase. Agora o Prisma Client está sincronizado com a estrutura completa do banco de dados.

## 🆕 Novas Tabelas Adicionadas

### 1. **EvaluationsModel** (`evaluations_model`)
Define os modelos/templates de avaliação que podem ser reutilizados.

**Campos:**
- `id`: Identificador único (BigInt)
- `createdAt`: Data de criação
- `updatedAt`: Data de atualização
- `name`: Nome do modelo
- `description`: Descrição opcional
- `isActive`: Se o modelo está ativo

**Relações:**
- `evaluations`: Avaliações criadas usando este modelo
- `evaluationQuestions`: Perguntas vinculadas a este modelo

### 2. **Evaluation** (`evaluations`)
Instâncias de avaliações aplicadas a funcionários específicos.

**Campos:**
- `id`: Identificador único
- `evaluationModelId`: Referência ao modelo usado
- `name`: Nome da avaliação
- `userId`: ID do avaliado (user_id do funcionário)
- `userName`: Nome do avaliado
- `ownerId`: ID do avaliador (gestor)
- `ownerName`: Nome do avaliador
- `periodStart`: Data de início do período avaliado
- `periodEnd`: Data de fim do período avaliado
- `statusId`: Status atual (referência a domains)
- `isDone`: Se foi concluída
- **`isClosed`: Se foi encerrada (campo recém-adicionado)** ✨

**Relações:**
- `evaluationModel`: Modelo usado
- `projects`: Projetos relacionados (N:N via evaluations_projects)
- `questionReplies`: Respostas às perguntas

### 3. **EvaluationsProjects** (`evaluations_projects`)
Tabela de relacionamento N:N entre avaliações e projetos.

**Campos:**
- `id`: Identificador único
- `evaluationId`: ID da avaliação
- `projectId`: ID do projeto

**Relações:**
- `evaluation`: Avaliação relacionada

### 4. **QuestionsModel** (`questions_model`)
Banco de perguntas que podem ser usadas em avaliações.

**Campos:**
- `id`: Identificador único
- `question`: Texto da pergunta
- `description`: Descrição/contexto da pergunta
- `categoryId`: Categoria (referência a domains)
- `subcategoryId`: Subcategoria opcional (referência a domains)
- `replyTypeId`: Tipo de resposta (escala, texto, sim/não)
- `weight`: Peso da pergunta na avaliação
- `required`: Se é obrigatória

**Relações:**
- `evaluationQuestions`: Vinculações com modelos de avaliação

### 5. **EvaluationsQuestionsModel** (`evaluations_questions_model`)
Tabela de relacionamento entre modelos de avaliação e perguntas, com ordenação.

**Campos:**
- `id`: Identificador único
- `evaluationId`: ID do modelo de avaliação
- `questionId`: ID da pergunta
- `categoryOrder`: Ordem de exibição da categoria
- `questionOrder`: Ordem de exibição da pergunta
- `subcategoryOrder`: Ordem de exibição da subcategoria

**Relações:**
- `evaluationModel`: Modelo de avaliação
- `question`: Pergunta vinculada

### 6. **EvaluationsQuestionsReply** (`evaluations_questions_reply`)
Armazena as respostas dadas às perguntas de uma avaliação.

**Campos:**
- `id`: Identificador único
- `evaluationId`: ID da avaliação
- `questionId`: ID da pergunta
- `categoryId`: ID da categoria
- `subcategoryId`: ID da subcategoria
- `category`: Nome da categoria (desnormalizado)
- `subcategory`: Nome da subcategoria (desnormalizado)
- `question`: Texto da pergunta (desnormalizado)
- `score`: Pontuação (1-5 ou null)
- `reply`: Resposta em texto livre
- `yesNo`: Resposta sim/não
- `weight`: Peso da pergunta
- `replyType`: Tipo de resposta
- `userId`: ID do avaliado
- `ownerId`: ID do avaliador

**Relações:**
- `evaluation`: Avaliação relacionada

### 7. **Domain** (`domains`)
Tabela de domínios/configurações do sistema (status, categorias, tipos de resposta, etc.)

**Campos:**
- `id`: Identificador único
- `type`: Tipo do domínio (evaluation_status, evaluation_category, etc.)
- `value`: Valor do domínio
- `isActive`: Se está ativo
- `parentId`: ID do pai (para hierarquias)

## 🔄 Relacionamentos

```
EvaluationsModel (1) ──< (N) Evaluation
Evaluation (1) ──< (N) EvaluationsProjects
Evaluation (1) ──< (N) EvaluationsQuestionsReply
EvaluationsModel (1) ──< (N) EvaluationsQuestionsModel (N) >── (1) QuestionsModel
```

## 🎯 Como Usar

### Importar Prisma Client

```typescript
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
```

### Exemplo: Buscar Avaliações com Relações

```typescript
const evaluations = await prisma.evaluation.findMany({
  include: {
    evaluationModel: true,
    projects: true,
    questionReplies: true,
  },
  where: {
    isClosed: false, // Apenas avaliações não encerradas
  },
});
```

### Exemplo: Criar Nova Avaliação

```typescript
const evaluation = await prisma.evaluation.create({
  data: {
    evaluationModelId: 1,
    name: 'Avaliação Q1 2025',
    userId: 'user123',
    userName: 'João Silva',
    ownerId: 'manager456',
    ownerName: 'Maria Santos',
    periodStart: new Date('2025-01-01'),
    periodEnd: new Date('2025-03-31'),
    isDone: false,
    isClosed: false,
  },
});
```

### Exemplo: Encerrar Avaliação

```typescript
await prisma.evaluation.update({
  where: { id: evaluationId },
  data: {
    isClosed: true,
    statusId: closedStatusId, // ID do status "Fechado"
  },
});
```

## ⚙️ Comandos Executados

1. **Formatação do Schema:**
   ```bash
   npx prisma format
   ```

2. **Validação do Schema:**
   ```bash
   npx prisma validate
   ```

3. **Geração do Prisma Client:**
   ```bash
   npx prisma generate
   ```

## 📝 Observações Importantes

### Dual Database Pattern
Este projeto usa **duas fontes de dados simultaneamente**:

1. **Prisma/PostgreSQL**: Modelos originais (User, Project, Employee, Task, etc.)
2. **Supabase**: Tabelas de avaliação + funcionalidades estendidas

**Por que?**
- O Prisma gerencia o schema principal do backend
- O Supabase fornece recursos adicionais (Edge Functions, RLS, Storage)
- As tabelas de avaliação estão no Supabase mas agora também documentadas no Prisma

### Uso Direto vs Prisma Client

**Frontend → Supabase (Direto):**
```typescript
const { data } = await supabase
  .from('evaluations')
  .select('*')
  .eq('id', evaluationId);
```

**Backend → Prisma Client:**
```typescript
const evaluation = await prisma.evaluation.findUnique({
  where: { id: evaluationId },
});
```

Ambas as abordagens são válidas neste projeto!

## 🔐 Segurança

As tabelas de avaliação no Supabase têm **Row Level Security (RLS)** habilitado. O Prisma Schema documenta a estrutura, mas não gerencia as políticas de segurança do Supabase.

## 📊 Estatísticas

- **7 novas tabelas** adicionadas ao schema
- **Campo `is_closed`** incluído na tabela `evaluations`
- **Schema validado** ✅
- **Prisma Client regenerado** ✅
- **Tipos TypeScript atualizados** ✅

## 🚀 Próximos Passos

1. ✅ Schema atualizado
2. ✅ Prisma Client gerado
3. ⏳ Considerar criar routes do backend usando Prisma (opcional)
4. ⏳ Adicionar testes para as novas tabelas
5. ⏳ Documentar políticas RLS do Supabase

## 📚 Referências

- [Prisma Schema Reference](https://www.prisma.io/docs/reference/api-reference/prisma-schema-reference)
- [Prisma Relations](https://www.prisma.io/docs/concepts/components/prisma-schema/relations)
- [docs/EVALUATION_CLOSURE_SYSTEM.md](./EVALUATION_CLOSURE_SYSTEM.md) - Sistema de encerramento
- [docs/EMPLOYEE_EVALUATIONS.md](./EMPLOYEE_EVALUATIONS.md) - Funcionalidade de avaliações
