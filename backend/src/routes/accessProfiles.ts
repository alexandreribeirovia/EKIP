/**
 * Rotas de Perfis de Acesso
 * 
 * Gerencia perfis de acesso e suas permissões.
 * Endpoints:
 * - GET /api/access-profiles - Lista todos os perfis
 * - GET /api/access-profiles/:id - Busca perfil por ID
 * - POST /api/access-profiles - Cria novo perfil
 * - PUT /api/access-profiles/:id - Atualiza perfil
 * - DELETE /api/access-profiles/:id - Remove perfil (soft delete)
 * - POST /api/access-profiles/:id/clone - Clona perfil
 * - GET /api/access-profiles/:id/permissions - Lista permissões do perfil
 * - PUT /api/access-profiles/:id/permissions - Atualiza permissões do perfil
 * - GET /api/access-profiles/user/permissions - Lista permissões do usuário logado
 */

import { Router, Request, Response, NextFunction } from 'express'
import { supabaseAdmin } from '../lib/supabaseAdmin'
import { sessionAuth } from '../middleware/sessionAuth'

const router = Router()

// Aplicar middleware de autenticação em todas as rotas
router.use(sessionAuth)

// =====================================================
// LISTAR TODOS OS PERFIS
// =====================================================
router.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('access_profiles')
      .select('*')
      .order('is_system', { ascending: false })
      .order('name', { ascending: true })

    if (error) {
      console.error('Erro ao buscar perfis:', error)
      return res.status(500).json({
        success: false,
        error: { message: error.message, code: 'SUPABASE_ERROR' }
      })
    }

    return res.json({
      success: true,
      data: data || []
    })
  } catch (err) {
    return next(err)
  }
})

// =====================================================
// LISTAR PERMISSÕES DO USUÁRIO LOGADO
// IMPORTANTE: Esta rota deve vir ANTES de /:id
// =====================================================
router.get('/user/permissions', async (req: Request, res: Response, next: NextFunction) => {
  try {
    // O sessionAuth já populou req.session com o usuário logado
    const userId = req.session?.userId

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: { message: 'Usuário não autenticado', code: 'UNAUTHORIZED' }
      })
    }

    // Busca o perfil do usuário na nova tabela users (por UUID)
    const { data: user } = await supabaseAdmin
      .from('users')
      .select('profile_id')
      .eq('id', userId)
      .single()

    // Se usuário não tem perfil, retorna resposta indicando acesso liberado
    // (backwards compatibility - usuários sem perfil têm acesso total)
    if (!user || !user.profile_id) {
      return res.json({
        success: true,
        data: {
          profileId: null,
          profileName: null,
          isAdmin: false,
          permissions: [],
          noProfile: true  // Indica que usuário não tem perfil
        }
      })
    }

    // Verifica se é perfil de sistema
    const { data: profile } = await supabaseAdmin
      .from('access_profiles')
      .select('id, name, is_system')
      .eq('id', user.profile_id)
      .single()

    if (!profile) {
      return res.status(404).json({
        success: false,
        error: { message: 'Perfil de acesso não encontrado', code: 'PROFILE_NOT_FOUND' }
      })
    }

    // Se for perfil de sistema (Admin), retorna flag especial
    if (profile.is_system) {
      return res.json({
        success: true,
        data: {
          profileId: profile.id,
          profileName: profile.name,
          isAdmin: true,
          permissions: []
        }
      })
    }

    // Busca permissões do perfil
    const { data: permissions, error } = await supabaseAdmin
      .from('access_permissions')
      .select('screen_key, action, allowed')
      .eq('profile_id', user.profile_id)

    if (error) {
      console.error('Erro ao buscar permissões do usuário:', error)
      return res.status(500).json({
        success: false,
        error: { message: error.message, code: 'SUPABASE_ERROR' }
      })
    }

    return res.json({
      success: true,
      data: {
        profileId: profile.id,
        profileName: profile.name,
        isAdmin: false,
        permissions: permissions || []
      }
    })
  } catch (err) {
    return next(err)
  }
})

// =====================================================
// BUSCAR PERFIL POR ID
// =====================================================
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params

    const { data, error } = await supabaseAdmin
      .from('access_profiles')
      .select('*')
      .eq('id', id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({
          success: false,
          error: { message: 'Perfil não encontrado', code: 'NOT_FOUND' }
        })
      }
      console.error('Erro ao buscar perfil:', error)
      return res.status(500).json({
        success: false,
        error: { message: error.message, code: 'SUPABASE_ERROR' }
      })
    }

    return res.json({
      success: true,
      data
    })
  } catch (err) {
    return next(err)
  }
})

