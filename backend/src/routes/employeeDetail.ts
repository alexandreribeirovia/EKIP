import { Router, Request, Response, NextFunction } from 'express'
import { supabaseAdmin } from '../lib/supabaseAdmin'
import { sessionAuth } from '../middleware/sessionAuth'

const router = Router()

// Aplicar middleware de autenticação por sessão em todas as rotas
router.use(sessionAuth)

// ==================== TAREFAS ====================

/**
 * @swagger
 * /api/employees/{id}/tasks:
 *   get:
 *     summary: Busca tarefas do funcionário
 *     tags: [Employees]
 */
router.get('/:id/tasks', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params

    const { data, error } = await supabaseAdmin
      .from('tasks')
      .select('*')
      .eq('responsible_id', id)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Erro ao buscar tarefas:', error)
      return res.status(500).json({
        success: false,
        error: { message: error.message, code: 'SUPABASE_ERROR' }
      })
    }

    return res.json({ success: true, data })
  } catch (err) {
    return next(err)
  }
})

// ==================== TIME WORKED (REGISTROS DE HORAS) ====================

/**
 * @swagger
 * /api/employees/{id}/time-worked:
 *   get:
 *     summary: Busca registros de horas do funcionário
 *     tags: [Employees]
 */
router.get('/:id/time-worked', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params
    const { month, year, startDate, endDate } = req.query

    let query = supabaseAdmin
      .from('time_worked')
      .select('*, task_title, project_name, client_name')
      .eq('user_id', id)

    // Filtrar por range de datas (novo formato)
    if (startDate && endDate) {
      query = query
        .gte('time_worked_date', startDate as string)
        .lt('time_worked_date', endDate as string)
        .gt('time', 0)
    }
    // Filtrar por mês/ano se fornecido (formato legado)
    else if (month && year) {
      const monthNum = parseInt(month as string, 10)
      const yearNum = parseInt(year as string, 10)
      const filterStartDate = `${yearNum}-${monthNum.toString().padStart(2, '0')}-01`
      
      let filterEndYear = yearNum
      let filterEndMonth = monthNum + 1
      if (filterEndMonth > 12) {
        filterEndMonth = 1
        filterEndYear = yearNum + 1
      }
      const filterEndDate = `${filterEndYear}-${filterEndMonth.toString().padStart(2, '0')}-01`

      query = query
        .gte('time_worked_date', filterStartDate)
        .lt('time_worked_date', filterEndDate)
        .gt('time', 0)
    }

    const { data, error } = await query.order('time_worked_date', { ascending: true })

    if (error) {
      console.error('Erro ao buscar registros de horas:', error)
      return res.status(500).json({
        success: false,
        error: { message: error.message, code: 'SUPABASE_ERROR' }
      })
    }

    return res.json({ success: true, data })
  } catch (err) {
    return next(err)
  }
})

/**
 * @swagger
 * /api/employees/{id}/time-worked/months:
 *   get:
 *     summary: Busca meses com registros de horas disponíveis
 *     tags: [Employees]
 */
router.get('/:id/time-worked/months', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params

    const { data, error } = await supabaseAdmin
      .from('time_worked')
      .select('time_worked_date')
      .eq('user_id', id)
      .gt('time', 0)
      .order('time_worked_date', { ascending: false })

    if (error) {
      console.error('Erro ao buscar meses disponíveis:', error)
      return res.status(500).json({
        success: false,
        error: { message: error.message, code: 'SUPABASE_ERROR' }
      })
    }

    // Extrair meses únicos
    const months = new Set(
      (data || []).map((record: any) => {
        const date = new Date(record.time_worked_date)
        return `${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getFullYear()}`
      })
    )

    return res.json({ success: true, data: Array.from(months) })
  } catch (err) {
    return next(err)
  }
})

/**
 * @swagger
 * /api/employees/{id}/time-worked/client-history:
 *   get:
 *     summary: Busca histórico de horas agrupado por cliente
 *     tags: [Employees]
 */
