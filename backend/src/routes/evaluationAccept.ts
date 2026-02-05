/**
 * Rotas de Aceite de Avaliação
 * 
 * Este módulo gerencia o fluxo de aceite de avaliação pelo funcionário:
 * - Geração de token temporário para aceite (configurável)
 * - Validação de token (rota pública)
 * - Confirmação de aceite (rota pública)
 * - Consulta de link ativo
 * 
 * Segurança:
 * - Token armazenado como hash SHA-256 no banco (tabela temp_session)
 * - Token expira conforme configurado (default 24h)
 * - Controle de quantidade de acessos (max_access)
 * - Apenas UPDATE em campos accepted e accepted_at
 * 
 * @module routes/evaluationAccept
 */

import { Router, Request, Response, NextFunction } from 'express'
import { supabaseAdmin } from '../lib/supabaseAdmin'
import { sessionAuth } from '../middleware/sessionAuth'
import { generateSecureToken, hashSHA256 } from '../lib/encryption'

const router = Router()

// ============================================================================
// CONSTANTES
// ============================================================================

const SESSION_TYPE = 'accept_evaluation'
const DEFAULT_EXPIRY_HOURS = 24
const DEFAULT_MAX_ACCESS = 1
const TOKEN_BYTES = 32 // 64 caracteres hex

// ============================================================================
// ROTAS PÚBLICAS (SEM AUTENTICAÇÃO)
// Estas rotas são acessadas via link enviado ao funcionário
// ============================================================================

