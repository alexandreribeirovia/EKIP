/**
 * Permission Store
 * 
 * Store Zustand para gerenciar permissões do usuário logado.
 * 
 * IMPORTANTE: Sem cache - busca permissões diretamente da API
 * para garantir reflexo imediato de alterações.
 * 
 * Uso:
 * - hasPermission(screen, action): Verifica permissão específica
 * - hasScreenAccess(screen): Verifica acesso à tela (view)
 * - isAdmin: Se é administrador (acesso total)
 */

import { create } from 'zustand'
import apiClient from '../lib/apiClient'

// =====================================================
// TYPES
// =====================================================

interface Permission {
  screen_key: string
  action: string
  allowed?: boolean
}

interface PermissionState {
  // Estado
  profileId: number | null
  profileName: string | null
  isAdmin: boolean
  permissions: Permission[]
  loading: boolean
  loaded: boolean
  error: string | null

  // Actions
  loadPermissions: () => Promise<void>
  clearPermissions: () => void
  hasPermission: (screenKey: string, action: string) => boolean
  hasScreenAccess: (screenKey: string) => boolean
  hasAnyPermission: (screenKey: string) => boolean
  /** Verifica se uma entidade ou sub-entidade está habilitada */
  isEnabled: (screenKey: string) => boolean
  /** Verifica acesso considerando habilitação + permissão view */
  hasFullAccess: (screenKey: string) => boolean
}

// =====================================================
// STORE
// =====================================================

export const usePermissionStore = create<PermissionState>((set, get) => ({
  // Estado inicial
  profileId: null,
  profileName: null,
  isAdmin: false,
  permissions: [],
  loading: false,
  loaded: false,
  error: null,

  /**
   * Carrega as permissões do usuário logado
   */
  loadPermissions: async () => {
    // Evita múltiplas requisições simultâneas
    if (get().loading) return

    set({ loading: true, error: null })

    try {
      const response = await apiClient.get('/api/access-profiles/user/permissions')

      if (response.success) {
        set({
          profileId: response.data.profileId,
          profileName: response.data.profileName,
          isAdmin: response.data.isAdmin,
          permissions: response.data.permissions,
          loaded: true,
          loading: false,
          error: null
        })
      } else {
        // Se não tem perfil, permite acesso (para não bloquear)
        // mas marca como carregado
        set({
          profileId: null,
          profileName: null,
          isAdmin: false,
          permissions: [],
          loaded: true,
          loading: false,
          error: response.error?.message || 'Erro ao carregar permissões'
        })
      }
    } catch (err: any) {
      console.error('Erro ao carregar permissões:', err)
      set({
        loading: false,
        loaded: true,
        error: err.message || 'Erro ao carregar permissões'
      })
    }
  },

  /**
   * Limpa as permissões (usado no logout)
   */
  clearPermissions: () => {
    set({
      profileId: null,
      profileName: null,
      isAdmin: false,
      permissions: [],
      loading: false,
      loaded: false,
      error: null
    })
  },

  /**
   * Verifica se o usuário tem permissão específica
   */
  hasPermission: (screenKey: string, action: string): boolean => {
    const state = get()

    // Admin tem acesso total
    if (state.isAdmin) return true

    // Usuário sem perfil - libera acesso (backwards compatibility)
    // Isso permite que usuários existentes sem perfil continuem acessando
    // até que um perfil seja atribuído
    if (!state.profileId) return true

    // Busca a permissão
    const perm = state.permissions.find(
      p => p.screen_key === screenKey && p.action === action
    )

    return perm?.allowed !== false && perm !== undefined
  },

  /**
   * Verifica se o usuário tem acesso de visualização à tela
   */
  hasScreenAccess: (screenKey: string): boolean => {
    return get().hasPermission(screenKey, 'view')
  },

  /**
   * Verifica se o usuário tem qualquer permissão na tela
   */
  hasAnyPermission: (screenKey: string): boolean => {
    const state = get()

    if (state.isAdmin) return true
    // Usuário sem perfil - libera acesso (backwards compatibility)
    if (!state.profileId) return true

    return state.permissions.some(p => p.screen_key === screenKey)
  },

  /**
   * Verifica se uma entidade ou sub-entidade está habilitada
   * Usa action='enabled' para verificar habilitação
   */
  isEnabled: (screenKey: string): boolean => {
    const state = get()

    // Admin tem tudo habilitado
    if (state.isAdmin) return true

    // Usuário sem perfil - libera acesso (backwards compatibility)
    if (!state.profileId) return true

    // Busca a permissão de habilitação
    const perm = state.permissions.find(
      p => p.screen_key === screenKey && p.action === 'enabled'
    )

    // Se não encontrou permissão de habilitação, considera habilitado por padrão
    // Isso garante backwards compatibility com perfis existentes
    if (!perm) return true

    return perm.allowed !== false
  },

  /**
   * Verifica acesso completo: entidade habilitada + permissão view
   * Usado para filtrar menus e rotas
   */
  hasFullAccess: (screenKey: string): boolean => {
    return get().isEnabled(screenKey) && get().hasScreenAccess(screenKey)
  }
}))