router.get('/:id/time-worked/client-history', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params

    const { data, error } = await supabaseAdmin
      .from('time_worked')
      .select('client_name, project_name, time')
      .eq('user_id', id)

    if (error) {
      console.error('Erro ao buscar histórico de horas:', error)
      return res.status(500).json({
        success: false,
        error: { message: error.message, code: 'SUPABASE_ERROR' }
      })
    }

    // Agrupa por client_name e depois por project_name
    const clientMap = new Map<string, { 
      total_seconds: number
      projects: Map<string, number> 
    }>()
    
    ;(data || []).forEach((record: any) => {
      const clientName = record.client_name || 'Sem cliente'
      const projectName = record.project_name || 'Sem projeto'
      const time = record.time || 0
      
      if (!clientMap.has(clientName)) {
        clientMap.set(clientName, { 
          total_seconds: 0, 
          projects: new Map() 
        })
      }
      
      const client = clientMap.get(clientName)!
      client.total_seconds += time
      
      const currentProjectTime = client.projects.get(projectName) || 0
      client.projects.set(projectName, currentProjectTime + time)
    })

    // Converte para array
    const history = Array.from(clientMap.entries()).map(([client_name, data]) => {
      const projects = Array.from(data.projects.entries())
        .map(([project_name, total_seconds]) => ({
          project_name,
          total_hours: total_seconds / 3600,
          total_seconds
        }))
        .sort((a, b) => b.total_hours - a.total_hours)

      return {
        client_name,
        total_hours: data.total_seconds / 3600,
        total_seconds: data.total_seconds,
        projects
      }
    })

    history.sort((a, b) => b.total_hours - a.total_hours)

    return res.json({ success: true, data: history })
  } catch (err) {
    return next(err)
  }
})

// ==================== FEEDBACKS ====================

/**
 * @swagger
 * /api/employees/{id}/feedbacks:
 *   get:
 *     summary: Busca feedbacks do funcionário
 *     tags: [Employees]
 */
router.get('/:id/feedbacks', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params

    const { data, error } = await supabaseAdmin
      .from('feedbacks')
      .select('id, feedback_user_id, feedback_user_name, owner_user_id, owner_user_name, feedback_date, type, public_comment, is_closed, closed_at, accepted, accepted_at')
      .eq('feedback_user_id', id)
      .order('feedback_date', { ascending: false })

    if (error) {
      console.error('Erro ao buscar feedbacks:', error)
      return res.status(500).json({
        success: false,
        error: { message: error.message, code: 'SUPABASE_ERROR' }
      })
    }

    // Buscar PDIs vinculados aos feedbacks
    const feedbackIds = (data || []).map((f: any) => f.id)
    let pdiMap = new Map()
    
    if (feedbackIds.length > 0) {
      const { data: pdiData } = await supabaseAdmin
        .from('pdi')
        .select('feedback_id')
        .in('feedback_id', feedbackIds)
        .not('feedback_id', 'is', null)
      
      if (pdiData) {
        pdiData.forEach((pdi: any) => {
          pdiMap.set(pdi.feedback_id, true)
        })
      }
    }

    const formattedData = (data || []).map((f: any) => ({
      ...f,
      has_pdi: pdiMap.has(f.id)
    }))

    return res.json({ success: true, data: formattedData })
  } catch (err) {
    return next(err)
  }
})

/**
 * @swagger
 * /api/feedbacks/{id}:
 *   delete:
 *     summary: Deleta um feedback
 *     tags: [Feedbacks]
 */
router.delete('/feedbacks/:feedbackId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { feedbackId } = req.params

    const { error } = await supabaseAdmin
      .from('feedbacks')
      .delete()
      .eq('id', feedbackId)

    if (error) {
      console.error('Erro ao deletar feedback:', error)
      return res.status(500).json({
        success: false,
        error: { message: error.message, code: 'SUPABASE_ERROR' }
      })
    }

    return res.json({ success: true, message: 'Feedback deletado com sucesso' })
  } catch (err) {
    return next(err)
  }
})

// ==================== AVALIAÇÕES ====================

/**
 * @swagger
 * /api/employees/{id}/evaluations:
 *   get:
 *     summary: Busca avaliações do funcionário
 *     tags: [Employees]
 */
