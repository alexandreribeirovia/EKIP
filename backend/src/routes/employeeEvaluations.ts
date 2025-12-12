import { Router, Request, Response, NextFunction } from 'express'
import { supabaseAdmin } from '../lib/supabaseAdmin'
import { sessionAuth } from '../middleware/sessionAuth'

const router = Router()

// Aplicar middleware de autenticação por sessão em todas as rotas
router.use(sessionAuth)

// ============================================================================
// EMPLOYEE EVALUATIONS CRUD
// ============================================================================

/**
 * @swagger
 * /api/employee-evaluations:
 *   get:
 *     summary: Lista avaliações de funcionários com filtros
 *     tags: [Employee Evaluations]
 *     parameters:
 *       - in: query
 *         name: start_date
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: end_date
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: consultant_ids
 *         schema:
 *           type: string
 *         description: Comma-separated user IDs
 *       - in: query
 *         name: manager_ids
 *         schema:
 *           type: string
 *         description: Comma-separated owner IDs
 *       - in: query
 *         name: status_ids
 *         schema:
 *           type: string
 *         description: Comma-separated status IDs
 *     responses:
 *       200:
 *         description: Lista de avaliações
 */
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { start_date, end_date, consultant_ids, manager_ids, status_ids } = req.query

    let query = supabaseAdmin
      .from('evaluations')
      .select(`
        *,
        is_pdi,
        evaluations_projects (
          project_id
        ),
        evaluations_questions_reply (
          score,
          weight
        )
      `)
      .order('updated_at', { ascending: false })

    // Filtrar por intervalo de datas
    if (start_date && typeof start_date === 'string') {
      query = query.gte('updated_at', start_date)
    }
    if (end_date && typeof end_date === 'string') {
      query = query.lte('updated_at', end_date + 'T23:59:59')
    }

    // Filtrar por consultores
    if (consultant_ids && typeof consultant_ids === 'string') {
      const ids = consultant_ids.split(',').filter(id => id.trim())
      if (ids.length > 0) {
        query = query.in('user_id', ids)
      }
    }

    // Filtrar por gestores
    if (manager_ids && typeof manager_ids === 'string') {
      const ids = manager_ids.split(',').filter(id => id.trim())
      if (ids.length > 0) {
        query = query.in('owner_id', ids)
      }
    }

    // Filtrar por status
    if (status_ids && typeof status_ids === 'string') {
      const ids = status_ids.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id))
      if (ids.length > 0) {
        query = query.in('status_id', ids)
      }
    }

    const { data: evaluations, error } = await query

    if (error) {
      console.error('Erro ao buscar avaliações:', error)
      return res.status(500).json({
        success: false,
        error: { message: error.message, code: 'SUPABASE_ERROR' }
      })
    }

    // Buscar todos os status da tabela domains
    const { data: statusData, error: statusError } = await supabaseAdmin
      .from('domains')
      .select('id, value')
      .eq('type', 'evaluation_status')

    if (statusError) {
      console.error('Erro ao buscar status:', statusError)
    }

    // Buscar todos os projetos para fazer o join
    const { data: projectsData, error: projectsError } = await supabaseAdmin
      .from('projects')
      .select('project_id, name')

    if (projectsError) {
      console.error('Erro ao buscar projetos:', projectsError)
    }

    // Criar mapas para lookup
    const statusMap = new Map()
    if (statusData) {
      statusData.forEach((status: any) => {
        statusMap.set(status.id, status)
      })
    }

    const projectsMap = new Map()
    if (projectsData) {
      projectsData.forEach((project: any) => {
        projectsMap.set(project.project_id, project)
      })
    }

    // Processar avaliações com joins manuais
    const evaluationsWithDetails = (evaluations || []).map((evaluation: any) => {
      // Enriquecer os projetos com os nomes
      const projectsWithNames = (evaluation.evaluations_projects || []).map((ep: any) => ({
        ...ep,
        project_name: projectsMap.get(ep.project_id)?.name || 'Projeto não encontrado'
      }))

      // Calcular média ponderada dos scores
      let averageScore = null
      const replies = evaluation.evaluations_questions_reply || []

      if (replies.length > 0) {
        const validReplies = replies.filter((r: any) => r.score !== null && r.weight !== null)

        if (validReplies.length > 0) {
          let totalWeightedScore = 0
          let totalWeight = 0

          validReplies.forEach((r: any) => {
            totalWeightedScore += r.score * r.weight
            totalWeight += r.weight
          })

          if (totalWeight > 0) {
            averageScore = totalWeightedScore / totalWeight
          }
        }
      }

      return {
        ...evaluation,
        status: evaluation.status_id ? statusMap.get(evaluation.status_id) : null,
        evaluations_projects: projectsWithNames,
        average_score: averageScore
      }
    })

    return res.json({
      success: true,
      data: evaluationsWithDetails
    })
  } catch (err) {
    return next(err)
  }
})