/**
 * @swagger
 * /api/evaluation-accept/verify/{token}:
 *   get:
 *     summary: Verifica se um token de aceite é válido (rota pública)
 *     tags: [Evaluation Accept]
 *     parameters:
 *       - in: path
 *         name: token
 *         required: true
 *         schema:
 *           type: string
 *         description: Token de aceite (64 caracteres hex)
 *     responses:
 *       200:
 *         description: Token válido - retorna dados da avaliação
 *       400:
 *         description: Token inválido, expirado ou já utilizado
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

    // Buscar sessão de aceite pelo hash
    const { data: session, error: sessionError } = await supabaseAdmin
      .from('temp_session')
      .select(`
        id,
        entity_id,
        type,
        expires_at,
        used_at,
        is_active,
        max_access,
        access_count
      `)
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

    // Verificar se já foi utilizado (usado_at preenchido)
    if (session.used_at) {
      return res.status(400).json({
        success: false,
        error: { message: 'Este link de aceite já foi utilizado', code: 'TOKEN_ALREADY_USED' }
      })
    }

    // Verificar limite de acessos
    const maxAccess = session.max_access || DEFAULT_MAX_ACCESS
    const accessCount = session.access_count || 0
    if (accessCount >= maxAccess) {
      return res.status(400).json({
        success: false,
        error: { message: 'Limite de acessos atingido para este link', code: 'ACCESS_LIMIT_REACHED' }
      })
    }

    // Verificar se expirou
    const expiresAt = new Date(session.expires_at)
    if (expiresAt < new Date()) {
      return res.status(400).json({
        success: false,
        error: { message: 'Este link de aceite expirou', code: 'TOKEN_EXPIRED' }
      })
    }

    // Incrementar contador de acessos
    await supabaseAdmin
      .from('temp_session')
      .update({ access_count: accessCount + 1 })
      .eq('id', session.id)

    // Buscar dados da avaliação com modelo vinculado
    const { data: evaluation, error: evalError } = await supabaseAdmin
      .from('evaluations')
      .select(`
        id,
        name,
        user_name,
        owner_name,
        period_start,
        period_end,
        accepted,
        accepted_at,
        evaluation_model_id,
        evaluations_questions_reply (
          question_id,
          score,
          reply,
          yes_no,
          weight,
          category,
          subcategory
        )
      `)
      .eq('id', session.entity_id)
      .single()

    if (evalError || !evaluation) {
      return res.status(400).json({
        success: false,
        error: { message: 'Avaliação não encontrada', code: 'EVALUATION_NOT_FOUND' }
      })
    }

    // Verificar se já foi aceita
    if (evaluation.accepted) {
      return res.status(400).json({
        success: false,
        error: { message: 'Esta avaliação já foi aceita anteriormente', code: 'ALREADY_ACCEPTED' }
      })
    }

    // Calcular média ponderada dos scores
    let averageScore: number | null = null
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
          averageScore = Math.round((totalWeightedScore / totalWeight) * 10) / 10
        }
      }
    }

    // Buscar perguntas do modelo (se existir modelo vinculado)
    let questions: any[] = []
    let categories: any[] = []

    if (evaluation.evaluation_model_id) {
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

      if (!questionsError && evalQuestions) {
        // Extrair IDs únicos de categorias, subcategorias e tipos de resposta
        const categoryIds = new Set<number>()
        const subcategoryIds = new Set<number>()
        const replyTypeIds = new Set<number>()

        evalQuestions.forEach((item: any) => {
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
          const { data: domainsData } = await supabaseAdmin
            .from('domains')
            .select('*')
            .in('id', allDomainIds)

          if (domainsData) {
            domainsData.forEach((d: any) => {
              domainsMap.set(d.id, d)
            })
          }
        }

        // Criar mapa de respostas por question_id
        const responsesMap = new Map<number, any>()
        replies.forEach((r: any) => {
          responsesMap.set(r.question_id, r)
        })

        // Processar perguntas com respostas
        questions = evalQuestions
          .map((item: any) => {
            const q = item.questions_model
            if (!q) return null

            const categoryDomain = domainsMap.get(q.category_id)
            const subcategoryDomain = domainsMap.get(q.subcategory_id)
            const replyTypeDomain = domainsMap.get(q.reply_type_id)
            const response = responsesMap.get(q.id)

            return {
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
              question_order: item.question_order,
              // Resposta
              score: response?.score ?? null,
              reply: response?.reply ?? null,
              yes_no: response?.yes_no ?? null
            }
          })
          .filter((q: any) => q !== null)

        // Extrair categorias únicas
        const categoriesArray = Array.from(categoryIds).map(catId => domainsMap.get(catId)).filter(Boolean)
        const subcategoriesArray = Array.from(subcategoryIds).map(subId => domainsMap.get(subId)).filter(Boolean)
        categories = [...categoriesArray, ...subcategoriesArray]
      }
    }

    return res.json({
      success: true,
      data: {
        evaluation: {
          id: evaluation.id,
          name: evaluation.name,
          userName: evaluation.user_name,
          ownerName: evaluation.owner_name,
          periodStart: evaluation.period_start,
          periodEnd: evaluation.period_end,
          averageScore
        },
        questions,
        categories,
        expiresAt: session.expires_at
      }
    })
  } catch (err) {
    return next(err)
  }
})

/**
 * @swagger
 * /api/evaluation-accept/confirm/{token}:
 *   post:
 *     summary: Confirma o aceite de uma avaliação usando o token (rota pública)
 *     tags: [Evaluation Accept]
 *     parameters:
 *       - in: path
 *         name: token
 *         required: true
 *         schema:
 *           type: string
 *         description: Token de aceite (64 caracteres hex)
 *     responses:
 *       200:
 *         description: Avaliação aceita com sucesso
 *       400:
 *         description: Token inválido, expirado ou já utilizado
 */