router.get('/:id/evaluations', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params

    const { data, error } = await supabaseAdmin
      .from('evaluations')
      .select(`
        *,
        evaluations_questions_reply (
          score,
          weight
        )
      `)
      .eq('user_id', id)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Erro ao buscar avaliações:', error)
      return res.status(500).json({
        success: false,
        error: { message: error.message, code: 'SUPABASE_ERROR' }
      })
    }

    // Buscar status da tabela domains
    const statusIds = (data || []).map((e: any) => e.status_id).filter(Boolean)
    let statusMap = new Map()
    
    if (statusIds.length > 0) {
      const { data: statuses } = await supabaseAdmin
        .from('domains')
        .select('id, value')
        .in('id', statusIds)
        .eq('type', 'evaluation_status')
      
      if (statuses) {
        statusMap = new Map(statuses.map((s: any) => [s.id, s.value]))
      }
    }

    // Buscar PDIs vinculados às avaliações
    const evaluationIds = (data || []).map((e: any) => e.id)
    let pdiMap = new Map()
    
    if (evaluationIds.length > 0) {
      const { data: pdiData } = await supabaseAdmin
        .from('pdi')
        .select('evaluation_id')
        .in('evaluation_id', evaluationIds)
        .not('evaluation_id', 'is', null)
      
      if (pdiData) {
        pdiData.forEach((pdi: any) => {
          pdiMap.set(pdi.evaluation_id, true)
        })
      }
    }

    const formattedData = (data || []).map((e: any) => {
      // Calcular média ponderada dos scores
      let averageScore = null
      const replies = e.evaluations_questions_reply || []
      
      if (replies.length > 0) {
        const validReplies = replies.filter((r: any) => r.score !== null && r.weight !== null)
        
        if (validReplies.length > 0) {
          const totalWeightedScore = validReplies.reduce(
            (sum: number, r: any) => sum + (r.score * r.weight),
            0
          )
          const totalWeight = validReplies.reduce(
            (sum: number, r: any) => sum + r.weight,
            0
          )
          
          averageScore = totalWeight > 0 ? totalWeightedScore / totalWeight : null
        }
      }

      return {
        ...e,
        status_name: statusMap.get(e.status_id) || 'N/A',
        has_pdi: pdiMap.has(e.id),
        average_score: averageScore
      }
    })

    return res.json({ success: true, data: formattedData })
  } catch (err) {
    return next(err)
  }
})

/**
 * @swagger
 * /api/employees/{id}/evaluations/data:
 *   get:
 *     summary: Busca dados de avaliações para gráficos
 *     tags: [Employees]
 */
router.get('/:id/evaluations/data', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params

    // Busca dados das respostas do usuário
    const { data, error } = await supabaseAdmin
      .from('evaluations_questions_reply')
      .select(`
        evaluation_id,
        subcategory,
        score,
        weight,
        evaluations!inner (
          id,
          name,
          updated_at
        )
      `)
      .eq('user_id', id)
      .eq('reply_type', 'Escala (1-5)')
      .order('evaluations(updated_at)', { ascending: true })

    if (error) {
      console.error('Erro ao buscar dados das avaliações:', error)
      return res.status(500).json({
        success: false,
        error: { message: error.message, code: 'SUPABASE_ERROR' }
      })
    }

    // Busca dados de TODOS os usuários para calcular média do time
    const { data: teamData, error: teamError } = await supabaseAdmin
      .from('evaluations_questions_reply')
      .select('subcategory, score, weight')
      .eq('reply_type', 'Escala (1-5)')

    if (teamError) {
      console.error('Erro ao buscar dados do time:', teamError)
    }

    return res.json({ 
      success: true, 
      data: {
        userData: data || [],
        teamData: teamData || []
      }
    })
  } catch (err) {
    return next(err)
  }
})

/**
 * @swagger
 * /api/evaluations/{id}:
 *   delete:
 *     summary: Deleta uma avaliação
 *     tags: [Evaluations]
 */
router.delete('/evaluations/:evaluationId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { evaluationId } = req.params

    // 1. Deletar as respostas da avaliação
    await supabaseAdmin
      .from('evaluations_questions_reply')
      .delete()
      .eq('evaluation_id', evaluationId)

    // 2. Deletar os vínculos com projetos
    await supabaseAdmin
      .from('evaluations_projects')
      .delete()
      .eq('evaluation_id', evaluationId)

    // 3. Deletar a avaliação principal
    const { error } = await supabaseAdmin
      .from('evaluations')
      .delete()
      .eq('id', evaluationId)

    if (error) {
      console.error('Erro ao deletar avaliação:', error)
      return res.status(500).json({
        success: false,
        error: { message: error.message, code: 'SUPABASE_ERROR' }
      })
    }

    return res.json({ success: true, message: 'Avaliação deletada com sucesso' })
  } catch (err) {
    return next(err)
  }
})

// ==================== PDI ====================

/**
 * @swagger
 * /api/employees/{id}/pdis:
 *   get:
 *     summary: Busca PDIs do funcionário
 *     tags: [Employees]
 */
