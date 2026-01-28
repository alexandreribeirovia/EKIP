/**
 * Rotas de Gerenciamento de Quiz
 * 
 * Este módulo gerencia o CRUD de quizzes, perguntas e opções:
 * - CRUD de quizzes (modelos de teste de conhecimento)
 * - CRUD de perguntas (single_choice e multiple_choice)
 * - CRUD de opções de resposta
 * - Reordenação de perguntas e opções
 * 
 * @module routes/quiz
 */

import { Router, Request, Response, NextFunction } from 'express'
import { supabaseAdmin } from '../lib/supabaseAdmin'
import { sessionAuth } from '../middleware/sessionAuth'

const router = Router()

// Aplicar middleware de autenticação em todas as rotas
router.use(sessionAuth)

// ============================================================================
// QUIZ CRUD
// ============================================================================

/**
 * @swagger
 * /api/quiz:
 *   get:
 *     summary: Lista todos os quizzes
 *     tags: [Quiz]
 *     parameters:
 *       - in: query
 *         name: include_stats
 *         schema:
 *           type: boolean
 *         description: Incluir estatísticas de participação e pontuação
 *     responses:
 *       200:
 *         description: Lista de quizzes
 */
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const includeStats = req.query['include_stats'] === 'true'

    // Buscar quizzes com contagem de perguntas e participantes
    const { data: quizzes, error } = await supabaseAdmin
      .from('quiz')
      .select(`
        *,
        quiz_question(count),
        quiz_participant(count)
      `)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Erro ao buscar quizzes:', error)
      return res.status(500).json({
        success: false,
        error: { message: error.message, code: 'SUPABASE_ERROR' }
      })
    }

    // Se includeStats, buscar estatísticas de conclusão e média
    let statsMap = new Map<number, { completed_count: number; average_score: number | null }>()
    
    if (includeStats && quizzes && quizzes.length > 0) {
      // Buscar todas as tentativas completadas por quiz
      // quiz_attempt tem quiz_id e user_id diretamente, percentage está em metadata
      const quizIds = quizzes.map((q: any) => q.id)
      
      const { data: attempts, error: attemptsError } = await supabaseAdmin
        .from('quiz_attempt')
        .select(`
          quiz_id,
          user_id,
          score,
          total_points,
          metadata
        `)
        .in('quiz_id', quizIds)
        .eq('status', 'completed')

      if (!attemptsError && attempts) {
        // Helper para extrair percentage
        const getPercentage = (attempt: any): number => {
          if (attempt.metadata?.percentage !== undefined) {
            return attempt.metadata.percentage
          }
          if (attempt.total_points > 0) {
            return Math.round((attempt.score / attempt.total_points) * 100)
          }
          return 0
        }

        // Agrupar por quiz e calcular estatísticas
        const quizAttempts = new Map<number, { users: Set<string>; scores: number[] }>()
        
        attempts.forEach((attempt: any) => {
          const quizId = attempt.quiz_id
          if (quizId) {
            if (!quizAttempts.has(quizId)) {
              quizAttempts.set(quizId, { users: new Set(), scores: [] })
            }
            const data = quizAttempts.get(quizId)!
            data.users.add(attempt.user_id)
            data.scores.push(getPercentage(attempt))
          }
        })

        quizAttempts.forEach((data, quizId) => {
          const avgScore = data.scores.length > 0 
            ? Math.round(data.scores.reduce((a, b) => a + b, 0) / data.scores.length)
            : null
          statsMap.set(quizId, {
            completed_count: data.users.size,
            average_score: avgScore
          })
        })
      }
    }

    // Formatar contagens
    const formattedData = (quizzes || []).map((quiz: any) => {
      const participantCount = quiz.quiz_participant?.[0]?.count || 0
      const stats = statsMap.get(quiz.id) || { completed_count: 0, average_score: null }
      const completionRate = participantCount > 0 
        ? Math.round((stats.completed_count / participantCount) * 100) 
        : 0

      return {
        ...quiz,
        questions_count: quiz.quiz_question?.[0]?.count || 0,
        participants_count: participantCount,
        completed_count: stats.completed_count,
        completion_rate: completionRate,
        average_score: stats.average_score,
        quiz_question: undefined,
        quiz_participant: undefined
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

/**
 * @swagger
 * /api/quiz/{id}:
 *   get:
 *     summary: Busca um quiz pelo ID
 *     tags: [Quiz]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Quiz encontrado
 */
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params['id']
    if (!id) {
      return res.status(400).json({
        success: false,
        error: { message: 'ID do quiz é obrigatório', code: 'INVALID_REQUEST' }
      })
    }

    const { data: quiz, error } = await supabaseAdmin
      .from('quiz')
      .select(`
        *,
        quiz_question(count),
        quiz_participant(count)
      `)
      .eq('id', parseInt(id))
      .single()

    if (error) {
      console.error('Erro ao buscar quiz:', error)
      return res.status(500).json({
        success: false,
        error: { message: error.message, code: 'SUPABASE_ERROR' }
      })
    }

    if (!quiz) {
      return res.status(404).json({
        success: false,
        error: { message: 'Quiz não encontrado', code: 'NOT_FOUND' }
      })
    }

    // Formatar contagens
    const formattedData = {
      ...quiz,
      question_count: quiz.quiz_question?.[0]?.count || 0,
      participant_count: quiz.quiz_participant?.[0]?.count || 0,
      quiz_question: undefined,
      quiz_participant: undefined
    }

    return res.json({
      success: true,
      data: formattedData
    })
  } catch (err) {
    return next(err)
  }
})