// =====================================================
// CRIAR NOVO PERFIL
// =====================================================
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, description } = req.body

    if (!name || name.trim() === '') {
      return res.status(400).json({
        success: false,
        error: { message: 'Nome do perfil é obrigatório', code: 'VALIDATION_ERROR' }
      })
    }

    // Verifica se já existe perfil com este nome
    const { data: existing } = await supabaseAdmin
      .from('access_profiles')
      .select('id')
      .eq('name', name.trim())
      .single()

    if (existing) {
      return res.status(400).json({
        success: false,
        error: { message: 'Já existe um perfil com este nome', code: 'DUPLICATE_NAME' }
      })
    }

    const { data, error } = await supabaseAdmin
      .from('access_profiles')
      .insert({
        name: name.trim(),
        description: description?.trim() || null,
        is_system: false,
        is_active: true
      })
      .select()
      .single()

    if (error) {
      console.error('Erro ao criar perfil:', error)
      return res.status(500).json({
        success: false,
        error: { message: error.message, code: 'SUPABASE_ERROR' }
      })
    }

    return res.status(201).json({
      success: true,
      data
    })
  } catch (err) {
    return next(err)
  }
})

// =====================================================
// ATUALIZAR PERFIL
// =====================================================
router.put('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params
    const { name, description, is_active } = req.body

    // Verifica se o perfil existe e não é de sistema
    const { data: profile } = await supabaseAdmin
      .from('access_profiles')
      .select('is_system')
      .eq('id', id)
      .single()

    if (!profile) {
      return res.status(404).json({
        success: false,
        error: { message: 'Perfil não encontrado', code: 'NOT_FOUND' }
      })
    }

    if (profile.is_system) {
      return res.status(403).json({
        success: false,
        error: { message: 'Perfis de sistema não podem ser editados', code: 'SYSTEM_PROFILE' }
      })
    }

    // Verifica duplicidade de nome
    if (name) {
      const { data: existing } = await supabaseAdmin
        .from('access_profiles')
        .select('id')
        .eq('name', name.trim())
        .neq('id', id)
        .single()

      if (existing) {
        return res.status(400).json({
          success: false,
          error: { message: 'Já existe um perfil com este nome', code: 'DUPLICATE_NAME' }
        })
      }
    }

    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString()
    }
    if (name !== undefined) updateData['name'] = name.trim()
    if (description !== undefined) updateData['description'] = description?.trim() || null
    if (is_active !== undefined) updateData['is_active'] = is_active

    const { data, error } = await supabaseAdmin
      .from('access_profiles')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Erro ao atualizar perfil:', error)
      return res.status(500).json({
        success: false,
        error: { message: error.message, code: 'SUPABASE_ERROR' }
      })
    }

    return res.json({
      success: true,
      data
    })
  } catch (err) {
    return next(err)
  }
})

// =====================================================
// EXCLUIR PERFIL (SOFT DELETE)
// =====================================================
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params

    // Verifica se o perfil existe e não é de sistema
    const { data: profile } = await supabaseAdmin
      .from('access_profiles')
      .select('is_system')
      .eq('id', id)
      .single()

    if (!profile) {
      return res.status(404).json({
        success: false,
        error: { message: 'Perfil não encontrado', code: 'NOT_FOUND' }
      })
    }

    if (profile.is_system) {
      return res.status(403).json({
        success: false,
        error: { message: 'Perfis de sistema não podem ser excluídos', code: 'SYSTEM_PROFILE' }
      })
    }

    // Verifica se há usuários vinculados a este perfil
    const { data: users } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('profile_id', id)
      .limit(1)

    if (users && users.length > 0) {
      return res.status(400).json({
        success: false,
        error: { 
          message: 'Este perfil possui usuários vinculados. Remova os usuários antes de excluir.', 
          code: 'HAS_USERS' 
        }
      })
    }

    // Soft delete - marca como inativo
    const { error } = await supabaseAdmin
      .from('access_profiles')
      .update({ 
        is_active: false,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)

    if (error) {
      console.error('Erro ao excluir perfil:', error)
      return res.status(500).json({
        success: false,
        error: { message: error.message, code: 'SUPABASE_ERROR' }
      })
    }

    return res.json({
      success: true,
      message: 'Perfil excluído com sucesso'
    })
  } catch (err) {
    return next(err)
  }
})

