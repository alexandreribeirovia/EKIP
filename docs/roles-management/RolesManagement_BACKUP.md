# RolesManagement - Documentação Completa (BACKUP)

**Data do Backup**: 10/12/2025

## Visão Geral

Tela de gestão de perfis de acesso (roles) que permite configurar permissões granulares de telas e elementos por perfil de usuário. Implementa controle de acesso baseado em funções (RBAC - Role-Based Access Control).

## Localização

- **Arquivo**: `frontend/src/pages/RolesManagement.tsx`
- **Rota**: `/roles` (configurada em `App.tsx`)
- **Acesso**: Apenas administradores (`isAdmin` via `usePermissions` hook)

## Funcionalidades Principais

### 1. Gestão de Perfis
- **Listagem de perfis** com contagem de usuários e telas associadas
- **Criação de novos perfis** via modal
- **Seleção de perfil** para configuração de permissões
- **Distinção visual** entre perfis de sistema (com Lock icon) e customizados (Unlock icon)

### 2. Configuração de Permissões

#### Permissões de Tela (Screen-level)
- **Concessão/revogação de acesso** a telas individuais
- **Ações em lote**: "Conceder Todas" e "Revogar Todas"
- **Estado visual** com cores (verde = acesso, cinza = bloqueado)
- **Expansão de tela** para ver elementos (chevron interativo)

#### Permissões de Elementos (Element-level)
- **Controle de visibilidade** de elementos específicos (tabs, buttons, sections, columns, fields)
- **Badges coloridos** por tipo de elemento
- **Toggle individual** de visibilidade com estado visual (check/x icons)

### 3. Proteções de Sistema
- **Perfil "admin"** (is_system = true) é bloqueado para edição
- **Validação de acesso** via hook `usePermissions`
- **Mensagem de acesso negado** para usuários não-admin

### 4. Tabs de Navegação
- **Tab "Telas e Elementos"**: Configuração de permissões (implementada)
- **Tab "Usuários com este Perfil"**: Placeholder para funcionalidade futura

## Estrutura de Dados

### Tipos TypeScript

```typescript
interface RoleWithDetails extends DbRole {
  user_count: number;
  screen_count: number;
}

interface ScreenWithElements extends DbScreen {
  elements: DbScreenElement[];
  expanded?: boolean;
}
```

### Tabelas Supabase Utilizadas

1. **`roles`**
   - `id` (number)
   - `name` (string)
   - `description` (string | null)
   - `is_system` (boolean)

2. **`screens`**
   - `code` (string)
   - `name` (string)
   - `path` (string)
   - `is_active` (boolean)
   - `display_order` (number)

3. **`screen_elements`**
   - `element_code` (string)
   - `screen_code` (string)
   - `name` (string)
   - `element_type` (string: 'tab' | 'button' | 'section' | 'column' | 'field')

4. **`role_screens`**
   - `role_id` (number)
   - `screen_code` (string)
   - `can_access` (boolean)
   - Constraint: `UNIQUE(role_id, screen_code)`

5. **`role_screen_elements`**
   - `role_id` (number)
   - `screen_code` (string)
   - `element_code` (string)
   - `can_view` (boolean)
   - Constraint: `UNIQUE(role_id, screen_code, element_code)`

6. **`user_roles`** (para contagem)
   - `user_id`
   - `role_id`

## Estados do Componente

### Estados Principais
```typescript
const [roles, setRoles] = useState<RoleWithDetails[]>([]);
const [screens, setScreens] = useState<ScreenWithElements[]>([]);
const [selectedRole, setSelectedRole] = useState<RoleWithDetails | null>(null);
const [roleScreens, setRoleScreens] = useState<Map<string, boolean>>(new Map());
const [roleElements, setRoleElements] = useState<Map<string, boolean>>(new Map());
```

### Estados de Loading
```typescript
const [isLoading, setIsLoading] = useState(true);
const [isSaving, setIsSaving] = useState(false);
```

