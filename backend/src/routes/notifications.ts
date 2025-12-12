/**
 * Notifications Routes
 * 
 * Endpoints REST para gerenciamento de notificações.
 * Substitui chamadas diretas ao Supabase do frontend.
 * 
 * @module routes/notifications
 */

import { Router, type Request, type Response, type NextFunction } from 'express'
import { supabaseAdmin } from '../lib/supabaseAdmin'
import { sessionAuth } from '../middleware/sessionAuth'

const router = Router()

// Aplicar autenticação em todas as rotas
router.use(sessionAuth)

// ==================== TIPOS ====================

interface NotificationRecord {
  id: number
  created_at: string
  updated_at: string
  title: string
  message: string
  type_id: number
  type: string
  category: string
  source_id: string | null
  audience: 'all' | 'user'
  auth_user_id: string | null
  link_url: string | null
}

interface NotificationStateRecord {
  id: number
  notification_id: number
  auth_user_id: string
  is_read: boolean
  read_at: string | null
  is_deleted: boolean
  deleted_at: string | null
}

// ==================== ENDPOINTS ====================

/**
 * @swagger
 * /api/notifications:
 *   get:
 *     summary: Lista notificações do usuário
 *     tags: [Notifications]
 *     security:
 *       - sessionAuth: []
 *     responses:
 *       200:
 *         description: Lista de notificações com contador de não lidas
 */
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.session!.userId

    // Buscar notificações pessoais do usuário
    const { data: userNotifications, error: userError } = await supabaseAdmin
      .from('notifications')
      .select('*')
      .eq('auth_user_id', userId)
      .eq('audience', 'user')
      .order('created_at', { ascending: false })
      .limit(100)

    if (userError) {
      console.error('[Notifications] Erro ao buscar notificações pessoais:', userError)
      throw userError
    }

    // Buscar notificações globais (audience = 'all')
    const { data: globalNotifications, error: globalError } = await supabaseAdmin
      .from('notifications')
      .select('*')
      .eq('audience', 'all')
      .order('created_at', { ascending: false })
      .limit(100)

    if (globalError) {
      console.error('[Notifications] Erro ao buscar notificações globais:', globalError)
      throw globalError
    }

    // Combinar todas as notificações
    const allNotifications = [
      ...(userNotifications || []),
      ...(globalNotifications || [])
    ] as NotificationRecord[]

    // Buscar estados das notificações para este usuário
    const notificationIds = allNotifications.map(n => n.id)
    
    let states: NotificationStateRecord[] = []
    if (notificationIds.length > 0) {
      const { data: statesData, error: statesError } = await supabaseAdmin
        .from('notifications_all_users_state')
        .select('*')
        .eq('auth_user_id', userId)
        .in('notification_id', notificationIds)

      if (statesError) {
        console.error('[Notifications] Erro ao buscar estados:', statesError)
        // Não throw - continuar sem estados
      } else {
        states = statesData || []
      }
    }

    // Combinar notificações com estados
    const notifications = allNotifications
      .map(notification => {
        const state = states.find(s => s.notification_id === notification.id)
        return {
          ...notification,
          is_read: state?.is_read || false,
          read_at: state?.read_at || null,
          is_deleted: state?.is_deleted || false
        }
      })
      .filter(n => !n.is_deleted)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

    const unreadCount = notifications.filter(n => !n.is_read).length

    return res.json({
      success: true,
      data: {
        notifications,
        unreadCount
      }
    })
  } catch (error) {
    return next(error)
  }
})

/**
 * @swagger
 * /api/notifications/{id}/read:
 *   patch:
 *     summary: Marca uma notificação como lida
 *     tags: [Notifications]
 *     security:
 *       - sessionAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Notificação marcada como lida
 */
router.patch('/:id/read', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const notificationId = parseInt(req.params['id'] as string)
    const userId = req.session!.userId

    if (isNaN(notificationId)) {
      return res.status(400).json({
        success: false,
        error: { message: 'ID de notificação inválido', code: 'INVALID_ID' }
      })
    }

    const { error } = await supabaseAdmin
      .from('notifications_all_users_state')
      .upsert({
        notification_id: notificationId,
        auth_user_id: userId,
        is_read: true,
        read_at: new Date().toISOString(),
        is_deleted: false
      }, { 
        onConflict: 'notification_id,auth_user_id' 
      })

    if (error) {
      console.error('[Notifications] Erro ao marcar como lida:', error)
      throw error
    }

    return res.json({ success: true })
  } catch (error) {
    return next(error)
  }
})

