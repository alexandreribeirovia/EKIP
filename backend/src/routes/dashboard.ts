import { Router, Request, Response, NextFunction } from 'express'
import { supabaseAdmin } from '../lib/supabaseAdmin'
import { sessionAuth } from '../middleware/sessionAuth'

const router = Router()

// Aplicar middleware de autenticação em todas as rotas
router.use(sessionAuth)

// ============================================================================
// GET /api/dashboard/stats
// Retorna KPIs, riscos críticos, bench, férias e status dos projetos
// ============================================================================
router.get('/stats', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const { data, error } = await supabaseAdmin.rpc('dashboard_stats')

    if (error) {
      console.error('❌ [Dashboard] Erro ao buscar stats:', error)
      return res.status(500).json({
        success: false,
        error: { message: error.message, code: 'SUPABASE_ERROR' }
      })
    }

    return res.json({
      success: true,
      data: data || {}
    })
  } catch (err) {
    return next(err)
  }
})

// ============================================================================
// GET /api/dashboard/weekly-utilization
// Retorna % de utilização para semana atual + 3 próximas semanas
// ============================================================================
router.get('/weekly-utilization', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const { data, error } = await supabaseAdmin.rpc('dashboard_weekly_utilization')

    if (error) {
      console.error('❌ [Dashboard] Erro ao buscar utilização semanal:', error)
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
// GET /api/dashboard/monthly-allocation
// Retorna consultores por billing_type para mês atual + 5 próximos meses
// ============================================================================
router.get('/monthly-allocation', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const { data, error } = await supabaseAdmin.rpc('dashboard_monthly_allocation')

    if (error) {
      console.error('❌ [Dashboard] Erro ao buscar alocação mensal:', error)
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
// GET /api/dashboard/monthly-hours
// Retorna horas previstas, lançadas e % para mês anterior e mês atual
// ============================================================================
router.get('/monthly-hours', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const { data, error } = await supabaseAdmin.rpc('dashboard_monthly_hours')

    if (error) {
      console.error('❌ [Dashboard] Erro ao buscar horas mensais:', error)
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