/**
 * @swagger
 * /api/employee-evaluations/{id}:
 *   get:
 *     summary: Obtém uma avaliação por ID com detalhes completos
 *     tags: [Employee Evaluations]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Avaliação encontrada
 *       404:
 *         description: Avaliação não encontrada
 */
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params['id']
    if (!id) {
      return res.status(400).json({
        success: false,
        error: { message: 'ID da avaliação é obrigatório', code: 'INVALID_REQUEST' }
      })
    }

    // Buscar avaliação
    const { data: evaluation, error } = await supabaseAdmin
      .from('evaluations')
      .select('*')
      .eq('id', parseInt(id))
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({
          success: false,
          error: { message: 'Avaliação não encontrada', code: 'NOT_FOUND' }
        })
      }
      console.error('Erro ao buscar avaliação:', error)
      return res.status(500).json({
        success: false,
        error: { message: error.message, code: 'SUPABASE_ERROR' }
      })
    }

    // Buscar nome do modelo de avaliação
    let evaluationModelName = null
    if (evaluation.evaluation_model_id) {
      const { data: modelData, error: modelError } = await supabaseAdmin
        .from('evaluations_model')
        .select('name')
        .eq('id', evaluation.evaluation_model_id)
        .single()

      if (!modelError && modelData) {
        evaluationModelName = modelData.name
      }
    }

    // Buscar status da avaliação
    let statusName = null
    if (evaluation.status_id) {
      const { data: statusData, error: statusError } = await supabaseAdmin
        .from('domains')
        .select('value')
        .eq('id', evaluation.status_id)
        .single()

      if (!statusError && statusData) {
        statusName = statusData.value
      }
    }

    // Buscar projetos vinculados
    let projectNames: string[] = []
    const { data: projectLinks, error: projectLinksError } = await supabaseAdmin
      .from('evaluations_projects')
      .select('project_id')
      .eq('evaluation_id', parseInt(id))

    if (!projectLinksError && projectLinks && projectLinks.length > 0) {
      const projectIds = projectLinks.map((pl: any) => pl.project_id)
      const { data: projectsData, error: projectsError } = await supabaseAdmin
        .from('projects')
        .select('name')
        .in('project_id', projectIds)

      if (!projectsError && projectsData) {
        projectNames = projectsData.map((p: any) => p.name)
      }
    }

    // Verificar PDI vinculado
    let hasLinkedPDI = false
    const { data: pdiData, error: pdiError } = await supabaseAdmin
      .from('pdi')
      .select('id')
      .eq('evaluation_id', parseInt(id))
      .limit(1)

    if (!pdiError && pdiData && pdiData.length > 0) {
      hasLinkedPDI = true
    }

    return res.json({
      success: true,
      data: {
        ...evaluation,
        evaluation_model_name: evaluationModelName,
        status_name: statusName,
        project_names: projectNames,
        has_linked_pdi: hasLinkedPDI
      }
    })
  } catch (err) {
    return next(err)
  }
})