// =====================================================
// HOOKS UTILITÁRIOS
// =====================================================

/**
 * Hook para verificar permissão de forma reativa
 */
export function useHasPermission(screenKey: string, action: string): boolean {
  const hasPermission = usePermissionStore(state => state.hasPermission)
  const isAdmin = usePermissionStore(state => state.isAdmin)
  const permissions = usePermissionStore(state => state.permissions)
  
  // Re-calcula quando permissões mudam
  return isAdmin || permissions.some(
    p => p.screen_key === screenKey && p.action === action
  )
}

/**
 * Hook para verificar acesso à tela
 */
export function useHasScreenAccess(screenKey: string): boolean {
  return useHasPermission(screenKey, 'view')
}

/**
 * Hook que retorna função de verificação de permissão
 * Útil para usar em callbacks
 */
export function usePermissionCheck() {
  const isAdmin = usePermissionStore(state => state.isAdmin)
  const permissions = usePermissionStore(state => state.permissions)
  const profileId = usePermissionStore(state => state.profileId)

  return (screenKey: string, action: string): boolean => {
    if (isAdmin) return true
    if (!profileId) return false
    return permissions.some(p => p.screen_key === screenKey && p.action === action)
  }
}

/**
 * Hook para verificar se entidade/sub-entidade está habilitada
 */
export function useIsEnabled(screenKey: string): boolean {
  const isAdmin = usePermissionStore(state => state.isAdmin)
  const profileId = usePermissionStore(state => state.profileId)
  const permissions = usePermissionStore(state => state.permissions)

  if (isAdmin) return true
  if (!profileId) return true

  const perm = permissions.find(
    p => p.screen_key === screenKey && p.action === 'enabled'
  )

  return perm ? perm.allowed !== false : true
}

/**
 * Hook para verificar acesso completo (habilitado + view) para uma tela específica
 * Útil para verificar acesso a uma única tela
 */
export function useHasFullAccessFor(screenKey: string): boolean {
  const isAdmin = usePermissionStore(state => state.isAdmin)
  const profileId = usePermissionStore(state => state.profileId)
  const permissions = usePermissionStore(state => state.permissions)

  if (isAdmin) return true
  if (!profileId) return true

  const isEnabled = permissions.find(
    p => p.screen_key === screenKey && p.action === 'enabled'
  )
  const enabledResult = isEnabled ? isEnabled.allowed !== false : true

  const hasView = permissions.some(
    p => p.screen_key === screenKey && p.action === 'view'
  )
  
  return enabledResult && hasView
}

/**
 * Hook que retorna função para verificar acesso completo (habilitado + view)
 * Útil para callbacks e verificações múltiplas em um componente
 */
export function useHasFullAccess() {
  const isAdmin = usePermissionStore(state => state.isAdmin)
  const profileId = usePermissionStore(state => state.profileId)
  const permissions = usePermissionStore(state => state.permissions)

  return (screenKey: string): boolean => {
    if (isAdmin) return true
    if (!profileId) return true

    const isEnabled = permissions.find(
      p => p.screen_key === screenKey && p.action === 'enabled'
    )
    const enabledResult = isEnabled ? isEnabled.allowed !== false : true

    const hasView = permissions.some(
      p => p.screen_key === screenKey && p.action === 'view'
    )
    
    return enabledResult && hasView
  }
}
