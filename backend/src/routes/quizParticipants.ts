/**
 * Rotas de Gerenciamento de Participantes do Quiz
 * 
 * Este módulo gerencia participantes e links temporários:
 * - Adicionar/remover participantes (individual e em lote)
 * - Gerar links temporários (individual e para todos)
 * - Consultar status de links e resultados
 * 
 * @module routes/quizParticipants
 */

import { Router, Request, Response, NextFunction } from 'express'
import { supabaseAdmin } from '../lib/supabaseAdmin'
import { sessionAuth } from '../middleware/sessionAuth'
import { generateSecureToken, hashSHA256 } from '../lib/encryption'

const router = Router()

// Aplicar middleware de autenticação em todas as rotas
router.use(sessionAuth)

// ============================================================================
// CONSTANTES
// ============================================================================

const SESSION_TYPE = 'quiz_answer'
const DEFAULT_EXPIRY_DAYS = 7
const DEFAULT_MAX_ACCESS = 100 // Permite múltiplos acessos para responder
const TOKEN_BYTES = 32 // 64 caracteres hex

// ============================================================================
// ANALYTICS - IMPORTANTE: Esta rota deve vir ANTES de /:quizId genérico
// ============================================================================

/**
 * @swagger
 * /api/quiz-participants/{quizId}/analytics:
 *   get:
 *     summary: Retorna métricas e estatísticas do quiz
 *     tags: [Quiz Participants]
 *     parameters:
 *       - in: path
 *         name: quizId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Métricas do quiz
 */