/**
 * @swagger
 * /api/employee-evaluations:
 *   post:
 *     summary: Cria uma nova avaliação com projetos vinculados
 *     tags: [Employee Evaluations]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - user_id
 *               - owner_id
 *               - evaluation_model_id
 *               - period_start
 *               - period_end
 *             properties:
 *               user_id:
 *                 type: string
 *               user_name:
 *                 type: string
 *               owner_id:
 *                 type: string
 *               owner_name:
 *                 type: string
 *               evaluation_model_id:
 *                 type: integer
 *               period_start:
 *                 type: string
 *                 format: date
 *               period_end:
 *                 type: string
 *                 format: date
 *               project_ids:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       201:
 *         description: Avaliação criada com sucesso
 */
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const {
      user_id,
      user_name,
      owner_id,
      owner_name,
      evaluation_model_id,
      period_start,
      period_end,
      project_ids
    } = req.body

    if (!user_id || !owner_id || !evaluation_model_id || !period_start || !period_end) {
      return res.status(400).json({
        success: false,
        error: { message: 'Campos obrigatórios: user_id, owner_id, evaluation_model_id, period_start, period_end', code: 'INVALID_REQUEST' }
      })
    }

    // Buscar status "Aberto"
    const { data: statusData, error: statusError } = await supabaseAdmin
      .from('domains')
      .select('id')
      .eq('type', 'evaluation_status')
      .ilike('value', '%aberto%')
      .limit(1)
      .single()

    if (statusError) {
      console.error('Erro ao buscar status Aberto:', statusError)
      return res.status(500).json({
        success: false,
        error: { message: 'Erro ao buscar status inicial', code: 'SUPABASE_ERROR' }
      })
    }

    // Buscar nome do modelo de avaliação
    const { data: modelData, error: modelError } = await supabaseAdmin
      .from('evaluations_model')
      .select('name')
      .eq('id', evaluation_model_id)
      .single()

    if (modelError) {
      console.error('Erro ao buscar modelo de avaliação:', modelError)
      return res.status(500).json({
        success: false,
        error: { message: 'Erro ao buscar modelo de avaliação', code: 'SUPABASE_ERROR' }
      })
    }

    // Gerar nome da avaliação: "Modelo - Nome do Avaliado"
    const evaluationName = `${modelData?.name || 'Avaliação'} - ${user_name || 'Sem Nome'}`

    // Criar avaliação
    const { data: evaluationData, error: createError } = await supabaseAdmin
      .from('evaluations')
      .insert({
        name: evaluationName,
        user_id,
        user_name,
        owner_id,
        owner_name,
        evaluation_model_id,
        period_start,
        period_end,
        status_id: statusData.id,
        is_closed: false,
        is_pdi: false
      })
      .select()
      .single()

    if (createError) {
      console.error('Erro ao criar avaliação:', createError)
      return res.status(500).json({
        success: false,
        error: { message: createError.message, code: 'SUPABASE_ERROR' }
      })
    }

    // Vincular projetos se fornecidos
    if (project_ids && Array.isArray(project_ids) && project_ids.length > 0) {
      const projectLinks = project_ids.map((projectId: string) => ({
        evaluation_id: evaluationData.id,
        project_id: projectId
      }))

      const { error: linkError } = await supabaseAdmin
        .from('evaluations_projects')
        .insert(projectLinks)

      if (linkError) {
        console.error('Erro ao vincular projetos:', linkError)
        // Reverter criação da avaliação
        await supabaseAdmin
          .from('evaluations')
          .delete()
          .eq('id', evaluationData.id)

        return res.status(500).json({
          success: false,
          error: { message: linkError.message, code: 'SUPABASE_ERROR' }
        })
      }
    }

    return res.status(201).json({
      success: true,
      data: evaluationData
    })
  } catch (err) {
    return next(err)
  }
})

/**
 * @swagger
 * /api/employee-evaluations/{id}:
 *   delete:
 *     summary: Deleta uma avaliação (cascade: respostas e projetos)
 *     tags: [Employee Evaluations]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Avaliação deletada com sucesso
 */
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params['id']
    if (!id) {
      return res.status(400).json({
        success: false,
        error: { message: 'ID da avaliação é obrigatório', code: 'INVALID_REQUEST' }
      })
    }

    // 1. Deletar respostas
    const { error: replyError } = await supabaseAdmin
      .from('evaluations_questions_reply')
      .delete()
      .eq('evaluation_id', parseInt(id))

    if (replyError) {
      console.error('Erro ao deletar respostas:', replyError)
      return res.status(500).json({
        success: false,
        error: { message: replyError.message, code: 'SUPABASE_ERROR' }
      })
    }

    // 2. Deletar vínculos com projetos
    const { error: projectsError } = await supabaseAdmin
      .from('evaluations_projects')
      .delete()
      .eq('evaluation_id', parseInt(id))

    if (projectsError) {
      console.error('Erro ao deletar vínculos de projetos:', projectsError)
      return res.status(500).json({
        success: false,
        error: { message: projectsError.message, code: 'SUPABASE_ERROR' }
      })
    }

    // 3. Deletar avaliação
    const { error: deleteError } = await supabaseAdmin
      .from('evaluations')
      .delete()
      .eq('id', parseInt(id))

    if (deleteError) {
      console.error('Erro ao deletar avaliação:', deleteError)
      return res.status(500).json({
        success: false,
        error: { message: deleteError.message, code: 'SUPABASE_ERROR' }
      })
    }

    return res.json({
      success: true,
      data: { message: 'Avaliação deletada com sucesso' }
    })
  } catch (err) {
    return next(err)
  }
})

