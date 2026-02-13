/**
 * Constantes de Permissões do Sistema EKIP
 * 
 * Este arquivo define todas as entidades e sub-entidades baseadas no menu,
 * com suas respectivas ações disponíveis para configuração de perfis de acesso.
 * 
 * Estrutura hierárquica de 3 níveis:
 * 
 * NÍVEL 1 - Entidades (menu principal):
 * - Dashboard, Funcionários, Projetos, Alocações, Configurações
 * 
 * NÍVEL 2 - SubEntidades:
 * - Itens de menu (route definida, aparecem no menu lateral)
 * - Páginas de detalhe (isDetailPage: true, não aparecem no menu, acessadas via click no grid)
 * 
 * NÍVEL 3 - Tabs (dentro de páginas de detalhe):
 * - Abas dentro de EmployeeDetail ou ProjectDetail
 * - Cada aba tem suas próprias ações CRUD
 * 
 * Exemplo:
 * - Funcionários (entidade) → Detalhes do Funcionário (subentidade detalhe) → Feedbacks (tab)
 */

// =====================================================
// TIPOS
// =====================================================

export interface Action {
  key: string;
  label: string;
  description: string;
}

/** Aba dentro de uma página de detalhe (3º nível) */
export interface TabEntity {
  key: string;
  label: string;
  icon: string;
  actions: Action[];
}

export interface SubEntity {
  key: string;
  label: string;
  route: string;
  icon: string;
  actions: Action[];
  /** Se true, é uma página de detalhe (não aparece no menu, acessada via click no grid) */
  isDetailPage?: boolean;
  /** Abas dentro desta página de detalhe (3º nível de permissões) */
  tabs?: TabEntity[];
}

export interface Entity {
  key: string;
  label: string;
  icon: string;
  description: string;
  route: string;
  /** Sub-entidades (itens de submenu ou páginas de detalhe) */
  subEntities: SubEntity[];
  /** Ações disponíveis na entidade raiz (quando não tem sub-entidades ou para a listagem principal) */
  actions: Action[];
}

/** @deprecated Use SubEntity instead */
export type Subtab = SubEntity;

// =====================================================
// AÇÕES PADRÃO
// =====================================================

export const ACTIONS = {
  VIEW: { key: 'view', label: 'Visualizar', description: 'Permite abrir/visualizar registros individuais no grid' },
  CREATE: { key: 'create', label: 'Criar', description: 'Permite criar novos registros' },
  EDIT: { key: 'edit', label: 'Editar', description: 'Permite editar registros existentes' },
  DELETE: { key: 'delete', label: 'Excluir', description: 'Permite excluir registros' },
  EXPORT: { key: 'export', label: 'Exportar', description: 'Permite exportar dados' },
  IMPORT: { key: 'import', label: 'Importar', description: 'Permite importar dados' },
} as const;

/** Ações padrão CRUD completo (view + create + edit + delete) */
const CRUD_ACTIONS: Action[] = [
  ACTIONS.VIEW,
  ACTIONS.CREATE,
  ACTIONS.EDIT,
  ACTIONS.DELETE,
];

/** CRUD sem view (create + edit + delete) - para telas onde a listagem já é visível */
const CED_ACTIONS: Action[] = [
  ACTIONS.CREATE,
  ACTIONS.EDIT,
  ACTIONS.DELETE,
];

/** Apenas criação e edição (sem delete) */
const CE_ACTIONS: Action[] = [
  ACTIONS.CREATE,
  ACTIONS.EDIT,
];

/** Apenas edição */
const EDIT_ONLY_ACTIONS: Action[] = [
  ACTIONS.EDIT,
];

/** Sem ações configuráveis - acesso controlado apenas pelo toggle habilitado/desabilitado */
const NO_ACTIONS: Action[] = [];

// =====================================================
// CONFIGURAÇÃO DE ENTIDADES (Baseado no Menu)
// =====================================================

