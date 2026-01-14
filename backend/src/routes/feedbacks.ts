import { Router, Request, Response, NextFunction } from 'express'
import { supabaseAdmin } from '../lib/supabaseAdmin'
import { sessionAuth } from '../middleware/sessionAuth'

const router = Router()

// Aplicar middleware de autenticação por sessão em todas as rotas
router.use(sessionAuth)

// ============================================================================
// FEEDBACKS CRUD
// ============================================================================

/**
 * @swagger
 * /api/feedbacks:
 *   get:
 *     summary: Lista feedbacks com filtros
 *     tags: [Feedbacks]
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *         description: Data início (YYYY-MM-DD)
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *         description: Data fim (YYYY-MM-DD)
 *       - in: query
 *         name: consultantIds
 *         schema:
 *           type: string
 *         description: IDs dos consultores separados por vírgula
 *     responses:
 *       200:
 *         description: Lista de feedbacks
 */
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { startDate, endDate, consultantIds } = req.query

    // Buscar feedbacks - usa campo is_pdi existente na tabela
    let query = supabaseAdmin
      .from('feedbacks')
      .select(`
        id,
        feedback_user_id,
        feedback_user_name,
        owner_user_id,
        owner_user_name,
        feedback_date,
        type,
        type_id,
        public_comment,
        private_comment,
        is_pdi,
        is_closed,
        closed_at,
        accepted,
        accepted_at
      `)
      .order('feedback_date', { ascending: false })

    // Filtrar por datas se fornecidas (opcional)
    if (startDate && typeof startDate === 'string') {
      query = query.gte('feedback_date', startDate)
    }
    if (endDate && typeof endDate === 'string') {
      query = query.lte('feedback_date', endDate)
    }

    // Filtrar por consultores se fornecido
    if (consultantIds && typeof consultantIds === 'string' && consultantIds.trim() !== '') {
      const ids = consultantIds.split(',').map(id => id.trim()).filter(id => id !== '')
      if (ids.length > 0) {
        query = query.in('feedback_user_id', ids)
      }
    }

    const { data, error } = await query

    if (error) {
      console.error('Erro ao buscar feedbacks:', error)
      return res.status(500).json({
        success: false,
        error: { message: error.message, code: 'SUPABASE_ERROR' }
      })
    }

    // Processar dados para incluir has_pdi baseado no campo is_pdi
    const feedbacksWithPDI = (data || []).map((feedback: any) => ({
      ...feedback,
      has_pdi: feedback.is_pdi || false
    }))

    return res.json({
      success: true,
      data: feedbacksWithPDI
    })
  } catch (err) {
    return next(err)
  }
})

/**
 * @swagger
 * /api/feedbacks/{id}:
 *   get:
 *     summary: Busca um feedback por ID
 *     tags: [Feedbacks]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID do feedback
 *     responses:
 *       200:
 *         description: Dados do feedback
 *       404:
 *         description: Feedback não encontrado
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

    const { data, error } = await supabaseAdmin
      .from('feedbacks')
      .select(`
        id,
        feedback_user_id,
        feedback_user_name,
        owner_user_id,
        owner_user_name,
        feedback_date,
        type,
        type_id,
        public_comment,
        private_comment,
        is_pdi
      `)
      .eq('id', id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({
          success: false,
          error: { message: 'Feedback não encontrado', code: 'NOT_FOUND' }
        })
      }
      console.error('Erro ao buscar feedback:', error)
      return res.status(500).json({
        success: false,
        error: { message: error.message, code: 'SUPABASE_ERROR' }
      })
    }

    return res.json({
      success: true,
      data: {
        ...data,
        has_pdi: data.is_pdi || false
      }
    })
  } catch (err) {
    return next(err)
  }
})

/**
 * @swagger
 * /api/feedbacks:
 *   post:
 *     summary: Cria um novo feedback
 *     tags: [Feedbacks]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - feedback_user_id
 *               - feedback_user_name
 *               - owner_user_id
 *               - owner_user_name
 *               - feedback_date
 *               - type
 *               - public_comment
 *             properties:
 *               feedback_user_id:
 *                 type: string
 *               feedback_user_name:
 *                 type: string
 *               owner_user_id:
 *                 type: string
 *               owner_user_name:
 *                 type: string
 *               feedback_date:
 *                 type: string
 *               type:
 *                 type: string
 *               type_id:
 *                 type: integer
 *               public_comment:
 *                 type: string
 *               private_comment:
 *                 type: string
 *     responses:
 *       201:
 *         description: Feedback criado com sucesso
 *       400:
 *         description: Dados inválidos
 */
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const {
      feedback_user_id,
      feedback_user_name,
      owner_user_id,
      owner_user_name,
      feedback_date,
      type,
      type_id,
      public_comment,
      private_comment
    } = req.body

    // Validações
    if (!feedback_user_id || !feedback_user_name) {
      return res.status(400).json({
        success: false,
        error: { message: 'Consultor é obrigatório', code: 'VALIDATION_ERROR' }
      })
    }

    if (!feedback_date) {
      return res.status(400).json({
        success: false,
        error: { message: 'Data do feedback é obrigatória', code: 'VALIDATION_ERROR' }
      })
    }

    if (!type) {
      return res.status(400).json({
        success: false,
        error: { message: 'Tipo de feedback é obrigatório', code: 'VALIDATION_ERROR' }
      })
    }

    if (!public_comment || !public_comment.trim()) {
      return res.status(400).json({
        success: false,
        error: { message: 'Comentário é obrigatório', code: 'VALIDATION_ERROR' }
      })
    }

    const { data, error } = await supabaseAdmin
      .from('feedbacks')
      .insert({
        feedback_user_id,
        feedback_user_name,
        owner_user_id,
        owner_user_name,
        feedback_date,
        type,
        type_id,
        public_comment: public_comment.trim(),
        private_comment: private_comment?.trim() || null
      })
      .select()
      .single()

    if (error) {
      console.error('Erro ao criar feedback:', error)
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
 * /api/feedbacks/{id}:
 *   patch:
 *     summary: Atualiza um feedback
 *     tags: [Feedbacks]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID do feedback
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               feedback_user_id:
 *                 type: string
 *               feedback_user_name:
 *                 type: string
 *               feedback_date:
 *                 type: string
 *               type:
 *                 type: string
 *               type_id:
 *                 type: integer
 *               public_comment:
 *                 type: string
 *               private_comment:
 *                 type: string
 *               is_pdi:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Feedback atualizado com sucesso
 *       404:
 *         description: Feedback não encontrado
 */
router.patch('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params
    const updateData = req.body

    if (!id) {
      return res.status(400).json({
        success: false,
        error: { message: 'ID é obrigatório', code: 'VALIDATION_ERROR' }
      })
    }

    // Limpar campos de texto se fornecidos
    if (updateData.public_comment) {
      updateData.public_comment = updateData.public_comment.trim()
    }
    if (updateData.private_comment !== undefined) {
      updateData.private_comment = updateData.private_comment?.trim() || null
    }

    const { data, error } = await supabaseAdmin
      .from('feedbacks')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({
          success: false,
          error: { message: 'Feedback não encontrado', code: 'NOT_FOUND' }
        })
      }
      console.error('Erro ao atualizar feedback:', error)
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
 * /api/feedbacks/{id}:
 *   delete:
 *     summary: Deleta um feedback
 *     tags: [Feedbacks]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID do feedback
 *     responses:
 *       200:
 *         description: Feedback deletado com sucesso
 *       404:
 *         description: Feedback não encontrado
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
      .from('feedbacks')
      .select('id')
      .eq('id', id)
      .single()

    if (checkError || !existing) {
      return res.status(404).json({
        success: false,
        error: { message: 'Feedback não encontrado', code: 'NOT_FOUND' }
      })
    }

    const { error } = await supabaseAdmin
      .from('feedbacks')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Erro ao deletar feedback:', error)
      return res.status(500).json({
        success: false,
        error: { message: error.message, code: 'SUPABASE_ERROR' }
      })
    }

    return res.json({
      success: true,
      message: 'Feedback deletado com sucesso'
    })
  } catch (err) {
    return next(err)
  }
})

