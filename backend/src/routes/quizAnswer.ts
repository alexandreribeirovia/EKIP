/**
 * Rotas Públicas de Resposta do Quiz
 * 
 * Este módulo gerencia o fluxo de resposta do quiz:
 * - Validação de token temporário (rota pública)
 * - Buscar dados do quiz com perguntas embaralhadas
 * - Submissão de respostas com cálculo de pontuação
 * 
 * Segurança:
 * - Token armazenado como hash SHA-256 no banco (tabela temp_session)
 * - Validação de expiração individual E status ativo do quiz
 * - Controle de tentativas (attempt_limit)
 * 
 * @module routes/quizAnswer
 */

import { Router, Request, Response, NextFunction } from 'express'
import { supabaseAdmin } from '../lib/supabaseAdmin'
import { sessionAuth } from '../middleware/sessionAuth'
import { hashSHA256 } from '../lib/encryption'

const router = Router()

// ============================================================================
// CONSTANTES
// ============================================================================

const SESSION_TYPE = 'quiz_answer'

// ============================================================================
// FUNÇÕES AUXILIARES
// ============================================================================

/**
 * Embaralha um array usando o algoritmo Fisher-Yates
 */
function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!]
  }
  return shuffled
}

// ============================================================================
// ROTAS PÚBLICAS (SEM AUTENTICAÇÃO)
// ============================================================================

/**
 * @swagger
 * /api/quiz-answer/verify/{token}:
 *   get:
 *     summary: Verifica se um token é válido e retorna dados do quiz (rota pública)
 *     tags: [Quiz Answer]
 *     parameters:
 *       - in: path
 *         name: token
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Token válido - retorna dados do quiz
 *       400:
 *         description: Token inválido, expirado ou quiz inativo
 */
