/**
 * Notification Store - WebSocket via Backend (Socket.IO)
 * 
 * Este store gerencia notificações em tempo real usando Socket.IO conectado ao backend.
 * Segue o padrão de segurança baseado em sessões - tokens Supabase nunca expostos.
 * 
 * Arquitetura:
 * - Frontend (Socket.IO Client) → Backend (Socket.IO Server) → Supabase Realtime
 * - Autenticação via sessionId (mesmo padrão REST)
 * 
 * @module stores/notificationStore
 */

import { create } from 'zustand'
import { io, Socket } from 'socket.io-client'
import apiClient from '@/lib/apiClient'
import { useAuthStore } from './authStore'
import type { Notification } from '@/types'

// ==================== TIPOS ====================

interface NotificationState {
  notifications: Notification[]
  unreadCount: number
  isLoading: boolean
  socket: Socket | null
  isConnected: boolean
  
  // Actions
  fetchNotifications: () => Promise<void>
  markAsRead: (id: number) => Promise<void>
  markAllAsRead: () => Promise<void>
  deleteNotification: (id: number) => Promise<void>
  connectSocket: () => void
  disconnectSocket: () => void
}

// ==================== STORE ====================

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  unreadCount: 0,
  isLoading: false,
  socket: null,
  isConnected: false,

  /**
   * Busca notificações via API backend
   */
  fetchNotifications: async () => {
    set({ isLoading: true })
    
    try {
      const response = await apiClient.get<{ 
        notifications: Notification[]
        unreadCount: number 
      }>('/api/notifications')
      
      if (response.success && response.data) {
        set({ 
          notifications: response.data.notifications,
          unreadCount: response.data.unreadCount,
          isLoading: false 
        })
      } else {
        console.error('[NotificationStore] Erro ao buscar notificações:', response.error)
        set({ isLoading: false })
      }
    } catch (error) {
      console.error('[NotificationStore] Erro ao buscar notificações:', error)
      set({ isLoading: false })
    }
  },

  /**
   * Marca uma notificação como lida
   */
  markAsRead: async (id: number) => {
    try {
      const response = await apiClient.patch(`/api/notifications/${id}/read`)
      
      if (response.success) {
        set(state => ({
          notifications: state.notifications.map(n =>
            n.id === id 
              ? { ...n, is_read: true, read_at: new Date().toISOString() } 
              : n
          ),
          unreadCount: Math.max(0, state.unreadCount - 1)
        }))
      } else {
        console.error('[NotificationStore] Erro ao marcar como lida:', response.error)
      }
    } catch (error) {
      console.error('[NotificationStore] Erro ao marcar como lida:', error)
    }
  },

  /**
   * Marca todas as notificações como lidas
   */
  markAllAsRead: async () => {
    try {
      const response = await apiClient.patch('/api/notifications/read-all')
      
      if (response.success) {
        set(state => ({
          notifications: state.notifications.map(n => ({
            ...n,
            is_read: true,
            read_at: new Date().toISOString()
          })),
          unreadCount: 0
        }))
      } else {
        console.error('[NotificationStore] Erro ao marcar todas como lidas:', response.error)
      }
    } catch (error) {
      console.error('[NotificationStore] Erro ao marcar todas como lidas:', error)
    }
  },

  /**
   * Deleta (soft delete) uma notificação
   */
  deleteNotification: async (id: number) => {
    try {
      const notification = get().notifications.find(n => n.id === id)
      
      const response = await apiClient.delete(`/api/notifications/${id}`)
      
      if (response.success) {
        set(state => {
          const wasUnread = notification && !notification.is_read
          
          return {
            notifications: state.notifications.filter(n => n.id !== id),
            unreadCount: wasUnread 
              ? Math.max(0, state.unreadCount - 1) 
              : state.unreadCount
          }
        })
      } else {
        console.error('[NotificationStore] Erro ao deletar:', response.error)
      }
    } catch (error) {
      console.error('[NotificationStore] Erro ao deletar notificação:', error)
    }
  },

  /**
   * Conecta ao WebSocket de notificações via Backend
   */
  connectSocket: () => {
    const existingSocket = get().socket
    if (existingSocket?.connected) {
      console.log('[NotificationStore] Socket já conectado')
      return
    }

    // Obter sessionId do authStore
    const { sessionId, isAuthenticated } = useAuthStore.getState()
    
    if (!isAuthenticated || !sessionId) {
      console.warn('[NotificationStore] Não autenticado - socket não será conectado')
      return
    }

    // URL do backend
    const backendUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000'
    
    console.log('[NotificationStore] Conectando ao WebSocket...')
    
    // Criar conexão Socket.IO com autenticação via sessionId
    const socket = io(backendUrl, {
      auth: {
        sessionId
      },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000
    })

    // Event handlers
    socket.on('connect', () => {
      console.log('[NotificationStore] Socket conectado:', socket.id)
      set({ isConnected: true })
    })

    socket.on('connected', (data: { message: string; userId: string }) => {
      console.log('[NotificationStore]', data.message)
    })

    socket.on('disconnect', (reason) => {
      console.log('[NotificationStore] Socket desconectado:', reason)
      set({ isConnected: false })
    })

    socket.on('connect_error', (error) => {
      console.error('[NotificationStore] Erro de conexão:', error.message)
      set({ isConnected: false })
      
      // Se erro de autenticação, não reconectar automaticamente
      if (error.message.includes('SESSION')) {
        socket.disconnect()
        set({ socket: null })
      }
    })

    // Handler de novas notificações
    socket.on('notification', (notification: Notification) => {
      console.log('[NotificationStore] Nova notificação recebida:', notification.title)
      
      set(state => {
        // Verificar se já existe para evitar duplicação
        const exists = state.notifications.some(n => n.id === notification.id)
        if (exists) {
          console.log('[NotificationStore] Notificação já existe, ignorando duplicata')
          return state
        }
        
        return {
          notifications: [notification, ...state.notifications],
          unreadCount: state.unreadCount + 1
        }
      })
    })

    // Handler de notificações deletadas (sincroniza quando deletado no banco)
    socket.on('notification_deleted', (data: { id: number }) => {
      console.log('[NotificationStore] Notificação deletada do banco:', data.id)
      
      set(state => {
        const notification = state.notifications.find(n => n.id === data.id)
        const wasUnread = notification && !notification.is_read
        
        return {
          notifications: state.notifications.filter(n => n.id !== data.id),
          unreadCount: wasUnread ? Math.max(0, state.unreadCount - 1) : state.unreadCount
        }
      })
    })

    // Ping/pong para manter conexão viva
    socket.on('pong', () => {
      // Conexão ativa
    })

    set({ socket })
  },

  /**
   * Desconecta do WebSocket
   */
  disconnectSocket: () => {
    const { socket } = get()
    
    if (socket) {
      console.log('[NotificationStore] Desconectando socket...')
      socket.disconnect()
      set({ socket: null, isConnected: false })
    }
  }
}))