router.get('/:id/pdis', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params

    const { data: pdiData, error: pdiError } = await supabaseAdmin
      .from('pdi')
      .select('*')
      .eq('user_id', id)
      .order('created_at', { ascending: false })

    if (pdiError) {
      console.error('Erro ao buscar PDIs:', pdiError)
      return res.status(500).json({
        success: false,
        error: { message: pdiError.message, code: 'SUPABASE_ERROR' }
      })
    }

    if (!pdiData || pdiData.length === 0) {
      return res.json({ success: true, data: [] })
    }

    // Buscar todos os status da tabela domains
    const { data: statusData } = await supabaseAdmin
      .from('domains')
      .select('id, value')
      .eq('type', 'pdi_status')

    const statusMap = new Map((statusData || []).map((s: any) => [s.id, s.value]))

    // Buscar itens de cada PDI
    const pdiIds = pdiData.map((p: any) => p.id)
    const { data: itemsData } = await supabaseAdmin
      .from('pdi_items')
      .select('*')
      .in('pdi_id', pdiIds)
      .order('created_at', { ascending: true })

    // Agrupar itens por pdi_id
    const itemsByPdi = new Map<number, any[]>()
    ;(itemsData || []).forEach((item: any) => {
      if (!itemsByPdi.has(item.pdi_id)) {
        itemsByPdi.set(item.pdi_id, [])
      }
      itemsByPdi.get(item.pdi_id)!.push(item)
    })

    // Formatar dados
    const formattedData = pdiData.map((pdi: any) => ({
      ...pdi,
      status_name: statusMap.get(pdi.status_id) || 'N/A',
      items: itemsByPdi.get(pdi.id) || []
    }))

    return res.json({ success: true, data: formattedData })
  } catch (err) {
    return next(err)
  }
})

/**
 * @swagger
 * /api/pdis/{id}:
 *   delete:
 *     summary: Deleta um PDI
 *     tags: [PDI]
 */
router.delete('/pdis/:pdiId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { pdiId } = req.params

    // 1. Deletar os itens do PDI
    await supabaseAdmin
      .from('pdi_items')
      .delete()
      .eq('pdi_id', pdiId)

    // 2. Deletar o PDI principal
    const { error } = await supabaseAdmin
      .from('pdi')
      .delete()
      .eq('id', pdiId)

    if (error) {
      console.error('Erro ao deletar PDI:', error)
      return res.status(500).json({
        success: false,
        error: { message: error.message, code: 'SUPABASE_ERROR' }
      })
    }

    return res.json({ success: true, message: 'PDI deletado com sucesso' })
  } catch (err) {
    return next(err)
  }
})

// ==================== ACESSOS ====================

/**
 * @swagger
 * /api/employees/{id}/accesses:
 *   get:
 *     summary: Busca acessos do funcionário
 *     tags: [Employees]
 */
router.get('/:id/accesses', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params

    const { data, error } = await supabaseAdmin
      .from('access_platforms')
      .select('*, clients(name)')
      .eq('user_id', id)
      .eq('is_active', true)
      .order('platform_name')

    if (error) {
      console.error('Erro ao buscar acessos:', error)
      return res.status(500).json({
        success: false,
        error: { message: error.message, code: 'SUPABASE_ERROR' }
      })
    }

    if (!data || data.length === 0) {
      return res.json({ success: true, data: [] })
    }

    // Buscar detalhes de acesso
    const accessIds = data.map((a: any) => a.id)
    const { data: detailsData } = await supabaseAdmin
      .from('access_platforms_details')
      .select('*')
      .in('access_platform_id', accessIds)

    const accessDetails = detailsData || []

    // Mapear dados
    const accessesWithDetails = data.map((access: any) => {
      const details = accessDetails.filter((d: any) => d.access_platform_id === access.id)
      const policies = details.filter((d: any) => d.domain_type === 'access_policy').map((d: any) => d.domain_value)
      const dataTypes = details.filter((d: any) => d.domain_type === 'access_data_type').map((d: any) => d.domain_value)
      
      return {
        ...access,
        client_name: access.clients?.name || 'Cliente não encontrado',
        access_policies: policies,
        data_types: dataTypes,
      }
    })

    return res.json({ success: true, data: accessesWithDetails })
  } catch (err) {
    return next(err)
  }
})

/**
 * @swagger
 * /api/accesses/{id}:
 *   delete:
 *     summary: Deleta um acesso (marca como inativo)
 *     tags: [Accesses]
 */