export const ENTITIES_CONFIG: Entity[] = [
  // -------------------------
  // DASHBOARD
  // -------------------------
  {
    key: 'dashboard',
    label: 'Dashboard',
    icon: 'LayoutDashboard',
    description: 'Painel principal com indicadores e gráficos',
    route: '/dashboard',
    actions: NO_ACTIONS,
    subEntities: [
      {
        key: 'dashboard.time-entries',
        label: 'Lançamento de Horas',
        route: '/time-entries',
        icon: 'Clock',
        actions: NO_ACTIONS,
      },
    ],
  },

  // -------------------------
  // FUNCIONÁRIOS
  // -------------------------
  {
    key: 'employees',
    label: 'Funcionários',
    icon: 'Users',
    description: 'Gestão de funcionários e colaboradores',
    route: '/employees',
    actions: NO_ACTIONS,
    subEntities: [
      // Página de detalhe (não aparece no menu)
      {
        key: 'employees.detail',
        label: 'Detalhes do Funcionário',
        route: '/employees/:id',
        icon: 'User',
        isDetailPage: true,
        actions: EDIT_ONLY_ACTIONS, // toggle status, toggle log hours, add/remove skills
        tabs: [
          { key: 'employees.detail.tasks', label: 'Tarefas Atribuídas', icon: 'ClipboardList', actions: NO_ACTIONS },
          { key: 'employees.detail.timerecord', label: 'Registro de Horas', icon: 'Clock', actions: NO_ACTIONS },
          { key: 'employees.detail.followup', label: 'Acompanhamento', icon: 'TrendingUp', actions: NO_ACTIONS },
          { key: 'employees.detail.feedbacks', label: 'Feedbacks', icon: 'MessageSquare', actions: CRUD_ACTIONS }, // view(eye), create(novo), edit, delete
          { key: 'employees.detail.evaluations', label: 'Avaliações', icon: 'FileCheck', actions: [ACTIONS.VIEW, ACTIONS.CREATE, ACTIONS.DELETE] }, // view(link), create(nova), delete
          { key: 'employees.detail.pdi', label: 'PDI', icon: 'Target', actions: CRUD_ACTIONS }, // view(eye fechado), create(novo), edit, delete
          { key: 'employees.detail.access', label: 'Acessos', icon: 'Key', actions: CED_ACTIONS }, // create(novo/clone), edit, delete
          { key: 'employees.detail.quizzes', label: 'Quizzes', icon: 'HelpCircle', actions: NO_ACTIONS },
        ],
      },
      // Itens de menu (páginas separadas)
      {
        key: 'employees.feedbacks',
        label: 'Feedbacks',
        route: '/feedbacks',
        icon: 'MessageSquare',
        actions: CRUD_ACTIONS, // view(eye), create(novo), edit, delete
      },
      {
        key: 'employees.evaluations',
        label: 'Avaliação',
        route: '/employee-evaluations',
        icon: 'FileCheck',
        actions: CRUD_ACTIONS, // view(eye), create(nova), edit, delete
      },
      {
        key: 'employees.pdi',
        label: 'PDI',
        route: '/pdi',
        icon: 'Target',
        actions: CRUD_ACTIONS, // view(eye fechado), create(novo), edit, delete
      },
      {
        key: 'employees.quizzes',
        label: 'Quiz',
        route: '/employee-quizzes',
        icon: 'HelpCircle',
        actions: NO_ACTIONS,
      },
    ],
  },

  // -------------------------
  // PROJETOS
  // -------------------------
  {
    key: 'projects',
    label: 'Projetos',
    icon: 'ClipboardList',
    description: 'Gestão de projetos e entregas',
    route: '/projects',
    actions: NO_ACTIONS,
    subEntities: [
      // Página de detalhe (não aparece no menu)
      {
        key: 'projects.detail',
        label: 'Detalhes do Projeto',
        route: '/projects/:id',
        icon: 'FolderOpen',
        isDetailPage: true,
        actions: NO_ACTIONS,
        tabs: [
          { key: 'projects.detail.tracking', label: 'Acompanhamento', icon: 'TrendingUp', actions: EDIT_ONLY_ACTIONS }, // add/remove owners
          { key: 'projects.detail.tasks', label: 'Tarefas do Projeto', icon: 'ClipboardList', actions: NO_ACTIONS }, // somente leitura (RunRun)
          { key: 'projects.detail.risks', label: 'Riscos/Ações', icon: 'AlertTriangle', actions: CED_ACTIONS }, // create(novo), edit, delete
          { key: 'projects.detail.statusreport', label: 'Status Report', icon: 'BarChart', actions: [ACTIONS.IMPORT] }, // upload CSV
          { key: 'projects.detail.access', label: 'Acesso', icon: 'Key', actions: CED_ACTIONS }, // create(novo/clone), edit, delete
        ],
      },
    ],
  },

  // -------------------------
  // ALOCAÇÕES (sem sub-entidades)
  // -------------------------
  {
    key: 'allocations',
    label: 'Alocações',
    icon: 'CalendarRange',
    description: 'Visualização de alocações de funcionários em projetos',
    route: '/allocations',
    actions: NO_ACTIONS, // calendário somente leitura
    subEntities: [],
  },

  // -------------------------
  // CONFIGURAÇÕES
  // -------------------------
  {
    key: 'settings',
    label: 'Configurações',
    icon: 'Settings',
    description: 'Configurações do sistema',
    route: '/settings',
    actions: NO_ACTIONS,
    subEntities: [
      {
        key: 'settings.evaluations',
        label: 'Avaliações Modelo',
        route: '/evaluations',
        icon: 'ClipboardList',
        actions: CED_ACTIONS, // create(novo), edit, delete
      },
      {
        key: 'settings.quizzes',
        label: 'Quiz',
        route: '/quizzes',
        icon: 'ClipboardCheck',
        actions: CRUD_ACTIONS, // view(detalhe), create(novo), edit, delete
      },
      {
        key: 'settings.access-profiles',
        label: 'Perfis de Acesso',
        route: '/access-profiles',
        icon: 'Shield',
        actions: CRUD_ACTIONS, // view(detalhe), create(novo/clone), edit, delete
      },
      {
        key: 'settings.users',
        label: 'Usuários',
        route: '/users',
        icon: 'Users',
        actions: CE_ACTIONS, // create(novo), edit
      },
      {
        key: 'settings.domains',
        label: 'Domínios',
        route: '/domains',
        icon: 'Database',
        actions: CE_ACTIONS, // create(novo/clone), edit
      },
    ],
  },
];