/**
 * @swagger
 * /api/quiz:
 *   post:
 *     summary: Cria um novo quiz
 *     tags: [Quiz]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *             properties:
 *               title:
 *                 type: string
 *               description:
 *                 type: string
 *               is_active:
 *                 type: boolean
 *               starts_at:
 *                 type: string
 *               ends_at:
 *                 type: string
 *               shuffle_questions:
 *                 type: boolean
 *               shuffle_options:
 *                 type: boolean
 *               attempt_limit:
 *                 type: integer
 *               pass_score:
 *                 type: integer
 *     responses:
 *       201:
 *         description: Quiz criado com sucesso
 */
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const {
      title,
      description,
      is_active = false,
      starts_at,
      ends_at,
      about_id,
      about,
      shuffle_questions = true,
      shuffle_options = true,
      attempt_limit,
      pass_score,
      owner_user_id
    } = req.body

    if (!title) {
      return res.status(400).json({
        success: false,
        error: { message: 'Título do quiz é obrigatório', code: 'INVALID_REQUEST' }
      })
    }

    const { data: quiz, error } = await supabaseAdmin
      .from('quiz')
      .insert({
        title,
        description,
        is_active,
        starts_at,
        ends_at,
        about_id,
        about,
        shuffle_questions,
        shuffle_options,
        attempt_limit,
        pass_score,
        owner_user_id
      })
      .select()
      .single()

    if (error) {
      console.error('Erro ao criar quiz:', error)
      return res.status(500).json({
        success: false,
        error: { message: error.message, code: 'SUPABASE_ERROR' }
      })
    }

    return res.status(201).json({
      success: true,
      data: quiz
    })
  } catch (err) {
    return next(err)
  }
})

/**
 * @swagger
 * /api/quiz/{id}:
 *   put:
 *     summary: Atualiza um quiz
 *     tags: [Quiz]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Quiz atualizado com sucesso
 */
router.put('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params['id']
    if (!id) {
      return res.status(400).json({
        success: false,
        error: { message: 'ID do quiz é obrigatório', code: 'INVALID_REQUEST' }
      })
    }

    const {
      title,
      description,
      is_active,
      starts_at,
      ends_at,
      about_id,
      about,
      shuffle_questions,
      shuffle_options,
      attempt_limit,
      pass_score,
      owner_user_id
    } = req.body

    const { data: quiz, error } = await supabaseAdmin
      .from('quiz')
      .update({
        title,
        description,
        is_active,
        starts_at,
        ends_at,
        about_id,
        about,
        shuffle_questions,
        shuffle_options,
        attempt_limit,
        pass_score,
        owner_user_id
      })
      .eq('id', parseInt(id))
      .select()
      .single()

    if (error) {
      console.error('Erro ao atualizar quiz:', error)
      return res.status(500).json({
        success: false,
        error: { message: error.message, code: 'SUPABASE_ERROR' }
      })
    }

    return res.json({
      success: true,
      data: quiz
    })
  } catch (err) {
    return next(err)
  }
})

