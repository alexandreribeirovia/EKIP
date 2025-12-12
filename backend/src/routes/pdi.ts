import { Router, Request, Response, NextFunction } from 'express'
import { supabaseAdmin } from '../lib/supabaseAdmin'
import { sessionAuth } from '../middleware/sessionAuth'

const router = Router()

// Aplicar middleware de autenticação por sessão em todas as rotas
router.use(sessionAuth)

// ============================================================================
// PDI CRUD
// ============================================================================

/**
 * @swagger
 * /api/pdi:
 *   get:
 *     summary: Lista PDIs com filtros
 *     tags: [PDI]
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *         description: Data início (YYYY-MM-DD) - filtra por updated_at
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *         description: Data fim (YYYY-MM-DD) - filtra por updated_at
 *       - in: query
 *         name: consultantIds
 *         schema:
 *           type: string
 *         description: IDs dos consultores separados por vírgula
 *       - in: query
 *         name: managerIds
 *         schema:
 *           type: string
 *         description: IDs dos responsáveis separados por vírgula
 *       - in: query
 *         name: statusIds
 *         schema:
 *           type: string
 *         description: IDs dos status separados por vírgula
 *     responses:
 *       200:
 *         description: Lista de PDIs
 */
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { startDate, endDate, consultantIds, managerIds, statusIds } = req.query

    // Validar datas obrigatórias
    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        error: { message: 'startDate e endDate são obrigatórios', code: 'VALIDATION_ERROR' }
      })
    }

    // Buscar PDIs
    let query = supabaseAdmin
      .from('pdi')
      .select('*')
      .gte('updated_at', startDate as string)
      .lte('updated_at', (endDate as string) + 'T23:59:59')
      .order('updated_at', { ascending: false })

    // Filtrar por consultores se fornecido
    if (consultantIds && typeof consultantIds === 'string' && consultantIds.trim() !== '') {
      const ids = consultantIds.split(',').map(id => id.trim()).filter(id => id !== '')
      if (ids.length > 0) {
        query = query.in('user_id', ids)
      }
    }

    // Filtrar por responsáveis se fornecido
    if (managerIds && typeof managerIds === 'string' && managerIds.trim() !== '') {
      const ids = managerIds.split(',').map(id => id.trim()).filter(id => id !== '')
      if (ids.length > 0) {
        query = query.in('owner_id', ids)
      }
    }

    // Filtrar por status se fornecido
    if (statusIds && typeof statusIds === 'string' && statusIds.trim() !== '') {
      const ids = statusIds.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id))
      if (ids.length > 0) {
        query = query.in('status_id', ids)
      }
    }

    const { data, error } = await query

    if (error) {
      console.error('Erro ao buscar PDIs:', error)
      return res.status(500).json({
        success: false,
        error: { message: error.message, code: 'SUPABASE_ERROR' }
      })
    }

    // Buscar status da tabela domains para join manual
    const { data: statusData, error: statusError } = await supabaseAdmin
      .from('domains')
      .select('id, value')
      .eq('type', 'pdi_status')

    if (statusError) {
      console.error('Erro ao buscar status:', statusError)
    }

    const statusMap = new Map()
    if (statusData) {
      statusData.forEach((status) => {
        statusMap.set(status.id, status)
      })
    }

    // Buscar contagem de competências por PDI
    const pdiIds = (data || []).map(pdi => pdi.id)
    const competencyCounts = new Map()

    if (pdiIds.length > 0) {
      const { data: itemsData, error: itemsError } = await supabaseAdmin
        .from('pdi_items')
        .select('pdi_id')
        .in('pdi_id', pdiIds)

      if (!itemsError && itemsData) {
        itemsData.forEach((item) => {
          const count = competencyCounts.get(item.pdi_id) || 0
          competencyCounts.set(item.pdi_id, count + 1)
        })
      }
    }

    // Montar resposta com status e contagem de competências
    const pdisWithStatus = (data || []).map((pdi) => ({
      ...pdi,
      status: pdi.status_id ? statusMap.get(pdi.status_id) : null,
      competency_count: competencyCounts.get(pdi.id) || 0,
    }))

    return res.json({
      success: true,
      data: pdisWithStatus
    })
  } catch (err) {
    return next(err)
  }
})

