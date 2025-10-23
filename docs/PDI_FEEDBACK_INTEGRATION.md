# Integração PDI com Feedbacks

## 📋 Resumo

Foi implementada a funcionalidade de criar PDIs (Plano de Desenvolvimento Individual) diretamente a partir de feedbacks, permitindo vincular ações de desenvolvimento aos feedbacks dados aos consultores.

## 🆕 Mudanças Implementadas

### 1. **FeedbackModal.tsx**

Adicionado botão "Adicionar PDI" que aparece somente no modo de edição de feedback:

- **Localização**: Footer do modal, ao lado do botão "Cancelar"
- **Comportamento**: 
  - Só aparece quando o feedback está sendo editado (`feedbackToEdit` existe)
  - Abre o `PDIModal` com os dados do feedback pré-preenchidos
  - Passa o `feedbackId` para vincular o PDI ao feedback

**Props passados ao PDIModal:**
```typescript
<PDIModal
  isOpen={isPDIModalOpen}
  onClose={() => setIsPDIModalOpen(false)}
  onSuccess={() => setIsPDIModalOpen(false)}
  feedbackId={feedbackToEdit.id}
  prefilledConsultant={{ value: feedback_user_id, label: feedback_user_name }}
  prefilledManager={{ value: owner_user_id, label: owner_user_name }}
  onError={(message) => setError(message)}
/>
```

### 2. **PDIModal.tsx**

Adicionado suporte ao prop `feedbackId`:

- **Novo prop**: `feedbackId?: number | null`
- **Função `fetchPDIByFeedbackId`**: Busca PDI existente vinculado ao feedback
- **Salvamento**: Ao criar/editar PDI, o campo `feedback_id` é preenchido na tabela `pdi`

**Lógica de carregamento:**
```typescript
useEffect(() => {
  if (isOpen && pdiId && competencies.length > 0) {
    void fetchPDIData(pdiId);
  } else if (isOpen && evaluationId && competencies.length > 0 && !pdiId) {
    void fetchPDIByEvaluationId(evaluationId);
  } else if (isOpen && feedbackId && competencies.length > 0 && !pdiId) {
    void fetchPDIByFeedbackId(feedbackId);
  }
}, [isOpen, pdiId, evaluationId, feedbackId, competencies]);
```

## 🗄️ Estrutura de Dados

### Tabela: `pdi`

A tabela PDI deve ter a coluna `feedback_id` para vincular PDIs aos feedbacks:

```sql
ALTER TABLE pdi 
ADD COLUMN IF NOT EXISTS feedback_id BIGINT REFERENCES feedbacks(id);

CREATE INDEX IF NOT EXISTS idx_pdi_feedback_id ON pdi(feedback_id);
```

**Relação com outras colunas:**
- `evaluation_id`: Vincula PDI a uma avaliação (existente)
- `feedback_id`: Vincula PDI a um feedback (novo)

**Nota**: Um PDI pode estar vinculado a uma avaliação OU a um feedback, mas não necessariamente a ambos.

## 🔄 Fluxo de Uso

### Cenário 1: PDI a partir de Feedback

1. Usuário acessa a tela de **Feedbacks**
2. Clica para **editar** um feedback existente
3. No modal de edição, clica no botão **"Adicionar PDI"**
4. O `PDIModal` abre com:
   - **Consultor**: Pré-preenchido com o receptor do feedback
   - **Responsável**: Pré-preenchido com quem deu o feedback
5. Usuário preenche as competências e detalhes do PDI
6. Ao salvar, o PDI é criado com `feedback_id` preenchido

### Cenário 2: PDI a partir de Avaliação (existente)

1. Usuário acessa **Avaliação de Resposta**
2. Clica no botão **"Adicionar PDI"**
3. O `PDIModal` abre com dados da avaliação pré-preenchidos
4. Ao salvar, o PDI é criado com `evaluation_id` preenchido

## 🎨 Design

### Botão "Adicionar PDI"

- **Cor**: Laranja (`bg-orange-500`)
- **Ícone**: Target (Lucide React)
- **Posição**: Entre o botão "Cancelar" e "Salvar" no footer do modal
- **Visibilidade**: Apenas no modo de edição

### Modal PDI

- Mantém o design padrão já existente
- Funciona da mesma forma para feedbacks e avaliações
- Campos pré-preenchidos automaticamente

## ✅ Testes Sugeridos

1. **Criar PDI a partir de feedback**
   - Editar um feedback existente
   - Clicar em "Adicionar PDI"
   - Verificar se consultor e responsável estão pré-preenchidos
   - Salvar PDI e verificar se `feedback_id` foi gravado

2. **Verificar se PDI existente carrega**
   - Criar um PDI vinculado a um feedback
   - Reabrir o feedback e clicar em "Adicionar PDI"
   - Verificar se os dados do PDI existente são carregados

3. **Verificar independência dos vínculos**
   - Criar PDI a partir de feedback (deve ter `feedback_id`)
   - Criar PDI a partir de avaliação (deve ter `evaluation_id`)
   - Ambos devem funcionar independentemente

## 📝 Observações

- O botão "Adicionar PDI" só aparece no **modo de edição** do feedback, não na criação
- Isso garante que o feedback já exista no banco antes de criar o PDI vinculado
- Um feedback pode ter múltiplos PDIs associados (relacionamento 1:N)
- A funcionalidade de PDI a partir de avaliações continua funcionando normalmente

## 🐛 Correções Aplicadas

### Problema: Campos não preenchiam automaticamente

**Causa:** As funções `fetchConsultants` e `fetchManagers` tinham lógica duplicada e condições que só verificavam `evaluationId`, ignorando `feedbackId`.

**Solução:**
1. Removida lógica duplicada das funções `fetch`
2. Atualizado `useEffect` principal para incluir todas as dependências necessárias
3. Mantido apenas um `useEffect` separado para preencher os campos automaticamente
4. Adicionado log de debug para facilitar troubleshooting

**Código corrigido:**
```typescript
// useEffect que carrega as listas
useEffect(() => {
  if (isOpen) {
    void fetchConsultants();
    void fetchManagers();
    void fetchCompetencies();
    void fetchStatus();
  }
}, [isOpen, evaluationId, feedbackId, prefilledConsultant, prefilledManager, pdiId]);

// useEffect que preenche os campos automaticamente
useEffect(() => {
  if (isOpen && (evaluationId || feedbackId) && prefilledConsultant && prefilledManager && !pdiId) {
    if (consultants.length > 0 && managers.length > 0) {
      console.log('🔄 Preenchendo campos automaticamente');
      setSelectedConsultant(prefilledConsultant);
      setSelectedManager(prefilledManager);
    }
  }
}, [isOpen, evaluationId, feedbackId, prefilledConsultant, prefilledManager, pdiId, consultants, managers]);
```

## 🔗 Arquivos Modificados

- `frontend/src/components/FeedbackModal.tsx`
- `frontend/src/components/PDIModal.tsx`
- `docs/PDI_FEEDBACK_INTEGRATION.md` (novo)
- `docs/pdi_feedback_migration.sql` (novo)

## 🚀 Deploy

Antes de usar em produção:

1. Executar a migration SQL para adicionar a coluna `feedback_id`
2. Testar a criação de PDI a partir de feedback em ambiente de desenvolvimento
3. Verificar se os vínculos estão sendo salvos corretamente