/**
 * @swagger
 * /api/quiz/{id}/toggle-active:
 *   patch:
 *     summary: Alterna o status ativo/inativo do quiz
 *     tags: [Quiz]
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
router.patch('/:id/toggle-active', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params['id']
    if (!id) {
      return res.status(400).json({
        success: false,
        error: { message: 'ID do quiz é obrigatório', code: 'INVALID_REQUEST' }
      })
    }

    // Buscar status atual
    const { data: currentQuiz, error: fetchError } = await supabaseAdmin
      .from('quiz')
      .select('is_active')
      .eq('id', parseInt(id))
      .single()

    if (fetchError || !currentQuiz) {
      return res.status(404).json({
        success: false,
        error: { message: 'Quiz não encontrado', code: 'NOT_FOUND' }
      })
    }

    // Alternar status
    const { data: quiz, error } = await supabaseAdmin
      .from('quiz')
      .update({ is_active: !currentQuiz.is_active })
      .eq('id', parseInt(id))
      .select()
      .single()

    if (error) {
      console.error('Erro ao alternar status do quiz:', error)
      return res.status(500).json({
        success: false,
        error: { message: error.message, code: 'SUPABASE_ERROR' }
      })
    }

    return res.json({
      success: true,
      data: quiz
    })
  } catch (err) {
    return next(err)
  }
})

/**
 * @swagger
 * /api/quiz/{id}:
 *   delete:
 *     summary: Exclui um quiz
 *     tags: [Quiz]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Quiz excluído com sucesso
 */
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params['id']
    if (!id) {
      return res.status(400).json({
        success: false,
        error: { message: 'ID do quiz é obrigatório', code: 'INVALID_REQUEST' }
      })
    }

    const { error } = await supabaseAdmin
      .from('quiz')
      .delete()
      .eq('id', parseInt(id))

    if (error) {
      console.error('Erro ao excluir quiz:', error)
      return res.status(500).json({
        success: false,
        error: { message: error.message, code: 'SUPABASE_ERROR' }
      })
    }

    return res.json({
      success: true,
      message: 'Quiz excluído com sucesso'
    })
  } catch (err) {
    return next(err)
  }
})

// ============================================================================
// QUIZ QUESTIONS CRUD
// ============================================================================

/**
 * @swagger
 * /api/quiz/{quizId}/questions:
 *   get:
 *     summary: Lista todas as perguntas de um quiz
 *     tags: [Quiz Questions]
 *     parameters:
 *       - in: path
 *         name: quizId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Lista de perguntas com opções
 */
router.get('/:quizId/questions', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const quizId = req.params['quizId']
    if (!quizId) {
      return res.status(400).json({
        success: false,
        error: { message: 'ID do quiz é obrigatório', code: 'INVALID_REQUEST' }
      })
    }

    const { data: questions, error } = await supabaseAdmin
      .from('quiz_question')
      .select(`
        *,
        quiz_question_option (
          id,
          option_text,
          is_correct,
          rationale,
          option_order,
          is_active
        )
      `)
      .eq('quiz_id', parseInt(quizId))
      .order('question_order', { ascending: true })

    if (error) {
      console.error('Erro ao buscar perguntas:', error)
      return res.status(500).json({
        success: false,
        error: { message: error.message, code: 'SUPABASE_ERROR' }
      })
    }

    // Ordenar opções dentro de cada pergunta
    const formattedQuestions = (questions || []).map((q: any) => ({
      ...q,
      options: (q.quiz_question_option || []).sort((a: any, b: any) => a.option_order - b.option_order),
      quiz_question_option: undefined
    }))

    return res.json({
      success: true,
      data: formattedQuestions
    })
  } catch (err) {
    return next(err)
  }
})

