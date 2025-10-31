import { create } from 'zustand'
import { supabase } from '@/lib/supabaseClient'
import type { RealtimeChannel } from '@supabase/supabase-js'
import type { Notification } from '@/types'

interface NotificationState {
  notifications: Notification[]
  unreadCount: number
  isLoading: boolean
  realtimeChannel: RealtimeChannel | null
  
  // Actions
  fetchNotifications: () => Promise<void>
  markAsRead: (id: number) => Promise<void>
  markAllAsRead: () => Promise<void>
  deleteNotification: (id: number) => Promise<void>
  subscribeToNotifications: (userId: string) => void
  unsubscribeFromNotifications: () => void
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  unreadCount: 0,
  isLoading: false,
  realtimeChannel: null,

  fetchNotifications: async () => {
    set({ isLoading: true })
    
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        set({ isLoading: false })
        return
      }

      // 1. Buscar TODAS as notificações (user + all) relevantes para o usuário
      const { data: userNotifications, error: userError } = await supabase
        .from('notifications')
        .select('*')
        .eq('auth_user_id', user.id)
        .eq('audience', 'user')
        .order('created_at', { ascending: false })
        .limit(50)

      if (userError) {
        console.error('Erro ao buscar notificações do usuário:', userError)
      }

      const { data: allNotifications, error: allError } = await supabase
        .from('notifications')
        .select('*')
        .eq('audience', 'all')
        .order('created_at', { ascending: false })
        .limit(50)

      if (allError) {
        console.error('Erro ao buscar notificações globais:', allError)
      }

      // 2. Buscar estados de TODAS as notificações (user + all) da tabela auxiliar
      const allNotificationIds = [
        ...(userNotifications || []).map(n => n.id),
        ...(allNotifications || []).map(n => n.id)
      ]
      
      let states: any[] = []
      
      if (allNotificationIds.length > 0) {
        const { data: statesData, error: statesError } = await supabase
          .from('notifications_all_users_state')
          .select('*')
          .eq('auth_user_id', user.id)
          .in('notification_id', allNotificationIds)

        if (statesError) {
          console.error('Erro ao buscar estados das notificações:', statesError)
        } else {
          states = statesData || []
        }
      }

      // 3. Mapear estados para TODAS as notificações
      const allNotificationsWithState = [
        ...(userNotifications || []),
        ...(allNotifications || [])
      ]
        .map(notification => {
          const state = states.find(s => s.notification_id === notification.id)
          return {
            ...notification,
            is_read: state?.is_read || false,
            read_at: state?.read_at || null,
            is_deleted: state?.is_deleted || false
          }
        })
        .filter(n => !n.is_deleted) // Filtrar notificações marcadas como deletadas
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

      const unreadCount = allNotificationsWithState.filter(n => !n.is_read).length

