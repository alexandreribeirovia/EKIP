/**
 * Socket.IO Authentication Middleware
 * 
 * Valida sessões via sessionId no handshake do WebSocket.
 * Segue o mesmo padrão de segurança do sessionAuth.ts para HTTP.
 * 
 * @module websocket/socketAuth
 */

import type { Socket } from 'socket.io'
import { getSessionById, type StoredSession } from '../lib/sessionStore'

// Estende o tipo Socket para incluir dados da sessão autenticada
export interface AuthenticatedSocket extends Socket {
  sessionId: string
  userId: string
  email: string
  session: StoredSession
}

/**
 * Middleware de autenticação para Socket.IO
 * 
 * Valida o sessionId enviado no handshake e injeta dados da sessão no socket.
 * 
 * @param socket - Socket sendo conectado
 * @param next - Callback para continuar ou rejeitar conexão
 */
export const socketAuthMiddleware = async (
  socket: Socket,
  next: (err?: Error) => void
): Promise<void> => {
  try {
    // Extrair sessionId do handshake
    const sessionId = socket.handshake.auth['sessionId'] as string
      || socket.handshake.query['sessionId'] as string
      || socket.handshake.headers['x-session-id'] as string

    if (!sessionId) {
      console.warn('[Socket.IO] Conexão rejeitada: sessionId não fornecido')
      return next(new Error('SESSION_MISSING'))
    }

    // Validar formato UUID
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(sessionId)) {
      console.warn('[Socket.IO] Conexão rejeitada: sessionId inválido')
      return next(new Error('SESSION_INVALID_FORMAT'))
    }

    // Buscar sessão no banco
    const session = await getSessionById(sessionId)

    if (!session) {
      console.warn(`[Socket.IO] Conexão rejeitada: sessão não encontrada - ${sessionId}`)
      return next(new Error('SESSION_INVALID'))
    }

    if (!session.isValid) {
      console.warn(`[Socket.IO] Conexão rejeitada: sessão invalidada - ${sessionId}`)
      return next(new Error('SESSION_INVALID'))
    }

    // Verificar expiração
    const now = Math.floor(Date.now() / 1000)
    if (session.expiresAt <= now) {
      console.warn(`[Socket.IO] Conexão rejeitada: sessão expirada - ${sessionId}`)
      return next(new Error('SESSION_EXPIRED'))
    }

    // Injetar dados no socket
    const authSocket = socket as AuthenticatedSocket
    authSocket.sessionId = sessionId
    authSocket.userId = session.userId
    authSocket.email = session.email
    authSocket.session = session

    console.log(`[Socket.IO] Usuário autenticado: ${session.email} (${session.userId})`)

    next()
  } catch (error) {
    console.error('[Socket.IO] Erro na autenticação:', error)
    next(new Error('SESSION_ERROR'))
  }
}