router.get('/:quizId/analytics', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const quizId = req.params['quizId']
    if (!quizId) {
      return res.status(400).json({
        success: false,
        error: { message: 'ID do quiz é obrigatório', code: 'INVALID_REQUEST' }
      })
    }

    const quizIdInt = parseInt(quizId)

    // 1. Buscar dados do quiz
    const { data: quiz, error: quizError } = await supabaseAdmin
      .from('quiz')
      .select('id, title, pass_score')
      .eq('id', quizIdInt)
      .single()

    if (quizError || !quiz) {
      console.error('Erro ao buscar quiz para analytics:', { quizIdInt, quizError, quiz })
      return res.status(404).json({
        success: false,
        error: { message: 'Quiz não encontrado', code: 'NOT_FOUND', details: quizError?.message }
      })
    }

    // 2. Buscar participantes
    const { data: participants, error: participantsError } = await supabaseAdmin
      .from('quiz_participant')
      .select('id, user_id, employees(name)')
      .eq('quiz_id', quizIdInt)

    if (participantsError) {
      console.error('Erro ao buscar participantes:', participantsError)
      return res.status(500).json({
        success: false,
        error: { message: participantsError.message, code: 'SUPABASE_ERROR' }
      })
    }

    const totalParticipants = participants?.length || 0

    // 3. Buscar todas as tentativas (attempts) com pontuação
    // quiz_attempt tem quiz_id e user_id diretamente (não passa por quiz_participant)
    // percentage está em metadata->percentage OU calculamos score/total_points
    const { data: attempts, error: attemptsError } = await supabaseAdmin
      .from('quiz_attempt')
      .select(`
        id,
        quiz_id,
        user_id,
        score,
        total_points,
        correct_count,
        wrong_count,
        submitted_at,
        metadata,
        employees!user_id(name)
      `)
      .eq('quiz_id', quizIdInt)
      .eq('status', 'completed')
      .order('submitted_at', { ascending: true })

    if (attemptsError) {
      console.error('Erro ao buscar tentativas:', attemptsError)
      return res.status(500).json({
        success: false,
        error: { message: attemptsError.message, code: 'SUPABASE_ERROR' }
      })
    }

    // 4. Calcular métricas
    // Helper para extrair percentage do metadata ou calcular
    const getPercentage = (attempt: any): number => {
      if (attempt.metadata?.percentage !== undefined) {
        return attempt.metadata.percentage
      }
      if (attempt.total_points > 0) {
        return Math.round((attempt.score / attempt.total_points) * 100)
      }
      return 0
    }

    // Participantes que completaram pelo menos uma tentativa (agrupado por user_id)
    const participantsWithAttempts = new Set(attempts?.map((a: any) => a.user_id) || [])
    const completedCount = participantsWithAttempts.size
    const completionRate = totalParticipants > 0 ? Math.round((completedCount / totalParticipants) * 100) : 0

    // Média geral de acertos (usando a melhor tentativa de cada usuário)
    // E contamos quantas tentativas cada usuário fez
    const bestAttemptsByUser = new Map<string, any>()
    const attemptCountByUser = new Map<string, number>()
    
    attempts?.forEach((attempt: any) => {
      const userId = attempt.user_id
      // Contar tentativas por usuário
      attemptCountByUser.set(userId, (attemptCountByUser.get(userId) || 0) + 1)
      
      const existing = bestAttemptsByUser.get(userId)
      const currentPct = getPercentage(attempt)
      const existingPct = existing ? getPercentage(existing) : 0
      if (!existing || currentPct > existingPct) {
        bestAttemptsByUser.set(userId, attempt)
      }
    })

    const bestAttempts = Array.from(bestAttemptsByUser.values())
    const averageScore = bestAttempts.length > 0
      ? Math.round(bestAttempts.reduce((sum, a) => sum + getPercentage(a), 0) / bestAttempts.length)
      : 0

    // 5. Ranking de participantes (top 10 por melhor pontuação, desempate por menos tentativas)
    const ranking = bestAttempts
      .map((attempt: any) => ({
        user_id: attempt.user_id,
        name: attempt.employees?.name || 'Participante',
        score: attempt.score || 0,
        total_points: attempt.total_points || quiz.pass_score || 0,
        percentage: getPercentage(attempt),
        attempts: attemptCountByUser.get(attempt.user_id) || 1,
        completed_at: attempt.submitted_at
      }))
      .sort((a, b) => {
        // Primeiro ordena por percentage (maior primeiro)
        if (b.percentage !== a.percentage) {
          return b.percentage - a.percentage
        }
        // Em caso de empate, ordena por número de tentativas (menor primeiro)
        return a.attempts - b.attempts
      })
      .slice(0, 10)

    // 6. Distribuição de notas por faixas (0-20%, 21-40%, 41-60%, 61-80%, 81-100%)
    const distribution: Record<string, number> = {
      '0-20': 0,
      '21-40': 0,
      '41-60': 0,
      '61-80': 0,
      '81-100': 0
    }

    bestAttempts.forEach((attempt: any) => {
      const pct = getPercentage(attempt)
      if (pct <= 20) distribution['0-20'] = (distribution['0-20'] || 0) + 1
      else if (pct <= 40) distribution['21-40'] = (distribution['21-40'] || 0) + 1
      else if (pct <= 60) distribution['41-60'] = (distribution['41-60'] || 0) + 1
      else if (pct <= 80) distribution['61-80'] = (distribution['61-80'] || 0) + 1
      else distribution['81-100'] = (distribution['81-100'] || 0) + 1
    })

    // 7. Evolução temporal (respostas por dia nos últimos 30 dias)
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const temporalEvolution: { date: string; count: number; avgScore: number }[] = []
    const attemptsByDate = new Map<string, { count: number; totalScore: number }>()

    attempts?.forEach((attempt: any) => {
      if (attempt.submitted_at) {
        const date = new Date(attempt.submitted_at)
        if (date >= thirtyDaysAgo) {
          const dateStr = date.toISOString().split('T')[0] as string
          const existing = attemptsByDate.get(dateStr) || { count: 0, totalScore: 0 }
          existing.count++
          existing.totalScore += getPercentage(attempt)
          attemptsByDate.set(dateStr, existing)
        }
      }
    })

    // Preencher todos os dias dos últimos 30 dias
    for (let i = 29; i >= 0; i--) {
      const date = new Date()
      date.setDate(date.getDate() - i)
      const dateStr = date.toISOString().split('T')[0] as string
      const data = attemptsByDate.get(dateStr)
      temporalEvolution.push({
        date: dateStr,
        count: data?.count || 0,
        avgScore: data ? Math.round(data.totalScore / data.count) : 0
      })
    }

    // 8. Estatísticas de tentativas
    const totalAttempts = attempts?.length || 0
    const avgAttemptsPerParticipant = completedCount > 0 
      ? Math.round((totalAttempts / completedCount) * 10) / 10 
      : 0

    // 9. Analytics por pergunta - acertos por número de tentativas
    // Buscar todas as perguntas do quiz
    const { data: questionsData, error: questionsError } = await supabaseAdmin
      .from('quiz_question')
      .select('id, question_text')
      .eq('quiz_id', quizIdInt)
      .eq('is_active', true)
      .order('id', { ascending: true })

    if (questionsError) {
      console.error('Erro ao buscar perguntas para analytics:', questionsError)
    }

    console.log(`[Analytics] Quiz ${quizIdInt}: ${questionsData?.length || 0} perguntas encontradas`)

    // Buscar todas as respostas de tentativas completadas
    // Primeiro buscar os IDs das tentativas completadas deste quiz
    const completedAttemptIds = attempts?.map((a: any) => a.id) || []
    
    let answersData: any[] = []
    let answersError: any = null

    if (completedAttemptIds.length > 0) {
      const result = await supabaseAdmin
        .from('quiz_attempt_answer')
        .select(`
          question_id,
          is_correct,
          attempt_id
        `)
        .in('attempt_id', completedAttemptIds)

      answersData = result.data || []
      answersError = result.error
    }

    console.log(`[Analytics] Quiz ${quizIdInt}: ${answersData?.length || 0} respostas encontradas de ${completedAttemptIds.length} tentativas`)

    if (answersError) {
      console.error('Erro ao buscar respostas para analytics:', answersError)
    }

    // Processar analytics por pergunta
    // Para cada user_id + question_id, precisamos saber em qual tentativa (1ª, 2ª, etc.) acertou
    interface QuestionStats {
      question_id: number
      question_text: string
      correct_1st: number  // Acertou na 1ª tentativa
      correct_2nd: number  // Acertou na 2ª tentativa
      correct_3rd: number  // Acertou na 3ª tentativa
      correct_4plus: number // Acertou na 4ª tentativa ou mais
      total_answers: number // Total de respostas para esta pergunta
      total_correct: number // Total que acertou (em qualquer tentativa)
      avg_attempts: number // Média de tentativas para acertar
      difficulty_index: number // % de erros (maior = mais difícil)
      difficulty_level: 'easy' | 'medium' | 'hard'
    }

    const questionAnalytics: QuestionStats[] = []

    if (questionsData && answersData && attempts) {
      // Criar mapa de attempt_id -> { user_id, order } usando os attempts já carregados
      const attemptInfoMap = new Map<number, { user_id: string, order: number }>()
      const attemptsByUser = new Map<string, number[]>()

      // Ordenar attempts por id (aproximação de ordem cronológica) e agrupar por user
      const sortedAttempts = [...attempts].sort((a: any, b: any) => a.id - b.id)
      
      sortedAttempts.forEach((attempt: any) => {
        const userId = attempt.user_id
        const userAttempts = attemptsByUser.get(userId) || []
        userAttempts.push(attempt.id)
        attemptsByUser.set(userId, userAttempts)
        attemptInfoMap.set(attempt.id, {
          user_id: userId,
          order: userAttempts.length // 1-based order for this user
        })
      })

      console.log(`[Analytics] Mapa de tentativas criado: ${attemptInfoMap.size} tentativas de ${attemptsByUser.size} usuários`)

      // Para cada pergunta, calcular estatísticas
      for (const question of questionsData) {
        const questionAnswers = answersData.filter((ans: any) => ans.question_id === question.id)
        
        // Agrupar por usuário para pegar apenas o primeiro acerto
        const userFirstCorrect = new Map<string, number>() // userId -> attempt_order when first correct
        const usersWhoAnswered = new Set<string>()
        
        questionAnswers.forEach((ans: any) => {
          const attemptInfo = attemptInfoMap.get(ans.attempt_id)
          if (!attemptInfo) return
          
          const userId = attemptInfo.user_id
          usersWhoAnswered.add(userId)
          
          if (ans.is_correct && !userFirstCorrect.has(userId)) {
            userFirstCorrect.set(userId, attemptInfo.order)
          }
        })

        // Contar acertos por tentativa
        let correct_1st = 0
        let correct_2nd = 0
        let correct_3rd = 0
        let correct_4plus = 0
        let sumAttempts = 0 // Soma das tentativas para calcular média

        userFirstCorrect.forEach((attemptOrder) => {
          sumAttempts += attemptOrder
          if (attemptOrder === 1) correct_1st++
          else if (attemptOrder === 2) correct_2nd++
          else if (attemptOrder === 3) correct_3rd++
          else correct_4plus++
        })

        // Total de usuários que responderam esta pergunta
        const totalAnswers = usersWhoAnswered.size
        const totalCorrect = userFirstCorrect.size
        
        // Média de tentativas para acertar (para quem acertou)
        const avgAttempts = totalCorrect > 0 
          ? Math.round((sumAttempts / totalCorrect) * 10) / 10 
          : 0
        
        // Difficulty index = % de quem NÃO acertou na 1ª tentativa
        const difficultyIndex = totalAnswers > 0 
          ? Math.round(((totalAnswers - correct_1st) / totalAnswers) * 100)
          : 0

        // Determinar nível de dificuldade baseado na média de tentativas
        let difficultyLevel: 'easy' | 'medium' | 'hard' = 'easy'
        if (avgAttempts >= 2.5 || difficultyIndex > 70) difficultyLevel = 'hard'
        else if (avgAttempts >= 1.5 || difficultyIndex >= 40) difficultyLevel = 'medium'

        questionAnalytics.push({
          question_id: question.id,
          question_text: question.question_text,
          correct_1st,
          correct_2nd,
          correct_3rd,
          correct_4plus,
          total_answers: totalAnswers,
          total_correct: totalCorrect,
          avg_attempts: avgAttempts,
          difficulty_index: difficultyIndex,
          difficulty_level: difficultyLevel
        })
      }

      // Ordenar por dificuldade (mais difíceis primeiro)
      questionAnalytics.sort((a, b) => b.difficulty_index - a.difficulty_index)
    }

    return res.json({
      success: true,
      data: {
        quiz: {
          id: quiz.id,
          title: quiz.title,
          total_points: quiz.pass_score || 0
        },
        summary: {
          total_participants: totalParticipants,
          completed_count: completedCount,
          completion_rate: completionRate,
          average_score: averageScore,
          total_attempts: totalAttempts,
          avg_attempts_per_participant: avgAttemptsPerParticipant
        },
        ranking,
        distribution: [
          { range: '0-20%', count: distribution['0-20'], color: '#ef4444' },
          { range: '21-40%', count: distribution['21-40'], color: '#f97316' },
          { range: '41-60%', count: distribution['41-60'], color: '#eab308' },
          { range: '61-80%', count: distribution['61-80'], color: '#22c55e' },
          { range: '81-100%', count: distribution['81-100'], color: '#10b981' }
        ],
        temporal_evolution: temporalEvolution,
        question_analytics: questionAnalytics
      }
    })
  } catch (err) {
    return next(err)
  }
})