// =====================================================
// CLONAR PERFIL
// =====================================================
router.post('/:id/clone', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params
    const { name } = req.body

    if (!name || name.trim() === '') {
      return res.status(400).json({
        success: false,
        error: { message: 'Nome do novo perfil é obrigatório', code: 'VALIDATION_ERROR' }
      })
    }

    // Busca o perfil original
    const { data: original } = await supabaseAdmin
      .from('access_profiles')
      .select('*')
      .eq('id', id)
      .single()

    if (!original) {
      return res.status(404).json({
        success: false,
        error: { message: 'Perfil original não encontrado', code: 'NOT_FOUND' }
      })
    }

    // Verifica duplicidade de nome
    const { data: existing } = await supabaseAdmin
      .from('access_profiles')
      .select('id')
      .eq('name', name.trim())
      .single()

    if (existing) {
      return res.status(400).json({
        success: false,
        error: { message: 'Já existe um perfil com este nome', code: 'DUPLICATE_NAME' }
      })
    }

    // Cria o novo perfil
    const { data: newProfile, error: createError } = await supabaseAdmin
      .from('access_profiles')
      .insert({
        name: name.trim(),
        description: `Cópia de ${original.name}`,
        is_system: false,
        is_active: true
      })
      .select()
      .single()

    if (createError) {
      console.error('Erro ao criar clone:', createError)
      return res.status(500).json({
        success: false,
        error: { message: createError.message, code: 'SUPABASE_ERROR' }
      })
    }

    // Copia as permissões do perfil original
    const { data: originalPermissions } = await supabaseAdmin
      .from('access_permissions')
      .select('screen_key, action, allowed')
      .eq('profile_id', id)

    if (originalPermissions && originalPermissions.length > 0) {
      const newPermissions = originalPermissions.map(p => ({
        profile_id: newProfile.id,
        screen_key: p.screen_key,
        action: p.action,
        allowed: p.allowed
      }))

      const { error: permError } = await supabaseAdmin
        .from('access_permissions')
        .insert(newPermissions)

      if (permError) {
        console.error('Erro ao copiar permissões:', permError)
        // Não falha a operação, apenas loga
      }
    }

    return res.status(201).json({
      success: true,
      data: newProfile
    })
  } catch (err) {
    return next(err)
  }
})

// =====================================================
// LISTAR PERMISSÕES DO PERFIL
// =====================================================
router.get('/:id/permissions', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params

    // Verifica se o perfil existe
    const { data: profile } = await supabaseAdmin
      .from('access_profiles')
      .select('id, is_system')
      .eq('id', id)
      .single()

    if (!profile) {
      return res.status(404).json({
        success: false,
        error: { message: 'Perfil não encontrado', code: 'NOT_FOUND' }
      })
    }

    // Se for perfil de sistema, retorna indicador especial
    if (profile.is_system) {
      return res.json({
        success: true,
        data: {
          isSystemProfile: true,
          permissions: []
        }
      })
    }

    const { data, error } = await supabaseAdmin
      .from('access_permissions')
      .select('*')
      .eq('profile_id', id)
      .order('screen_key', { ascending: true })
      .order('action', { ascending: true })

    if (error) {
      console.error('Erro ao buscar permissões:', error)
      return res.status(500).json({
        success: false,
        error: { message: error.message, code: 'SUPABASE_ERROR' }
      })
    }

    return res.json({
      success: true,
      data: {
        isSystemProfile: false,
        permissions: data || []
      }
    })
  } catch (err) {
    return next(err)
  }
})

// =====================================================
// ATUALIZAR PERMISSÕES DO PERFIL
// =====================================================
router.put('/:id/permissions', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params
    const { permissions } = req.body

    if (!Array.isArray(permissions)) {
      return res.status(400).json({
        success: false,
        error: { message: 'Permissões devem ser um array', code: 'VALIDATION_ERROR' }
      })
    }

    // Verifica se o perfil existe e não é de sistema
    const { data: profile } = await supabaseAdmin
      .from('access_profiles')
      .select('is_system')
      .eq('id', id)
      .single()

    if (!profile) {
      return res.status(404).json({
        success: false,
        error: { message: 'Perfil não encontrado', code: 'NOT_FOUND' }
      })
    }

    if (profile.is_system) {
      return res.status(403).json({
        success: false,
        error: { message: 'Permissões de perfis de sistema não podem ser editadas', code: 'SYSTEM_PROFILE' }
      })
    }

    // Remove todas as permissões existentes
    const { error: deleteError } = await supabaseAdmin
      .from('access_permissions')
      .delete()
      .eq('profile_id', id)

    if (deleteError) {
      console.error('Erro ao limpar permissões:', deleteError)
      return res.status(500).json({
        success: false,
        error: { message: deleteError.message, code: 'SUPABASE_ERROR' }
      })
    }

    // Insere todas as permissões (incluindo allowed=false para estados desabilitados)
    const permissionsToInsert = permissions
      .map((p: { screen_key: string; action: string; allowed: boolean }) => ({
        profile_id: Number(id),
        screen_key: p.screen_key,
        action: p.action,
        allowed: p.allowed === true
      }))

    if (permissionsToInsert.length > 0) {
      const { error: insertError } = await supabaseAdmin
        .from('access_permissions')
        .insert(permissionsToInsert)

      if (insertError) {
        console.error('Erro ao inserir permissões:', insertError)
        return res.status(500).json({
          success: false,
          error: { message: insertError.message, code: 'SUPABASE_ERROR' }
        })
      }
    }

    // Atualiza timestamp do perfil
    await supabaseAdmin
      .from('access_profiles')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', id)

    return res.json({
      success: true,
      message: 'Permissões atualizadas com sucesso',
      data: { count: permissionsToInsert.length }
    })
  } catch (err) {
    return next(err)
  }
})

export default router
