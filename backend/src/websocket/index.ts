/**
 * Notifications WebSocket - Index
 * 
 * Re-exporta módulos do serviço de WebSocket de notificações.
 * 
 * @module websocket
 */

export { socketAuthMiddleware, type AuthenticatedSocket } from './socketAuth'
export { 
  initializeNotificationSocket, 
  shutdownNotificationSocket,
  sendToUser,
  broadcastToAll,
  getConnectionStats
} from './notificationSocket'