// ============================================================================
// PARTICIPANTES CRUD
// ============================================================================

/**
 * @swagger
 * /api/quiz-participants/{quizId}:
 *   get:
 *     summary: Lista todos os participantes de um quiz com status e resultados
 *     tags: [Quiz Participants]
 *     parameters:
 *       - in: path
 *         name: quizId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Lista de participantes com status e resultados
 */
router.get('/:quizId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const quizId = req.params['quizId']
    if (!quizId) {
      return res.status(400).json({
        success: false,
        error: { message: 'ID do quiz é obrigatório', code: 'INVALID_REQUEST' }
      })
    }

    // Buscar participantes com dados do funcionário
    const { data: participants, error: participantsError } = await supabaseAdmin
      .from('quiz_participant')
      .select(`
        id,
        quiz_id,
        user_id,
        created_at,
        employees (
          user_id,
          name,
          email
        )
      `)
      .eq('quiz_id', parseInt(quizId))
      .order('created_at', { ascending: true })

    if (participantsError) {
      console.error('Erro ao buscar participantes:', participantsError)
      return res.status(500).json({
        success: false,
        error: { message: participantsError.message, code: 'SUPABASE_ERROR' }
      })
    }

    // Buscar links ativos (temp_session) para cada participante
    const { data: sessions, error: sessionsError } = await supabaseAdmin
      .from('temp_session')
      .select('*')
      .eq('type', SESSION_TYPE)
      .eq('is_active', true)

    if (sessionsError) {
      console.error('Erro ao buscar sessões:', sessionsError)
    }

    // Criar mapa de sessões por entity_id (participant_id)
    const sessionsMap = new Map<number, any>()
    sessions?.forEach((s: any) => {
      sessionsMap.set(s.entity_id, s)
    })

    // Buscar tentativas de cada participante
    const { data: attempts, error: attemptsError } = await supabaseAdmin
      .from('quiz_attempt')
      .select('*')
      .eq('quiz_id', parseInt(quizId))

    if (attemptsError) {
      console.error('Erro ao buscar tentativas:', attemptsError)
    }

    // Criar mapa de tentativas por user_id
    const attemptsMap = new Map<string, any[]>()
    attempts?.forEach((a: any) => {
      const userAttempts = attemptsMap.get(a.user_id) || []
      userAttempts.push(a)
      attemptsMap.set(a.user_id, userAttempts)
    })

    // Buscar quiz para obter attempt_limit e total de pontos
    const { data: quiz } = await supabaseAdmin
      .from('quiz')
      .select('attempt_limit, pass_score')
      .eq('id', parseInt(quizId))
      .single()

    // Calcular total de pontos do quiz
    const { data: questions } = await supabaseAdmin
      .from('quiz_question')
      .select('points')
      .eq('quiz_id', parseInt(quizId))
      .eq('is_active', true)

    const totalPoints = questions?.reduce((sum: number, q: any) => sum + (q.points || 1), 0) || 0

    // Montar resposta com status completo de cada participante
    const formattedParticipants = (participants || []).map((p: any) => {
      const session = sessionsMap.get(p.id)
      const userAttempts = attemptsMap.get(p.user_id) || []
      
      // Calcular estatísticas de tentativas
      const completedAttempts = userAttempts.filter((a: any) => a.status === 'completed')
      const bestAttempt = completedAttempts.length > 0
        ? completedAttempts.reduce((best: any, curr: any) => 
            (curr.score || 0) > (best?.score || 0) ? curr : best, completedAttempts[0])
        : null

      // Determinar status do link
      let linkStatus: 'not_generated' | 'active' | 'expired' | 'used' = 'not_generated'
      if (session) {
        if (session.used_at) {
          linkStatus = 'used'
        } else if (new Date(session.expires_at) < new Date()) {
          linkStatus = 'expired'
        } else {
          linkStatus = 'active'
        }
      }

      return {
        id: p.id,
        quiz_id: p.quiz_id,
        user_id: p.user_id,
        user_name: p.employees?.name || p.user_id,
        user_email: p.employees?.email || null,
        created_at: p.created_at,
        // Status do link
        link_status: linkStatus,
        link_expires_at: session?.expires_at || null,
        link_created_at: session?.created_at || null,
        // Estatísticas de tentativas
        attempts_used: userAttempts.length,
        attempt_limit: quiz?.attempt_limit || null,
        // Melhor resultado
        best_score: bestAttempt?.score || null,
        best_score_percentage: bestAttempt && totalPoints > 0 
          ? Math.round((bestAttempt.score / totalPoints) * 100) 
          : null,
        total_points: totalPoints,
        correct_count: bestAttempt?.correct_count || null,
        wrong_count: bestAttempt?.wrong_count || null,
        // Última tentativa
        last_attempt_at: userAttempts.length > 0
          ? userAttempts.sort((a: any, b: any) => 
              new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
            )[0]?.submitted_at || userAttempts[0]?.started_at
          : null,
        // Status geral
        status: completedAttempts.length > 0 ? 'completed' : 
                userAttempts.some((a: any) => a.status === 'in_progress') ? 'in_progress' : 
                'not_started',
        // Passou no quiz?
        passed: quiz?.pass_score && bestAttempt
          ? (bestAttempt.score / totalPoints * 100) >= quiz.pass_score
          : null
      }
    })

    return res.json({
      success: true,
      data: formattedParticipants
    })
  } catch (err) {
    return next(err)
  }
})

