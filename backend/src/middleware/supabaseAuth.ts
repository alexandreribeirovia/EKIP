import { Request, Response, NextFunction } from 'express'
import { createClient, SupabaseClient } from '@supabase/supabase-js'

// Estendendo a interface Request para incluir o usuário autenticado
declare global {
  namespace Express {
    interface Request {
      user?: any
      supabase?: SupabaseClient
    }
  }
}

/**
 * Middleware que valida o JWT do Supabase e recupera o usuário
 * Adiciona o usuário autenticado ao request para uso nas rotas
 */
export const supabaseAuth = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Extrair o token do header Authorization
    const authHeader = req.headers.authorization
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        success: false,
        error: { message: 'Token de autenticação não fornecido', code: 'UNAUTHORIZED' },
      })
      return
    }

    const token = authHeader.replace('Bearer ', '')

    // Validar variáveis de ambiente
    const supabaseUrl = process.env['SUPABASE_URL']
    const supabaseServiceKey = process.env['SUPABASE_SERVICE_ROLE_KEY']

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Missing Supabase environment variables')
      res.status(500).json({
        success: false,
        error: { message: 'Erro de configuração do servidor', code: 'SERVER_ERROR' },
      })
      return
    }

    // Criar client Supabase com o service role para validar o token
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

    // Validar o token e obter o usuário
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token)

    if (error || !user) {
      console.error('Invalid token:', error?.message)
      res.status(401).json({
        success: false,
        error: { message: 'Token inválido ou expirado', code: 'INVALID_TOKEN' },
      })
      return
    }

    // Criar um client Supabase específico para este usuário (respeitando RLS)
    const userSupabase = createClient(supabaseUrl, supabaseServiceKey, {
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    })

    // Adicionar usuário e client ao request
    req.user = user
    req.supabase = userSupabase

    next()
  } catch (error: any) {
    console.error('Auth middleware error:', error)
    res.status(500).json({
      success: false,
      error: { message: 'Erro ao validar autenticação', code: 'SERVER_ERROR' },
    })
  }
}

/**
 * Middleware opcional - permite acesso sem autenticação mas adiciona o usuário se presente
 */
export const optionalAuth = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      // Sem token, mas permite continuar
      next()
      return
    }

    const token = authHeader.replace('Bearer ', '')
    const supabaseUrl = process.env['SUPABASE_URL']
    const supabaseServiceKey = process.env['SUPABASE_SERVICE_ROLE_KEY']

    if (!supabaseUrl || !supabaseServiceKey) {
      next()
      return
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token)

    if (!error && user) {
      const userSupabase = createClient(supabaseUrl, supabaseServiceKey, {
        global: {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      })

      req.user = user
      req.supabase = userSupabase
    }

    next()
  } catch (error) {
    // Em caso de erro, permite continuar sem autenticação
    next()
  }
}

/**
 * Helper para criar um client Supabase autenticado no backend
 * Usar nas rotas quando precisar acessar o Supabase com RLS
 */
export const getAuthenticatedSupabaseClient = (token: string): SupabaseClient => {
  const supabaseUrl = process.env['SUPABASE_URL']
  const supabaseServiceKey = process.env['SUPABASE_SERVICE_ROLE_KEY']

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing Supabase environment variables')
  }

  return createClient(supabaseUrl, supabaseServiceKey, {
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  })
}
