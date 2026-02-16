import { Router, Request, Response, NextFunction } from 'express'
import { supabaseAdmin } from '../lib/supabaseAdmin'
import { sessionAuth } from '../middleware/sessionAuth'

const router = Router()

// Aplicar middleware de autenticação em todas as rotas
router.use(sessionAuth)

// ==================== CONSULTORES (dropdown) ====================

/**
 * @swagger
 * /api/time-entries/consultants:
 *   get:
 *     summary: Lista consultores que lançam horas (para dropdown de filtro)
 *     tags: [Time Entries]
 *     responses:
 *       200:
 *         description: Lista de consultores
 */
router.get('/consultants', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('employees')
      .select('user_id, name, is_active')
      .eq('log_hours', true)
      .order('name', { ascending: true })

    if (error) {
      console.error('Erro ao buscar consultores:', error)
      return res.status(500).json({
        success: false,
        error: { message: error.message, code: 'SUPABASE_ERROR' }
      })
    }

    return res.json({ success: true, data: data || [] })
  } catch (err) {
    return next(err)
  }
})

// ==================== RELATÓRIO DE HORAS ====================

/**
 * @swagger
 * /api/time-entries/report:
 *   get:
 *     summary: Relatório de lançamento de horas por consultor (usa PostgreSQL function)
 *     tags: [Time Entries]
 *     parameters:
 *       - in: query
 *         name: startDate
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *         description: Data início do período (YYYY-MM-DD)
 *       - in: query
 *         name: endDate
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *         description: Data fim do período (YYYY-MM-DD)
 *       - in: query
 *         name: userIds
 *         required: false
 *         schema:
 *           type: string
 *         description: IDs dos consultores separados por vírgula (ex. "12345,67890"). Se vazio, retorna todos.
 *       - in: query
 *         name: status
 *         required: false
 *         schema:
 *           type: string
 *           enum: [active, inactive, all]
 *           default: active
 *         description: Filtro de status do consultor
 *     responses:
 *       200:
 *         description: Relatório com resumo por consultor e detalhamento diário
 */
router.get('/report', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { startDate, endDate, userIds, status } = req.query

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        error: { message: 'startDate e endDate são obrigatórios', code: 'VALIDATION_ERROR' }
      })
    }

    // Preparar array de userIds (ou null para todos)
    let userIdsArray: string[] | null = null
    if (userIds && typeof userIds === 'string' && userIds.trim() !== '') {
      userIdsArray = userIds.split(',').map(id => id.trim()).filter(Boolean)
      if (userIdsArray.length === 0) userIdsArray = null
    }

    // Chamar a PostgreSQL function (UMA única chamada ao banco)
    const { data, error } = await supabaseAdmin.rpc('timesheet_detail_report', {
      p_start_date: startDate as string,
      p_end_date: endDate as string,
      p_user_ids: userIdsArray,
      p_status: (status as string) || 'active'
    })

    if (error) {
      console.error('Erro ao buscar relatório de horas:', error)
      return res.status(500).json({
        success: false,
        error: { message: error.message, code: 'SUPABASE_ERROR', details: error }
      })
    }

    // Mapear colunas out_* para nomes limpos (frontend não precisa conhecer o prefixo)
    const report = (data || []).map((row: any) => ({
      user_id: row.out_user_id,
      user_name: row.out_user_name,
      expected_hours: Number(row.out_expected_hours) || 0,
      worked_hours: Number(row.out_worked_hours) || 0,
      expected_hours_until_yesterday: Number(row.out_expected_hours_until_yesterday) || 0,
      overtime_hours_in_period: Number(row.out_overtime_hours_in_period) || 0,
      positive_comp_hours_in_period: Number(row.out_positive_comp_hours_in_period) || 0,
      negative_comp_hours_in_period: Number(row.out_negative_comp_hours_in_period) || 0,
      total_positive_comp_hours: Number(row.out_total_positive_comp_hours) || 0,
      total_negative_comp_hours: Number(row.out_total_negative_comp_hours) || 0,
      time_balance: Number(row.out_time_balance) || 0,
      daily_details: (row.out_daily_details || []).map((day: any) => ({
        date: day.date,
        dayOfWeek: day.day_of_week,
        expected_hours: Number(day.expected_hours) || 0,
        worked_hours: Number(day.worked_hours) || 0,
        comp_positive: Number(day.comp_positive) || 0,
        comp_negative: Number(day.comp_negative) || 0,
        isInsufficient: day.is_insufficient ?? false,
        isMoresufficient: day.is_moresufficient ?? false
      }))
    }))

    return res.json({ success: true, data: report })
  } catch (err) {
    return next(err)
  }
})

export default router
