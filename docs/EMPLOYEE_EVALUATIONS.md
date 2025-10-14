# Documentação - Tela de Avaliação de Funcionários

## Visão Geral

Foi criada uma nova funcionalidade completa para **Avaliação de Funcionários**, separada dos "Modelos de Avaliação". Esta funcionalidade permite criar avaliações específicas para consultores, com período definido, avaliador (gestor) e projeto(s) opcional(is).

## Estrutura de Arquivos Criados/Modificados

### Arquivos Criados

1. **`frontend/src/pages/Evaluations.tsx`**
   - Página principal de Avaliação de Funcionários
   - Grid com AG-Grid mostrando todas as avaliações
   - Filtros por período, consultor, avaliador e status
   - Cards de estatísticas (Total, Abertos, Em andamento, Concluídos)

2. **`frontend/src/components/EmployeeEvaluationModal.tsx`**
   - Modal para criar novas avaliações
   - Permite selecionar: modelo, período, avaliado(s), avaliador, projeto(s)
   - Cria uma avaliação para cada combinação avaliado x projeto

### Arquivos Modificados

1. **`frontend/src/types.ts`**
   - Adicionados tipos: `EmployeeEvaluationData`, `EvaluationProjectOption`

2. **`frontend/src/components/Layout.tsx`**
   - Adicionado submenu "Avaliação" sob "Funcionários"
   - Importado ícone `FileCheck`

3. **`frontend/src/App.tsx`**
   - Adicionada rota `/employee-evaluations`
   - Renomeado import de `Evaluations` para `EvaluationModels` (modelos)
   - Novo import `EmployeeEvaluations` (avaliações de funcionários)

## Estrutura da Tabela Supabase

### Tabelas Principais

#### Tabela: `evaluations`
Armazena os dados principais de cada avaliação:

```sql
CREATE TABLE evaluations (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  evaluation_model_id INT NOT NULL REFERENCES evaluations_model(id),
  name VARCHAR NOT NULL,
  user_id VARCHAR NOT NULL REFERENCES users(user_id),
  user_name VARCHAR NOT NULL,
  owner_id VARCHAR NOT NULL REFERENCES users(user_id),
  owner_name VARCHAR NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  status_id INT NULL REFERENCES domains(id),
  is_done BOOLEAN NOT NULL DEFAULT FALSE
);
```

#### Tabela: `evaluations_projects`
Tabela de relacionamento entre avaliações e projetos (N:N):

```sql
CREATE TABLE evaluations_projects (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  evaluation_id INT NOT NULL REFERENCES evaluations(id),
  project_id INT NOT NULL REFERENCES projects(project_id)
);
```

**Nota**: Estas tabelas devem ser criadas manualmente no Supabase antes de usar a funcionalidade.

## Funcionalidades Implementadas

### 1. Filtros

- **Período**: Mês Atual, Mês Anterior, Ano Atual, Personalizar
- **Consultor**: Multi-select de todos os usuários ativos
- **Avaliador**: Multi-select de gestores (usuários com "Ger", "Dir" ou "Coord" no cargo)
- **Status**: Multi-select de status (Aberto, Em andamento, Concluído)

### 2. Cards de Estatísticas

- **Total de Avaliações**: Total de avaliações no período filtrado
- **Abertos**: Avaliações com status "Aberto"
- **Em andamento**: Avaliações com status "Em andamento"
- **Concluídos**: Avaliações com status "Concluído"

### 3. Grid (AG-Grid)

Colunas:
- **Consultor**: Nome do avaliado
- **Avaliador**: Nome do gestor responsável
- **Período**: Data início e fim da avaliação
- **Projeto**: Nome do projeto (ou "-" se geral)
- **Status**: Badge colorido (Azul=Aberto, Amarelo=Em andamento, Verde=Concluído)
- **Ações**: Botões de Editar e Deletar

### 4. Modal de Nova Avaliação

Campos:
- **Modelo de Avaliação**: Select com modelos ativos
- **Período Início/Fim**: Campos de data
- **Avaliado(s)**: Multi-select de usuários ativos
- **Avaliador (Gestor)**: Select de gestores
- **Projeto(s)**: Multi-select de projetos ativos (opcional)

**Lógica de Criação**:
- Se **nenhum projeto** for selecionado: cria 1 avaliação geral por avaliado
- Se **N projetos** forem selecionados: cria N avaliações por avaliado (uma para cada projeto)

Exemplo:
- 2 avaliados + 3 projetos = 6 avaliações criadas
- 2 avaliados + 0 projetos = 2 avaliações gerais

## Padrões Seguidos

### Modal Pattern
Seguiu o padrão estabelecido em `RiskModal.tsx`:
- Backdrop: `bg-black/60`
- Header gradiente: `from-orange-500 to-red-500`
- Botão fechar no topo direito
- Botões de ação no footer (Cancelar=cinza, Salvar=verde)
- Input focus com `ring-orange-500`

### AG-Grid Pattern
Seguiu o padrão de `Feedbacks.tsx`:
- ColDef com `flex` e `minWidth`
- defaultColDef com `sortable`, `filter`, `resizable`
- Cell renderers customizados para badges e formatação

### React Select
Usado para multi-selects com estilização consistente:
```tsx
className="react-select-container"
classNamePrefix="react-select"
```

## Rotas

| Caminho | Componente | Descrição |
|---------|-----------|-----------|
| `/employee-evaluations` | `Evaluations.tsx` | Listagem de avaliações de funcionários |
| `/evaluations` | `EvaluationModel.tsx` | Modelos de avaliação |
| `/evaluations/:id` | `EvaluationDetailModel.tsx` | Detalhes do modelo |

## Menu de Navegação

```
Funcionários
├── [Listagem de Funcionários]
├── Feedbacks
└── Avaliação  ← NOVO
```

## Próximos Passos (TODO)

1. **Criar a tabela no Supabase**:
   ```sql
   -- Ver estrutura acima
   ```

2. **Implementar página de responder avaliação**:
   - Nova rota: `/employee-evaluations/:id/answer`
   - Página com perguntas do modelo
   - Salvar respostas em tabela `evaluations_projects_answers`

3. **Adicionar funcionalidade de edição de status**:
   - Botão "Iniciar" para mudar de "Aberto" → "Em andamento"
   - Botão "Finalizar" para mudar de "Em andamento" → "Concluído"

4. **Implementar relatórios**:
   - Visualização das respostas
   - Comparação de avaliações
   - Gráficos de evolução

## Dependências

- **Supabase**: Para banco de dados
- **AG-Grid**: Para tabelas
- **React Select**: Para multi-selects
- **Lucide React**: Para ícones
- **Tailwind CSS**: Para estilização

## Como Testar

1. Acessar o menu "Funcionários" → "Avaliação"
2. Clicar em "Nova Avaliação"
3. Preencher todos os campos obrigatórios
4. Salvar
5. Verificar que a avaliação aparece na grid
6. Testar filtros e exclusão

## Observações Importantes

- **Gestores** são identificados pela posição contendo "Ger", "Dir" ou "Coord"
- **Validações** impedem salvar sem modelo, avaliado ou avaliador
- **Período** não pode ter data início maior que data fim
- **Projeto opcional**: Se nenhum projeto for selecionado, cria avaliação geral

## Estilização Dark Mode

Todos os componentes suportam dark mode:
- Cards: `dark:bg-gray-800`
- Texto: `dark:text-gray-100`
- Bordas: `dark:border-gray-600`
- Inputs: `dark:bg-gray-800`