/**
 * @swagger
 * /api/pdi/{id}:
 *   get:
 *     summary: Busca um PDI por ID com seus itens
 *     tags: [PDI]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID do PDI
 *     responses:
 *       200:
 *         description: Dados do PDI com itens
 *       404:
 *         description: PDI não encontrado
 */
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params

    if (!id) {
      return res.status(400).json({
        success: false,
        error: { message: 'ID é obrigatório', code: 'VALIDATION_ERROR' }
      })
    }

    // Buscar PDI
    const { data: pdiData, error: pdiError } = await supabaseAdmin
      .from('pdi')
      .select('*')
      .eq('id', id)
      .single()

    if (pdiError) {
      if (pdiError.code === 'PGRST116') {
        return res.status(404).json({
          success: false,
          error: { message: 'PDI não encontrado', code: 'NOT_FOUND' }
        })
      }
      console.error('Erro ao buscar PDI:', pdiError)
      return res.status(500).json({
        success: false,
        error: { message: pdiError.message, code: 'SUPABASE_ERROR' }
      })
    }

    // Buscar itens do PDI
    const { data: itemsData, error: itemsError } = await supabaseAdmin
      .from('pdi_items')
      .select('*')
      .eq('pdi_id', id)
      .order('created_at')

    if (itemsError) {
      console.error('Erro ao buscar itens do PDI:', itemsError)
      return res.status(500).json({
        success: false,
        error: { message: itemsError.message, code: 'SUPABASE_ERROR' }
      })
    }

    return res.json({
      success: true,
      data: {
        ...pdiData,
        items: itemsData || []
      }
    })
  } catch (err) {
    return next(err)
  }
})

/**
 * @swagger
 * /api/pdi/by-evaluation/{evaluationId}:
 *   get:
 *     summary: Busca PDI vinculado a uma avaliação
 *     tags: [PDI]
 *     parameters:
 *       - in: path
 *         name: evaluationId
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID da avaliação
 *     responses:
 *       200:
 *         description: PDI encontrado ou null
 */
router.get('/by-evaluation/:evaluationId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { evaluationId } = req.params

    if (!evaluationId) {
      return res.status(400).json({
        success: false,
        error: { message: 'evaluationId é obrigatório', code: 'VALIDATION_ERROR' }
      })
    }

    const { data, error } = await supabaseAdmin
      .from('pdi')
      .select('id')
      .eq('evaluation_id', evaluationId)
      .maybeSingle()

    if (error) {
      console.error('Erro ao buscar PDI por evaluation_id:', error)
      return res.status(500).json({
        success: false,
        error: { message: error.message, code: 'SUPABASE_ERROR' }
      })
    }

    return res.json({
      success: true,
      data: data // null se não encontrou
    })
  } catch (err) {
    return next(err)
  }
})

/**
 * @swagger
 * /api/pdi/by-feedback/{feedbackId}:
 *   get:
 *     summary: Busca PDI vinculado a um feedback
 *     tags: [PDI]
 *     parameters:
 *       - in: path
 *         name: feedbackId
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID do feedback
 *     responses:
 *       200:
 *         description: PDI encontrado ou null
 */
router.get('/by-feedback/:feedbackId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { feedbackId } = req.params

    if (!feedbackId) {
      return res.status(400).json({
        success: false,
        error: { message: 'feedbackId é obrigatório', code: 'VALIDATION_ERROR' }
      })
    }

    const { data, error } = await supabaseAdmin
      .from('pdi')
      .select('id')
      .eq('feedback_id', feedbackId)
      .maybeSingle()

    if (error) {
      console.error('Erro ao buscar PDI por feedback_id:', error)
      return res.status(500).json({
        success: false,
        error: { message: error.message, code: 'SUPABASE_ERROR' }
      })
    }

    return res.json({
      success: true,
      data: data // null se não encontrou
    })
  } catch (err) {
    return next(err)
  }
})