/**
 * @swagger
 * /api/quiz-participants/{quizId}:
 *   post:
 *     summary: Adiciona participantes ao quiz (um ou mais)
 *     tags: [Quiz Participants]
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
 *               - user_ids
 *             properties:
 *               user_ids:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Lista de user_ids para adicionar
 *     responses:
 *       201:
 *         description: Participantes adicionados com sucesso
 */
router.post('/:quizId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const quizId = req.params['quizId']
    if (!quizId) {
      return res.status(400).json({
        success: false,
        error: { message: 'ID do quiz é obrigatório', code: 'INVALID_REQUEST' }
      })
    }

    const { user_ids } = req.body
    if (!user_ids || !Array.isArray(user_ids) || user_ids.length === 0) {
      return res.status(400).json({
        success: false,
        error: { message: 'Lista de usuários é obrigatória', code: 'INVALID_REQUEST' }
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

    // Verificar quais usuários já são participantes
    const { data: existingParticipants } = await supabaseAdmin
      .from('quiz_participant')
      .select('user_id')
      .eq('quiz_id', parseInt(quizId))
      .in('user_id', user_ids)

    const existingUserIds = new Set(existingParticipants?.map((p: any) => p.user_id) || [])
    const newUserIds = user_ids.filter((uid: string) => !existingUserIds.has(uid))

    if (newUserIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: { message: 'Todos os usuários selecionados já são participantes', code: 'ALREADY_EXISTS' }
      })
    }

    // Inserir novos participantes
    const participantsToInsert = newUserIds.map((uid: string) => ({
      quiz_id: parseInt(quizId),
      user_id: uid
    }))

    const { data: newParticipants, error: insertError } = await supabaseAdmin
      .from('quiz_participant')
      .insert(participantsToInsert)
      .select()

    if (insertError) {
      console.error('Erro ao adicionar participantes:', insertError)
      return res.status(500).json({
        success: false,
        error: { message: insertError.message, code: 'SUPABASE_ERROR' }
      })
    }

    return res.status(201).json({
      success: true,
      data: newParticipants,
      message: `${newParticipants?.length || 0} participante(s) adicionado(s). ${existingUserIds.size > 0 ? `${existingUserIds.size} já existia(m).` : ''}`
    })
  } catch (err) {
    return next(err)
  }
})