/**
 * @swagger
 * /api/quiz/{quizId}/questions:
 *   post:
 *     summary: Adiciona uma nova pergunta ao quiz
 *     tags: [Quiz Questions]
 *     parameters:
 *       - in: path
 *         name: quizId
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
 *               - question_text
 *               - question_type
 *             properties:
 *               question_text:
 *                 type: string
 *               question_type:
 *                 type: string
 *                 enum: [single_choice, multiple_choice]
 *               hint:
 *                 type: string
 *               explanation:
 *                 type: string
 *               points:
 *                 type: integer
 *               options:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     option_text:
 *                       type: string
 *                     is_correct:
 *                       type: boolean
 *                     rationale:
 *                       type: string
 *     responses:
 *       201:
 *         description: Pergunta criada com sucesso
 */
router.post('/:quizId/questions', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const quizId = req.params['quizId']
    if (!quizId) {
      return res.status(400).json({
        success: false,
        error: { message: 'ID do quiz é obrigatório', code: 'INVALID_REQUEST' }
      })
    }

    const {
      question_text,
      question_type = 'single_choice',
      hint,
      explanation,
      points = 1,
      options = []
    } = req.body

    if (!question_text) {
      return res.status(400).json({
        success: false,
        error: { message: 'Texto da pergunta é obrigatório', code: 'INVALID_REQUEST' }
      })
    }

    // Buscar próximo question_order
    const { data: maxOrderResult } = await supabaseAdmin
      .from('quiz_question')
      .select('question_order')
      .eq('quiz_id', parseInt(quizId))
      .order('question_order', { ascending: false })
      .limit(1)
      .single()

    const nextOrder = (maxOrderResult?.question_order || 0) + 1

    // Criar pergunta
    const { data: question, error: questionError } = await supabaseAdmin
      .from('quiz_question')
      .insert({
        quiz_id: parseInt(quizId),
        question_text,
        question_type,
        hint,
        explanation,
        points,
        question_order: nextOrder
      })
      .select()
      .single()

    if (questionError) {
      console.error('Erro ao criar pergunta:', questionError)
      return res.status(500).json({
        success: false,
        error: { message: questionError.message, code: 'SUPABASE_ERROR' }
      })
    }

    // Criar opções se fornecidas
    if (options.length > 0 && question) {
      const optionsToInsert = options.map((opt: any, index: number) => ({
        question_id: question.id,
        option_text: opt.option_text,
        is_correct: opt.is_correct || false,
        rationale: opt.rationale,
        option_order: index + 1
      }))

      const { error: optionsError } = await supabaseAdmin
        .from('quiz_question_option')
        .insert(optionsToInsert)

      if (optionsError) {
        console.error('Erro ao criar opções:', optionsError)
        // Não falhar totalmente, a pergunta foi criada
      }
    }

    // Buscar pergunta com opções
    const { data: fullQuestion } = await supabaseAdmin
      .from('quiz_question')
      .select(`
        *,
        quiz_question_option (
          id,
          option_text,
          is_correct,
          rationale,
          option_order,
          is_active
        )
      `)
      .eq('id', question.id)
      .single()

    return res.status(201).json({
      success: true,
      data: {
        ...fullQuestion,
        options: fullQuestion?.quiz_question_option || [],
        quiz_question_option: undefined
      }
    })
  } catch (err) {
    return next(err)
  }
})

/**
 * @swagger
 * /api/quiz/{quizId}/questions/{questionId}:
 *   put:
 *     summary: Atualiza uma pergunta
 *     tags: [Quiz Questions]
 *     parameters:
 *       - in: path
 *         name: quizId
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
 *         description: Pergunta atualizada com sucesso
 */
router.put('/:quizId/questions/:questionId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { quizId, questionId } = req.params
    if (!quizId || !questionId) {
      return res.status(400).json({
        success: false,
        error: { message: 'IDs são obrigatórios', code: 'INVALID_REQUEST' }
      })
    }

    const {
      question_text,
      question_type,
      hint,
      explanation,
      points,
      is_active
    } = req.body

    const { data: question, error } = await supabaseAdmin
      .from('quiz_question')
      .update({
        question_text,
        question_type,
        hint,
        explanation,
        points,
        is_active
      })
      .eq('id', parseInt(questionId))
      .eq('quiz_id', parseInt(quizId))
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
      data: question
    })
  } catch (err) {
    return next(err)
  }
})