/**
 * @swagger
 * /api/pdi:
 *   post:
 *     summary: Cria um novo PDI com itens (transacional via RPC)
 *     tags: [PDI]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - pdi
 *               - items
 *             properties:
 *               pdi:
 *                 type: object
 *               items:
 *                 type: array
 *     responses:
 *       201:
 *         description: PDI criado com sucesso
 */
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { pdi, items } = req.body

    // Validações básicas
    if (!pdi || !pdi.user_id || !pdi.owner_id || !pdi.status_id) {
      return res.status(400).json({
        success: false,
        error: { message: 'Dados do PDI incompletos', code: 'VALIDATION_ERROR' }
      })
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        error: { message: 'É necessário pelo menos um item de competência', code: 'VALIDATION_ERROR' }
      })
    }

    // Chamar a RPC function para criar PDI com itens em transação
    const { data, error } = await supabaseAdmin.rpc('create_pdi_with_items', {
      p_pdi_data: pdi,
      p_items_data: items
    })

    if (error) {
      console.error('Erro ao criar PDI:', error)
      return res.status(500).json({
        success: false,
        error: { message: error.message, code: 'SUPABASE_ERROR' }
      })
    }

    return res.status(201).json({
      success: true,
      data
    })
  } catch (err) {
    return next(err)
  }
})

/**
 * @swagger
 * /api/pdi/{id}:
 *   put:
 *     summary: Atualiza um PDI com itens (transacional via RPC)
 *     tags: [PDI]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID do PDI
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - pdi
 *               - items
 *     responses:
 *       200:
 *         description: PDI atualizado com sucesso
 */
router.put('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params
    const { pdi, items } = req.body

    if (!id) {
      return res.status(400).json({
        success: false,
        error: { message: 'ID é obrigatório', code: 'VALIDATION_ERROR' }
      })
    }

    // Validações básicas
    if (!pdi || !pdi.user_id || !pdi.owner_id || !pdi.status_id) {
      return res.status(400).json({
        success: false,
        error: { message: 'Dados do PDI incompletos', code: 'VALIDATION_ERROR' }
      })
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        error: { message: 'É necessário pelo menos um item de competência', code: 'VALIDATION_ERROR' }
      })
    }

    // Chamar a RPC function para atualizar PDI com itens em transação
    const { data, error } = await supabaseAdmin.rpc('update_pdi_with_items', {
      p_pdi_id: parseInt(id),
      p_pdi_data: pdi,
      p_items_data: items
    })

    if (error) {
      console.error('Erro ao atualizar PDI:', error)
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

/**
 * @swagger
 * /api/pdi/{id}:
 *   delete:
 *     summary: Deleta um PDI (cascade deleta itens automaticamente)
 *     tags: [PDI]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID do PDI
 *     responses:
 *       200:
 *         description: PDI deletado com sucesso
 *       404:
 *         description: PDI não encontrado
 */
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params

    if (!id) {
      return res.status(400).json({
        success: false,
        error: { message: 'ID é obrigatório', code: 'VALIDATION_ERROR' }
      })
    }

    // Verificar se existe antes de deletar
    const { data: existing, error: checkError } = await supabaseAdmin
      .from('pdi')
      .select('id')
      .eq('id', id)
      .single()

    if (checkError || !existing) {
      return res.status(404).json({
        success: false,
        error: { message: 'PDI não encontrado', code: 'NOT_FOUND' }
      })
    }

    // Deletar o PDI (cascade deleta pdi_items automaticamente)
    const { error } = await supabaseAdmin
      .from('pdi')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Erro ao deletar PDI:', error)
      return res.status(500).json({
        success: false,
        error: { message: error.message, code: 'SUPABASE_ERROR' }
      })
    }

    return res.json({
      success: true,
      message: 'PDI deletado com sucesso'
    })
  } catch (err) {
    return next(err)
  }
})

export default router
