/**
 * JWT Auth Middleware - Autenticação com token próprio do Backend
 * 
 * Este middleware valida JWTs gerados pelo próprio backend (não do Supabase).
 * O token do Supabase fica armazenado no SessionStore e nunca é exposto ao frontend.
 * 
 * Fluxo:
 * 1. Frontend envia: Authorization: Bearer {backendToken}
 * 2. Middleware valida o backendToken com JWT_SECRET
 * 3. Recupera sessão Supabase do SessionStore pelo userId
 * 4. Renova sessão Supabase se necessário
 * 5. Injeta req.jwtUser para uso nas rotas
 */

import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { refreshSessionIfNeeded, StoredSession } from '../lib/sessionStore'

// Chave secreta para assinar/verificar JWTs do backend
const JWT_SECRET = process.env['JWT_SECRET'] || 'your-super-secret-jwt-key-change-in-production'

/**
 * Payload do JWT do Backend
 */
export interface JwtPayload {
  userId: string
  email: string
  role: string
  name: string
  iat?: number
  exp?: number
}

/**
 * Extensão do Request do Express para incluir dados do usuário autenticado
 */
declare global {
  namespace Express {
    interface Request {
      jwtUser?: JwtPayload
      supabaseSession?: StoredSession
    }
  }
}

/**
 * Middleware que valida o JWT do Backend e recupera sessão Supabase
 * 
 * @param req - Request do Express
 * @param res - Response do Express  
 * @param next - Função next do Express
 */
export const jwtAuth = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization

    // Verifica se o header Authorization está presente
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        success: false,
        error: { 
          message: 'Token de autenticação não fornecido', 
          code: 'MISSING_TOKEN' 
        },
      })
      return
    }

    // Extrai o token do header
    const token = authHeader.replace('Bearer ', '')

    try {
      // Valida o JWT do Backend
      const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload
      
      // Recupera a sessão Supabase do store
      const session = await refreshSessionIfNeeded(decoded.userId)
      
      if (!session) {
        // Sessão Supabase não encontrada ou expirada e não renovável
        res.status(401).json({
          success: false,
          error: { 
            message: 'Sessão expirada. Faça login novamente.', 
            code: 'SESSION_EXPIRED' 
          },
        })
        return
      }
      
      // Injeta dados do usuário e sessão no request
      req.jwtUser = decoded
      req.supabaseSession = session
      
      next()
    } catch (jwtError) {
      // Erro na validação do JWT
      if (jwtError instanceof jwt.TokenExpiredError) {
        res.status(401).json({
          success: false,
          error: { 
            message: 'Token expirado. Use o refresh token para obter um novo.', 
            code: 'TOKEN_EXPIRED' 
          },
        })
        return
      }
      
      if (jwtError instanceof jwt.JsonWebTokenError) {
        res.status(401).json({
          success: false,
          error: { 
            message: 'Token inválido', 
            code: 'INVALID_TOKEN' 
          },
        })
        return
      }
      
      throw jwtError
    }
  } catch (error) {
    console.error('[jwtAuth] Erro no middleware:', error)
    res.status(500).json({
      success: false,
      error: { 
        message: 'Erro interno ao validar autenticação', 
        code: 'AUTH_ERROR' 
      },
    })
  }
}

/**
 * Middleware opcional - permite acesso mesmo sem autenticação
 * Útil para rotas que têm comportamento diferente para usuários autenticados
 */
export const jwtAuthOptional = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization

    // Se não tem header, continua sem autenticar
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      next()
      return
    }

    const token = authHeader.replace('Bearer ', '')

    try {
      const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload
      const session = await refreshSessionIfNeeded(decoded.userId)
      
      if (session) {
        req.jwtUser = decoded
        req.supabaseSession = session
      }
    } catch {
      // Ignora erros de JWT - usuário não autenticado
    }
    
    next()
  } catch (error) {
    console.error('[jwtAuthOptional] Erro no middleware:', error)
    next()
  }
}

// ==================== FUNÇÕES AUXILIARES ====================

/**
 * Gera um Access Token JWT do Backend
 * 
 * @param payload - Dados do usuário para incluir no token
 * @param expiresIn - Tempo de expiração (default: 15 minutos)
 * @returns Token JWT assinado
 */
export const generateAccessToken = (
  payload: Omit<JwtPayload, 'iat' | 'exp'>,
  expiresIn: string = '15m'
): string => {
  return jwt.sign(payload, JWT_SECRET, { expiresIn } as jwt.SignOptions)
}

/**
 * Gera um Refresh Token JWT do Backend
 * 
 * @param payload - Dados mínimos para o refresh token
 * @param expiresIn - Tempo de expiração (default: 7 dias)
 * @returns Token JWT assinado
 */
export const generateRefreshToken = (
  payload: { userId: string },
  expiresIn: string = '7d'
): string => {
  return jwt.sign(payload, JWT_SECRET, { expiresIn } as jwt.SignOptions)
}

/**
 * Verifica e decodifica um token JWT
 * 
 * @param token - Token JWT para verificar
 * @returns Payload decodificado ou null se inválido
 */
export const verifyToken = (token: string): JwtPayload | null => {
  try {
    return jwt.verify(token, JWT_SECRET) as JwtPayload
  } catch {
    return null
  }
}

/**
 * Extrai o JWT_SECRET (para uso em testes ou configuração)
 */
export const getJwtSecret = (): string => JWT_SECRET