router.delete('/accesses/:accessId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { accessId } = req.params

    // Primeiro deletar os detalhes do acesso
    await supabaseAdmin
      .from('access_platforms_details')
      .delete()
      .eq('access_platform_id', accessId)

    // Depois marcar o acesso como inativo
    const { error } = await supabaseAdmin
      .from('access_platforms')
      .update({ is_active: false })
      .eq('id', accessId)

    if (error) {
      console.error('Erro ao deletar acesso:', error)
      return res.status(500).json({
        success: false,
        error: { message: error.message, code: 'SUPABASE_ERROR' }
      })
    }

    return res.json({ success: true, message: 'Acesso removido com sucesso' })
  } catch (err) {
    return next(err)
  }
})

// ==================== SKILLS ====================

/**
 * @swagger
 * /api/skills:
 *   get:
 *     summary: Busca todas as skills disponíveis
 *     tags: [Skills]
 */
router.get('/skills', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('skills')
      .select('*')
      .order('area')
      .order('category')
      .order('skill')

    if (error) {
      console.error('Erro ao buscar skills:', error)
      return res.status(500).json({
        success: false,
        error: { message: error.message, code: 'SUPABASE_ERROR' }
      })
    }

    return res.json({ success: true, data })
  } catch (err) {
    return next(err)
  }
})

// ==================== OFF DAYS (FERIADOS) ====================

/**
 * @swagger
 * /api/off-days:
 *   get:
 *     summary: Busca feriados em um período
 *     tags: [OffDays]
 */
router.get('/off-days', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { startDate, endDate } = req.query

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        error: { message: 'startDate e endDate são obrigatórios', code: 'VALIDATION_ERROR' }
      })
    }

    const { data, error } = await supabaseAdmin
      .from('off_days')
      .select('day')
      .gte('day', startDate as string)
      .lt('day', endDate as string)

    if (error) {
      console.error('Erro ao buscar feriados:', error)
      return res.status(500).json({
        success: false,
        error: { message: error.message, code: 'SUPABASE_ERROR' }
      })
    }

    return res.json({ success: true, data })
  } catch (err) {
    return next(err)
  }
})

// ==================== ALLOCATIONS ====================

/**
 * @swagger
 * /api/employees/{id}/allocations:
 *   get:
 *     summary: Busca alocações do funcionário
 *     tags: [Employees]
 */
router.get('/:id/allocations', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params

    const { data, error } = await supabaseAdmin
      .from('allocations')
      .select('project_id')
      .eq('employee_id', id)
      .limit(1)

    if (error) {
      console.error('Erro ao buscar alocações:', error)
      return res.status(500).json({
        success: false,
        error: { message: error.message, code: 'SUPABASE_ERROR' }
      })
    }

    return res.json({ success: true, data })
  } catch (err) {
    return next(err)
  }
})

// ==================== PROJECTS ====================

/**
 * @swagger
 * /api/projects/active:
 *   get:
 *     summary: Busca projetos ativos
 *     tags: [Projects]
 */
router.get('/projects/active', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('projects')
      .select('project_id')
      .eq('is_active', true)
      .limit(1)

    if (error) {
      console.error('Erro ao buscar projetos ativos:', error)
      return res.status(500).json({
        success: false,
        error: { message: error.message, code: 'SUPABASE_ERROR' }
      })
    }

    return res.json({ success: true, data })
  } catch (err) {
    return next(err)
  }
})

/**
 * @swagger
 * /api/projects/by-client/{clientId}:
 *   get:
 *     summary: Busca projeto de um cliente
 *     tags: [Projects]
 */
router.get('/projects/by-client/:clientId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { clientId } = req.params

    // Buscar o nome do cliente primeiro
    const { data: clientData, error: clientError } = await supabaseAdmin
      .from('clients')
      .select('name')
      .eq('client_id', clientId)
      .single()

    if (clientError || !clientData) {
      return res.status(404).json({
        success: false,
        error: { message: 'Cliente não encontrado', code: 'NOT_FOUND' }
      })
    }

    // Buscar um projeto desse cliente
    const { data, error } = await supabaseAdmin
      .from('projects')
      .select('project_id')
      .eq('client_name', clientData.name)
      .limit(1)
      .single()

    if (error) {
      return res.status(404).json({
        success: false,
        error: { message: 'Projeto não encontrado', code: 'NOT_FOUND' }
      })
    }

    return res.json({ success: true, data })
  } catch (err) {
    return next(err)
  }
})

// ==================== QUIZZES DO FUNCIONÁRIO ====================

/**
 * @swagger
 * /api/employee-detail/{userId}/quizzes:
 *   get:
 *     summary: Busca histórico de quizzes do funcionário
 *     tags: [Employee Detail]
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Lista de quizzes com resultados
 */
