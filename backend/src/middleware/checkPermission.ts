/**
 * Middleware de Verificação de Permissões
 * 
 * Verifica se o usuário logado tem permissão para acessar
 * uma determinada tela/ação.
 * 
 * Uso:
 * router.get('/', checkPermission('employees', 'view'), handler)
 * router.post('/', checkPermission('employees', 'create'), handler)
 */

import { Request, Response, NextFunction } from 'express'
import { supabaseAdmin } from '../lib/supabaseAdmin'

/**
 * Middleware factory que verifica permissões
 * @param screenKey - Chave da tela (ex: 'employees', 'employees.feedbacks')
 * @param action - Ação (ex: 'view', 'create', 'edit', 'delete')
 */
export function checkPermission(screenKey: string, action: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Obtém o userId da sessão (populado pelo sessionAuth)
      const userId = req.session?.userId

      if (!userId) {
        return res.status(401).json({
          success: false,
          error: { 
            message: 'Usuário não autenticado', 
            code: 'UNAUTHORIZED' 
          }
        })
      }

      // Busca o perfil do usuário na tabela users (usuários da plataforma)
      const { data: user } = await supabaseAdmin
        .from('users')
        .select('profile_id')
        .eq('id', userId)
        .single()

      if (!user) {
        return res.status(403).json({
          success: false,
          error: { 
            message: 'Usuário não encontrado no sistema', 
            code: 'USER_NOT_FOUND' 
          }
        })
      }

      if (!user.profile_id) {
        return res.status(403).json({
          success: false,
          error: { 
            message: 'Usuário sem perfil de acesso definido', 
            code: 'NO_PROFILE' 
          }
        })
      }

      // Verifica se é perfil de sistema (Admin - tem acesso total)
      const { data: profile } = await supabaseAdmin
        .from('access_profiles')
        .select('is_system, is_active')
        .eq('id', user.profile_id)
        .single()

      if (!profile) {
        return res.status(403).json({
          success: false,
          error: { 
            message: 'Perfil de acesso não encontrado', 
            code: 'PROFILE_NOT_FOUND' 
          }
        })
      }

      if (!profile.is_active) {
        return res.status(403).json({
          success: false,
          error: { 
            message: 'Perfil de acesso está inativo', 
            code: 'PROFILE_INACTIVE' 
          }
        })
      }

      // Perfil de sistema (Administrador) tem acesso total
      if (profile.is_system) {
        return next()
      }

      // Verifica a permissão específica
      const { data: permission } = await supabaseAdmin
        .from('access_permissions')
        .select('allowed')
        .eq('profile_id', user.profile_id)
        .eq('screen_key', screenKey)
        .eq('action', action)
        .single()

      if (!permission || !permission.allowed) {
        return res.status(403).json({
          success: false,
          error: { 
            message: `Acesso negado. Você não tem permissão para ${getActionLabel(action)} em ${screenKey}.`, 
            code: 'PERMISSION_DENIED',
            details: { screenKey, action }
          }
        })
      }

      // Permissão concedida
      return next()
    } catch (err) {
      console.error('Erro no middleware de permissão:', err)
      return next(err)
    }
  }
}

/**
 * Retorna label amigável para a ação
 */
function getActionLabel(action: string): string {
  const labels: Record<string, string> = {
    view: 'visualizar',
    create: 'criar',
    edit: 'editar',
    delete: 'excluir',
    export: 'exportar',
    import: 'importar'
  }
  return labels[action] || action
}

/**
 * Middleware que verifica se o usuário tem QUALQUER permissão
 * para uma determinada tela (útil para verificar acesso ao menu)
 */
export function checkScreenAccess(screenKey: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.session?.userId

      if (!userId) {
        return res.status(401).json({
          success: false,
          error: { message: 'Usuário não autenticado', code: 'UNAUTHORIZED' }
        })
      }

      const { data: user } = await supabaseAdmin
        .from('users')
        .select('profile_id')
        .eq('id', userId)
        .single()

      if (!user?.profile_id) {
        return res.status(403).json({
          success: false,
          error: { message: 'Usuário sem perfil de acesso', code: 'NO_PROFILE' }
        })
      }

      // Verifica se é admin
      const { data: profile } = await supabaseAdmin
        .from('access_profiles')
        .select('is_system, is_active')
        .eq('id', user.profile_id)
        .single()

      if (profile?.is_system) {
        return next()
      }

      if (!profile?.is_active) {
        return res.status(403).json({
          success: false,
          error: { message: 'Perfil inativo', code: 'PROFILE_INACTIVE' }
        })
      }

      // Verifica se tem pelo menos view na tela
      const { data: permission } = await supabaseAdmin
        .from('access_permissions')
        .select('allowed')
        .eq('profile_id', user.profile_id)
        .eq('screen_key', screenKey)
        .eq('action', 'view')
        .eq('allowed', true)
        .limit(1)

      if (!permission || permission.length === 0) {
        return res.status(403).json({
          success: false,
          error: { 
            message: 'Você não tem acesso a esta tela', 
            code: 'NO_SCREEN_ACCESS' 
          }
        })
      }

      return next()
    } catch (err) {
      return next(err)
    }
  }
}

/**
 * Helper para obter todas as permissões do usuário (usado internamente)
 * @param userId - UUID do auth.users
 */
export async function getUserPermissions(userId: string): Promise<{
  isAdmin: boolean
  profileId: number | null
  permissions: Array<{ screen_key: string; action: string }>
}> {
  const { data: user } = await supabaseAdmin
    .from('users')
    .select('profile_id')
    .eq('id', userId)
    .single()

  if (!user?.profile_id) {
    return { isAdmin: false, profileId: null, permissions: [] }
  }

  const { data: profile } = await supabaseAdmin
    .from('access_profiles')
    .select('is_system')
    .eq('id', user.profile_id)
    .single()

  if (profile?.is_system) {
    return { isAdmin: true, profileId: user.profile_id, permissions: [] }
  }

  const { data: permissions } = await supabaseAdmin
    .from('access_permissions')
    .select('screen_key, action')
    .eq('profile_id', user.profile_id)
    .eq('allowed', true)

  return {
    isAdmin: false,
    profileId: user.profile_id,
    permissions: permissions || []
  }
}