### Estados de UI
```typescript
const [activeTab, setActiveTab] = useState<'screens' | 'users'>('screens');
const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
const [showNewRoleModal, setShowNewRoleModal] = useState(false);
const [newRoleName, setNewRoleName] = useState('');
const [newRoleDescription, setNewRoleDescription] = useState('');
```

### Permissões
```typescript
const { isAdmin, loading: permissionsLoading } = usePermissions();
```

## Funções Principais

### Fetch de Dados

#### `fetchRoles()`
```typescript
const fetchRoles = useCallback(async () => {
  const { data: rolesData, error: rolesError } = await supabase
    .from('roles')
    .select(`
      *,
      user_roles(count),
      role_screens(count)
    `)
    .order('name');

  // Mapeia para RoleWithDetails com contagens
});
```

#### `fetchScreens()`
```typescript
const fetchScreens = useCallback(async () => {
  // Busca screens com is_active = true
  // Busca screen_elements
  // Agrupa elementos por tela
  // Adiciona propriedade expanded: false
});
```

#### `fetchRolePermissions(roleId)`
```typescript
const fetchRolePermissions = useCallback(async (roleId: number) => {
  // Busca role_screens
  // Busca role_screen_elements
  // Monta Maps: roleScreens e roleElements
});
```

### Handlers de Ações

#### `handleToggleScreenAccess(screenCode)`
```typescript
// Bloqueia se perfil admin
// Toggle acesso com upsert/delete na tabela role_screens
// Atualiza Map local roleScreens
// Exibe NotificationToast
```

#### `handleToggleElementVisibility(screenCode, elementCode)`
```typescript
// Bloqueia se perfil admin
// Toggle visibilidade com upsert na tabela role_screen_elements
// Atualiza Map local roleElements (key = "screenCode:elementCode")
// Exibe NotificationToast
```

#### `handleCreateRole()`
```typescript
// Valida nome obrigatório
// Normaliza nome: toLowerCase().replace(/\s+/g, '_')
// Insert na tabela roles com is_system = false
// Trata erro 23505 (duplicate key) com mensagem específica
// Recarrega lista de roles
```

#### `handleGrantAllScreens()`
```typescript
// Upsert em lote: todas as telas com can_access = true
// Atualiza Map local com todas as telas = true
```

#### `handleRevokeAllScreens()`
```typescript
// Delete em lote: todas as entries de role_screens do role
// Limpa Map local roleScreens
```

### Helpers de Renderização

#### `getElementTypeBadge(type)`
```typescript
const getElementTypeBadge = (type: string) => {
  const colors: Record<string, string> = {
    tab: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',
    button: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300',
    section: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300',
    column: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300',
    field: 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300',
  };
  return colors[type] || colors.field;
};
```

## Design System

### Paleta de Cores

#### Badges de Tipo de Elemento
- **Tab**: Azul (`bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300`)
- **Button**: Verde (`bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300`)
- **Section**: Roxo (`bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300`)
- **Column**: Laranja (`bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300`)
- **Field**: Cinza (`bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300`)

#### Estados de Acesso
- **Com acesso**: Verde (`bg-green-500 text-white hover:bg-green-600`)
- **Sem acesso**: Cinza (`bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-300`)
- **Background com acesso**: Verde claro (`bg-green-50 dark:bg-green-900/10`)
- **Background sem acesso**: Cinza (`bg-gray-50 dark:bg-gray-800`)

#### Botões de Ação
- **Conceder Todas**: Verde (`bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300`)
- **Revogar Todas**: Vermelho (`bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300`)
- **Novo Perfil**: Laranja (`bg-orange-500 text-white hover:bg-orange-600`)

### Layout