/**
 * @swagger
 * /api/quiz/{quizId}/questions/{questionId}:
 *   delete:
 *     summary: Exclui uma pergunta
 *     tags: [Quiz Questions]
 *     parameters:
 *       - in: path
 *         name: quizId
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
 *         description: Pergunta excluída com sucesso
 */
router.delete('/:quizId/questions/:questionId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { quizId, questionId } = req.params
    if (!quizId || !questionId) {
      return res.status(400).json({
        success: false,
        error: { message: 'IDs são obrigatórios', code: 'INVALID_REQUEST' }
      })
    }

    const { error } = await supabaseAdmin
      .from('quiz_question')
      .delete()
      .eq('id', parseInt(questionId))
      .eq('quiz_id', parseInt(quizId))

    if (error) {
      console.error('Erro ao excluir pergunta:', error)
      return res.status(500).json({
        success: false,
        error: { message: error.message, code: 'SUPABASE_ERROR' }
      })
    }

    return res.json({
      success: true,
      message: 'Pergunta excluída com sucesso'
    })
  } catch (err) {
    return next(err)
  }
})

/**
 * @swagger
 * /api/quiz/{quizId}/questions/reorder:
 *   patch:
 *     summary: Reordena as perguntas do quiz
 *     tags: [Quiz Questions]
 *     parameters:
 *       - in: path
 *         name: quizId
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
 *               questions:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                     question_order:
 *                       type: integer
 *     responses:
 *       200:
 *         description: Perguntas reordenadas com sucesso
 */
router.patch('/:quizId/questions/reorder', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const quizId = req.params['quizId']
    if (!quizId) {
      return res.status(400).json({
        success: false,
        error: { message: 'ID do quiz é obrigatório', code: 'INVALID_REQUEST' }
      })
    }

    const { questions } = req.body
    if (!questions || !Array.isArray(questions)) {
      return res.status(400).json({
        success: false,
        error: { message: 'Lista de perguntas é obrigatória', code: 'INVALID_REQUEST' }
      })
    }

    // Atualizar ordem de cada pergunta
    for (const q of questions) {
      await supabaseAdmin
        .from('quiz_question')
        .update({ question_order: q.question_order })
        .eq('id', q.id)
        .eq('quiz_id', parseInt(quizId))
    }

    return res.json({
      success: true,
      message: 'Perguntas reordenadas com sucesso'
    })
  } catch (err) {
    return next(err)
  }
})

// ============================================================================
// QUIZ QUESTION OPTIONS CRUD
// ============================================================================

/**
 * @swagger
 * /api/quiz/{quizId}/questions/{questionId}/options:
 *   post:
 *     summary: Adiciona uma opção a uma pergunta
 *     tags: [Quiz Question Options]
 *     parameters:
 *       - in: path
 *         name: quizId
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
 *             required:
 *               - option_text
 *             properties:
 *               option_text:
 *                 type: string
 *               is_correct:
 *                 type: boolean
 *               rationale:
 *                 type: string
 *     responses:
 *       201:
 *         description: Opção criada com sucesso
 */
router.post('/:quizId/questions/:questionId/options', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { questionId } = req.params
    if (!questionId) {
      return res.status(400).json({
        success: false,
        error: { message: 'ID da pergunta é obrigatório', code: 'INVALID_REQUEST' }
      })
    }

    const { option_text, is_correct = false, rationale } = req.body

    if (!option_text) {
      return res.status(400).json({
        success: false,
        error: { message: 'Texto da opção é obrigatório', code: 'INVALID_REQUEST' }
      })
    }

    // Buscar próximo option_order
    const { data: maxOrderResult } = await supabaseAdmin
      .from('quiz_question_option')
      .select('option_order')
      .eq('question_id', parseInt(questionId))
      .order('option_order', { ascending: false })
      .limit(1)
      .single()

    const nextOrder = (maxOrderResult?.option_order || 0) + 1

    const { data: option, error } = await supabaseAdmin
      .from('quiz_question_option')
      .insert({
        question_id: parseInt(questionId),
        option_text,
        is_correct,
        rationale,
        option_order: nextOrder
      })
      .select()
      .single()

    if (error) {
      console.error('Erro ao criar opção:', error)
      return res.status(500).json({
        success: false,
        error: { message: error.message, code: 'SUPABASE_ERROR' }
      })
    }

    return res.status(201).json({
      success: true,
      data: option
    })
  } catch (err) {
    return next(err)
  }
})

