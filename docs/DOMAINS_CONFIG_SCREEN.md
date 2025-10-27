# Tela de Configuração de Domínios - Documentação

## Resumo da Implementação

Foi criada uma tela completa para configuração de domínios no sistema EKIP, seguindo o padrão visual e estrutural da plataforma.

## Arquivos Criados/Modificados

### 1. **Types** (`frontend/src/types.ts`)
- Atualizado interface `DbDomain` para incluir:
  - `parent_id: number | null` - ID do domínio pai
  - `description: string | null` - Descrição do domínio
- Criado interface `DomainWithChildren` para suporte a hierarquia

### 2. **Componente DomainModal** (`frontend/src/components/DomainModal.tsx`)
Modal para criar/editar domínios com os seguintes campos:
- **Tipo** (type): Campo texto obrigatório
- **Valor** (value): Campo texto obrigatório
- **Domínio Pai** (parent_id): Select opcional com lista de domínios existentes
- **Status** (is_active): Toggle switch (Ativo/Inativo)
- **Descrição** (description): Textarea opcional

**Características:**
- Validação de campos obrigatórios
- Loading state durante submissão
- Mensagens de erro inline
- Botões de ação: Cancelar (cinza) e Salvar (verde)
- Header com gradiente laranja/vermelho
- Suporte para modo criação e edição

### 3. **Página Domains** (`frontend/src/pages/Domains.tsx`)
Página principal de gerenciamento de domínios com:

**Card Superior de Filtros:**
- Busca por texto (tipo, valor ou descrição)
- Filtro por tipo (dinâmico baseado nos tipos existentes)
- Filtro por status (Todos/Ativo/Inativo)
- Botão "Novo Domínio" (laranja)

**Minicards Quantitativos (5 cards):**
- Total de domínios
- Domínios ativos (verde)
- Domínios inativos (vermelho)
- Domínios com pai (azul)
- Tipos únicos (laranja)

**Grid AG-Grid:**
Colunas:
1. Tipo (com ícone Database)
2. Valor
3. Descrição
4. Domínio Pai (mostra tipo + valor do pai)
5. Status (badge verde/vermelho)
6. Criado em (formatado pt-BR)
7. Ações (botão editar)

**Notificações:**
- Toast de sucesso após criar/editar domínio
- Auto-close em 10 segundos
- Pausa ao passar mouse

### 4. **Rotas** (`frontend/src/App.tsx`)
- Adicionado import: `Domains from '@/pages/Domains'`
- Adicionada rota protegida: `/domains`

### 5. **Menu Lateral** (`frontend/src/components/Layout.tsx`)
- Adicionado ícone `Database` nos imports do lucide-react
- Adicionado submenu "Domínios" dentro de "Configurações", após "Usuários"
- Rota: `/domains`
- Ícone: Database

## Estrutura da Tabela `domains` (Supabase)

```sql
CREATE TABLE domains (
  id SERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  type VARCHAR NOT NULL,
  value VARCHAR NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  parent_id INTEGER REFERENCES domains(id),
  description TEXT
);
```

## Consulta SQL de Exemplo

```sql
SELECT  
  d.id,
  d.type,
  d.value,
  d.is_active, 
  d.description, 
  d.parent_id,
  dp.value as filho
FROM domains d
LEFT JOIN domains dp ON dp.parent_id = d.id
```

## Funcionalidades Implementadas

✅ Listagem de domínios com paginação e ordenação  
✅ Filtros por tipo, status e busca textual  
✅ Estatísticas em tempo real (minicards)  
✅ Criação de novo domínio via modal  
✅ Edição de domínio existente via modal  
✅ Suporte a relacionamento hierárquico (parent_id)  
✅ Toggle de status ativo/inativo  
✅ Notificações de sucesso/erro  
✅ Dark mode completo  
✅ Responsivo (mobile/tablet/desktop)  
✅ Integração com Supabase via queries diretas  

## Como Usar

1. **Acessar a tela:**
   - Navegue para "Configurações" no menu lateral
   - Clique em "Domínios" no submenu

2. **Criar novo domínio:**
   - Clique no botão "Novo Domínio"
   - Preencha os campos obrigatórios (Tipo e Valor)
   - Opcionalmente selecione um domínio pai
   - Clique em "Adicionar Domínio"

3. **Editar domínio:**
   - Clique no ícone de edição na coluna "Ações"
   - Modifique os campos desejados
   - Clique em "Atualizar Domínio"

4. **Filtrar domínios:**
   - Use a barra de busca para filtrar por tipo/valor/descrição
   - Selecione um tipo específico no dropdown
   - Filtre por status (Ativo/Inativo)

## Padrões Seguidos

- **Modal Pattern:** Seguindo o padrão de `RiskModal.tsx`
- **Badge Pattern:** Badges arredondados com suporte dark mode
- **Notification Toast:** Auto-close com progress bar e hover pause
- **Layout:** Card superior com filtros + minicards + grid AG-Grid
- **Cores:** Esquema de cores padrão da plataforma (laranja/vermelho/verde/azul)
- **Responsividade:** Grid adaptável para mobile/tablet/desktop
- **TypeScript:** Tipagem completa com interfaces em `types.ts`

## Observações Técnicas

- A página usa queries diretas ao Supabase (não passa pelo backend API)
- Suporta RLS (Row Level Security) via sessão autenticada do Supabase
- Relacionamento `parent_id` permite criar hierarquias de domínios
- AG-Grid configurado para sorting, filtering e resizing de colunas
- Estado local gerenciado com `useState` (sem React Query)