/**
 * @swagger
 * /api/quiz-participants/{quizId}/{participantId}:
 *   delete:
 *     summary: Remove um participante do quiz
 *     tags: [Quiz Participants]
 *     parameters:
 *       - in: path
 *         name: quizId
 *         required: true
 *         schema:
 *           type: integer
 *       - in: path
 *         name: participantId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Participante removido com sucesso
 */
router.delete('/:quizId/:participantId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { quizId, participantId } = req.params
    if (!quizId || !participantId) {
      return res.status(400).json({
        success: false,
        error: { message: 'IDs são obrigatórios', code: 'INVALID_REQUEST' }
      })
    }

    // Desativar links existentes para este participante
    await supabaseAdmin
      .from('temp_session')
      .update({ is_active: false })
      .eq('entity_id', parseInt(participantId))
      .eq('type', SESSION_TYPE)

    // Remover participante
    const { error } = await supabaseAdmin
      .from('quiz_participant')
      .delete()
      .eq('id', parseInt(participantId))
      .eq('quiz_id', parseInt(quizId))

    if (error) {
      console.error('Erro ao remover participante:', error)
      return res.status(500).json({
        success: false,
        error: { message: error.message, code: 'SUPABASE_ERROR' }
      })
    }

    return res.json({
      success: true,
      message: 'Participante removido com sucesso'
    })
  } catch (err) {
    return next(err)
  }
})

