import { useState, useEffect } from 'react'
import { Bell, Check, CheckCheck, Trash2, ExternalLink } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import Select from 'react-select'
import { useAuthStore } from '@/stores/authStore'
import { useNotificationStore } from '@/stores/notificationStore'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import type { Notification } from '@/types'

interface TypeOption {
  value: string;
  label: string;
}

const NotificationsPage = () => {
  const navigate = useNavigate()
  const { user, isAuthenticated } = useAuthStore()
  const {
    notifications,
    unreadCount,
    isLoading,
    markAsRead,
    markAllAsRead,
    deleteNotification
  } = useNotificationStore()

  const [filter, setFilter] = useState<'all' | 'unread' | 'read'>('all')
  const [selectedTypes, setSelectedTypes] = useState<TypeOption[]>([])

  // O subscribe do authStore no notificationStore já cuida de:
  // - connectSocket() ao autenticar
  // - fetchNotifications() ao autenticar  
  // Não precisamos chamar aqui para evitar duplicação

  const handleNotificationClick = async (notification: Notification) => {
    // Marcar como lida
    if (!notification.is_read) {
      await markAsRead(notification.id)
    }

    // Navegar para o link se existir
    if (notification.link_url) {
      navigate(notification.link_url)
    }
  }

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'success': return '✅'
      case 'warning': return '⚠️'
      case 'error': return '❌'
      default: return 'ℹ️'
    }
  }

  const getNotificationColor = (type: string) => {
    switch (type) {
      case 'success': return 'border-l-green-500'
      case 'warning': return 'border-l-yellow-500'
      case 'error': return 'border-l-red-500'
      default: return 'border-l-blue-500'
    }
  }

  const getNotificationBgColor = (type: string, isRead: boolean) => {
    if (isRead) return 'bg-white dark:bg-gray-800'
    
    switch (type) {
      case 'success': return 'bg-green-50 dark:bg-green-900/10'
      case 'warning': return 'bg-yellow-50 dark:bg-yellow-900/10'
      case 'error': return 'bg-red-50 dark:bg-red-900/10'
      default: return 'bg-blue-50 dark:bg-blue-900/10'
    }
  }

  // Filtrar notificações
  const filteredNotifications = notifications.filter(notification => {
    if (filter === 'unread' && notification.is_read) return false
    if (filter === 'read' && !notification.is_read) return false
    
    // Filtro de tipo (múltipla seleção)
    if (selectedTypes.length > 0) {
      const selectedTypeValues = selectedTypes.map(t => t.value)
      if (!selectedTypeValues.includes(notification.type)) return false
    }
    
    return true
  })

  // Opções de tipo para o filtro
  const typeOptions: TypeOption[] = [
    { value: 'info', label: 'Info' },
    { value: 'success', label: 'Sucesso' },
    { value: 'warning', label: 'Aviso' },
    { value: 'error', label: 'Erro' },
  ]

  // Estatísticas
  const stats = {
    total: notifications.length,
    unread: unreadCount,
    info: notifications.filter((n) => n.type === 'info').length,
    success: notifications.filter((n) => n.type === 'success').length,
    warning: notifications.filter((n) => n.type === 'warning').length,
    error: notifications.filter((n) => n.type === 'error').length,
  }

  return (
    <div className="h-full flex flex-col space-y-2">
      {/* Card de Filtros */}
      <div className="card p-6 pt-3 pb-3">
        <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center">
          {/* Filtro de Status */}
          <div className="w-full lg:w-64">
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value as 'all' | 'unread' | 'read')}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-orange-500 focus:border-transparent"
            >
              <option value="all">Todas as notificações</option>
              <option value="unread">Não lidas</option>
              <option value="read">Lidas</option>
            </select>
          </div>

          {/* Filtro de Tipo */}
          <div className="flex-1 min-w-0">
            <Select
              isMulti
              value={selectedTypes}
              onChange={(selected) => setSelectedTypes(selected as TypeOption[])}
              options={typeOptions}
              placeholder="Filtrar tipo"
              className="react-select-container"
              classNamePrefix="react-select"
            />
          </div>

          {/* Botão Marcar todas como lidas */}
          {unreadCount > 0 && (
            <div className="flex items-end">
              <button
                onClick={() => void markAllAsRead()}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-500 rounded-lg hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
              >
                <CheckCheck className="w-4 h-4" />
                Marcar todas como lidas
              </button>
            </div>
          )}
        </div>

        {/* Cards de Estatísticas */}
        <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {/* Total */}
          <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-2 border border-gray-200 dark:border-gray-600">
            <div className="flex items-center justify-between mb-1">
              <div className="text-xs text-gray-500 dark:text-gray-400">Total</div>
              <Bell className="w-5 h-5 text-gray-500 dark:text-gray-400" />
            </div>
            <div className="text-xl font-bold text-gray-800 dark:text-gray-200">
              {stats.total}
            </div>
          </div>

          {/* Não lidas */}
          <div className="bg-orange-50 dark:bg-orange-900/20 rounded-lg p-2 border border-orange-200 dark:border-orange-800">
            <div className="flex items-center justify-between mb-1">
              <div className="text-xs text-orange-600 dark:text-orange-400">Não lidas</div>
              <Bell className="w-5 h-5 text-orange-600 dark:text-orange-400" />
            </div>
            <div className="text-xl font-bold text-orange-700 dark:text-orange-300">
              {stats.unread}
            </div>
          </div>

          {/* Info */}
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-2 border border-blue-200 dark:border-blue-800">
            <div className="flex items-center justify-between mb-1">
              <div className="text-xs text-blue-600 dark:text-blue-400">Info</div>
              <span className="text-lg">ℹ️</span>
            </div>
            <div className="text-xl font-bold text-blue-700 dark:text-blue-300">
              {stats.info}
            </div>
          </div>

          {/* Sucesso */}
          <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-2 border border-green-200 dark:border-green-800">
            <div className="flex items-center justify-between mb-1">
              <div className="text-xs text-green-600 dark:text-green-400">Sucesso</div>
              <span className="text-lg">✅</span>
            </div>
            <div className="text-xl font-bold text-green-700 dark:text-green-300">
              {stats.success}
            </div>
          </div>

          {/* Aviso */}
          <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-2 border border-yellow-200 dark:border-yellow-800">
            <div className="flex items-center justify-between mb-1">
              <div className="text-xs text-yellow-600 dark:text-yellow-400">Aviso</div>
              <span className="text-lg">⚠️</span>
            </div>
            <div className="text-xl font-bold text-yellow-700 dark:text-yellow-300">
              {stats.warning}
            </div>
          </div>

          {/* Erro */}
          <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-2 border border-red-200 dark:border-red-800">
            <div className="flex items-center justify-between mb-1">
              <div className="text-xs text-red-600 dark:text-red-400">Erro</div>
              <span className="text-lg">❌</span>
            </div>
            <div className="text-xl font-bold text-red-700 dark:text-red-300">
              {stats.error}
            </div>
          </div>
        </div>
      </div>

      {/* Card com Lista de Notificações */}
      <div className="card p-6 pt-3 flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="text-center py-8">
              <p className="text-gray-500 dark:text-gray-400 text-sm">Carregando...</p>
            </div>
          ) : filteredNotifications.length === 0 ? (
          <div className="p-12 text-center">
            <Bell className="w-16 h-16 mx-auto mb-4 text-gray-300 dark:text-gray-600" />
            <p className="text-gray-500 dark:text-gray-400 font-medium text-lg">
              {filter === 'unread' 
                ? 'Nenhuma notificação não lida'
                : filter === 'read'
                ? 'Nenhuma notificação lida'
                : selectedTypes.length > 0
                ? `Nenhuma notificação dos tipos selecionados`
                : 'Nenhuma notificação encontrada'
              }
            </p>
            <p className="text-gray-400 dark:text-gray-500 text-sm mt-2">
              {filter === 'unread' 
                ? 'Você está em dia com todas as suas notificações!'
                : filter === 'read'
                ? 'Você ainda não leu nenhuma notificação.'
                : 'Quando você receber notificações, elas aparecerão aqui.'
              }
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {filteredNotifications.map((notification) => (
              <div
                key={notification.id}
                className={`p-6 border-l-4 ${getNotificationColor(notification.type)} ${getNotificationBgColor(notification.type, notification.is_read)} hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors ${
                  notification.link_url ? 'cursor-pointer' : ''
                }`}
                onClick={() => notification.link_url && void handleNotificationClick(notification)}
              >
                <div className="flex items-start gap-4">
                  {/* Icon */}
                  <span className="text-3xl flex-shrink-0">
                    {getNotificationIcon(notification.type)}
                  </span>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="flex-1">
                        <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2 flex-wrap">
                          {notification.title}
                          {notification.audience === 'all' && (
                            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300">
                              Global
                            </span>
                          )}
                          {!notification.is_read && (
                            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300">
                              Nova
                            </span>
                          )}
                        </h3>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {!notification.is_read && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              void markAsRead(notification.id)
                            }}
                            className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
                            title="Marcar como lida"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            void deleteNotification(notification.id)
                          }}
                          className="p-2 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400 transition-colors"
                          title="Excluir notificação"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    <p className="text-sm text-gray-700 dark:text-gray-300 mb-3 whitespace-pre-line">
                      {notification.message}
                    </p>

                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <span className="text-xs text-gray-500 dark:text-gray-500">
                        {formatDistanceToNow(new Date(notification.created_at), {
                          addSuffix: true,
                          locale: ptBR
                        })}
                      </span>

                      {notification.link_url && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            void handleNotificationClick(notification)
                          }}
                          className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline font-medium"
                        >
                          Ver detalhes
                          <ExternalLink className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default NotificationsPage