      set({ 
        notifications: allNotificationsWithState, 
        unreadCount,
        isLoading: false 
      })
    } catch (error) {
      console.error('Erro ao buscar notificações:', error)
      set({ isLoading: false })
    }
  },

  markAsRead: async (id: number) => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Sempre usar tabela auxiliar para TODAS as notificações
      const { error } = await supabase
        .from('notifications_all_users_state')
        .upsert({
          notification_id: id,
          auth_user_id: user.id,
          is_read: true,
          read_at: new Date().toISOString(),
          is_deleted: false
        }, {
          onConflict: 'notification_id,auth_user_id'
        })

      if (error) {
        console.error('Erro ao marcar notificação como lida:', error)
        return
      }

      // Atualizar estado local
      set(state => ({
        notifications: state.notifications.map(n =>
          n.id === id ? { ...n, is_read: true, read_at: new Date().toISOString() } : n
        ),
        unreadCount: Math.max(0, state.unreadCount - 1)
      }))
    } catch (error) {
      console.error('Erro ao marcar como lida:', error)
    }
  },

  markAllAsRead: async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const notifications = get().notifications.filter(n => !n.is_read)
      
      if (notifications.length === 0) return

      // Criar/atualizar estados para TODAS as notificações não lidas na tabela auxiliar
      const upsertData = notifications.map(n => ({
        notification_id: n.id,
        auth_user_id: user.id,
        is_read: true,
        read_at: new Date().toISOString(),
        is_deleted: false
      }))

      const { error } = await supabase
        .from('notifications_all_users_state')
        .upsert(upsertData, {
          onConflict: 'notification_id,auth_user_id'
        })

      if (error) {
        console.error('Erro ao marcar todas notificações como lidas:', error)
        return
      }

      // Atualizar estado local
      set(state => ({
        notifications: state.notifications.map(n => ({
          ...n,
          is_read: true,
          read_at: new Date().toISOString()
        })),
        unreadCount: 0
      }))
    } catch (error) {
      console.error('Erro ao marcar todas como lidas:', error)
    }
  },

  deleteNotification: async (id: number) => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const notification = get().notifications.find(n => n.id === id)
      if (!notification) return

      // Sempre marcar como deletada na tabela auxiliar (nunca delete físico)
      const { error } = await supabase
        .from('notifications_all_users_state')
        .upsert({
          notification_id: id,
          auth_user_id: user.id,
          is_read: notification.is_read,
          read_at: notification.read_at,
          is_deleted: true,
          deleted_at: new Date().toISOString()
        }, {
          onConflict: 'notification_id,auth_user_id'
        })

      if (error) {
        console.error('Erro ao marcar notificação como deletada:', error)
        return
      }

      // Atualizar estado local (remover da lista visualmente)
      set(state => {
        const wasUnread = notification && !notification.is_read
        
        return {
          notifications: state.notifications.filter(n => n.id !== id),
          unreadCount: wasUnread ? Math.max(0, state.unreadCount - 1) : state.unreadCount
        }
      })
    } catch (error) {
      console.error('Erro ao deletar notificação:', error)
    }
  },

  subscribeToNotifications: (userId: string) => {
    // Limpar canal anterior se existir
    const existingChannel = get().realtimeChannel
    if (existingChannel) {
      supabase.removeChannel(existingChannel)
    }

    // O Supabase automaticamente inclui o JWT token da sessão atual
    // quando você usa .subscribe() após autenticação
    // O token é enviado em mensagens Phoenix dentro do WebSocket, não nos headers HTTP
    const channel = supabase
      .channel(`notifications:${userId}`, {
        config: {
          broadcast: { self: false },
          presence: { key: userId }
        }
      })
      // Escutar TODAS as notificações relevantes para o usuário
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `auth_user_id=eq.${userId}`
        },
        (payload) => {
          // Notificações pessoais: adicionar com estado inicial (não lida, não deletada)
          const newNotification = {
            ...payload.new,
            is_read: false,
            read_at: null,
            is_deleted: false
          } as Notification

          set(state => ({
            notifications: [newNotification, ...state.notifications],
            unreadCount: state.unreadCount + 1
          }))

          // Som de notificação (opcional)
          try {
            const audio = new Audio('/notification.mp3')
            audio.volume = 0.3
            audio.play().catch(() => {
              // Ignorar erro de som
            })
          } catch (error) {
            // Ignorar erro de som
          }
        }
      )
      // Escutar notificações globais (audience = 'all')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: 'audience=eq.all'
        },
        (payload) => {
          // Notificações globais: adicionar com estado inicial (não lida, não deletada)
          const newNotification = {
            ...payload.new,
            is_read: false,
            read_at: null,
            is_deleted: false
          } as Notification

          set(state => ({
            notifications: [newNotification, ...state.notifications],
            unreadCount: state.unreadCount + 1
          }))

          // Som de notificação (opcional)
          try {
            const audio = new Audio('/notification.mp3')
            audio.volume = 0.3
            audio.play().catch(() => {
              // Ignorar erro de som
            })
          } catch (error) {
            // Ignorar erro de som
          }
        }
      )
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR') {
          // Tentar reconectar após 5 segundos
          setTimeout(() => {
            get().unsubscribeFromNotifications()
            get().subscribeToNotifications(userId)
          }, 5000)
        }
        
        if (status === 'TIMED_OUT') {
          get().unsubscribeFromNotifications()
          get().subscribeToNotifications(userId)
        }
      })

    set({ realtimeChannel: channel })
  },

  unsubscribeFromNotifications: () => {
    const { realtimeChannel } = get()
    if (realtimeChannel) {
      supabase.removeChannel(realtimeChannel)
      set({ realtimeChannel: null })
    }
  }
}))