// ============================================================================
// GERAÇÃO DE LINKS
// ============================================================================

/**
 * @swagger
 * /api/quiz-participants/{quizId}/{participantId}/generate-link:
 *   post:
 *     summary: Gera link de acesso para um participante
 *     tags: [Quiz Participants]
 *     parameters:
 *       - in: path
 *         name: quizId
 *         required: true
 *         schema:
 *           type: integer
 *       - in: path
 *         name: participantId
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               expires_at:
 *                 type: string
 *                 format: date-time
 *                 description: Data de expiração do link (opcional, padrão 7 dias)
 *     responses:
 *       200:
 *         description: Link gerado com sucesso
 */
router.post('/:quizId/:participantId/generate-link', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { quizId, participantId } = req.params
    if (!quizId || !participantId) {
      return res.status(400).json({
        success: false,
        error: { message: 'IDs são obrigatórios', code: 'INVALID_REQUEST' }
      })
    }

    // Verificar se o quiz está ativo
    const { data: quiz, error: quizError } = await supabaseAdmin
      .from('quiz')
      .select('id, is_active, title')
      .eq('id', parseInt(quizId))
      .single()

    if (quizError || !quiz) {
      return res.status(404).json({
        success: false,
        error: { message: 'Quiz não encontrado', code: 'NOT_FOUND' }
      })
    }

    if (!quiz.is_active) {
      return res.status(400).json({
        success: false,
        error: { message: 'Não é possível gerar links para um quiz inativo', code: 'QUIZ_INACTIVE' }
      })
    }

    // Verificar se o participante existe
    const { data: participant, error: participantError } = await supabaseAdmin
      .from('quiz_participant')
      .select('id, user_id')
      .eq('id', parseInt(participantId))
      .eq('quiz_id', parseInt(quizId))
      .single()

    if (participantError || !participant) {
      return res.status(404).json({
        success: false,
        error: { message: 'Participante não encontrado', code: 'NOT_FOUND' }
      })
    }

    // Desativar links anteriores para este participante
    await supabaseAdmin
      .from('temp_session')
      .update({ is_active: false })
      .eq('entity_id', parseInt(participantId))
      .eq('type', SESSION_TYPE)

    // Calcular data de expiração
    const { expires_at, max_access: requestMaxAccess } = req.body
    let expiryDate: Date
    if (expires_at) {
      expiryDate = new Date(expires_at)
    } else {
      expiryDate = new Date()
      expiryDate.setDate(expiryDate.getDate() + DEFAULT_EXPIRY_DAYS)
    }

    // Usar max_access do request ou o padrão
    const maxAccess = requestMaxAccess && requestMaxAccess > 0 ? requestMaxAccess : DEFAULT_MAX_ACCESS

    // Gerar token seguro
    const token = generateSecureToken(TOKEN_BYTES)
    const tokenHash = hashSHA256(token)

    console.log('Criando sessão temporária para quiz:', {
      entity_id: parseInt(participantId),
      type: SESSION_TYPE,
      quiz_id: parseInt(quizId),
      user_id: participant.user_id,
      max_access: maxAccess,
      expires_at: expiryDate.toISOString()
    })

    // Criar sessão temporária
    // Nota: O quiz_id e user_id são recuperados via JOIN com quiz_participant
    const { data: session, error: sessionError } = await supabaseAdmin
      .from('temp_session')
      .insert({
        entity_id: parseInt(participantId),
        type: SESSION_TYPE,
        token_hash: tokenHash,
        expires_at: expiryDate.toISOString(),
        max_access: maxAccess,
        access_count: 0,
        is_active: true
      })
      .select()
      .single()

    if (sessionError) {
      console.error('Erro ao criar sessão:', sessionError)
      return res.status(500).json({
        success: false,
        error: { message: sessionError.message, code: 'SUPABASE_ERROR' }
      })
    }

    // Construir URL do link
    const frontendUrl = process.env['FRONTEND_URL'] || 'http://localhost:3000'
    const link = `${frontendUrl}/quiz-answer/${token}`

    return res.json({
      success: true,
      data: {
        link,
        expires_at: session.expires_at,
        participant_id: participantId
      }
    })
  } catch (err) {
    return next(err)
  }
})

