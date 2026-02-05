import { Router, Request, Response, NextFunction } from 'express'
import { supabaseAdmin } from '../lib/supabaseAdmin'
import { sessionAuth } from '../middleware/sessionAuth'

const router = Router()

// Aplicar middleware de autenticação por sessão em todas as rotas
router.use(sessionAuth)

// ============================================================================
// USERS LOOKUPS
// ============================================================================

/**
 * @swagger
 * /api/lookups/users:
 *   get:
 *     summary: Lista todos os usuários ativos para dropdowns
 *     tags: [Lookups]
 *     responses:
 *       200:
 *         description: Lista de usuários ativos
 */
router.get('/users', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('employees')
      .select('user_id, name, email, position')
      .eq('is_active', true)
      .order('name')

    if (error) {
      console.error('Erro ao buscar funcionários:', error)
      return res.status(500).json({
        success: false,
        error: { message: error.message, code: 'SUPABASE_ERROR' }
      })
    }

    return res.json({
      success: true,
      data: data || []
    })
  } catch (err) {
    return next(err)
  }
})

/**
 * @swagger
 * /api/lookups/managers:
 *   get:
 *     summary: Lista gestores (usuários com posição contendo "Gestor")
 *     tags: [Lookups]
 *     responses:
 *       200:
 *         description: Lista de gestores
 */
router.get('/managers', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('employees')
      .select('user_id, name, email, position')
      .eq('is_active', true)
      .order('name')

    if (error) {
      console.error('Erro ao buscar gestores:', error)
      return res.status(500).json({
        success: false,
        error: { message: error.message, code: 'SUPABASE_ERROR' }
      })
    }

    // Filtrar gestores pela posição (deve conter "Gestor")
    const managers = (data || []).filter((user: any) => {
      const position = (user.position || '').toLowerCase()
      return position.includes('gestor')
    })

    return res.json({
      success: true,
      data: managers
    })
  } catch (err) {
    return next(err)
  }
})

// ============================================================================
// DOMAIN LOOKUPS
// ============================================================================

/**
 * @swagger
 * /api/lookups/evaluation-statuses:
 *   get:
 *     summary: Lista status de avaliação disponíveis
 *     tags: [Lookups]
 *     responses:
 *       200:
 *         description: Lista de status de avaliação
 */
router.get('/evaluation-statuses', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('domains')
      .select('id, value')
      .eq('type', 'evaluation_status')
      .eq('is_active', true)
      .order('value')

    if (error) {
      console.error('Erro ao buscar status:', error)
      return res.status(500).json({
        success: false,
        error: { message: error.message, code: 'SUPABASE_ERROR' }
      })
    }

    return res.json({
      success: true,
      data: data || []
    })
  } catch (err) {
    return next(err)
  }
})

// ============================================================================
// PROJECTS LOOKUPS
// ============================================================================

/**
 * @swagger
 * /api/lookups/projects/active:
 *   get:
 *     summary: Lista projetos ativos (não fechados)
 *     tags: [Lookups]
 *     responses:
 *       200:
 *         description: Lista de projetos ativos
 */
router.get('/projects/active', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('projects')
      .select('project_id, name')
      .eq('is_closed', false)
      .order('name')

    if (error) {
      console.error('Erro ao buscar projetos:', error)
      return res.status(500).json({
        success: false,
        error: { message: error.message, code: 'SUPABASE_ERROR' }
      })
    }

    return res.json({
      success: true,
      data: data || []
    })
  } catch (err) {
    return next(err)
  }
})

// ============================================================================
// EVALUATION MODELS LOOKUPS
// ============================================================================

/**
 * @swagger
 * /api/lookups/evaluation-models/active:
 *   get:
 *     summary: Lista modelos de avaliação ativos
 *     tags: [Lookups]
 *     responses:
 *       200:
 *         description: Lista de modelos de avaliação ativos
 */
router.get('/evaluation-models/active', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('evaluations_model')
      .select('id, name, description')
      .eq('is_active', true)
      .order('name')

    if (error) {
      console.error('Erro ao buscar modelos de avaliação:', error)
      return res.status(500).json({
        success: false,
        error: { message: error.message, code: 'SUPABASE_ERROR' }
      })
    }

    return res.json({
      success: true,
      data: data || []
    })
  } catch (err) {
    return next(err)
  }
})

export default router