// =====================================================
// HELPERS
// =====================================================

/**
 * Busca uma entidade pelo key
 */
export function getEntityByKey(key: string): Entity | undefined {
  return ENTITIES_CONFIG.find(e => e.key === key);
}

/**
 * Busca uma sub-entidade pelo key completo (ex: 'employees.feedbacks' ou 'employees.detail')
 */
export function getSubEntityByKey(fullKey: string): { entity: Entity; subEntity: SubEntity } | undefined {
  const [entityKey] = fullKey.split('.');
  const entity = getEntityByKey(entityKey);
  if (!entity) return undefined;
  
  const subEntity = entity.subEntities.find(s => s.key === fullKey);
  if (!subEntity) return undefined;
  
  return { entity, subEntity };
}

/**
 * Busca uma tab pelo key completo (ex: 'employees.detail.tasks')
 */
export function getTabByKey(fullKey: string): { entity: Entity; subEntity: SubEntity; tab: TabEntity } | undefined {
  const parts = fullKey.split('.');
  if (parts.length !== 3) return undefined;
  
  const [entityKey, subKey] = parts;
  const subEntityKey = `${entityKey}.${subKey}`;
  
  const result = getSubEntityByKey(subEntityKey);
  if (!result || !result.subEntity.tabs) return undefined;
  
  const tab = result.subEntity.tabs.find(t => t.key === fullKey);
  if (!tab) return undefined;
  
  return { ...result, tab };
}

/** @deprecated Use getSubEntityByKey instead */
export const getSubtabByKey = getSubEntityByKey;