/**
 * @swagger
 * /api/quiz-participants/{quizId}/generate-all-links:
 *   post:
 *     summary: Gera links para todos os participantes do quiz
 *     tags: [Quiz Participants]
 *     parameters:
 *       - in: path
 *         name: quizId
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               expires_at:
 *                 type: string
 *                 format: date-time
 *                 description: Data de expiração dos links (opcional, padrão 7 dias)
 *     responses:
 *       200:
 *         description: Links gerados com sucesso
 */
router.post('/:quizId/generate-all-links', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const quizId = req.params['quizId']
    if (!quizId) {
      return res.status(400).json({
        success: false,
        error: { message: 'ID do quiz é obrigatório', code: 'INVALID_REQUEST' }
      })
    }

    // Verificar se o quiz está ativo
    const { data: quiz, error: quizError } = await supabaseAdmin
      .from('quiz')
      .select('id, is_active, title')
      .eq('id', parseInt(quizId))
      .single()

    if (quizError || !quiz) {
      return res.status(404).json({
        success: false,
        error: { message: 'Quiz não encontrado', code: 'NOT_FOUND' }
      })
    }

    if (!quiz.is_active) {
      return res.status(400).json({
        success: false,
        error: { message: 'Não é possível gerar links para um quiz inativo', code: 'QUIZ_INACTIVE' }
      })
    }

    // Buscar todos os participantes
    const { data: participants, error: participantsError } = await supabaseAdmin
      .from('quiz_participant')
      .select('id, user_id')
      .eq('quiz_id', parseInt(quizId))

    if (participantsError) {
      console.error('Erro ao buscar participantes:', participantsError)
      return res.status(500).json({
        success: false,
        error: { message: participantsError.message, code: 'SUPABASE_ERROR' }
      })
    }

    if (!participants || participants.length === 0) {
      return res.status(400).json({
        success: false,
        error: { message: 'Nenhum participante encontrado', code: 'NO_PARTICIPANTS' }
      })
    }

    // Desativar todos os links anteriores do quiz
    const participantIds = participants.map((p: any) => p.id)
    await supabaseAdmin
      .from('temp_session')
      .update({ is_active: false })
      .in('entity_id', participantIds)
      .eq('type', SESSION_TYPE)

    // Calcular data de expiração
    const { expires_at, max_access } = req.body
    let expiryDate: Date
    if (expires_at) {
      expiryDate = new Date(expires_at)
    } else {
      expiryDate = new Date()
      expiryDate.setDate(expiryDate.getDate() + DEFAULT_EXPIRY_DAYS)
    }

    // Usar max_access do body ou valor padrão
    const maxAccessValue = max_access && Number.isInteger(max_access) && max_access > 0 
      ? max_access 
      : DEFAULT_MAX_ACCESS

    const frontendUrl = process.env['FRONTEND_URL'] || 'http://localhost:3000'
    const generatedLinks: any[] = []

    // Gerar link para cada participante
    for (const participant of participants) {
      const token = generateSecureToken(TOKEN_BYTES)
      const tokenHash = hashSHA256(token)

      const { error: sessionError } = await supabaseAdmin
        .from('temp_session')
        .insert({
          entity_id: participant.id,
          type: SESSION_TYPE,
          token_hash: tokenHash,
          expires_at: expiryDate.toISOString(),
          max_access: maxAccessValue,
          access_count: 0,
          is_active: true
        })

      if (!sessionError) {
        generatedLinks.push({
          participant_id: participant.id,
          user_id: participant.user_id,
          link: `${frontendUrl}/quiz-answer/${token}`,
          expires_at: expiryDate.toISOString()
        })
      }
    }

    return res.json({
      success: true,
      data: {
        generated_count: generatedLinks.length,
        total_participants: participants.length,
        expires_at: expiryDate.toISOString(),
        links: generatedLinks
      }
    })
  } catch (err) {
    return next(err)
  }
})

