/**
 * Constantes de Permissões do Sistema EKIP
 * 
 * Este arquivo define todas as entidades, subtabs e ações disponíveis
 * para configuração de perfis de acesso.
 * 
 * Estrutura:
 * - ENTITIES_CONFIG: Mapeamento completo de entidades e suas configurações
 * - ACTIONS: Ações disponíveis (view, create, edit, delete)
 * - Helpers: Funções utilitárias para trabalhar com permissões
 */

// =====================================================
// TIPOS
// =====================================================

export interface Action {
  key: string;
  label: string;
  description: string;
}

export interface Subtab {
  key: string;
  label: string;
  actions: Action[];
}

export interface Entity {
  key: string;
  label: string;
  icon: string;
  description: string;
  route: string;
  subtabs: Subtab[];
  /** Ações disponíveis na entidade raiz (listagem) */
  actions: Action[];
}

// =====================================================
// AÇÕES PADRÃO
// =====================================================

export const ACTIONS = {
  VIEW: { key: 'view', label: 'Visualizar', description: 'Permite visualizar os dados' },
  CREATE: { key: 'create', label: 'Criar', description: 'Permite criar novos registros' },
  EDIT: { key: 'edit', label: 'Editar', description: 'Permite editar registros existentes' },
  DELETE: { key: 'delete', label: 'Excluir', description: 'Permite excluir registros' },
  EXPORT: { key: 'export', label: 'Exportar', description: 'Permite exportar dados' },
  IMPORT: { key: 'import', label: 'Importar', description: 'Permite importar dados' },
} as const;

/** Ações padrão CRUD */
const CRUD_ACTIONS: Action[] = [
  ACTIONS.VIEW,
  ACTIONS.CREATE,
  ACTIONS.EDIT,
  ACTIONS.DELETE,
];

/** Apenas visualização */
const VIEW_ONLY_ACTIONS: Action[] = [
  ACTIONS.VIEW,
];

