/**
 * Notification Socket Service
 * 
 * Gerencia conexões WebSocket para notificações em tempo real.
 * Escuta Supabase Realtime server-side e emite para clientes autenticados.
 * 
 * Arquitetura:
 * - Supabase Realtime → Backend (server-side) → Socket.IO → Frontend
 * - Tokens Supabase nunca expostos ao frontend
 * - Autenticação via sessionId (mesmo padrão REST)
 * 
 * @module websocket/notificationSocket
 */

import type { Server as SocketIOServer } from 'socket.io'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { getSupabaseAdmin } from '../lib/supabaseAdmin'
import type { AuthenticatedSocket } from './socketAuth'

// ==================== TIPOS ====================

interface NotificationPayload {
  id: number
  created_at: string
  updated_at: string
  title: string
  message: string
  type_id: number
  type: 'info' | 'success' | 'warning' | 'error'
  category: string
  source_id: string | null
  audience: 'all' | 'user'
  auth_user_id: string | null
  link_url: string | null
}

interface NotificationWithState extends NotificationPayload {
  is_read: boolean
  read_at: string | null
  is_deleted: boolean
}

// ==================== STATE ====================

// Mapa de userId → Set de sockets conectados
const userSockets = new Map<string, Set<AuthenticatedSocket>>()

// Canal Supabase Realtime (server-side)
let realtimeChannel: RealtimeChannel | null = null

// Referência ao servidor Socket.IO
let io: SocketIOServer | null = null

// ==================== FUNÇÕES PÚBLICAS ====================

/**
 * Inicializa o serviço de notificações WebSocket
 * 
 * @param socketServer - Instância do Socket.IO Server
 */
export const initializeNotificationSocket = (socketServer: SocketIOServer): void => {
  io = socketServer

  // Handler de conexão
  io.on('connection', (socket) => {
    const authSocket = socket as AuthenticatedSocket
    
    console.log(`[NotificationSocket] Usuário conectado: ${authSocket.email}`)

    // Registrar socket no mapa de usuários
    registerSocket(authSocket)

    // Entrar na sala do usuário
    authSocket.join(`user:${authSocket.userId}`)

    // Enviar confirmação de conexão
    authSocket.emit('connected', {
      message: 'Conectado ao serviço de notificações',
      userId: authSocket.userId
    })

    // Handler de desconexão
    authSocket.on('disconnect', (reason) => {
      console.log(`[NotificationSocket] Usuário desconectado: ${authSocket.email} (${reason})`)
      unregisterSocket(authSocket)
    })

    // Handler de erros
    authSocket.on('error', (error) => {
      console.error(`[NotificationSocket] Erro no socket: ${authSocket.email}`, error)
    })

    // Ping/pong para manter conexão viva
    authSocket.on('ping', () => {
      authSocket.emit('pong')
    })
  })

  // Inicializar canal Supabase Realtime (server-side)
  initializeRealtimeChannel()

  console.log('[NotificationSocket] Serviço de notificações inicializado')
}

/**
 * Encerra o serviço de notificações
 */
export const shutdownNotificationSocket = (): void => {
  if (realtimeChannel) {
    getSupabaseAdmin().removeChannel(realtimeChannel)
    realtimeChannel = null
  }
  userSockets.clear()
  io = null
  console.log('[NotificationSocket] Serviço de notificações encerrado')
}

/**
 * Envia notificação para um usuário específico
 * 
 * @param userId - ID do usuário
 * @param notification - Dados da notificação
 */
export const sendToUser = (userId: string, notification: NotificationWithState): void => {
  if (!io) {
    console.warn('[NotificationSocket] Servidor Socket.IO não inicializado')
    return
  }

  io.to(`user:${userId}`).emit('notification', notification)
  console.log(`[NotificationSocket] Notificação enviada para user:${userId}`)
}

/**
 * Envia notificação para todos os usuários conectados (broadcast)
 * 
 * @param notification - Dados da notificação
 */
