# Sistema de Encerramento de Avaliações

## Visão Geral

Este documento descreve o sistema de encerramento de avaliações implementado no EKIP, que permite finalizar avaliações e bloqueá-las para edição.

## Funcionalidades Implementadas

### 1. Status "Concluído" Automático

Quando o avaliador preenche **todas as perguntas obrigatórias** da avaliação:
- O status é automaticamente atualizado para "Concluído"
- Indica que o preenchimento foi finalizado
- A avaliação ainda pode ser editada neste estado

### 2. Botão "Encerrar Avaliação"

**Quando aparece:**
- Somente quando todas as perguntas obrigatórias foram respondidas (status "Concluído")
- Somente quando a avaliação ainda não foi encerrada (`is_closed = false`)

**Localização:**
- No rodapé da página, ao lado do botão "Salvar Progresso"
- Ícone de XCircle (X dentro de um círculo)

### 3. Modal de Confirmação

Ao clicar em "Encerrar Avaliação", um modal de confirmação é exibido:

**Conteúdo:**
- Título: "Encerrar Avaliação"
- Mensagem de alerta: "Se a avaliação for encerrada, ela não poderá mais ser alterada. Apenas será possível visualizá-la."
- Pergunta: "Deseja continuar?"

**Ações:**
- **Cancelar**: Fecha o modal sem fazer nada
- **Sim, Encerrar**: Encerra a avaliação

### 4. Encerramento da Avaliação

Quando confirmado o encerramento:
- Status é atualizado para "Fechado"
- Campo `is_closed` é definido como `true`
- Mensagem de sucesso: "Avaliação encerrada com sucesso! Agora ela está somente em modo de visualização."

### 5. Modo Somente Leitura

Quando a avaliação está encerrada (`is_closed = true`):

**Bloqueios aplicados:**
- Não é possível editar respostas (estrelas, texto, sim/não)
- Botão "Salvar Progresso" é ocultado
- Botão "Encerrar Avaliação" é ocultado
- Tentativas de edição mostram erro: "Esta avaliação foi encerrada e não pode mais ser alterada."

**Indicadores visuais:**
- Banner de aviso no topo: "Esta avaliação foi encerrada e está disponível apenas para visualização..."
- Mensagem no rodapé: "Avaliação encerrada - Somente visualização"
- Botão "Voltar" permanece disponível para navegação

## Fluxo Completo

```
1. Avaliação criada (Status: Pendente/Aberto)
   ↓
2. Avaliador começa a responder (Status: Em Andamento)
   ↓
3. Todas perguntas obrigatórias respondidas (Status: Concluído)
   → Botão "Encerrar Avaliação" aparece
   ↓
4. Avaliador clica em "Encerrar Avaliação"
   → Modal de confirmação aparece
   ↓
5. Confirmação do encerramento
   → Status: Fechado
   → is_closed = true
   ↓
6. Avaliação em modo somente leitura
   → Sem possibilidade de edição
```

## Alterações no Banco de Dados

### Nova Coluna

```sql
ALTER TABLE evaluations
ADD COLUMN IF NOT EXISTS is_closed BOOLEAN DEFAULT false NOT NULL;
```

**Propriedades:**
- **Nome**: `is_closed`
- **Tipo**: BOOLEAN
- **Padrão**: false
- **Nullable**: NOT NULL
- **Descrição**: Indica se a avaliação foi encerrada e está em modo somente leitura

### Script de Migração

Arquivo: `docs/add_is_closed_to_evaluations.sql`

Execute este script no Supabase para adicionar a coluna à tabela `evaluations`.

## Status da Avaliação

A avaliação utiliza a tabela `domains` com `type = 'evaluation_status'`. Certifique-se de que os seguintes status existem:

1. **Pendente/Aberto**: Avaliação criada, não iniciada
2. **Em Andamento**: Pelo menos uma resposta salva
3. **Concluído**: Todas perguntas obrigatórias respondidas
4. **Fechado**: Avaliação encerrada, modo somente leitura

## Alterações nos Tipos TypeScript

### EvaluationInfo

```typescript
export interface EvaluationInfo {
  id: number;
  name: string;
  evaluation_model_id: number;
  user_id: string;
  user_name: string;
  owner_id: string;
  owner_name: string;
  period_start: string;
  period_end: string;
  status_id: number | null;
  is_done: boolean;
  is_closed?: boolean; // NOVO
}
```

## Interface do Usuário

### Modal de Confirmação

- **Estilo**: Segue o padrão de modais do projeto
- **Header**: Gradiente laranja-vermelho
- **Botão Cancelar**: Cinza
- **Botão Confirmar**: Vermelho (ação destrutiva)
- **Ícone**: AlertCircle para indicar atenção

### Notificações

- **Sucesso**: Toast verde com mensagem de confirmação
- **Erro**: Toast vermelho para problemas ao encerrar
- **Aviso**: Banner cinza para indicar modo somente leitura

## Testes Recomendados

1. **Teste de Preenchimento Parcial**
   - Preencher apenas algumas perguntas
   - Verificar que status fica "Em Andamento"
   - Botão "Encerrar Avaliação" não deve aparecer

2. **Teste de Preenchimento Completo**
   - Preencher todas perguntas obrigatórias
   - Verificar que status muda para "Concluído"
   - Botão "Encerrar Avaliação" deve aparecer

3. **Teste de Encerramento**
   - Clicar em "Encerrar Avaliação"
   - Verificar modal de confirmação
   - Cancelar e verificar que nada mudou
   - Confirmar e verificar status "Fechado"

4. **Teste de Modo Somente Leitura**
   - Tentar editar respostas
   - Verificar mensagens de erro
   - Verificar que botões de edição estão ocultos

5. **Teste de Navegação**
   - Tentar sair com alterações não salvas (quando editável)
   - Verificar confirmação de perda de dados
   - Sair de avaliação fechada deve ser direto

## Considerações de Segurança

- O bloqueio de edição é feito apenas no frontend
- Para garantir integridade, considere adicionar validação no backend/Supabase
- Row Level Security (RLS) pode ser configurada para impedir updates quando `is_closed = true`

## Próximos Passos Sugeridos

1. Implementar auditoria de quando a avaliação foi encerrada (campo `closed_at`)
2. Registrar quem encerrou a avaliação (campo `closed_by_user_id`)
3. Adicionar RLS no Supabase para garantir imutabilidade no banco de dados
4. Implementar permissões para "reabrir" avaliações (para casos excepcionais)