router.get('/verify/:token', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { token } = req.params

    if (!token || token.length !== 64) {
      return res.status(400).json({
        success: false,
        error: { message: 'Token inválido', code: 'INVALID_TOKEN' }
      })
    }

    // Calcular hash do token
    const tokenHash = hashSHA256(token)

    // Buscar sessão pelo hash
    const { data: session, error: sessionError } = await supabaseAdmin
      .from('temp_session')
      .select('*')
      .eq('token_hash', tokenHash)
      .eq('type', SESSION_TYPE)
      .eq('is_active', true)
      .single()

    if (sessionError || !session) {
      return res.status(400).json({
        success: false,
        error: { message: 'Token não encontrado ou inválido', code: 'TOKEN_NOT_FOUND' }
      })
    }

    // Verificar se expirou (individual)
    const expiresAt = new Date(session.expires_at)
    if (expiresAt < new Date()) {
      return res.status(400).json({
        success: false,
        error: { message: 'Este link expirou', code: 'TOKEN_EXPIRED' }
      })
    }

    // Verificar limite de acessos
    const maxAccess = session.max_access || 100
    const accessCount = session.access_count || 0
    if (accessCount >= maxAccess) {
      return res.status(400).json({
        success: false,
        error: { message: 'Limite de acessos atingido', code: 'ACCESS_LIMIT_REACHED' }
      })
    }

    // Buscar dados do participante
    const { data: participant, error: participantError } = await supabaseAdmin
      .from('quiz_participant')
      .select(`
        id,
        quiz_id,
        user_id,
        employees (
          name,
          email
        )
      `)
      .eq('id', session.entity_id)
      .single()

    if (participantError || !participant) {
      return res.status(400).json({
        success: false,
        error: { message: 'Participante não encontrado', code: 'PARTICIPANT_NOT_FOUND' }
      })
    }

    // Buscar dados do quiz
    const { data: quiz, error: quizError } = await supabaseAdmin
      .from('quiz')
      .select('*')
      .eq('id', participant.quiz_id)
      .single()

    if (quizError || !quiz) {
      return res.status(400).json({
        success: false,
        error: { message: 'Quiz não encontrado', code: 'QUIZ_NOT_FOUND' }
      })
    }

    // Verificar se o quiz está ativo
    if (!quiz.is_active) {
      return res.status(400).json({
        success: false,
        error: { message: 'Este quiz não está mais ativo', code: 'QUIZ_INACTIVE' }
      })
    }

    // Buscar tentativas anteriores do usuário
    const { data: attempts } = await supabaseAdmin
      .from('quiz_attempt')
      .select('*')
      .eq('quiz_id', quiz.id)
      .eq('user_id', participant.user_id)
      .order('created_at', { ascending: false })

    const attemptsCount = attempts?.length || 0
    const hasInProgressAttempt = attempts?.some((a: any) => a.status === 'in_progress')

    // Verificar limite de tentativas
    if (quiz.attempt_limit && attemptsCount >= quiz.attempt_limit && !hasInProgressAttempt) {
      return res.status(400).json({
        success: false,
        error: { 
          message: `Você já atingiu o limite de ${quiz.attempt_limit} tentativa(s)`, 
          code: 'ATTEMPT_LIMIT_REACHED' 
        }
      })
    }

    // Incrementar contador de acessos
    await supabaseAdmin
      .from('temp_session')
      .update({ access_count: accessCount + 1 })
      .eq('id', session.id)

    // Buscar perguntas do quiz
    const { data: questions, error: questionsError } = await supabaseAdmin
      .from('quiz_question')
      .select(`
        id,
        question_text,
        hint,
        question_type,
        points,
        question_order,
        quiz_question_option (
          id,
          option_text,
          option_order
        )
      `)
      .eq('quiz_id', quiz.id)
      .eq('is_active', true)
      .order('question_order', { ascending: true })

    if (questionsError) {
      console.error('Erro ao buscar perguntas:', questionsError)
      return res.status(500).json({
        success: false,
        error: { message: 'Erro ao buscar perguntas', code: 'SUPABASE_ERROR' }
      })
    }

    // Formatar perguntas (sem is_correct e rationale!)
    let formattedQuestions = (questions || []).map((q: any) => ({
      id: q.id,
      question_text: q.question_text,
      hint: q.hint,
      question_type: q.question_type,
      points: q.points,
      question_order: q.question_order,
      options: (q.quiz_question_option || [])
        .sort((a: any, b: any) => a.option_order - b.option_order)
        .map((opt: any) => ({
          id: opt.id,
          option_text: opt.option_text,
          option_order: opt.option_order
        }))
    }))

    // Embaralhar perguntas se configurado
    if (quiz.shuffle_questions) {
      formattedQuestions = shuffleArray(formattedQuestions)
    }

    // Embaralhar opções se configurado
    if (quiz.shuffle_options) {
      formattedQuestions = formattedQuestions.map((q: any) => ({
        ...q,
        options: shuffleArray(q.options)
      }))
    }

    // Calcular total de pontos
    const totalPoints = formattedQuestions.reduce((sum: number, q: any) => sum + (q.points || 1), 0)

    return res.json({
      success: true,
      data: {
        quiz: {
          id: quiz.id,
          title: quiz.title,
          description: quiz.description,
          attempt_limit: quiz.attempt_limit,
          pass_score: quiz.pass_score,
          total_points: totalPoints,
          total_questions: formattedQuestions.length
        },
        participant: {
          id: participant.id,
          user_id: participant.user_id,
          user_name: (participant.employees as any)?.name || participant.user_id
        },
        attempts: {
          count: attemptsCount,
          limit: quiz.attempt_limit,
          has_in_progress: hasInProgressAttempt,
          in_progress_id: hasInProgressAttempt 
            ? attempts?.find((a: any) => a.status === 'in_progress')?.id 
            : null
        },
        questions: formattedQuestions,
        link_expires_at: session.expires_at
      }
    })
  } catch (err) {
    return next(err)
  }
})

/**
 * @swagger
 * /api/quiz-answer/start/{token}:
 *   post:
 *     summary: Inicia uma nova tentativa de quiz (rota pública)
 *     tags: [Quiz Answer]
 *     parameters:
 *       - in: path
 *         name: token
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Tentativa iniciada
 */