#### Estrutura Principal
```
┌─────────────────────────────────────────────────────────┐
│ Header: Shield Icon + Título + Botão "Novo Perfil"     │
├─────────────────┬───────────────────────────────────────┤
│ Lista de Perfis │ Painel de Permissões                  │
│ (w-80, fixo)    │ (flex-1, responsivo)                  │
│                 │                                       │
│ ┌─────────────┐ │ ┌─────────────────────────────────┐  │
│ │ Perfil 1    │ │ │ Header: Nome + Botões           │  │
│ │ - users     │ │ ├─────────────────────────────────┤  │
│ │ - screens   │ │ │ Tabs: Telas | Usuários          │  │
│ └─────────────┘ │ ├─────────────────────────────────┤  │
│                 │ │ Conteúdo:                       │  │
│ ┌─────────────┐ │ │ - Telas expansíveis             │  │
│ │ Perfil 2    │ │ │ - Elementos com badges          │  │
│ │ (selecionado)│ │ │                                 │  │
│ └─────────────┘ │ └─────────────────────────────────┘  │
│                 │                                       │
└─────────────────┴───────────────────────────────────────┘
```

### Modal de Novo Perfil
- **Header**: Gradiente laranja-vermelho (`from-orange-500 to-red-500`)
- **Campos**:
  - Nome do Perfil (input text com validação)
  - Descrição (textarea opcional)
- **Botões**: Cancelar (cinza) + Criar Perfil (verde)
- **Validações**:
  - Nome obrigatório
  - Normalização automática (lowercase, underscores)

## Ícones Utilizados (lucide-react)

- `Shield`: Ícone principal da página
- `Plus`: Botão "Novo Perfil"
- `Users`: Contagem de usuários e tab "Usuários"
- `Lock`: Perfis de sistema (bloqueados)
- `Unlock`: Perfis customizados (editáveis)
- `Check`: Estado ativo/visível
- `X`: Estado inativo/oculto e botão fechar
- `Loader2`: Loading spinner (com animate-spin)
- `ChevronRight`: Tela colapsada
- `ChevronDown`: Tela expandida
- `Monitor`: Contagem de telas
- `LayoutGrid`: Tab "Telas e Elementos"

## Fluxo de Uso

### Fluxo de Criação de Perfil
1. Usuário clica em "Novo Perfil"
2. Modal abre com campos vazios
3. Preenche nome (obrigatório) e descrição (opcional)
4. Clica em "Criar Perfil"
5. Sistema normaliza nome e insere no banco
6. Lista de perfis recarrega
7. NotificationToast de sucesso/erro

### Fluxo de Configuração de Permissões
1. Usuário seleciona perfil na lista lateral
2. Sistema carrega permissões existentes (fetchRolePermissions)
3. Tab "Telas e Elementos" é ativada por padrão
4. Usuário vê lista de telas com estado atual (verde/cinza)
5. Para conceder acesso a uma tela:
   - Clica no botão de estado da tela
   - Sistema faz upsert na tabela role_screens
   - Estado local atualiza (Map)
   - NotificationToast confirma ação
6. Para configurar elementos:
   - Clica no chevron para expandir tela
   - Vê badges coloridos de elementos
   - Clica em badge para toggle visibilidade
   - Sistema faz upsert na tabela role_screen_elements
   - Badge atualiza visualmente (cores/line-through)
   - NotificationToast confirma ação

### Fluxo de Ações em Lote
1. Usuário seleciona perfil
2. Clica em "Conceder Todas" ou "Revogar Todas"
3. Sistema confirma ação (sem modal de confirmação)
4. Operação em lote no banco (upsert/delete)
5. Estado local atualiza completamente
6. NotificationToast confirma ação

## Casos de Uso Especiais

### Perfil Admin (Sistema)
- Identificado por `is_system = true` e `name = 'admin'`
- **Comportamento**:
  - Sempre exibe todas as telas/elementos como acessíveis (verde)
  - Botões de toggle ficam disabled (opacity-50, cursor-not-allowed)
  - Mensagem de aviso: "⚠️ Perfil de sistema - permissões não podem ser alteradas"
  - Botões "Conceder Todas" e "Revogar Todas" não aparecem