router.get('/:userId/quizzes', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId } = req.params
    if (!userId) {
      return res.status(400).json({
        success: false,
        error: { message: 'ID do usuário é obrigatório', code: 'INVALID_REQUEST' }
      })
    }

    // Buscar participações em quizzes
    const { data: participations, error: participationsError } = await supabaseAdmin
      .from('quiz_participant')
      .select(`
        id,
        quiz_id,
        created_at,
        quiz (
          id,
          title,
          description,
          is_active,
          attempt_limit,
          pass_score
        )
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (participationsError) {
      console.error('Erro ao buscar participações:', participationsError)
      return res.status(500).json({
        success: false,
        error: { message: participationsError.message, code: 'SUPABASE_ERROR' }
      })
    }

    // Buscar todas as tentativas do usuário
    const { data: attempts, error: attemptsError } = await supabaseAdmin
      .from('quiz_attempt')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (attemptsError) {
      console.error('Erro ao buscar tentativas:', attemptsError)
    }

    // Criar mapa de tentativas por quiz_id
    const attemptsMap = new Map<number, any[]>()
    attempts?.forEach((a: any) => {
      const quizAttempts = attemptsMap.get(a.quiz_id) || []
      quizAttempts.push(a)
      attemptsMap.set(a.quiz_id, quizAttempts)
    })

    // Formatar resposta
    const formattedData = (participations || []).map((p: any) => {
      const quiz = p.quiz
      const userAttempts = attemptsMap.get(p.quiz_id) || []
      const completedAttempts = userAttempts.filter((a: any) => a.status === 'completed')
      
      // Melhor tentativa
      const bestAttempt = completedAttempts.length > 0
        ? completedAttempts.reduce((best: any, curr: any) => {
            const currPercentage = curr.total_points > 0 
              ? (curr.score / curr.total_points) * 100 
              : 0
            const bestPercentage = best?.total_points > 0 
              ? (best.score / best.total_points) * 100 
              : 0
            return currPercentage > bestPercentage ? curr : best
          }, completedAttempts[0])
        : null

      // Última tentativa
      const lastAttempt = userAttempts.length > 0 ? userAttempts[0] : null

      // Calcular percentual
      const bestPercentage = bestAttempt && bestAttempt.total_points > 0
        ? Math.round((bestAttempt.score / bestAttempt.total_points) * 100)
        : null

      // Verificar se passou
      const passed = quiz?.pass_score && bestPercentage !== null
        ? bestPercentage >= quiz.pass_score
        : null

      // Determinar status geral
      let status: 'completed' | 'in_progress' | 'not_started' = 'not_started'
      if (completedAttempts.length > 0) {
        status = 'completed'
      } else if (userAttempts.some((a: any) => a.status === 'in_progress')) {
        status = 'in_progress'
      }

      return {
        participation_id: p.id,
        quiz_id: p.quiz_id,
        quiz_title: quiz?.title || 'Quiz não encontrado',
        quiz_description: quiz?.description || null,
        quiz_is_active: quiz?.is_active || false,
        added_at: p.created_at,
        // Estatísticas
        attempts_used: userAttempts.length,
        attempt_limit: quiz?.attempt_limit || null,
        // Melhor resultado
        best_score: bestAttempt?.score || null,
        best_total_points: bestAttempt?.total_points || null,
        best_percentage: bestPercentage,
        best_correct_count: bestAttempt?.correct_count || null,
        best_wrong_count: bestAttempt?.wrong_count || null,
        pass_score: quiz?.pass_score || null,
        passed: passed,
        // Última tentativa
        last_attempt_at: lastAttempt?.submitted_at || lastAttempt?.started_at || null,
        last_attempt_status: lastAttempt?.status || null,
        // Status geral
        status: status,
        // Todas as tentativas completas (para gráfico)
        attempts: completedAttempts.map((a: any, index: number) => ({
          attempt_number: completedAttempts.length - index,
          score: a.score,
          total_points: a.total_points,
          percentage: a.total_points > 0 ? Math.round((a.score / a.total_points) * 100) : 0,
          correct_count: a.correct_count,
          wrong_count: a.wrong_count,
          submitted_at: a.submitted_at,
          time_spent_seconds: a.time_spent_seconds
        })).reverse() // Ordenar da primeira para a última tentativa
      }
    })

    return res.json({
      success: true,
      data: formattedData
    })
  } catch (err) {
    return next(err)
  }
})

export default router