router.post('/confirm/:token', async (req: Request, res: Response, next: NextFunction) => {
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

    // Buscar sessão de aceite pelo hash
    const { data: session, error: sessionError } = await supabaseAdmin
      .from('temp_session')
      .select('id, entity_id, type, expires_at, used_at, is_active')
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

    // Verificar se já foi utilizado
    if (session.used_at) {
      return res.status(400).json({
        success: false,
        error: { message: 'Este link de aceite já foi utilizado', code: 'TOKEN_ALREADY_USED' }
      })
    }

    // Verificar se expirou
    const expiresAt = new Date(session.expires_at)
    if (expiresAt < new Date()) {
      return res.status(400).json({
        success: false,
        error: { message: 'Este link de aceite expirou', code: 'TOKEN_EXPIRED' }
      })
    }

    // Verificar se avaliação já foi aceita e buscar dados para notificação
    const { data: evaluation, error: evalCheckError } = await supabaseAdmin
      .from('evaluations')
      .select('id, accepted, owner_id, user_id, user_name, name, period_start, period_end')
      .eq('id', session.entity_id)
      .single()

    if (evalCheckError || !evaluation) {
      return res.status(400).json({
        success: false,
        error: { message: 'Avaliação não encontrada', code: 'EVALUATION_NOT_FOUND' }
      })
    }

    if (evaluation.accepted) {
      return res.status(400).json({
        success: false,
        error: { message: 'Esta avaliação já foi aceita anteriormente', code: 'ALREADY_ACCEPTED' }
      })
    }

    const now = new Date().toISOString()

    // ========================================================================
    // OPERAÇÃO CRÍTICA: Atualizar APENAS os campos accepted e accepted_at
    // ========================================================================
    const { error: updateEvalError } = await supabaseAdmin
      .from('evaluations')
      .update({
        accepted: true,
        accepted_at: now
      })
      .eq('id', session.entity_id)

    if (updateEvalError) {
      console.error('Erro ao aceitar avaliação:', updateEvalError)
      return res.status(500).json({
        success: false,
        error: { message: 'Erro ao aceitar avaliação', code: 'SUPABASE_ERROR' }
      })
    }

    // Marcar sessão como utilizada e inativar
    const { error: updateSessionError } = await supabaseAdmin
      .from('temp_session')
      .update({ used_at: now, is_active: false })
      .eq('id', session.id)

    if (updateSessionError) {
      console.error('Erro ao marcar token como usado:', updateSessionError)
      // Não retorna erro pois a avaliação já foi aceita
    }

    // ========================================================================
    // NOTIFICAÇÃO: Criar notificação para o gerente informando o aceite
    // ========================================================================
    try {
      // 1. Buscar o email do owner na tabela employees usando o slug (user_id)
      const { data: ownerEmployee, error: ownerError } = await supabaseAdmin
        .from('employees')
        .select('email')
        .eq('user_id', evaluation.owner_id)
        .single()

      if (ownerError || !ownerEmployee?.email) {
        console.error('Erro ao buscar email do owner na tabela employees:', ownerError)
      } else {
        // 2. Buscar o UUID do auth.users na tabela sessions usando o email
        const { data: ownerSession, error: sessionError } = await supabaseAdmin
          .from('sessions')
          .select('user_id')
          .eq('email', ownerEmployee.email)
          .limit(1)
          .single()

        if (sessionError || !ownerSession?.user_id) {
          console.error('Erro ao buscar user_id na tabela sessions:', sessionError)
        } else {
          // Formatar período para exibição
          const periodStart = evaluation.period_start 
            ? new Date(evaluation.period_start).toLocaleDateString('pt-BR')
            : 'N/A'
          const periodEnd = evaluation.period_end 
            ? new Date(evaluation.period_end).toLocaleDateString('pt-BR')
            : 'N/A'
          
          const notificationMessage = `${evaluation.user_name} aceitou a avaliação "${evaluation.name || 'N/A'}" (${periodStart} a ${periodEnd})`
          
          const { error: notifError } = await supabaseAdmin
            .from('notifications')
            .insert({
              title: 'Avaliação Aceita',
              message: notificationMessage,
              type_id: 76,
              type: 'info',
              audience: 'user',
              auth_user_id: ownerSession.user_id,
              link_url: `/employees/${evaluation.user_id}#avaliacoes`,
              source_type: 132,
              source_id: session.entity_id.toString()
            })

          if (notifError) {
            console.error('Erro ao criar notificação de aceite de avaliação:', notifError)
          }
        }
      }
    } catch (notifErr) {
      console.error('Erro ao criar notificação de aceite de avaliação:', notifErr)
      // Não bloqueia o fluxo principal
    }

    return res.json({
      success: true,
      data: {
        message: 'Avaliação aceita com sucesso!',
        acceptedAt: now
      }
    })
  } catch (err) {
    return next(err)
  }
})