/**
 * @swagger
 * /api/quiz-participants/{quizId}/{participantId}/link:
 *   get:
 *     summary: Obtém o link ativo de um participante (se existir)
 *     tags: [Quiz Participants]
 *     parameters:
 *       - in: path
 *         name: quizId
 *         required: true
 *         schema:
 *           type: integer
 *       - in: path
 *         name: participantId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Informações do link
 */
router.get('/:quizId/:participantId/link', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { quizId, participantId } = req.params
    if (!quizId || !participantId) {
      return res.status(400).json({
        success: false,
        error: { message: 'IDs são obrigatórios', code: 'INVALID_REQUEST' }
      })
    }

    // Buscar sessão ativa (não podemos recuperar o token original, apenas verificar se existe)
    const { data: session, error } = await supabaseAdmin
      .from('temp_session')
      .select('*')
      .eq('entity_id', parseInt(participantId))
      .eq('type', SESSION_TYPE)
      .eq('is_active', true)
      .single()

    if (error || !session) {
      return res.json({
        success: true,
        data: {
          has_active_link: false,
          message: 'Nenhum link ativo encontrado. Gere um novo link.'
        }
      })
    }

    const isExpired = new Date(session.expires_at) < new Date()

    return res.json({
      success: true,
      data: {
        has_active_link: !isExpired,
        expires_at: session.expires_at,
        is_expired: isExpired,
        access_count: session.access_count,
        max_access: session.max_access,
        message: isExpired 
          ? 'O link expirou. Gere um novo link.' 
          : 'Link ativo encontrado. Não é possível recuperar o token original, gere um novo se necessário.'
      }
    })
  } catch (err) {
    return next(err)
  }
})

export default router