### Acesso Negado para Não-Admin
- Hook `usePermissions` retorna `isAdmin = false`
- Renderiza tela de acesso negado:
  - Ícone Lock (w-16 h-16)
  - Título "Acesso Restrito"
  - Mensagem explicativa

### Loading States
- **Initial loading**: Spinner central com texto "Carregando..."
- **Saving**: Botões mostram Loader2 icon + disabled state
- **Permissions loading**: Aguarda hook usePermissions antes de renderizar

## Dependências

### Hooks
- `useState`, `useEffect`, `useCallback` (React)
- `usePermissions` (custom hook)

### Bibliotecas
- `lucide-react`: Ícones
- `supabase`: Cliente de banco de dados
- `NotificationToast`: Componente customizado de notificações

### Tipos
- `DbRole`, `DbScreen`, `DbScreenElement` (importados de `../types`)

## Padrões Seguidos

### Padrões do Projeto EKIP
✅ **Modal Pattern**: Header com gradiente, botões padronizados, NotificationToast
✅ **Badge Pattern**: rounded-full, cores padronizadas, dark mode support
✅ **NotificationToast**: Auto-close 10s, hover pause, portal rendering
✅ **Tailwind CSS**: Utility classes, dark mode, cores da paleta do projeto
✅ **Estado Local**: useState com Maps para performance (roleScreens, roleElements)
✅ **Supabase Queries**: Destructure {data, error}, joins com select
✅ **Error Handling**: Try-catch, console.error, NotificationToast

### Otimizações
- **useCallback** para evitar re-renders desnecessários
- **Maps** ao invés de arrays para lookup O(1)
- **Parallel fetching** de roles e screens no useEffect inicial
- **Local state updates** antes de recarregar do banco

## Melhorias Futuras Sugeridas

### Funcionalidades
1. **Tab "Usuários"**: Implementar listagem e atribuição de usuários ao perfil
2. **Busca/Filtro**: Campo de busca para perfis e telas
3. **Histórico de Alterações**: Log de quem modificou permissões e quando
4. **Duplicar Perfil**: Criar novo perfil baseado em existente
5. **Editar Nome/Descrição**: Modal de edição de perfis existentes
6. **Deletar Perfil**: Com validação (bloquear se tiver usuários)
7. **Permissões em Árvore**: View hierárquica (tela > elementos)

### UX
1. **Confirmação de Ações em Lote**: Modal "Tem certeza?" para Conceder/Revogar Todas
2. **Indicador de Mudanças Não Salvas**: Avisar antes de trocar de perfil
3. **Exportar/Importar Perfis**: JSON para backup/migração
4. **Preview de Permissões**: Simular view do perfil antes de salvar

### Performance
1. **Paginação**: Para muitos perfis (>50)
2. **Virtual Scrolling**: Para muitas telas/elementos
3. **Debounce em Buscas**: Se implementar campo de busca
4. **Optimistic UI**: Atualizar UI antes da resposta do banco

### Segurança
1. **Audit Log**: Registrar todas as mudanças de permissões
2. **2FA para Admins**: Exigir 2FA para mudar permissões de perfil admin
3. **Rate Limiting**: Backend limitar operações em lote

## Queries Supabase Usadas

### Select de Roles com Contagens
```sql
SELECT 
  roles.*,
  (SELECT COUNT(*) FROM user_roles WHERE role_id = roles.id) as user_count,
  (SELECT COUNT(*) FROM role_screens WHERE role_id = roles.id) as screen_count
FROM roles
ORDER BY name;
```

### Select de Screens com Elementos
```sql
-- Screens
SELECT * FROM screens 
WHERE is_active = true 
ORDER BY display_order;

-- Elements
SELECT * FROM screen_elements 
ORDER BY element_code;
```

