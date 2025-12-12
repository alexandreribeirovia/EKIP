/**
 * Middleware de Autenticação por Sessão
 * 
 * Valida o sessionId enviado no header e injeta o cliente Supabase
 * autenticado no request para uso nas rotas.
 * 
 * @module middleware/sessionAuth
 */

import { Request, Response, NextFunction } from 'express'
import { refreshSessionIfNeeded } from '../lib/sessionStore'
import { createUserClient, SupabaseClient } from '../lib/supabaseUserClient'

// Extensão do tipo Request para incluir dados da sessão
declare global {
  namespace Express {
    interface Request {
      /**
       * ID da sessão atual
       */
      sessionId?: string
      
      /**
       * Dados da sessão (sem tokens)
       */
      session?: {
        userId: string
        email: string
        expiresAt: number
      }
      
      /**
       * Cliente Supabase autenticado com o JWT do usuário
       * Use este cliente para queries que devem aplicar RLS
       */
      supabaseUser?: SupabaseClient
      
      /**
       * Token de acesso do Supabase (descriptografado)
       * Disponível caso seja necessário para operações especiais
       */
      supabaseToken?: string
    }
  }
}

/**
 * Extrai o session ID do request
 * Suporta: Header X-Session-Id, Cookie session_id, ou Authorization Bearer
 */
function extractSessionId(req: Request): string | null {
  // 1. Tentar header X-Session-Id
  const headerSessionId = req.headers['x-session-id']
  if (headerSessionId && typeof headerSessionId === 'string') {
    return headerSessionId
  }
  
  // 2. Tentar cookie session_id
  const cookieSessionId = req.cookies?.['session_id']
  if (cookieSessionId) {
    return cookieSessionId
  }
  
  // 3. Tentar Authorization Bearer (para compatibilidade)
  const authHeader = req.headers.authorization
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.substring(7)
    // Se for um UUID, é um sessionId
    if (isUUID(token)) {
      return token
    }
  }
  
  return null
}

/**
 * Verifica se uma string é um UUID válido
 */
function isUUID(str: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
  return uuidRegex.test(str)
}

/**
 * Middleware de autenticação por sessão
 * 
 * Valida o sessionId e injeta:
 * - req.sessionId: ID da sessão
 * - req.session: Dados básicos da sessão
 * - req.supabaseUser: Cliente Supabase com JWT do usuário
 * - req.supabaseToken: Token de acesso (descriptografado)
 * 
 * @example
 * // Na rota:
 * router.get('/data', sessionAuth, async (req, res) => {
 *   const { data } = await req.supabaseUser!.from('table').select('*')
 *   res.json({ success: true, data })
 * })
 */
export const sessionAuth = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Extrair sessionId
    const sessionId = extractSessionId(req)
    
    if (!sessionId) {
      res.status(401).json({
        success: false,
        error: {
          message: 'Sessão não fornecida',
          code: 'SESSION_MISSING'
        }
      })
      return
    }
    
    // Validar formato UUID
    if (!isUUID(sessionId)) {
      res.status(401).json({
        success: false,
        error: {
          message: 'Formato de sessão inválido',
          code: 'SESSION_INVALID_FORMAT'
        }
      })
      return
    }
    
    // Buscar sessão (com refresh automático se necessário)
    const session = await refreshSessionIfNeeded(sessionId)
    
    if (!session) {
      res.status(401).json({
        success: false,
        error: {
          message: 'Sessão inválida ou expirada',
          code: 'SESSION_INVALID'
        }
      })
      return
    }
    
    // Criar cliente Supabase com o token do usuário
    const supabaseClient = createUserClient(session.supabaseAccessToken)
    
    // Injetar dados no request
    req.sessionId = sessionId
    req.session = {
      userId: session.userId,
      email: session.email,
      expiresAt: session.expiresAt
    }
    req.supabaseUser = supabaseClient
    req.supabaseToken = session.supabaseAccessToken
    
    next()
  } catch (error) {
    console.error('[sessionAuth] Erro ao validar sessão:', error)
    res.status(500).json({
      success: false,
      error: {
        message: 'Erro interno ao validar sessão',
        code: 'SESSION_ERROR'
      }
    })
  }
}

/**
 * Middleware opcional de autenticação
 * 
 * Igual ao sessionAuth, mas não retorna erro se não houver sessão.
 * Útil para rotas que funcionam com ou sem autenticação.
 */
export const optionalSessionAuth = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const sessionId = extractSessionId(req)
    
    if (sessionId && isUUID(sessionId)) {
      const session = await refreshSessionIfNeeded(sessionId)
      
      if (session) {
        req.sessionId = sessionId
        req.session = {
          userId: session.userId,
          email: session.email,
          expiresAt: session.expiresAt
        }
        req.supabaseUser = createUserClient(session.supabaseAccessToken)
        req.supabaseToken = session.supabaseAccessToken
      }
    }
    
    next()
  } catch (error) {
    console.error('[optionalSessionAuth] Erro:', error)
    // Continua sem autenticação
    next()
  }
}

/**
 * Middleware que requer uma role específica
 * Deve ser usado após sessionAuth
 * 
 * @example
 * router.get('/admin', sessionAuth, requireRole('admin'), handler)
 */
export const requireRole = (_role: string) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (!req.session) {
      res.status(401).json({
        success: false,
        error: {
          message: 'Não autenticado',
          code: 'UNAUTHORIZED'
        }
      })
      return
    }
    
    // TODO: Implementar verificação de role quando necessário
    // Por enquanto, apenas verifica se está autenticado
    
    next()
  }
}

export default sessionAuth