/**
 * @swagger
 * /api/quiz/{quizId}/questions/{questionId}/options/{optionId}:
 *   put:
 *     summary: Atualiza uma opção
 *     tags: [Quiz Question Options]
 *     parameters:
 *       - in: path
 *         name: quizId
 *         required: true
 *         schema:
 *           type: integer
 *       - in: path
 *         name: questionId
 *         required: true
 *         schema:
 *           type: integer
 *       - in: path
 *         name: optionId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Opção atualizada com sucesso
 */
router.put('/:quizId/questions/:questionId/options/:optionId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { questionId, optionId } = req.params
    if (!questionId || !optionId) {
      return res.status(400).json({
        success: false,
        error: { message: 'IDs são obrigatórios', code: 'INVALID_REQUEST' }
      })
    }

    const { option_text, is_correct, rationale, is_active } = req.body

    const { data: option, error } = await supabaseAdmin
      .from('quiz_question_option')
      .update({
        option_text,
        is_correct,
        rationale,
        is_active
      })
      .eq('id', parseInt(optionId))
      .eq('question_id', parseInt(questionId))
      .select()
      .single()

    if (error) {
      console.error('Erro ao atualizar opção:', error)
      return res.status(500).json({
        success: false,
        error: { message: error.message, code: 'SUPABASE_ERROR' }
      })
    }

    return res.json({
      success: true,
      data: option
    })
  } catch (err) {
    return next(err)
  }
})

/**
 * @swagger
 * /api/quiz/{quizId}/questions/{questionId}/options/{optionId}:
 *   delete:
 *     summary: Exclui uma opção
 *     tags: [Quiz Question Options]
 *     parameters:
 *       - in: path
 *         name: quizId
 *         required: true
 *         schema:
 *           type: integer
 *       - in: path
 *         name: questionId
 *         required: true
 *         schema:
 *           type: integer
 *       - in: path
 *         name: optionId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Opção excluída com sucesso
 */
router.delete('/:quizId/questions/:questionId/options/:optionId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { questionId, optionId } = req.params
    if (!questionId || !optionId) {
      return res.status(400).json({
        success: false,
        error: { message: 'IDs são obrigatórios', code: 'INVALID_REQUEST' }
      })
    }

    const { error } = await supabaseAdmin
      .from('quiz_question_option')
      .delete()
      .eq('id', parseInt(optionId))
      .eq('question_id', parseInt(questionId))

    if (error) {
      console.error('Erro ao excluir opção:', error)
      return res.status(500).json({
        success: false,
        error: { message: error.message, code: 'SUPABASE_ERROR' }
      })
    }

    return res.json({
      success: true,
      message: 'Opção excluída com sucesso'
    })
  } catch (err) {
    return next(err)
  }
})

/**
 * @swagger
 * /api/quiz/{quizId}/questions/{questionId}/options/reorder:
 *   patch:
 *     summary: Reordena as opções de uma pergunta
 *     tags: [Quiz Question Options]
 *     parameters:
 *       - in: path
 *         name: quizId
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
 *               options:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                     option_order:
 *                       type: integer
 *     responses:
 *       200:
 *         description: Opções reordenadas com sucesso
 */