### Upsert de Screen Access
```sql
INSERT INTO role_screens (role_id, screen_code, can_access)
VALUES ($1, $2, true)
ON CONFLICT (role_id, screen_code) 
DO UPDATE SET can_access = EXCLUDED.can_access;
```

### Upsert de Element Visibility
```sql
INSERT INTO role_screen_elements (role_id, screen_code, element_code, can_view)
VALUES ($1, $2, $3, $4)
ON CONFLICT (role_id, screen_code, element_code) 
DO UPDATE SET can_view = EXCLUDED.can_view;
```

### Delete Screen Access
```sql
DELETE FROM role_screens 
WHERE role_id = $1 AND screen_code = $2;
```

### Batch Grant All Screens
```sql
INSERT INTO role_screens (role_id, screen_code, can_access)
VALUES 
  ($1, 'screen1', true),
  ($1, 'screen2', true),
  ...
ON CONFLICT (role_id, screen_code) 
DO UPDATE SET can_access = EXCLUDED.can_access;
```

### Batch Revoke All Screens
```sql
DELETE FROM role_screens WHERE role_id = $1;
```

## Schema SQL de Referência

```sql
-- Tabela roles
CREATE TABLE roles (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  is_system BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Tabela screens
CREATE TABLE screens (
  code VARCHAR(100) PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  path VARCHAR(200) NOT NULL,
  is_active BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Tabela screen_elements
CREATE TABLE screen_elements (
  element_code VARCHAR(100) PRIMARY KEY,
  screen_code VARCHAR(100) REFERENCES screens(code) ON DELETE CASCADE,
  name VARCHAR(200) NOT NULL,
  element_type VARCHAR(50) NOT NULL, -- tab, button, section, column, field
  created_at TIMESTAMP DEFAULT NOW()
);

-- Tabela role_screens
CREATE TABLE role_screens (
  role_id INTEGER REFERENCES roles(id) ON DELETE CASCADE,
  screen_code VARCHAR(100) REFERENCES screens(code) ON DELETE CASCADE,
  can_access BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (role_id, screen_code)
);

-- Tabela role_screen_elements
CREATE TABLE role_screen_elements (
  role_id INTEGER REFERENCES roles(id) ON DELETE CASCADE,
  screen_code VARCHAR(100) REFERENCES screens(code) ON DELETE CASCADE,
  element_code VARCHAR(100) REFERENCES screen_elements(element_code) ON DELETE CASCADE,
  can_view BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (role_id, screen_code, element_code)
);

-- Tabela user_roles (para contagem)
CREATE TABLE user_roles (
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  role_id INTEGER REFERENCES roles(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (user_id, role_id)
);
```

## Notas de Implementação

### Por que Maps ao invés de Arrays?
- **Performance**: Lookup O(1) vs O(n)
- **Simplicidade**: `map.get(key)` vs `array.find(x => x.key === key)`
- **Imutabilidade controlada**: `new Map(prev).set(key, value)`

### Por que Upsert ao invés de Update?
- **Idempotência**: Funciona tanto para criar quanto atualizar
- **Simplicidade**: Não precisa verificar existência antes
- **Atomicidade**: Operação única no banco

### Por que useCallback?
- **Evitar re-renders**: Funções como dependências de useEffect
- **Estabilidade**: Mesma referência entre renders
- **Performance**: Especialmente em listas grandes

### Por que Local State Updates?
- **UX responsivo**: Usuário vê mudança imediatamente
- **Otimismo**: Assume sucesso (rollback se erro)
- **Performance**: Evita re-fetch desnecessário

## Código Completo

Ver arquivo original: `frontend/src/pages/RolesManagement.tsx` (anexo)

---

**Documentação gerada em**: 10/12/2025
**Versão do React**: 18
**Versão do Supabase**: Latest
**Autor**: Sistema EKIP