router.post('/start/:token', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { token } = req.params

    if (!token || token.length !== 64) {
      return res.status(400).json({
        success: false,
        error: { message: 'Token inválido', code: 'INVALID_TOKEN' }
      })
    }

    // Calcular hash e validar sessão
    const tokenHash = hashSHA256(token)

    const { data: session, error: sessionError } = await supabaseAdmin
      .from('temp_session')
      .select('*')
      .eq('token_hash', tokenHash)
      .eq('type', SESSION_TYPE)
      .eq('is_active', true)
      .single()

    if (sessionError || !session) {
      return res.status(400).json({
        success: false,
        error: { message: 'Token inválido', code: 'INVALID_TOKEN' }
      })
    }

    // Verificar expiração
    if (new Date(session.expires_at) < new Date()) {
      return res.status(400).json({
        success: false,
        error: { message: 'Link expirado', code: 'TOKEN_EXPIRED' }
      })
    }

    // Buscar participante e quiz
    const { data: participant } = await supabaseAdmin
      .from('quiz_participant')
      .select('id, quiz_id, user_id')
      .eq('id', session.entity_id)
      .single()

    if (!participant) {
      return res.status(400).json({
        success: false,
        error: { message: 'Participante não encontrado', code: 'PARTICIPANT_NOT_FOUND' }
      })
    }

    // Buscar quiz
    const { data: quiz } = await supabaseAdmin
      .from('quiz')
      .select('id, is_active, attempt_limit')
      .eq('id', participant.quiz_id)
      .single()

    if (!quiz || !quiz.is_active) {
      return res.status(400).json({
        success: false,
        error: { message: 'Quiz não está ativo', code: 'QUIZ_INACTIVE' }
      })
    }

    // Verificar se já tem tentativa em andamento
    const { data: existingAttempt } = await supabaseAdmin
      .from('quiz_attempt')
      .select('id')
      .eq('quiz_id', quiz.id)
      .eq('user_id', participant.user_id)
      .eq('status', 'in_progress')
      .single()

    if (existingAttempt) {
      return res.json({
        success: true,
        data: {
          attempt_id: existingAttempt.id,
          message: 'Continuando tentativa existente'
        }
      })
    }

    // Verificar limite de tentativas
    const { count } = await supabaseAdmin
      .from('quiz_attempt')
      .select('id', { count: 'exact' })
      .eq('quiz_id', quiz.id)
      .eq('user_id', participant.user_id)

    if (quiz.attempt_limit && (count || 0) >= quiz.attempt_limit) {
      return res.status(400).json({
        success: false,
        error: { message: 'Limite de tentativas atingido', code: 'ATTEMPT_LIMIT_REACHED' }
      })
    }

    // Contar total de perguntas
    const { count: questionCount } = await supabaseAdmin
      .from('quiz_question')
      .select('id', { count: 'exact' })
      .eq('quiz_id', quiz.id)
      .eq('is_active', true)

    // Criar nova tentativa
    const { data: attempt, error: attemptError } = await supabaseAdmin
      .from('quiz_attempt')
      .insert({
        quiz_id: quiz.id,
        user_id: participant.user_id,
        status: 'in_progress',
        total_points: 0,
        correct_count: 0,
        wrong_count: 0,
        metadata: {
          total_questions: questionCount || 0
        }
      })
      .select()
      .single()

    if (attemptError) {
      console.error('Erro ao criar tentativa:', attemptError)
      return res.status(500).json({
        success: false,
        error: { message: attemptError.message, code: 'SUPABASE_ERROR' }
      })
    }

    return res.json({
      success: true,
      data: {
        attempt_id: attempt.id,
        message: 'Nova tentativa iniciada'
      }
    })
  } catch (err) {
    return next(err)
  }
})

/**
 * @swagger
 * /api/quiz-answer/submit/{token}:
 *   post:
 *     summary: Submete as respostas do quiz (rota pública)
 *     tags: [Quiz Answer]
 *     parameters:
 *       - in: path
 *         name: token
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - attempt_id
 *               - answers
 *             properties:
 *               attempt_id:
 *                 type: integer
 *               answers:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     question_id:
 *                       type: integer
 *                     selected_option_ids:
 *                       type: array
 *                       items:
 *                         type: integer
 *               time_spent_seconds:
 *                 type: integer
 *     responses:
 *       200:
 *         description: Quiz submetido com sucesso - retorna resultado
 */