// ============================================================================
// ROTAS AUTENTICADAS
// Estas rotas requerem autenticação do gestor
// ============================================================================

/**
 * @swagger
 * /api/evaluation-accept/{evaluationId}/generate:
 *   post:
 *     summary: Gera um novo token de aceite para uma avaliação (requer autenticação)
 *     tags: [Evaluation Accept]
 *     security:
 *       - sessionAuth: []
 *     parameters:
 *       - in: path
 *         name: evaluationId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Token gerado com sucesso
 *       400:
 *         description: Avaliação não está fechada ou já foi aceita
 *       404:
 *         description: Avaliação não encontrada
 */
router.post('/:evaluationId/generate', sessionAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { evaluationId } = req.params
    const userId = req.session?.userId

    if (!evaluationId) {
      return res.status(400).json({
        success: false,
        error: { message: 'ID da avaliação é obrigatório', code: 'INVALID_REQUEST' }
      })
    }

    const evalId = parseInt(evaluationId)
    if (isNaN(evalId)) {
      return res.status(400).json({
        success: false,
        error: { message: 'ID da avaliação inválido', code: 'INVALID_REQUEST' }
      })
    }

    // Verificar se avaliação existe e está fechada
    const { data: evaluation, error: evalError } = await supabaseAdmin
      .from('evaluations')
      .select('id, name, user_name, is_closed, accepted')
      .eq('id', evalId)
      .single()

    if (evalError || !evaluation) {
      return res.status(404).json({
        success: false,
        error: { message: 'Avaliação não encontrada', code: 'NOT_FOUND' }
      })
    }

    // Verificar se está fechada
    if (!evaluation.is_closed) {
      return res.status(400).json({
        success: false,
        error: { message: 'A avaliação precisa estar encerrada para gerar link de aceite', code: 'NOT_CLOSED' }
      })
    }

    // Verificar se já foi aceita
    if (evaluation.accepted) {
      return res.status(400).json({
        success: false,
        error: { message: 'Esta avaliação já foi aceita', code: 'ALREADY_ACCEPTED' }
      })
    }

    // Parâmetros configuráveis do body
    const maxAccess = req.body.maxAccess || DEFAULT_MAX_ACCESS
    const expiresInHours = req.body.expiresInHours || DEFAULT_EXPIRY_HOURS

    // Desativar tokens anteriores para esta avaliação
    await supabaseAdmin
      .from('temp_session')
      .update({ is_active: false })
      .eq('entity_id', evalId)
      .eq('type', SESSION_TYPE)
      .eq('is_active', true)

    // Gerar novo token
    const token = generateSecureToken(TOKEN_BYTES)
    const tokenHash = hashSHA256(token)
    
    const expiresAt = new Date()
    expiresAt.setHours(expiresAt.getHours() + expiresInHours)

    // Inserir nova sessão de aceite
    const { error: insertError } = await supabaseAdmin
      .from('temp_session')
      .insert({
        entity_id: evalId,
        type: SESSION_TYPE,
        token_hash: tokenHash,
        expires_at: expiresAt.toISOString(),
        created_by: userId,
        is_active: true,
        max_access: maxAccess,
        access_count: 0
      })

    if (insertError) {
      console.error('Erro ao criar sessão de aceite:', insertError)
      return res.status(500).json({
        success: false,
        error: { message: 'Erro ao gerar link de aceite', code: 'SUPABASE_ERROR' }
      })
    }

    // Gerar URL completa
    const frontendUrl = process.env['FRONTEND_URL'] || 'http://localhost:3000'
    const acceptUrl = `${frontendUrl}/evaluation-accept/${token}`

    return res.json({
      success: true,
      data: {
        token,
        url: acceptUrl,
        expiresAt: expiresAt.toISOString(),
        expiresInHours: expiresInHours,
        maxAccess: maxAccess,
        evaluation: {
          id: evaluation.id,
          name: evaluation.name,
          userName: evaluation.user_name
        }
      }
    })
  } catch (err) {
    return next(err)
  }
})

