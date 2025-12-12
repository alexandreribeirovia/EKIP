import { Router, Request, Response, NextFunction } from 'express'
import { supabaseAdmin } from '../lib/supabaseAdmin'
import { sessionAuth } from '../middleware/sessionAuth'

const router = Router()

// Aplicar middleware de autenticação por sessão em todas as rotas
router.use(sessionAuth)

// ============================================================================
// EVALUATIONS CRUD
// ============================================================================

/**
 * @swagger
 * /api/evaluations:
 *   get:
 *     summary: Lista todos os modelos de avaliação
 *     tags: [Evaluations]
 *     responses:
 *       200:
 *         description: Lista de modelos de avaliação
 */
router.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('evaluations_model')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Erro ao buscar avaliações:', error)
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
// STATIC ROUTES (must be defined BEFORE /:id routes to avoid conflicts)
// ============================================================================

/**
 * @swagger
 * /api/evaluations/categories:
 *   get:
 *     summary: Lista categorias de avaliação disponíveis
 *     tags: [Evaluations]
 *     responses:
 *       200:
 *         description: Lista de categorias
 */
router.get('/categories', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('domains')
      .select('*')
      .eq('type', 'evaluation_category')
      .eq('is_active', true)
      .order('value')

    if (error) {
      console.error('Erro ao buscar categorias:', error)
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
 * /api/evaluations/categories/{categoryId}/subcategories:
 *   get:
 *     summary: Lista subcategorias de uma categoria
 *     tags: [Evaluations]
 *     parameters:
 *       - in: path
 *         name: categoryId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Lista de subcategorias
 */
router.get('/categories/:categoryId/subcategories', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const categoryId = req.params['categoryId']
    if (!categoryId) {
      return res.status(400).json({
        success: false,
        error: { message: 'ID da categoria é obrigatório', code: 'INVALID_REQUEST' }
      })
    }

    const { data, error } = await supabaseAdmin
      .from('domains')
      .select('*')
      .eq('type', 'evaluation_subcategory')
      .eq('parent_id', parseInt(categoryId))
      .eq('is_active', true)
      .order('value')

    if (error) {
      console.error('Erro ao buscar subcategorias:', error)
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
 * /api/evaluations/reply-types:
 *   get:
 *     summary: Lista tipos de resposta disponíveis
 *     tags: [Evaluations]
 *     responses:
 *       200:
 *         description: Lista de tipos de resposta
 */
router.get('/reply-types', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('domains')
      .select('id, value')
      .eq('type', 'evaluation_reply_type')
      .eq('is_active', true)
      .order('value')

    if (error) {
      console.error('Erro ao buscar tipos de resposta:', error)
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
// DYNAMIC ROUTES (/:id based routes)
// ============================================================================

/**
 * @swagger
 * /api/evaluations/{id}:
 *   get:
 *     summary: Obtém um modelo de avaliação por ID
 *     tags: [Evaluations]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Modelo de avaliação encontrado
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

    const { data, error } = await supabaseAdmin
      .from('evaluations_model')
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
 * /api/evaluations:
 *   post:
 *     summary: Cria um novo modelo de avaliação
 *     tags: [Evaluations]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               is_active:
 *                 type: boolean
 *     responses:
 *       201:
 *         description: Avaliação criada com sucesso
 */
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, description, is_active = true } = req.body

    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        error: { message: 'Nome da avaliação é obrigatório', code: 'INVALID_REQUEST' }
      })
    }

    const { data, error } = await supabaseAdmin
      .from('evaluations_model')
      .insert([{
        name: name.trim(),
        description: description?.trim() || null,
        is_active
      }])
      .select()
      .single()

    if (error) {
      console.error('Erro ao criar avaliação:', error)
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
 * /api/evaluations/{id}:
 *   put:
 *     summary: Atualiza um modelo de avaliação
 *     tags: [Evaluations]
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
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               is_active:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Avaliação atualizada com sucesso
 */
router.put('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params['id']
    if (!id) {
      return res.status(400).json({
        success: false,
        error: { message: 'ID da avaliação é obrigatório', code: 'INVALID_REQUEST' }
      })
    }

    const { name, description, is_active } = req.body

    const updateData: any = {}
    if (name !== undefined) updateData.name = name.trim()
    if (description !== undefined) updateData.description = description?.trim() || null
    if (is_active !== undefined) updateData.is_active = is_active

    const { data, error } = await supabaseAdmin
      .from('evaluations_model')
      .update(updateData)
      .eq('id', parseInt(id))
      .select()
      .single()

    if (error) {
      console.error('Erro ao atualizar avaliação:', error)
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
 * /api/evaluations/{id}/toggle-status:
 *   patch:
 *     summary: Alterna o status (ativo/inativo) de uma avaliação
 *     tags: [Evaluations]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Status alterado com sucesso
 */
router.patch('/:id/toggle-status', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params['id']
    if (!id) {
      return res.status(400).json({
        success: false,
        error: { message: 'ID da avaliação é obrigatório', code: 'INVALID_REQUEST' }
      })
    }

    // Buscar status atual
    const { data: current, error: fetchError } = await supabaseAdmin
      .from('evaluations_model')
      .select('is_active')
      .eq('id', parseInt(id))
      .single()

    if (fetchError) {
      console.error('Erro ao buscar avaliação:', fetchError)
      return res.status(500).json({
        success: false,
        error: { message: fetchError.message, code: 'SUPABASE_ERROR' }
      })
    }

    // Toggle status
    const { data, error } = await supabaseAdmin
      .from('evaluations_model')
      .update({ is_active: !current.is_active })
      .eq('id', parseInt(id))
      .select()
      .single()

    if (error) {
      console.error('Erro ao alterar status:', error)
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
 * /api/evaluations/{id}:
 *   delete:
 *     summary: Deleta uma avaliação e todas as suas perguntas (cascade)
 *     tags: [Evaluations]
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

    const evaluationId = parseInt(id)

    // 1. Buscar todas as perguntas vinculadas a esta avaliação
    const { data: linkedQuestions, error: fetchError } = await supabaseAdmin
      .from('evaluations_questions_model')
      .select('question_id')
      .eq('evaluation_id', evaluationId)

    if (fetchError) {
      console.error('Erro ao buscar perguntas vinculadas:', fetchError)
      return res.status(500).json({
        success: false,
        error: { message: fetchError.message, code: 'SUPABASE_ERROR' }
      })
    }

    // 2. Deletar os vínculos na tabela evaluations_questions_model
    const { error: linkError } = await supabaseAdmin
      .from('evaluations_questions_model')
      .delete()
      .eq('evaluation_id', evaluationId)

    if (linkError) {
      console.error('Erro ao deletar vínculos:', linkError)
      return res.status(500).json({
        success: false,
        error: { message: linkError.message, code: 'SUPABASE_ERROR' }
      })
    }

    // 3. Deletar as perguntas da tabela questions_model
    if (linkedQuestions && linkedQuestions.length > 0) {
      const questionIds = linkedQuestions.map(q => q.question_id)
      const { error: questionsError } = await supabaseAdmin
        .from('questions_model')
        .delete()
        .in('id', questionIds)

      if (questionsError) {
        console.error('Erro ao deletar perguntas:', questionsError)
        return res.status(500).json({
          success: false,
          error: { message: questionsError.message, code: 'SUPABASE_ERROR' }
        })
      }
    }

    // 4. Finalmente, deletar a avaliação
    const { error: evaluationError } = await supabaseAdmin
      .from('evaluations_model')
      .delete()
      .eq('id', evaluationId)

    if (evaluationError) {
      console.error('Erro ao deletar avaliação:', evaluationError)
      return res.status(500).json({
        success: false,
        error: { message: evaluationError.message, code: 'SUPABASE_ERROR' }
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

// ============================================================================
// QUESTIONS CRUD
// ============================================================================

/**
 * @swagger
 * /api/evaluations/{id}/questions:
 *   get:
 *     summary: Lista todas as perguntas de uma avaliação
 *     tags: [Evaluations]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Lista de perguntas da avaliação
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

    const { data, error } = await supabaseAdmin
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
          category,
          subcategory,
          category_id,
          subcategory_id,
          weight,
          required,
          reply_type_id
        )
      `)
      .eq('evaluation_id', parseInt(id))

    if (error) {
      console.error('Erro ao buscar perguntas:', error)
      return res.status(500).json({
        success: false,
        error: { message: error.message, code: 'SUPABASE_ERROR' }
      })
    }

    // Mapear os dados para o formato esperado pelo frontend
    const questionsData = (data || [])
      .filter(item => item.questions_model)
      .map(item => {
        const q = item.questions_model as any
        return {
          id: q.id,
          question: q.question,
          description: q.description || '',
          category: q.category,
          subcategory: q.subcategory,
          category_id: q.category_id,
          subcategory_id: q.subcategory_id,
          weight: q.weight,
          required: q.required,
          reply_type_id: q.reply_type_id,
          category_order: item.category_order || 0,
          question_order: item.question_order || 0,
          subcategory_order: item.subcategory_order || 0,
          evaluation_question_id: item.id
        }
      })
      .sort((a, b) => {
        if (a.category_order !== b.category_order) {
          return a.category_order - b.category_order
        }
        if (a.subcategory_order !== b.subcategory_order) {
          return a.subcategory_order - b.subcategory_order
        }
        return a.question_order - b.question_order
      })

    return res.json({
      success: true,
      data: questionsData
    })
  } catch (err) {
    return next(err)
  }
})

/**
 * @swagger
 * /api/evaluations/{id}/questions:
 *   post:
 *     summary: Adiciona uma nova pergunta a uma avaliação
 *     tags: [Evaluations]
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
 *               - question
 *               - category_id
 *               - reply_type_id
 *             properties:
 *               question:
 *                 type: string
 *               description:
 *                 type: string
 *               category_id:
 *                 type: integer
 *               subcategory_id:
 *                 type: integer
 *               category:
 *                 type: string
 *               subcategory:
 *                 type: string
 *               weight:
 *                 type: integer
 *               required:
 *                 type: boolean
 *               reply_type_id:
 *                 type: integer
 *               category_order:
 *                 type: integer
 *               subcategory_order:
 *                 type: integer
 *               question_order:
 *                 type: integer
 *     responses:
 *       201:
 *         description: Pergunta criada com sucesso
 */
router.post('/:id/questions', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params['id']
    if (!id) {
      return res.status(400).json({
        success: false,
        error: { message: 'ID da avaliação é obrigatório', code: 'INVALID_REQUEST' }
      })
    }

    const {
      question,
      description,
      category_id,
      subcategory_id,
      category,
      subcategory,
      weight = 1,
      required = true,
      reply_type_id,
      category_order = 0,
      subcategory_order = 0,
      question_order = 0
    } = req.body

    if (!question || !question.trim()) {
      return res.status(400).json({
        success: false,
        error: { message: 'Pergunta é obrigatória', code: 'INVALID_REQUEST' }
      })
    }

    if (!category_id) {
      return res.status(400).json({
        success: false,
        error: { message: 'Categoria é obrigatória', code: 'INVALID_REQUEST' }
      })
    }

    if (!reply_type_id) {
      return res.status(400).json({
        success: false,
        error: { message: 'Tipo de resposta é obrigatório', code: 'INVALID_REQUEST' }
      })
    }

    // 1. Criar a pergunta na tabela questions_model
    const { data: questionData, error: questionError } = await supabaseAdmin
      .from('questions_model')
      .insert([{
        question: question.trim(),
        description: description?.trim() || null,
        category: category || '',
        subcategory: subcategory || '',
        category_id,
        subcategory_id: subcategory_id || null,
        weight,
        required,
        reply_type_id
      }])
      .select()
      .single()

    if (questionError) {
      console.error('Erro ao criar pergunta:', questionError)
      return res.status(500).json({
        success: false,
        error: { message: questionError.message, code: 'SUPABASE_ERROR' }
      })
    }

    // 2. Criar o vínculo na tabela evaluations_questions_model
    const { data: linkData, error: linkError } = await supabaseAdmin
      .from('evaluations_questions_model')
      .insert([{
        evaluation_id: parseInt(id),
        question_id: questionData.id,
        category_order,
        subcategory_order,
        question_order
      }])
      .select()
      .single()

    if (linkError) {
      console.error('Erro ao vincular pergunta:', linkError)
      // Tentar reverter a criação da pergunta
      await supabaseAdmin
        .from('questions_model')
        .delete()
        .eq('id', questionData.id)
      
      return res.status(500).json({
        success: false,
        error: { message: linkError.message, code: 'SUPABASE_ERROR' }
      })
    }

    return res.status(201).json({
      success: true,
      data: {
        ...questionData,
        evaluation_question_id: linkData.id,
        category_order,
        subcategory_order,
        question_order
      }
    })
  } catch (err) {
    return next(err)
  }
})

/**
 * @swagger
 * /api/evaluations/{id}/questions/reorder:
 *   put:
 *     summary: Reordena perguntas de uma avaliação (batch update)
 *     tags: [Evaluations]
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
 *               - questions
 *             properties:
 *               questions:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     evaluation_question_id:
 *                       type: integer
 *                     category_order:
 *                       type: integer
 *                     subcategory_order:
 *                       type: integer
 *                     question_order:
 *                       type: integer
 *                     question_id:
 *                       type: integer
 *                     category_id:
 *                       type: integer
 *                     subcategory_id:
 *                       type: integer
 *                     category:
 *                       type: string
 *                     subcategory:
 *                       type: string
 *     responses:
 *       200:
 *         description: Perguntas reordenadas com sucesso
 */
router.put('/:id/questions/reorder', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params['id']
    if (!id) {
      return res.status(400).json({
        success: false,
        error: { message: 'ID da avaliação é obrigatório', code: 'INVALID_REQUEST' }
      })
    }

    const { questions } = req.body

    if (!questions || !Array.isArray(questions)) {
      return res.status(400).json({
        success: false,
        error: { message: 'Lista de perguntas é obrigatória', code: 'INVALID_REQUEST' }
      })
    }

    // Processar cada pergunta
    for (const q of questions) {
      // Atualizar ordem na tabela de vínculo (evaluations_questions_model)
      if (q.evaluation_question_id) {
        const orderUpdate: any = {}
        if (q.category_order !== undefined) orderUpdate.category_order = q.category_order
        if (q.subcategory_order !== undefined) orderUpdate.subcategory_order = q.subcategory_order
        if (q.question_order !== undefined) orderUpdate.question_order = q.question_order

        if (Object.keys(orderUpdate).length > 0) {
          const { error: orderError } = await supabaseAdmin
            .from('evaluations_questions_model')
            .update(orderUpdate)
            .eq('id', q.evaluation_question_id)

          if (orderError) {
            console.error('Erro ao atualizar ordem:', orderError)
          }
        }
      }

      // Atualizar categoria/subcategoria na tabela de perguntas (questions_model)
      if (q.question_id && (q.category_id !== undefined || q.subcategory_id !== undefined)) {
        const questionUpdate: any = {}
        if (q.category_id !== undefined) questionUpdate.category_id = q.category_id
        if (q.subcategory_id !== undefined) questionUpdate.subcategory_id = q.subcategory_id
        if (q.category !== undefined) questionUpdate.category = q.category
        if (q.subcategory !== undefined) questionUpdate.subcategory = q.subcategory

        if (Object.keys(questionUpdate).length > 0) {
          const { error: questionError } = await supabaseAdmin
            .from('questions_model')
            .update(questionUpdate)
            .eq('id', q.question_id)

          if (questionError) {
            console.error('Erro ao atualizar pergunta:', questionError)
          }
        }
      }
    }

    return res.json({
      success: true,
      data: { message: 'Perguntas reordenadas com sucesso' }
    })
  } catch (err) {
    return next(err)
  }
})

/**
 * @swagger
 * /api/evaluations/{id}/questions/{questionId}:
 *   put:
 *     summary: Atualiza uma pergunta
 *     tags: [Evaluations]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *       - in: path
 *         name: questionId
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               question:
 *                 type: string
 *               description:
 *                 type: string
 *               weight:
 *                 type: integer
 *               required:
 *                 type: boolean
 *               reply_type_id:
 *                 type: integer
 *               category_id:
 *                 type: integer
 *               subcategory_id:
 *                 type: integer
 *               category:
 *                 type: string
 *               subcategory:
 *                 type: string
 *     responses:
 *       200:
 *         description: Pergunta atualizada com sucesso
 */
router.put('/:id/questions/:questionId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const questionId = req.params['questionId']
    if (!questionId) {
      return res.status(400).json({
        success: false,
        error: { message: 'ID da pergunta é obrigatório', code: 'INVALID_REQUEST' }
      })
    }

    const { 
      question, 
      description, 
      weight, 
      required, 
      reply_type_id,
      category_id,
      subcategory_id,
      category,
      subcategory
    } = req.body

    const updateData: any = {}
    if (question !== undefined) updateData.question = question.trim()
    if (description !== undefined) updateData.description = description?.trim() || null
    if (weight !== undefined) updateData.weight = weight
    if (required !== undefined) updateData.required = required
    if (reply_type_id !== undefined) updateData.reply_type_id = reply_type_id
    if (category_id !== undefined) updateData.category_id = category_id
    if (subcategory_id !== undefined) updateData.subcategory_id = subcategory_id
    if (category !== undefined) updateData.category = category
    if (subcategory !== undefined) updateData.subcategory = subcategory

    const { data, error } = await supabaseAdmin
      .from('questions_model')
      .update(updateData)
      .eq('id', parseInt(questionId))
      .select()
      .single()

    if (error) {
      console.error('Erro ao atualizar pergunta:', error)
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
 * /api/evaluations/{id}/questions/{questionId}:
 *   delete:
 *     summary: Remove uma pergunta de uma avaliação
 *     tags: [Evaluations]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *       - in: path
 *         name: questionId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Pergunta removida com sucesso
 */
router.delete('/:id/questions/:questionId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params['id']
    const questionId = req.params['questionId']
    
    if (!id || !questionId) {
      return res.status(400).json({
        success: false,
        error: { message: 'ID da avaliação e da pergunta são obrigatórios', code: 'INVALID_REQUEST' }
      })
    }

    // 1. Remover o vínculo na tabela evaluations_questions_model
    const { error: linkError } = await supabaseAdmin
      .from('evaluations_questions_model')
      .delete()
      .eq('evaluation_id', parseInt(id))
      .eq('question_id', parseInt(questionId))

    if (linkError) {
      console.error('Erro ao remover vínculo:', linkError)
      return res.status(500).json({
        success: false,
        error: { message: linkError.message, code: 'SUPABASE_ERROR' }
      })
    }

    // 2. Deletar a pergunta da tabela questions_model
    const { error: questionError } = await supabaseAdmin
      .from('questions_model')
      .delete()
      .eq('id', parseInt(questionId))

    if (questionError) {
      console.error('Erro ao deletar pergunta:', questionError)
      return res.status(500).json({
        success: false,
        error: { message: questionError.message, code: 'SUPABASE_ERROR' }
      })
    }

    return res.json({
      success: true,
      data: { message: 'Pergunta removida com sucesso' }
    })
  } catch (err) {
    return next(err)
  }
})

/**
 * @swagger
 * /api/evaluations/{id}/categories:
 *   get:
 *     summary: Lista categorias e subcategorias usadas em uma avaliação
 *     tags: [Evaluations]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Lista de categorias usadas na avaliação
 */
router.get('/:id/categories', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params['id']
    if (!id) {
      return res.status(400).json({
        success: false,
        error: { message: 'ID da avaliação é obrigatório', code: 'INVALID_REQUEST' }
      })
    }

    // Buscar todas as categorias e subcategorias usadas nas perguntas desta avaliação
    const { data: evalQuestions, error: evalError } = await supabaseAdmin
      .from('evaluations_questions_model')
      .select(`
        questions_model (
          category_id,
          subcategory_id
        )
      `)
      .eq('evaluation_id', parseInt(id))

    if (evalError) {
      console.error('Erro ao buscar perguntas da avaliação:', evalError)
      return res.status(500).json({
        success: false,
        error: { message: evalError.message, code: 'SUPABASE_ERROR' }
      })
    }

    // Extrair IDs únicos de categorias e subcategorias
    const categoryIds = new Set<number>()
    const subcategoryIds = new Set<number>()
    
    evalQuestions?.forEach((item: any) => {
      if (item.questions_model?.category_id) {
        categoryIds.add(item.questions_model.category_id)
      }
      if (item.questions_model?.subcategory_id) {
        subcategoryIds.add(item.questions_model.subcategory_id)
      }
    })

    const allIds = [...Array.from(categoryIds), ...Array.from(subcategoryIds)]

    if (allIds.length === 0) {
      return res.json({
        success: true,
        data: []
      })
    }

    // Buscar os domínios das categorias e subcategorias usadas
    const { data, error } = await supabaseAdmin
      .from('domains')
      .select('*')
      .in('id', allIds)
      .eq('is_active', true)
      .order('value')

    if (error) {
      console.error('Erro ao buscar categorias:', error)
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