/**
 * @swagger
 * /api/notifications/read-all:
 *   patch:
 *     summary: Marca todas as notificações como lidas
 *     tags: [Notifications]
 *     security:
 *       - sessionAuth: []
 *     responses:
 *       200:
 *         description: Todas as notificações marcadas como lidas
 */
router.patch('/read-all', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.session!.userId

    // Buscar todas as notificações do usuário (pessoais + globais)
    const { data: userNotifications } = await supabaseAdmin
      .from('notifications')
      .select('id')
      .eq('auth_user_id', userId)
      .eq('audience', 'user')

    const { data: globalNotifications } = await supabaseAdmin
      .from('notifications')
      .select('id')
      .eq('audience', 'all')

    const allIds = [
      ...(userNotifications || []).map(n => n.id),
      ...(globalNotifications || []).map(n => n.id)
    ]

    if (allIds.length > 0) {
      const upserts = allIds.map(id => ({
        notification_id: id,
        auth_user_id: userId,
        is_read: true,
        read_at: new Date().toISOString(),
        is_deleted: false
      }))

      const { error } = await supabaseAdmin
        .from('notifications_all_users_state')
        .upsert(upserts, { 
          onConflict: 'notification_id,auth_user_id' 
        })

      if (error) {
        console.error('[Notifications] Erro ao marcar todas como lidas:', error)
        throw error
      }
    }

    return res.json({ success: true })
  } catch (error) {
    return next(error)
  }
})

/**
 * @swagger
 * /api/notifications/{id}:
 *   delete:
 *     summary: Deleta (soft delete) uma notificação
 *     tags: [Notifications]
 *     security:
 *       - sessionAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Notificação deletada
 */
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const notificationId = parseInt(req.params['id'] as string)
    const userId = req.session!.userId

    if (isNaN(notificationId)) {
      return res.status(400).json({
        success: false,
        error: { message: 'ID de notificação inválido', code: 'INVALID_ID' }
      })
    }

    const { error } = await supabaseAdmin
      .from('notifications_all_users_state')
      .upsert({
        notification_id: notificationId,
        auth_user_id: userId,
        is_deleted: true,
        deleted_at: new Date().toISOString()
      }, { 
        onConflict: 'notification_id,auth_user_id' 
      })

    if (error) {
      console.error('[Notifications] Erro ao deletar notificação:', error)
      throw error
    }

    return res.json({ success: true })
  } catch (error) {
    return next(error)
  }
})

/**
 * @swagger
 * /api/notifications/stats:
 *   get:
 *     summary: Retorna estatísticas de notificações
 *     tags: [Notifications]
 *     security:
 *       - sessionAuth: []
 *     responses:
 *       200:
 *         description: Estatísticas de notificações
 */
router.get('/stats', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.session!.userId

    // Buscar todas as notificações do usuário
    const { data: userNotifications } = await supabaseAdmin
      .from('notifications')
      .select('id, type')
      .eq('auth_user_id', userId)
      .eq('audience', 'user')

    const { data: globalNotifications } = await supabaseAdmin
      .from('notifications')
      .select('id, type')
      .eq('audience', 'all')

    const allNotifications = [
      ...(userNotifications || []),
      ...(globalNotifications || [])
    ]

    // Buscar estados
    const notificationIds = allNotifications.map(n => n.id)
    
    let states: NotificationStateRecord[] = []
    if (notificationIds.length > 0) {
      const { data: statesData } = await supabaseAdmin
        .from('notifications_all_users_state')
        .select('*')
        .eq('auth_user_id', userId)
        .in('notification_id', notificationIds)
      
      states = statesData || []
    }

    // Calcular estatísticas
    const deletedIds = new Set(states.filter(s => s.is_deleted).map(s => s.notification_id))
    const readIds = new Set(states.filter(s => s.is_read).map(s => s.notification_id))

    const activeNotifications = allNotifications.filter(n => !deletedIds.has(n.id))
    
    const stats = {
      total: activeNotifications.length,
      unread: activeNotifications.filter(n => !readIds.has(n.id)).length,
      info: activeNotifications.filter(n => n.type === 'info').length,
      success: activeNotifications.filter(n => n.type === 'success').length,
      warning: activeNotifications.filter(n => n.type === 'warning').length,
      error: activeNotifications.filter(n => n.type === 'error').length
    }

    return res.json({
      success: true,
      data: stats
    })
  } catch (error) {
    return next(error)
  }
})

export default router