// ==================== AUTO-CONNECT ====================

/**
 * Escuta mudanças no authStore para auto-conectar/desconectar
 */
useAuthStore.subscribe((state, prevState) => {
  const store = useNotificationStore.getState()
  
  // Se acabou de autenticar
  if (state.isAuthenticated && !prevState.isAuthenticated && state.sessionId) {
    console.log('[NotificationStore] Usuário autenticado - conectando socket')
    store.connectSocket()
    void store.fetchNotifications()
  }
  
  // Se acabou de deslogar
  if (!state.isAuthenticated && prevState.isAuthenticated) {
    console.log('[NotificationStore] Usuário deslogou - desconectando socket')
    store.disconnectSocket()
  }
})

/**
 * Inicialização: Se usuário já está autenticado (sessão persistida),
 * conectar socket e buscar notificações
 */
const initializeIfAuthenticated = () => {
  const { isAuthenticated, sessionId } = useAuthStore.getState()
  
  if (isAuthenticated && sessionId) {
    console.log('[NotificationStore] Usuário já autenticado - inicializando...')
    const store = useNotificationStore.getState()
    store.connectSocket()
    void store.fetchNotifications()
  }
}

// Executar inicialização após um pequeno delay para garantir que o DOM está pronto
setTimeout(initializeIfAuthenticated, 100)