/**
 * @swagger
 * /api/evaluation-accept/{evaluationId}/link:
 *   get:
 *     summary: Obtém o link de aceite ativo para uma avaliação (requer autenticação)
 *     tags: [Evaluation Accept]
 *     security:
 *       - sessionAuth: []
 *     parameters:
 *       - in: path
 *         name: evaluationId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Retorna informações do link ativo ou null se não houver
 */
router.get('/:evaluationId/link', sessionAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { evaluationId } = req.params

    if (!evaluationId) {
      return res.status(400).json({
        success: false,
        error: { message: 'ID da avaliação é obrigatório', code: 'INVALID_REQUEST' }
      })
    }

    const evalId = parseInt(evaluationId)
    if (isNaN(evalId)) {
      return res.status(400).json({
        success: false,
        error: { message: 'ID da avaliação inválido', code: 'INVALID_REQUEST' }
      })
    }

    // Buscar avaliação para status de aceite
    const { data: evaluation, error: evalError } = await supabaseAdmin
      .from('evaluations')
      .select('id, accepted, accepted_at, is_closed')
      .eq('id', evalId)
      .single()

    if (evalError || !evaluation) {
      return res.status(404).json({
        success: false,
        error: { message: 'Avaliação não encontrada', code: 'NOT_FOUND' }
      })
    }

    // Buscar último token ativo válido
    const { data: session, error: sessionError } = await supabaseAdmin
      .from('temp_session')
      .select('id, expires_at, used_at, created_at, is_active, max_access, access_count')
      .eq('entity_id', evalId)
      .eq('type', SESSION_TYPE)
      .eq('is_active', true)
      .is('used_at', null)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    // Se não encontrou sessão válida ou limite de acessos atingido
    const hasValidLink = !sessionError && session !== null && 
      (session.access_count || 0) < (session.max_access || DEFAULT_MAX_ACCESS)

    return res.json({
      success: true,
      data: {
        accepted: evaluation.accepted || false,
        acceptedAt: evaluation.accepted_at,
        isClosed: evaluation.is_closed,
        hasValidLink,
        linkExpiresAt: hasValidLink ? session.expires_at : null,
        linkCreatedAt: hasValidLink ? session.created_at : null
      }
    })
  } catch (err) {
    return next(err)
  }
})

/**
 * @swagger
 * /api/evaluation-accept/{evaluationId}/status:
 *   get:
 *     summary: Obtém status de aceite de uma avaliação (requer autenticação)
 *     tags: [Evaluation Accept]
 *     security:
 *       - sessionAuth: []
 *     parameters:
 *       - in: path
 *         name: evaluationId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Status do aceite
 */
router.get('/:evaluationId/status', sessionAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { evaluationId } = req.params

    if (!evaluationId) {
      return res.status(400).json({
        success: false,
        error: { message: 'ID da avaliação é obrigatório', code: 'INVALID_REQUEST' }
      })
    }

    const evalId = parseInt(evaluationId)
    if (isNaN(evalId)) {
      return res.status(400).json({
        success: false,
        error: { message: 'ID da avaliação inválido', code: 'INVALID_REQUEST' }
      })
    }

    // Buscar avaliação
    const { data: evaluation, error: evalError } = await supabaseAdmin
      .from('evaluations')
      .select('id, accepted, accepted_at')
      .eq('id', evalId)
      .single()

    if (evalError || !evaluation) {
      return res.status(404).json({
        success: false,
        error: { message: 'Avaliação não encontrada', code: 'NOT_FOUND' }
      })
    }

    return res.json({
      success: true,
      data: {
        accepted: evaluation.accepted || false,
        acceptedAt: evaluation.accepted_at
      }
    })
  } catch (err) {
    return next(err)
  }
})

export default router