/**
 * @swagger
 * /api/employee-evaluations/{id}/close:
 *   patch:
 *     summary: Encerra uma avaliação
 *     tags: [Employee Evaluations]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Avaliação encerrada com sucesso
 */
router.patch('/:id/close', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params['id']
    if (!id) {
      return res.status(400).json({
        success: false,
        error: { message: 'ID da avaliação é obrigatório', code: 'INVALID_REQUEST' }
      })
    }

    // Buscar status "Fechado"
    const { data: statusData, error: statusError } = await supabaseAdmin
      .from('domains')
      .select('id')
      .eq('type', 'evaluation_status')
      .ilike('value', '%fechado%')
      .limit(1)
      .single()

    if (statusError) {
      console.error('Erro ao buscar status Fechado:', statusError)
      return res.status(500).json({
        success: false,
        error: { message: 'Erro ao buscar status de fechamento', code: 'SUPABASE_ERROR' }
      })
    }

    // Atualizar avaliação
    const { data, error } = await supabaseAdmin
      .from('evaluations')
      .update({
        is_closed: true,
        status_id: statusData.id
      })
      .eq('id', parseInt(id))
      .select()
      .single()

    if (error) {
      console.error('Erro ao encerrar avaliação:', error)
      return res.status(500).json({
        success: false,
        error: { message: error.message, code: 'SUPABASE_ERROR' }
      })
    }

    return res.json({
      success: true,
      data
    })
  } catch (err) {
    return next(err)
  }
})

// ============================================================================
// QUESTIONS (from evaluation model)
// ============================================================================

/**
 * @swagger
 * /api/employee-evaluations/{id}/questions:
 *   get:
 *     summary: Obtém as perguntas do modelo vinculado à avaliação
 *     tags: [Employee Evaluations]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Lista de perguntas com categorias e tipos de resposta
 */
router.get('/:id/questions', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params['id']
    if (!id) {
      return res.status(400).json({
        success: false,
        error: { message: 'ID da avaliação é obrigatório', code: 'INVALID_REQUEST' }
      })
    }

    // Buscar avaliação para obter o evaluation_model_id
    const { data: evaluation, error: evalError } = await supabaseAdmin
      .from('evaluations')
      .select('evaluation_model_id')
      .eq('id', parseInt(id))
      .single()

    if (evalError) {
      console.error('Erro ao buscar avaliação:', evalError)
      return res.status(500).json({
        success: false,
        error: { message: evalError.message, code: 'SUPABASE_ERROR' }
      })
    }

    if (!evaluation?.evaluation_model_id) {
      return res.status(400).json({
        success: false,
        error: { message: 'Avaliação não possui modelo vinculado', code: 'INVALID_REQUEST' }
      })
    }

    // Buscar perguntas do modelo
    const { data: evalQuestions, error: questionsError } = await supabaseAdmin
      .from('evaluations_questions_model')
      .select(`
        id,
        question_id,
        category_order,
        question_order,
        subcategory_order,
        questions_model (
          id,
          question,
          description,
          category_id,
          subcategory_id,
          reply_type_id,
          weight,
          required
        )
      `)
      .eq('evaluation_id', evaluation.evaluation_model_id)
      .order('category_order', { ascending: true })
      .order('subcategory_order', { ascending: true })
      .order('question_order', { ascending: true })

    if (questionsError) {
      console.error('Erro ao buscar perguntas:', questionsError)
      return res.status(500).json({
        success: false,
        error: { message: questionsError.message, code: 'SUPABASE_ERROR' }
      })
    }

    // Extrair IDs únicos de categorias e subcategorias
    const categoryIds = new Set<number>()
    const subcategoryIds = new Set<number>()
    const replyTypeIds = new Set<number>()

    evalQuestions?.forEach((item: any) => {
      if (item.questions_model?.category_id) {
        categoryIds.add(item.questions_model.category_id)
      }
      if (item.questions_model?.subcategory_id) {
        subcategoryIds.add(item.questions_model.subcategory_id)
      }
      if (item.questions_model?.reply_type_id) {
        replyTypeIds.add(item.questions_model.reply_type_id)
      }
    })

    const allDomainIds = [...Array.from(categoryIds), ...Array.from(subcategoryIds), ...Array.from(replyTypeIds)]

    // Buscar todos os domains necessários
    let domainsMap = new Map<number, any>()
    if (allDomainIds.length > 0) {
      const { data: domainsData, error: domainsError } = await supabaseAdmin
        .from('domains')
        .select('*')
        .in('id', allDomainIds)

      if (domainsError) {
        console.error('Erro ao buscar domains:', domainsError)
      } else if (domainsData) {
        domainsData.forEach((d: any) => {
          domainsMap.set(d.id, d)
        })
      }
    }

    // Processar perguntas
    const processedQuestions = (evalQuestions || [])
      .map((item: any) => {
        const q = item.questions_model
        if (!q) return null

        const categoryDomain = domainsMap.get(q.category_id)
        const subcategoryDomain = domainsMap.get(q.subcategory_id)
        const replyTypeDomain = domainsMap.get(q.reply_type_id)

        return {
          evaluation_question_id: item.id,
          question_id: q.id,
          question: q.question,
          description: q.description,
          category_id: q.category_id,
          category: categoryDomain?.value || '',
          subcategory_id: q.subcategory_id,
          subcategory: subcategoryDomain?.value || '',
          reply_type_id: q.reply_type_id,
          reply_type: replyTypeDomain?.value || '',
          weight: q.weight || 1,
          required: q.required ?? true,
          category_order: item.category_order,
          subcategory_order: item.subcategory_order,
          question_order: item.question_order
        }
      })
      .filter((q: any) => q !== null)

    // Extrair categorias únicas
    const categoriesArray = Array.from(categoryIds).map(catId => domainsMap.get(catId)).filter(Boolean)
    const subcategoriesArray = Array.from(subcategoryIds).map(subId => domainsMap.get(subId)).filter(Boolean)
    const allCategories = [...categoriesArray, ...subcategoriesArray]

    return res.json({
      success: true,
      data: {
        questions: processedQuestions,
        categories: allCategories
      }
    })
  } catch (err) {
    return next(err)
  }
})