router.patch('/:quizId/questions/:questionId/options/reorder', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { questionId } = req.params
    if (!questionId) {
      return res.status(400).json({
        success: false,
        error: { message: 'ID da pergunta é obrigatório', code: 'INVALID_REQUEST' }
      })
    }

    const { options } = req.body
    if (!options || !Array.isArray(options)) {
      return res.status(400).json({
        success: false,
        error: { message: 'Lista de opções é obrigatória', code: 'INVALID_REQUEST' }
      })
    }

    // Atualizar ordem de cada opção
    for (const opt of options) {
      await supabaseAdmin
        .from('quiz_question_option')
        .update({ option_order: opt.option_order })
        .eq('id', opt.id)
        .eq('question_id', parseInt(questionId))
    }

    return res.json({
      success: true,
      message: 'Opções reordenadas com sucesso'
    })
  } catch (err) {
    return next(err)
  }
})

// ============================================================================
// BULK IMPORT QUESTIONS
// ============================================================================

/**
 * Interface para pergunta no formato de importação
 */
interface ImportQuestion {
  question: string;
  answerOptions: Array<{
    text: string;
    isCorrect: boolean;
    rationale?: string;
  }>;
  hint?: string;
  explanation?: string;
  points?: number;
}

/**
 * @swagger
 * /api/quiz/{quizId}/questions/bulk-import:
 *   post:
 *     summary: Importa múltiplas perguntas em lote
 *     tags: [Quiz Questions]
 *     parameters:
 *       - in: path
 *         name: quizId
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
 *                 maxItems: 100
 *                 items:
 *                   type: object
 *                   required:
 *                     - question
 *                     - answerOptions
 *                   properties:
 *                     question:
 *                       type: string
 *                     answerOptions:
 *                       type: array
 *                       items:
 *                         type: object
 *                         required:
 *                           - text
 *                           - isCorrect
 *                         properties:
 *                           text:
 *                             type: string
 *                           isCorrect:
 *                             type: boolean
 *                           rationale:
 *                             type: string
 *                     hint:
 *                       type: string
 *                     explanation:
 *                       type: string
 *                     points:
 *                       type: integer
 *     responses:
 *       200:
 *         description: Resultado da importação
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     imported:
 *                       type: integer
 *                     skipped:
 *                       type: integer
 *                     errors:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           index:
 *                             type: integer
 *                           message:
 *                             type: string
 */