export const broadcastToAll = (notification: NotificationWithState): void => {
  if (!io) {
    console.warn('[NotificationSocket] Servidor Socket.IO não inicializado')
    return
  }

  io.emit('notification', notification)
  console.log('[NotificationSocket] Notificação broadcast para todos os usuários')
}

/**
 * Retorna estatísticas de conexões
 */
export const getConnectionStats = (): { 
  totalUsers: number
  totalSockets: number 
} => {
  let totalSockets = 0
  userSockets.forEach((sockets) => {
    totalSockets += sockets.size
  })
  
  return {
    totalUsers: userSockets.size,
    totalSockets
  }
}

// ==================== FUNÇÕES INTERNAS ====================

/**
 * Registra socket no mapa de usuários
 */
const registerSocket = (socket: AuthenticatedSocket): void => {
  const { userId } = socket

  if (!userSockets.has(userId)) {
    userSockets.set(userId, new Set())
  }
  
  userSockets.get(userId)!.add(socket)
  
  const count = userSockets.get(userId)!.size
  console.log(`[NotificationSocket] Socket registrado. User ${userId} tem ${count} conexão(ões)`)
}

/**
 * Remove socket do mapa de usuários
 */
const unregisterSocket = (socket: AuthenticatedSocket): void => {
  const { userId } = socket

  if (userSockets.has(userId)) {
    userSockets.get(userId)!.delete(socket)
    
    // Remover entrada se não houver mais sockets
    if (userSockets.get(userId)!.size === 0) {
      userSockets.delete(userId)
    }
  }
}

/**
 * Inicializa canal Supabase Realtime para escutar novas notificações
 * 
 * Este canal roda server-side com supabaseAdmin (service_role),
 * garantindo que tokens nunca são expostos ao frontend.
 */
const initializeRealtimeChannel = (): void => {
  // Remover canal anterior se existir
  if (realtimeChannel) {
    getSupabaseAdmin().removeChannel(realtimeChannel)
  }

  realtimeChannel = getSupabaseAdmin()
    .channel('notifications-server')
    // Escutar INSERT
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications'
      },
      async (payload: { new: Record<string, unknown> }) => {
        try {
          const notification = payload.new as unknown as NotificationPayload

          console.log(`[NotificationSocket] Nova notificação recebida: ${notification.id} - ${notification.title}`)

          // Preparar notificação com estado inicial
          const notificationWithState: NotificationWithState = {
            ...notification,
            is_read: false,
            read_at: null,
            is_deleted: false
          }

          // Rotear baseado no audience
          if (notification.audience === 'user' && notification.auth_user_id) {
            // Notificação pessoal
            sendToUser(notification.auth_user_id, notificationWithState)
          } else if (notification.audience === 'all') {
            // Notificação global (broadcast)
            broadcastToAll(notificationWithState)
          }
        } catch (error) {
          console.error('[NotificationSocket] Erro ao processar notificação:', error)
        }
      }
    )
    // Escutar DELETE para sincronizar remoções do banco
    .on(
      'postgres_changes',
      {
        event: 'DELETE',
        schema: 'public',
        table: 'notifications'
      },
      (payload: { old: Record<string, unknown> }) => {
        try {
          const deletedNotification = payload.old as unknown as { id: number; auth_user_id?: string; audience?: string }
          
          console.log(`[NotificationSocket] Notificação deletada: ${deletedNotification.id}`)

          // Broadcast evento de remoção para todos (o frontend filtrará)
          if (io) {
            io.emit('notification_deleted', { id: deletedNotification.id })
          }
        } catch (error) {
          console.error('[NotificationSocket] Erro ao processar remoção:', error)
        }
      }
    )
    .subscribe((status: string) => {
      console.log(`[NotificationSocket] Supabase Realtime status: ${status}`)
      
      if (status === 'CHANNEL_ERROR') {
        console.error('[NotificationSocket] Erro no canal Supabase. Reconectando em 5s...')
        setTimeout(() => {
          initializeRealtimeChannel()
        }, 5000)
      }
    })
}