// =====================================================
// CONFIGURAÇÃO DE ENTIDADES
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
    actions: VIEW_ONLY_ACTIONS,
    subtabs: [],
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
    actions: CRUD_ACTIONS,
    subtabs: [
      {
        key: 'employees.tasks',
        label: 'Tarefas',
        actions: CRUD_ACTIONS,
      },
      {
        key: 'employees.timerecord',
        label: 'Registro de Ponto',
        actions: [...CRUD_ACTIONS, ACTIONS.EXPORT],
      },
      {
        key: 'employees.feedbacks',
        label: 'Feedbacks',
        actions: CRUD_ACTIONS,
      },
      {
        key: 'employees.evaluations',
        label: 'Avaliações',
        actions: CRUD_ACTIONS,
      },
      {
        key: 'employees.pdi',
        label: 'PDI',
        actions: CRUD_ACTIONS,
      },
      {
        key: 'employees.followup',
        label: 'Acompanhamento',
        actions: CRUD_ACTIONS,
      },
      {
        key: 'employees.access',
        label: 'Acessos',
        actions: CRUD_ACTIONS,
      },
      {
        key: 'employees.quizzes',
        label: 'Quizzes',
        actions: VIEW_ONLY_ACTIONS,
      },
    ],
  },

  // -------------------------
  // PROJETOS
  // -------------------------
  {
    key: 'projects',
    label: 'Projetos',
    icon: 'FolderKanban',
    description: 'Gestão de projetos e entregas',
    route: '/projects',
    actions: CRUD_ACTIONS,
    subtabs: [
      {
        key: 'projects.tasks',
        label: 'Tarefas',
        actions: CRUD_ACTIONS,
      },
      {
        key: 'projects.risks',
        label: 'Riscos',
        actions: CRUD_ACTIONS,
      },
      {
        key: 'projects.statusreport',
        label: 'Status Report',
        actions: [...VIEW_ONLY_ACTIONS, ACTIONS.EXPORT],
      },
      {
        key: 'projects.progress',
        label: 'Progresso',
        actions: [...VIEW_ONLY_ACTIONS, ACTIONS.IMPORT],
      },
    ],
  },

  // -------------------------
  // ALOCAÇÕES
  // -------------------------
  {
    key: 'allocations',
    label: 'Alocações',
    icon: 'CalendarDays',
    description: 'Gestão de alocações de funcionários em projetos',
    route: '/allocations',
    actions: CRUD_ACTIONS,
    subtabs: [],
  },

  // -------------------------
  // QUIZZES
  // -------------------------
  {
    key: 'quizzes',
    label: 'Quizzes',
    icon: 'ClipboardList',
    description: 'Gestão de quizzes e avaliações de conhecimento',
    route: '/quizzes',
    actions: CRUD_ACTIONS,
    subtabs: [
      {
        key: 'quizzes.questions',
        label: 'Perguntas',
        actions: CRUD_ACTIONS,
      },
      {
        key: 'quizzes.participants',
        label: 'Participantes',
        actions: CRUD_ACTIONS,
      },
      {
        key: 'quizzes.results',
        label: 'Resultados',
        actions: VIEW_ONLY_ACTIONS,
      },
    ],
  },

  // -------------------------
  // MODELOS DE AVALIAÇÃO
  // -------------------------
  {
    key: 'evaluation_models',
    label: 'Modelos de Avaliação',
    icon: 'FileCheck',
    description: 'Templates para avaliações de desempenho',
    route: '/evaluations',
    actions: CRUD_ACTIONS,
    subtabs: [],
  },

  // -------------------------
  // CONFIGURAÇÕES - DOMÍNIOS
  // -------------------------
  {
    key: 'domains',
    label: 'Domínios',
    icon: 'Database',
    description: 'Gestão de tabelas de domínio do sistema',
    route: '/domains',
    actions: CRUD_ACTIONS,
    subtabs: [],
  },

  // -------------------------
  // CONFIGURAÇÕES - USUÁRIOS
  // -------------------------
  {
    key: 'users',
    label: 'Usuários',
    icon: 'UserCog',
    description: 'Gestão de usuários do sistema',
    route: '/users',
    actions: CRUD_ACTIONS,
    subtabs: [],
  },

  // -------------------------
  // CONFIGURAÇÕES - PERFIS DE ACESSO
  // -------------------------
  {
    key: 'access_profiles',
    label: 'Perfis de Acesso',
    icon: 'Shield',
    description: 'Gestão de perfis e permissões de acesso',
    route: '/access-profiles',
    actions: [
      ACTIONS.VIEW,
      ACTIONS.CREATE,
      ACTIONS.EDIT,
      ACTIONS.DELETE,
    ],
    subtabs: [],
  },

  // -------------------------
  // NOTIFICAÇÕES
  // -------------------------
  {
    key: 'notifications',
    label: 'Notificações',
    icon: 'Bell',
    description: 'Central de notificações do sistema',
    route: '/notifications',
    actions: VIEW_ONLY_ACTIONS,
    subtabs: [],
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
 * Busca uma subtab pelo key completo (ex: 'employees.feedbacks')
 */
export function getSubtabByKey(fullKey: string): { entity: Entity; subtab: Subtab } | undefined {
  const [entityKey] = fullKey.split('.');
  const entity = getEntityByKey(entityKey);
  if (!entity) return undefined;
  
  const subtab = entity.subtabs.find(s => s.key === fullKey);
  if (!subtab) return undefined;
  
  return { entity, subtab };
}

/**
 * Gera a lista completa de screen_keys para uso em permissões
 */
export function getAllScreenKeys(): string[] {
  const keys: string[] = [];
  
  ENTITIES_CONFIG.forEach(entity => {
    keys.push(entity.key);
    entity.subtabs.forEach(subtab => {
      keys.push(subtab.key);
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
    
    // Ações das subtabs
    entity.subtabs.forEach(subtab => {
      subtab.actions.forEach(action => {
        combinations.push({
          screenKey: subtab.key,
          action: action.key,
        });
      });
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
 * Agrupa entidades por categoria para exibição no menu
 */
export function getEntitiesByCategory(): Record<string, Entity[]> {
  return {
    'Principal': ENTITIES_CONFIG.filter(e => ['dashboard'].includes(e.key)),
    'Gestão': ENTITIES_CONFIG.filter(e => ['employees', 'projects', 'allocations'].includes(e.key)),
    'Avaliações': ENTITIES_CONFIG.filter(e => ['quizzes', 'evaluation_models'].includes(e.key)),
    'Configurações': ENTITIES_CONFIG.filter(e => ['domains', 'users', 'access_profiles'].includes(e.key)),
    'Sistema': ENTITIES_CONFIG.filter(e => ['notifications'].includes(e.key)),
  };
}