/**
 * Gera a lista completa de screen_keys para uso em permissões
 * Inclui entidades, sub-entidades e tabs
 */
export function getAllScreenKeys(): string[] {
  const keys: string[] = [];
  
  ENTITIES_CONFIG.forEach(entity => {
    keys.push(entity.key);
    entity.subEntities.forEach(subEntity => {
      keys.push(subEntity.key);
      // Incluir tabs se existirem
      if (subEntity.tabs) {
        subEntity.tabs.forEach(tab => {
          keys.push(tab.key);
        });
      }
    });
  });
  
  return keys;
}

/**
 * Gera todas as combinações possíveis de permissões
 * Útil para criar permissões padrão de um perfil
 */
export function getAllPermissionCombinations(): Array<{ screenKey: string; action: string }> {
  const combinations: Array<{ screenKey: string; action: string }> = [];
  
  ENTITIES_CONFIG.forEach(entity => {
    // Ações da entidade raiz
    entity.actions.forEach(action => {
      combinations.push({
        screenKey: entity.key,
        action: action.key,
      });
    });
    
    // Ações das sub-entidades
    entity.subEntities.forEach(subEntity => {
      subEntity.actions.forEach(action => {
        combinations.push({
          screenKey: subEntity.key,
          action: action.key,
        });
      });
      
      // Ações das tabs (3º nível)
      if (subEntity.tabs) {
        subEntity.tabs.forEach(tab => {
          tab.actions.forEach(action => {
            combinations.push({
              screenKey: tab.key,
              action: action.key,
            });
          });
        });
      }
    });
  });
  
  return combinations;
}

/**
 * Verifica se um screen_key é válido
 */
export function isValidScreenKey(key: string): boolean {
  return getAllScreenKeys().includes(key);
}

/**
 * Busca entidade ou sub-entidade pela rota
 */
export function getEntityByRoute(route: string): { entity: Entity; subEntity?: SubEntity } | undefined {
  for (const entity of ENTITIES_CONFIG) {
    if (entity.route === route) {
      return { entity };
    }
    for (const subEntity of entity.subEntities) {
      if (subEntity.route === route) {
        return { entity, subEntity };
      }
    }
  }
  return undefined;
}

/**
 * Retorna a estrutura para configuração de habilitação
 * Cada entidade, sub-entidade e tab tem um campo 'enabled' que pode ser true/false
 */
export function getDefaultEnabledState(): Record<string, boolean> {
  const state: Record<string, boolean> = {};
  
  ENTITIES_CONFIG.forEach(entity => {
    state[entity.key] = true;
    entity.subEntities.forEach(subEntity => {
      state[subEntity.key] = true;
      // Incluir tabs se existirem
      if (subEntity.tabs) {
        subEntity.tabs.forEach(tab => {
          state[tab.key] = true;
        });
      }
    });
  });
  
  return state;
}

/**
 * Retorna apenas as sub-entidades que são páginas de detalhe
 */
export function getDetailPages(): Array<{ entity: Entity; subEntity: SubEntity }> {
  const detailPages: Array<{ entity: Entity; subEntity: SubEntity }> = [];
  
  ENTITIES_CONFIG.forEach(entity => {
    entity.subEntities
      .filter(sub => sub.isDetailPage)
      .forEach(subEntity => {
        detailPages.push({ entity, subEntity });
      });
  });
  
  return detailPages;
}

/**
 * Retorna apenas as sub-entidades que aparecem no menu (não são páginas de detalhe)
 */
export function getMenuSubEntities(entityKey: string): SubEntity[] {
  const entity = getEntityByKey(entityKey);
  if (!entity) return [];
  
  return entity.subEntities.filter(sub => !sub.isDetailPage);
}

/**
 * Retorna a página de detalhe de uma entidade, se existir
 */
export function getDetailPageForEntity(entityKey: string): SubEntity | undefined {
  const entity = getEntityByKey(entityKey);
  if (!entity) return undefined;
  
  return entity.subEntities.find(sub => sub.isDetailPage);
}