router.post('/submit/:token', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { token } = req.params
    const { attempt_id, answers, time_spent_seconds } = req.body

    if (!token || token.length !== 64) {
      return res.status(400).json({
        success: false,
        error: { message: 'Token inválido', code: 'INVALID_TOKEN' }
      })
    }

    if (!attempt_id || !answers || !Array.isArray(answers)) {
      return res.status(400).json({
        success: false,
        error: { message: 'Dados de submissão inválidos', code: 'INVALID_REQUEST' }
      })
    }

    // Validar token
    const tokenHash = hashSHA256(token)

    const { data: session } = await supabaseAdmin
      .from('temp_session')
      .select('*')
      .eq('token_hash', tokenHash)
      .eq('type', SESSION_TYPE)
      .eq('is_active', true)
      .single()

    if (!session) {
      return res.status(400).json({
        success: false,
        error: { message: 'Token inválido', code: 'INVALID_TOKEN' }
      })
    }

    // Buscar tentativa
    const { data: attempt, error: attemptError } = await supabaseAdmin
      .from('quiz_attempt')
      .select('*')
      .eq('id', attempt_id)
      .single()

    if (attemptError || !attempt) {
      return res.status(400).json({
        success: false,
        error: { message: 'Tentativa não encontrada', code: 'ATTEMPT_NOT_FOUND' }
      })
    }

    if (attempt.status !== 'in_progress') {
      return res.status(400).json({
        success: false,
        error: { message: 'Esta tentativa já foi finalizada', code: 'ATTEMPT_ALREADY_SUBMITTED' }
      })
    }

    // Buscar perguntas com opções corretas
    const { data: questions } = await supabaseAdmin
      .from('quiz_question')
      .select(`
        id,
        question_text,
        question_type,
        points,
        explanation,
        quiz_question_option (
          id,
          option_text,
          is_correct,
          rationale
        )
      `)
      .eq('quiz_id', attempt.quiz_id)
      .eq('is_active', true)

    if (!questions) {
      return res.status(500).json({
        success: false,
        error: { message: 'Erro ao buscar perguntas', code: 'SUPABASE_ERROR' }
      })
    }

    // Criar mapa de perguntas
    const questionsMap = new Map<number, any>()
    questions.forEach((q: any) => {
      questionsMap.set(q.id, q)
    })

    // Processar respostas e calcular pontuação
    let totalScore = 0
    let correctCount = 0
    let wrongCount = 0
    const results: any[] = []

    for (const answer of answers) {
      const question = questionsMap.get(answer.question_id)
      if (!question) continue

      const selectedOptionIds = answer.selected_option_ids || []
      const options = question.quiz_question_option || []
      
      // Determinar opções corretas
      const correctOptionIds = options
        .filter((opt: any) => opt.is_correct)
        .map((opt: any) => opt.id)

      // Verificar se a resposta está correta
      // Para single_choice: exatamente uma opção correta selecionada
      // Para multiple_choice: TODAS as opções corretas devem ser selecionadas, nenhuma errada
      let isCorrect = false

      if (question.question_type === 'single_choice') {
        isCorrect = selectedOptionIds.length === 1 && 
                   correctOptionIds.includes(selectedOptionIds[0])
      } else {
        // multiple_choice: precisa selecionar TODAS as corretas e NENHUMA errada
        const selectedSet = new Set(selectedOptionIds)
        const correctSet = new Set(correctOptionIds)
        
        isCorrect = selectedSet.size === correctSet.size &&
                   [...selectedSet].every(id => correctSet.has(id))
      }

      const pointsEarned = isCorrect ? (question.points || 1) : 0
      totalScore += pointsEarned

      if (isCorrect) {
        correctCount++
      } else {
        wrongCount++
      }

      // Salvar resposta
      const { data: attemptAnswer, error: answerError } = await supabaseAdmin
        .from('quiz_attempt_answer')
        .insert({
          attempt_id: attempt_id,
          question_id: answer.question_id,
          is_correct: isCorrect,
          points_earned: pointsEarned
        })
        .select()
        .single()

      if (!answerError && attemptAnswer) {
        // Salvar opções selecionadas
        if (selectedOptionIds.length > 0) {
          const optionsToInsert = selectedOptionIds.map((optId: number) => ({
            attempt_answer_id: attemptAnswer.id,
            option_id: optId
          }))

          await supabaseAdmin
            .from('quiz_attempt_answer_options')
            .insert(optionsToInsert)
        }
      }

      // Adicionar ao resultado (com detalhes para exibição)
      results.push({
        question_id: question.id,
        question_text: question.question_text,
        question_type: question.question_type,
        points: question.points,
        points_earned: pointsEarned,
        is_correct: isCorrect,
        explanation: question.explanation,
        selected_option_ids: selectedOptionIds,
        options: options.map((opt: any) => ({
          id: opt.id,
          option_text: opt.option_text,
          is_correct: opt.is_correct,
          rationale: opt.rationale,
          was_selected: selectedOptionIds.includes(opt.id)
        }))
      })
    }

    // Calcular total de pontos possíveis
    const totalPossiblePoints = questions.reduce((sum: number, q: any) => sum + (q.points || 1), 0)
    const percentageScore = totalPossiblePoints > 0 
      ? Math.round((totalScore / totalPossiblePoints) * 100) 
      : 0

    // Buscar quiz para verificar pass_score
    const { data: quiz } = await supabaseAdmin
      .from('quiz')
      .select('pass_score')
      .eq('id', attempt.quiz_id)
      .single()

    const passed = quiz?.pass_score ? percentageScore >= quiz.pass_score : null

    // Atualizar tentativa
    const { error: updateError } = await supabaseAdmin
      .from('quiz_attempt')
      .update({
        status: 'completed',
        submitted_at: new Date().toISOString(),
        score: totalScore,
        total_points: totalPossiblePoints,
        correct_count: correctCount,
        wrong_count: wrongCount,
        time_spent_seconds: time_spent_seconds || null,
        metadata: {
          total_questions: questions.length,
          percentage: percentageScore,
          passed: passed
        }
      })
      .eq('id', attempt_id)

    if (updateError) {
      console.error('Erro ao atualizar tentativa:', updateError)
    }

    return res.json({
      success: true,
      data: {
        score: totalScore,
        total_points: totalPossiblePoints,
        percentage: percentageScore,
        correct_count: correctCount,
        wrong_count: wrongCount,
        total_questions: questions.length,
        passed: passed,
        pass_score: quiz?.pass_score || null,
        time_spent_seconds: time_spent_seconds,
        results: results
      }
    })
  } catch (err) {
    return next(err)
  }
})

