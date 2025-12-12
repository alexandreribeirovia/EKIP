import { Router, Request, Response, NextFunction } from 'express'
import { supabaseAdmin } from '../lib/supabaseAdmin'
import { sessionAuth } from '../middleware/sessionAuth'

const router = Router()

// Aplicar middleware de autenticação por sessão em todas as rotas
router.use(sessionAuth)

// Helper para obter o cliente Supabase do request
const getSupabaseClient = (req: Request) => {
  return req.supabaseUser || supabaseAdmin
}

/**
 * @swagger
 * /api/allocations:
 *   get:
 *     summary: Informações da rota de alocações
 *     tags: [Allocations]
 *     responses:
 *       200:
 *         description: Rota de alocações ativa
 */
router.get('/', (_req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      message: 'Allocations API - endpoints disponíveis',
      endpoints: [
        'GET /api/allocations/projects/distinct',
        'POST /api/allocations/filtered'
      ]
    }
  })
})

/**
 * @swagger
 * /api/allocations/projects/distinct:
 *   get:
 *     summary: Lista projetos distintos para filtro de alocações
 *     tags: [Allocations]
 *     responses:
 *       200:
 *         description: Lista de projetos distintos
 */
router.get('/projects/distinct', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const supabase = getSupabaseClient(req)
    
    const { data, error } = await supabase.rpc('get_distinct_projects')

    if (error) {
      console.error('Erro ao buscar projetos distintos:', error)
      return res.status(500).json({
        success: false,
        error: { message: error.message, code: 'SUPABASE_ERROR' }
      })
    }

    // Formata os dados como SelectOption para o frontend
    const projectOptions = (data || []).map((p: { project_name: string }) => ({
      value: p.project_name,
      label: p.project_name
    }))

    return res.json({
      success: true,
      data: projectOptions
    })
  } catch (err) {
    return next(err)
  }
})

/**
 * @swagger
 * /api/allocations/filtered:
 *   post:
 *     summary: Busca alocações filtradas para o calendário
 *     tags: [Allocations]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               consultantIds:
 *                 type: array
 *                 items:
 *                   type: string
 *               projectNames:
 *                 type: array
 *                 items:
 *                   type: string
 *               status:
 *                 type: boolean
 *                 nullable: true
 *               startDate:
 *                 type: string
 *                 format: date-time
 *     responses:
 *       200:
 *         description: Lista de alocações filtradas com tasks
 */
router.post('/filtered', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { consultantIds, projectNames, status, startDate } = req.body

    const supabase = getSupabaseClient(req)
    
    // Parâmetros para a RPC do Supabase (com prefixo _ conforme convenção)
    const params = {
      _consultant_ids: consultantIds || [],
      _project_names: projectNames || [],
      _status: status,
      _start_date: startDate || new Date(Date.now() - 18 * 30 * 24 * 60 * 60 * 1000).toISOString()
    }

    const { data, error } = await supabase
      .rpc('get_filtered_assignments', params)
      .select('*, tasks(*)')

    if (error) {
      console.error('Erro ao buscar alocações filtradas:', error)
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