/**
 * @swagger
 * /api/feedbacks/{id}/close:
 *   patch:
 *     summary: Encerra um feedback (bloqueia edição)
 *     tags: [Feedbacks]
 *     security:
 *       - sessionAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID do feedback
 *     responses:
 *       200:
 *         description: Feedback encerrado com sucesso
 *       403:
 *         description: Apenas o criador do feedback pode encerrá-lo
 *       404:
 *         description: Feedback não encontrado
 */
router.patch('/:id/close', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params

    if (!id) {
      return res.status(400).json({
        success: false,
        error: { message: 'ID é obrigatório', code: 'VALIDATION_ERROR' }
      })
    }

    // Encerrar o feedback
    const { data, error } = await supabaseAdmin
      .from('feedbacks')
      .update({
        is_closed: true,
        closed_at: new Date().toISOString()
      })
      .eq('id', parseInt(id))
      .select()
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({
          success: false,
          error: { message: 'Feedback não encontrado', code: 'NOT_FOUND' }
        })
      }
      console.error('Erro ao encerrar feedback:', error)
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
 * /api/feedbacks/{id}/pdi:
 *   get:
 *     summary: Verifica se feedback tem PDI vinculado
 *     tags: [Feedbacks]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID do feedback
 *     responses:
 *       200:
 *         description: Status do PDI
 */
router.get('/:id/pdi', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params

    if (!id) {
      return res.status(400).json({
        success: false,
        error: { message: 'ID é obrigatório', code: 'VALIDATION_ERROR' }
      })
    }

    const { data, error } = await supabaseAdmin
      .from('pdi')
      .select('id')
      .eq('feedback_id', id)
      .limit(1)

    if (error) {
      console.error('Erro ao verificar PDI:', error)
      return res.status(500).json({
        success: false,
        error: { message: error.message, code: 'SUPABASE_ERROR' }
      })
    }

    const hasPdi = data && data.length > 0

    // Se existe PDI, garantir que o campo is_pdi está true
    if (hasPdi) {
      await supabaseAdmin
        .from('feedbacks')
        .update({ is_pdi: true })
        .eq('id', id)
    }

    return res.json({
      success: true,
      data: { has_pdi: hasPdi }
    })
  } catch (err) {
    return next(err)
  }
})

/**
 * @swagger
 * /api/feedbacks/{id}/pdi:
 *   patch:
 *     summary: Atualiza flag is_pdi do feedback
 *     tags: [Feedbacks]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID do feedback
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - is_pdi
 *             properties:
 *               is_pdi:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Flag atualizada com sucesso
 */
router.patch('/:id/pdi', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params
    const { is_pdi } = req.body

    if (!id) {
      return res.status(400).json({
        success: false,
        error: { message: 'ID é obrigatório', code: 'VALIDATION_ERROR' }
      })
    }

    if (typeof is_pdi !== 'boolean') {
      return res.status(400).json({
        success: false,
        error: { message: 'is_pdi deve ser um boolean', code: 'VALIDATION_ERROR' }
      })
    }

    const { data, error } = await supabaseAdmin
      .from('feedbacks')
      .update({ is_pdi })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({
          success: false,
          error: { message: 'Feedback não encontrado', code: 'NOT_FOUND' }
        })
      }
      console.error('Erro ao atualizar flag PDI:', error)
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

export default router