// ============================================================================
// ROTAS AUTENTICADAS (para consulta de resultados no admin)
// ============================================================================

// Aplicar middleware de autenticação a partir daqui
router.use(sessionAuth)

/**
 * @swagger
 * /api/quiz-answer/attempts/{quizId}/{userId}:
 *   get:
 *     summary: Busca todas as tentativas de um usuário em um quiz (autenticado)
 *     tags: [Quiz Answer]
 *     parameters:
 *       - in: path
 *         name: quizId
 *         required: true
 *         schema:
 *           type: integer
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Lista de tentativas
 */
router.get('/attempts/:quizId/:userId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { quizId, userId } = req.params
    if (!quizId || !userId) {
      return res.status(400).json({
        success: false,
        error: { message: 'IDs são obrigatórios', code: 'INVALID_REQUEST' }
      })
    }

    const { data: attempts, error } = await supabaseAdmin
      .from('quiz_attempt')
      .select(`
        *,
        quiz_attempt_answer (
          id,
          question_id,
          is_correct,
          points_earned,
          quiz_attempt_answer_options (
            option_id
          )
        )
      `)
      .eq('quiz_id', parseInt(quizId))
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Erro ao buscar tentativas:', error)
      return res.status(500).json({
        success: false,
        error: { message: error.message, code: 'SUPABASE_ERROR' }
      })
    }

    return res.json({
      success: true,
      data: attempts || []
    })
  } catch (err) {
    return next(err)
  }
})

export default router