router.post('/:quizId/questions/bulk-import', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const quizId = req.params['quizId']
    if (!quizId) {
      return res.status(400).json({
        success: false,
        error: { message: 'ID do quiz é obrigatório', code: 'INVALID_REQUEST' }
      })
    }

    const { questions } = req.body as { questions: ImportQuestion[] }

    // Validar se questions é um array
    if (!questions || !Array.isArray(questions)) {
      return res.status(400).json({
        success: false,
        error: { message: 'Lista de perguntas é obrigatória', code: 'INVALID_REQUEST' }
      })
    }

    // Validar limite de 100 perguntas
    if (questions.length > 100) {
      return res.status(400).json({
        success: false,
        error: { message: 'Limite máximo de 100 perguntas por importação', code: 'LIMIT_EXCEEDED' }
      })
    }

    // Verificar se o quiz existe
    const { data: quiz, error: quizError } = await supabaseAdmin
      .from('quiz')
      .select('id')
      .eq('id', parseInt(quizId))
      .single()

    if (quizError || !quiz) {
      return res.status(404).json({
        success: false,
        error: { message: 'Quiz não encontrado', code: 'NOT_FOUND' }
      })
    }

    // Buscar perguntas existentes para verificar duplicatas
    const { data: existingQuestions } = await supabaseAdmin
      .from('quiz_question')
      .select('question_text')
      .eq('quiz_id', parseInt(quizId))

    const existingTexts = new Set(
      (existingQuestions || []).map((q: { question_text: string }) => 
        q.question_text.trim().toLowerCase()
      )
    )

    // Buscar próximo question_order
    const { data: maxOrderResult } = await supabaseAdmin
      .from('quiz_question')
      .select('question_order')
      .eq('quiz_id', parseInt(quizId))
      .order('question_order', { ascending: false })
      .limit(1)
      .single()

    let nextOrder = (maxOrderResult?.question_order || 0) + 1

    // Processar cada pergunta
    const errors: Array<{ index: number; message: string }> = []
    const skippedDuplicates: Array<{ index: number; question: string }> = []
    let importedCount = 0

    for (let i = 0; i < questions.length; i++) {
      const q = questions[i]
      
      // Verificação de segurança
      if (!q) {
        errors.push({ index: i + 1, message: 'Pergunta inválida ou vazia' })
        continue
      }

      // Validar estrutura da pergunta
      if (!q.question || typeof q.question !== 'string' || !q.question.trim()) {
        errors.push({ index: i + 1, message: 'Texto da pergunta é obrigatório' })
        continue
      }

      if (!q.answerOptions || !Array.isArray(q.answerOptions) || q.answerOptions.length < 2) {
        errors.push({ index: i + 1, message: 'Cada pergunta deve ter pelo menos 2 opções de resposta' })
        continue
      }

      // Validar opções
      let hasValidOptions = true
      for (let j = 0; j < q.answerOptions.length; j++) {
        const opt = q.answerOptions[j]
        if (!opt) {
          errors.push({ index: i + 1, message: `Opção ${j + 1}: opção inválida` })
          hasValidOptions = false
          break
        }
        if (!opt.text || typeof opt.text !== 'string' || !opt.text.trim()) {
          errors.push({ index: i + 1, message: `Opção ${j + 1}: texto é obrigatório` })
          hasValidOptions = false
          break
        }
        if (typeof opt.isCorrect !== 'boolean') {
          errors.push({ index: i + 1, message: `Opção ${j + 1}: isCorrect deve ser true ou false` })
          hasValidOptions = false
          break
        }
      }

      if (!hasValidOptions) continue

      // Verificar se há pelo menos uma resposta correta
      const correctCount = q.answerOptions.filter(opt => opt?.isCorrect).length
      if (correctCount === 0) {
        errors.push({ index: i + 1, message: 'Cada pergunta deve ter pelo menos uma resposta correta' })
        continue
      }

      // Verificar duplicata
      const questionTextNormalized = q.question.trim().toLowerCase()
      if (existingTexts.has(questionTextNormalized)) {
        skippedDuplicates.push({ index: i + 1, question: q.question.substring(0, 50) + '...' })
        continue
      }

      // Auto-detectar question_type baseado nas respostas corretas
      const questionType = correctCount > 1 ? 'multiple_choice' : 'single_choice'

      // Criar pergunta
      const { data: newQuestion, error: questionError } = await supabaseAdmin
        .from('quiz_question')
        .insert({
          quiz_id: parseInt(quizId),
          question_text: q.question.trim(),
          question_type: questionType,
          hint: q.hint?.trim() || null,
          explanation: q.explanation?.trim() || null,
          points: q.points || 1,
          question_order: nextOrder
        })
        .select()
        .single()

      if (questionError || !newQuestion) {
        errors.push({ index: i + 1, message: `Erro ao inserir pergunta: ${questionError?.message || 'Erro desconhecido'}` })
        continue
      }

      // Criar opções
      const optionsToInsert = q.answerOptions
        .filter((opt): opt is NonNullable<typeof opt> => opt != null)
        .map((opt, index) => ({
          question_id: newQuestion.id,
          option_text: opt.text.trim(),
          is_correct: opt.isCorrect,
          rationale: opt.rationale?.trim() || null,
          option_order: index + 1
        }))

      const { error: optionsError } = await supabaseAdmin
        .from('quiz_question_option')
        .insert(optionsToInsert)

      if (optionsError) {
        errors.push({ index: i + 1, message: `Pergunta criada mas erro ao inserir opções: ${optionsError.message}` })
        // A pergunta foi criada, então conta como importada parcialmente
      }

      // Adicionar ao conjunto de existentes para evitar duplicatas no mesmo lote
      existingTexts.add(questionTextNormalized)
      importedCount++
      nextOrder++
    }

    // Preparar mensagem de resultado
    const skippedCount = skippedDuplicates.length
    
    return res.json({
      success: true,
      data: {
        imported: importedCount,
        skipped: skippedCount,
        skippedDuplicates: skippedDuplicates,
        errors: errors
      }
    })
  } catch (err) {
    return next(err)
  }
})

export default router
