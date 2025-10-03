# Status Report - Documentação da Funcionalidade

## Visão Geral

A funcionalidade Status Report foi adicionada ao sistema de alocação EKIP para fornecer uma visualização clara e intuitiva do progresso das fases de cada projeto através de gráficos de pizza.

## Localização

- **Aba**: Status Report (localizada à direita da aba "Riscos" no detalhe do projeto)
- **Arquivo**: `frontend/src/pages/ProjectDetail.tsx`
- **Componente**: Seção dentro do componente `ProjectDetail`

## Estrutura de Dados

### Tabelas Utilizadas

1. **`projects_phase`** - Armazena as fases de cada projeto
   - `id`: ID único da fase
   - `project_id`: ID do projeto (FK para `projects.project_id`)
   - `domains_id`: ID do domínio (FK para `domains.id`)
   - `expected_progress`: Progresso esperado (0-100)
   - `progress`: Progresso atual (0-100)
   - `created_at`: Data de criação
   - `updated_at`: Data de atualização

2. **`domains`** - Armazena os nomes das fases
   - `id`: ID único do domínio
   - `type`: Tipo do domínio (`project_phase`)
   - `value`: Nome da fase (ex: "Levantamento", "Desenvolvimento", etc.)
   - `is_active`: Se o domínio está ativo

### Interface TypeScript

```typescript
export interface DbProjectPhase {
  id: number;
  created_at: string;
  updated_at: string;
  project_id: number;
  domains_id: number;
  expected_progress: number;
  progress: number;
  phase_name?: string; // Nome da fase obtido através do relacionamento com domains
  domains?: {
    id: number;
    value: string;
  };
}
```

## Funcionalidades

### Visualização

- **Gráficos de Pizza**: Um gráfico para cada fase do projeto
- **Layout Responsivo**: Grid que se adapta ao tamanho da tela:
  - 1 coluna em telas pequenas
  - 2 colunas em tablets  
  - 3 colunas em desktop
  - 5 colunas em telas muito grandes

### Informações Exibidas

Para cada fase:
- **Nome da Fase**: Obtido da tabela `domains`
- **Progresso Atual**: Porcentagem no centro do gráfico
- **Meta Esperada**: Valor de `expected_progress`
- **Status Visual**: Baseado na comparação entre progresso atual e esperado
  - 🟢 **Verde (No prazo)**: progresso ≥ meta
  - 🟡 **Amarelo (Atenção)**: progresso ≥ 80% da meta
  - 🔴 **Vermelho (Atrasado)**: progresso < 80% da meta

### Estados da Interface

1. **Loading**: Exibido enquanto carrega os dados
2. **Com Dados**: Grid de gráficos de pizza
3. **Sem Dados**: Mensagem informativa quando não há fases configuradas

## Configuração de Cores

As cores dos gráficos seguem a paleta laranja/amarelo:
- `#F97316` (Laranja primário)
- `#FB923C` (Laranja claro)
- `#FCD34D` (Amarelo)
- `#FBBF24` (Amarelo dourado)
- `#F59E0B` (Amarelo escuro)

## Dependências

- **recharts**: Biblioteca para gráficos (já instalada)
- **lucide-react**: Ícones (PieChart)
- **Supabase**: Cliente para acesso aos dados

## Queries SQL Utilizadas

Como não há foreign key configurada entre `projects_phase` e `domains`, fazemos duas consultas separadas e o JOIN manual no JavaScript:

### 1. Buscar fases do projeto:
```sql
SELECT * FROM projects_phase 
WHERE project_id = ?
```

### 2. Buscar domínios das fases:
```sql
SELECT id, value FROM domains 
WHERE type = 'project_phase' 
  AND is_active = true
```

### 3. JOIN Manual no JavaScript:
```javascript
const phasesWithNames = phasesData.map(phase => {
  const domain = domainsData.find(d => d.id === phase.domains_id);
  return {
    ...phase,
    phase_name: domain?.value || 'Fase desconhecida',
    domains: domain ? { id: domain.id, value: domain.value } : undefined
  };
});
```

## Como Adicionar Dados de Teste

Para testar a funcionalidade, adicione dados na tabela `projects_phase`:

```sql
-- Exemplo para projeto ID 3714750
INSERT INTO projects_phase (project_id, domains_id, expected_progress, progress) VALUES
(3714750, 31, 100, 100), -- Levantamento
(3714750, 32, 90, 75),   -- Desenvolvimento  
(3714750, 33, 50, 80),   -- Homologação
(3714750, 34, 0, 0),     -- Deploy
(3714750, 35, 50, 80);   -- Acompanhamento
```

## Manutenção

### Para adicionar novas fases:
1. Adicionar entrada na tabela `domains` com `type = 'project_phase'`
2. Associar a fase ao projeto na tabela `projects_phase`

### Para modificar cores:
1. Editar o array `colors` no componente `ProjectDetail.tsx`
2. As cores devem estar no formato hexadecimal

### Para ajustar layout:
1. Modificar as classes CSS do grid: `grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5`