// ============================================================================
// RESPONSES
// ============================================================================

/**
 * @swagger
 * /api/employee-evaluations/{id}/responses:
 *   get:
 *     summary: Obtém as respostas salvas de uma avaliação
 *     tags: [Employee Evaluations]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Lista de respostas salvas
 */
router.get('/:id/responses', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params['id']
    if (!id) {
      return res.status(400).json({
        success: false,
        error: { message: 'ID da avaliação é obrigatório', code: 'INVALID_REQUEST' }
      })
    }

    const { data, error } = await supabaseAdmin
      .from('evaluations_questions_reply')
      .select('*')
      .eq('evaluation_id', parseInt(id))

    if (error) {
      console.error('Erro ao buscar respostas:', error)
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
 * /api/employee-evaluations/{id}/responses:
 *   put:
 *     summary: Salva todas as respostas de uma avaliação (delete + insert)
 *     tags: [Employee Evaluations]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - responses
 *             properties:
 *               responses:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     question_id:
 *                       type: integer
 *                     score:
 *                       type: number
 *                     reply:
 *                       type: string
 *                     yes_no:
 *                       type: boolean
 *                     weight:
 *                       type: number
 *     responses:
 *       200:
 *         description: Respostas salvas com sucesso
 */
router.put('/:id/responses', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params['id']
    if (!id) {
      return res.status(400).json({
        success: false,
        error: { message: 'ID da avaliação é obrigatório', code: 'INVALID_REQUEST' }
      })
    }

    const { responses } = req.body

    if (!responses || !Array.isArray(responses)) {
      return res.status(400).json({
        success: false,
        error: { message: 'Array de respostas é obrigatório', code: 'INVALID_REQUEST' }
      })
    }

    // Verificar avaliação e obter user_id/owner_id
    const { data: evaluation, error: evalError } = await supabaseAdmin
      .from('evaluations')
      .select('is_closed, user_id, owner_id, evaluation_model_id')
      .eq('id', parseInt(id))
      .single()

    if (evalError) {
      console.error('Erro ao verificar avaliação:', evalError)
      return res.status(500).json({
        success: false,
        error: { message: evalError.message, code: 'SUPABASE_ERROR' }
      })
    }

    if (evaluation?.is_closed) {
      return res.status(400).json({
        success: false,
        error: { message: 'Esta avaliação foi encerrada e não pode mais ser alterada', code: 'EVALUATION_CLOSED' }
      })
    }

    // Buscar informações das perguntas do modelo
    const { data: questionsData, error: questionsError } = await supabaseAdmin
      .from('evaluations_questions_model')
      .select(`
        question_id,
        questions_model (
          id,
          question,
          category_id,
          subcategory_id,
          reply_type_id
        )
      `)
      .eq('evaluation_id', evaluation.evaluation_model_id)

    if (questionsError) {
      console.error('Erro ao buscar perguntas:', questionsError)
      return res.status(500).json({
        success: false,
        error: { message: questionsError.message, code: 'SUPABASE_ERROR' }
      })
    }

    // Extrair IDs de categorias, subcategorias e reply_types
    const domainIds = new Set<number>()
    questionsData?.forEach((item: any) => {
      if (item.questions_model?.category_id) domainIds.add(item.questions_model.category_id)
      if (item.questions_model?.subcategory_id) domainIds.add(item.questions_model.subcategory_id)
      if (item.questions_model?.reply_type_id) domainIds.add(item.questions_model.reply_type_id)
    })

    // Buscar domains para obter os nomes
    let domainsMap = new Map<number, string>()
    if (domainIds.size > 0) {
      const { data: domainsData } = await supabaseAdmin
        .from('domains')
        .select('id, value')
        .in('id', Array.from(domainIds))

      if (domainsData) {
        domainsData.forEach((d: any) => {
          domainsMap.set(d.id, d.value || '')
        })
      }
    }

    // Criar mapa de perguntas
    const questionsMap = new Map<number, any>()
    questionsData?.forEach((item: any) => {
      const q = item.questions_model
      if (q) {
        questionsMap.set(q.id, {
          question: q.question || '',
          category_id: q.category_id || null,
          subcategory_id: q.subcategory_id || null,
          category: domainsMap.get(q.category_id) || '',
          subcategory: domainsMap.get(q.subcategory_id) || '',
          reply_type: domainsMap.get(q.reply_type_id) || ''
        })
      }
    })

    // Filtrar e enriquecer respostas válidas
    const validResponses = responses
      .filter((r: any) => r.score !== null || r.reply?.trim() || r.yes_no !== null)
      .map((r: any) => {
        const questionInfo = questionsMap.get(r.question_id) || {}
        return {
          evaluation_id: parseInt(id),
          question_id: r.question_id,
          category_id: questionInfo.category_id || null,
          subcategory_id: questionInfo.subcategory_id || null,
          category: questionInfo.category || '',
          subcategory: questionInfo.subcategory || '',
          question: questionInfo.question || '',
          score: r.score,
          reply: r.reply || null,
          yes_no: r.yes_no,
          weight: r.weight || 1,
          reply_type: questionInfo.reply_type || '',
          user_id: evaluation.user_id || null,
          owner_id: evaluation.owner_id || null
        }
      })

    if (validResponses.length === 0) {
      return res.status(400).json({
        success: false,
        error: { message: 'Nenhuma resposta válida para salvar', code: 'INVALID_REQUEST' }
      })
    }

    // Deletar respostas existentes
    const { error: deleteError } = await supabaseAdmin
      .from('evaluations_questions_reply')
      .delete()
      .eq('evaluation_id', parseInt(id))

    if (deleteError) {
      console.error('Erro ao deletar respostas existentes:', deleteError)
      return res.status(500).json({
        success: false,
        error: { message: deleteError.message, code: 'SUPABASE_ERROR' }
      })
    }

    // Inserir novas respostas
    const { error: insertError } = await supabaseAdmin
      .from('evaluations_questions_reply')
      .insert(validResponses)

    if (insertError) {
      console.error('Erro ao inserir respostas:', insertError)
      return res.status(500).json({
        success: false,
        error: { message: insertError.message, code: 'SUPABASE_ERROR' }
      })
    }

    // Atualizar status da avaliação para "Em Andamento" se estava "Aberto"
    const { data: emAndamentoStatus } = await supabaseAdmin
      .from('domains')
      .select('id')
      .eq('type', 'evaluation_status')
      .ilike('value', '%andamento%')
      .limit(1)
      .single()

    if (emAndamentoStatus) {
      await supabaseAdmin
        .from('evaluations')
        .update({ status_id: emAndamentoStatus.id })
        .eq('id', parseInt(id))
        .neq('is_closed', true)
    }

    return res.json({
      success: true,
      data: { message: 'Respostas salvas com sucesso', count: validResponses.length }
    })
  } catch (err) {
    return next(err)
  }
})

export default router
