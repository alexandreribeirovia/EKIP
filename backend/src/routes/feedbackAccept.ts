/**
 * Rotas de Aceite de Feedback
 * 
 * Este módulo gerencia o fluxo de aceite de feedback pelo funcionário:
 * - Encerramento do feedback (bloqueia edição)
 * - Geração de token temporário para aceite (configurável)
 * - Validação de token (rota pública)
 * - Confirmação de aceite (rota pública)
 * - Consulta de link ativo
 * 
 * Segurança:
 * - Token armazenado como hash SHA-256 no banco (tabela temp_session)
 * - Token expira conforme configurado (default 24h)
 * - Controle de quantidade de acessos (max_access)
 * - Apenas owner_user_id pode encerrar e gerar link
 * - Apenas UPDATE em campos accepted e accepted_at
 * 
 * @module routes/feedbackAccept
 */

import { Router, Request, Response, NextFunction } from 'express'
import { supabaseAdmin } from '../lib/supabaseAdmin'
import { sessionAuth } from '../middleware/sessionAuth'
import { generateSecureToken, hashSHA256 } from '../lib/encryption'

const router = Router()

// ============================================================================
// CONSTANTES
// ============================================================================

const SESSION_TYPE = 'accept_feedback'
const DEFAULT_EXPIRY_HOURS = 24
const DEFAULT_MAX_ACCESS = 1
const TOKEN_BYTES = 32 // 64 caracteres hex

// ============================================================================
// ROTAS PÚBLICAS (SEM AUTENTICAÇÃO)
// Estas rotas são acessadas via link enviado ao funcionário
// ============================================================================

/**
 * @swagger
 * /api/feedback-accept/verify/{token}:
 *   get:
 *     summary: Verifica se um token de aceite é válido (rota pública)
 *     tags: [Feedback Accept]
 *     parameters:
 *       - in: path
 *         name: token
 *         required: true
 *         schema:
 *           type: string
 *         description: Token de aceite (64 caracteres hex)
 *     responses:
 *       200:
 *         description: Token válido - retorna dados do feedback
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

    // Buscar dados do feedback
    const { data: feedback, error: feedbackError } = await supabaseAdmin
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
        is_closed,
        accepted,
        accepted_at
      `)
      .eq('id', session.entity_id)
      .single()

    if (feedbackError || !feedback) {
      return res.status(400).json({
        success: false,
        error: { message: 'Feedback não encontrado', code: 'FEEDBACK_NOT_FOUND' }
      })
    }

    // Verificar se já foi aceito
    if (feedback.accepted) {
      return res.status(400).json({
        success: false,
        error: { message: 'Este feedback já foi aceito anteriormente', code: 'ALREADY_ACCEPTED' }
      })
    }

    return res.json({
      success: true,
      data: {
        feedback: {
          id: feedback.id,
          feedbackUserName: feedback.feedback_user_name,
          ownerName: feedback.owner_user_name,
          feedbackDate: feedback.feedback_date,
          type: feedback.type,
          typeId: feedback.type_id,
          publicComment: feedback.public_comment
        },
        expiresAt: session.expires_at
      }
    })
  } catch (err) {
    return next(err)
  }
})

/**
 * @swagger
 * /api/feedback-accept/confirm/{token}:
 *   post:
 *     summary: Confirma o aceite de um feedback usando o token (rota pública)
 *     tags: [Feedback Accept]
 *     parameters:
 *       - in: path
 *         name: token
 *         required: true
 *         schema:
 *           type: string
 *         description: Token de aceite (64 caracteres hex)
 *     responses:
 *       200:
 *         description: Feedback aceito com sucesso
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

    // Verificar se feedback já foi aceito e buscar dados para notificação
    const { data: feedback, error: feedbackCheckError } = await supabaseAdmin
      .from('feedbacks')
      .select('id, accepted, owner_user_id, feedback_user_id, feedback_user_name, type, feedback_date')
      .eq('id', session.entity_id)
      .single()

    if (feedbackCheckError || !feedback) {
      return res.status(400).json({
        success: false,
        error: { message: 'Feedback não encontrado', code: 'FEEDBACK_NOT_FOUND' }
      })
    }

    if (feedback.accepted) {
      return res.status(400).json({
        success: false,
        error: { message: 'Este feedback já foi aceito anteriormente', code: 'ALREADY_ACCEPTED' }
      })
    }

    const now = new Date().toISOString()

    // ========================================================================
    // OPERAÇÃO CRÍTICA: Atualizar APENAS os campos accepted e accepted_at
    // ========================================================================
    const { error: updateFeedbackError } = await supabaseAdmin
      .from('feedbacks')
      .update({
        accepted: true,
        accepted_at: now
      })
      .eq('id', session.entity_id)

    if (updateFeedbackError) {
      console.error('Erro ao aceitar feedback:', updateFeedbackError)
      return res.status(500).json({
        success: false,
        error: { message: 'Erro ao aceitar feedback', code: 'SUPABASE_ERROR' }
      })
    }

    // Marcar sessão como utilizada e inativar
    const { error: updateSessionError } = await supabaseAdmin
      .from('temp_session')
      .update({ used_at: now, is_active: false })
      .eq('id', session.id)

    if (updateSessionError) {
      console.error('Erro ao marcar token como usado:', updateSessionError)
      // Não retorna erro pois o feedback já foi aceito
    }

    // ========================================================================
    // NOTIFICAÇÃO: Criar notificação para o gerente informando o aceite
    // ========================================================================
    try {
      // 1. Buscar o email do owner na tabela users usando o slug (user_id)
      const { data: ownerUser, error: ownerError } = await supabaseAdmin
        .from('users')
        .select('email')
        .eq('user_id', feedback.owner_user_id)
        .single()

      if (ownerError || !ownerUser?.email) {
        console.error('Erro ao buscar email do owner na tabela users:', ownerError)
      } else {
        // 2. Buscar o UUID do auth.users na tabela sessions usando o email
        const { data: ownerSession, error: sessionError } = await supabaseAdmin
          .from('sessions')
          .select('user_id')
          .eq('email', ownerUser.email)
          .limit(1)
          .single()

        if (sessionError || !ownerSession?.user_id) {
          console.error('Erro ao buscar user_id na tabela sessions:', sessionError)
        } else {
          // Formatar data do feedback para exibição
          const feedbackDateFormatted = feedback.feedback_date 
            ? new Date(feedback.feedback_date).toLocaleDateString('pt-BR')
            : 'N/A'
          
          const notificationMessage = `${feedback.feedback_user_name} aceitou o feedback do tipo "${feedback.type || 'N/A'}" de ${feedbackDateFormatted}`
          
          const { error: notifError } = await supabaseAdmin
            .from('notifications')
            .insert({
              title: 'Feedback Aceito',
              message: notificationMessage,
              type_id: 76,
              type: 'info',
              audience: 'user',
              auth_user_id: ownerSession.user_id,
              link_url: `/employees/${feedback.feedback_user_id}#feedbacks`,
              source_type: 80,
              source_id: session.entity_id.toString()
            })

          if (notifError) {
            console.error('Erro ao criar notificação de aceite de feedback:', notifError)
          }
        }
      }
    } catch (notifErr) {
      console.error('Erro ao criar notificação de aceite de feedback:', notifErr)
      // Não bloqueia o fluxo principal
    }

    return res.json({
      success: true,
      data: {
        message: 'Feedback aceito com sucesso!',
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
 * /api/feedback-accept/{feedbackId}/close:
 *   patch:
 *     summary: Encerra um feedback para permitir geração de link de aceite (requer autenticação)
 *     tags: [Feedback Accept]
 *     security:
 *       - sessionAuth: []
 *     parameters:
 *       - in: path
 *         name: feedbackId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Feedback encerrado com sucesso
 *       403:
 *         description: Apenas o criador do feedback pode encerrá-lo
 *       404:
 *         description: Feedback não encontrado
 */
router.patch('/:feedbackId/close', sessionAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { feedbackId } = req.params

    if (!feedbackId) {
      return res.status(400).json({
        success: false,
        error: { message: 'ID do feedback é obrigatório', code: 'INVALID_REQUEST' }
      })
    }

    const fbId = parseInt(feedbackId)
    if (isNaN(fbId)) {
      return res.status(400).json({
        success: false,
        error: { message: 'ID do feedback inválido', code: 'INVALID_REQUEST' }
      })
    }

    const now = new Date().toISOString()

    // Encerrar o feedback
    const { error: updateError } = await supabaseAdmin
      .from('feedbacks')
      .update({
        is_closed: true,
        closed_at: now
      })
      .eq('id', fbId)
      .select()
      .single()

    if (updateError) {
      if (updateError.code === 'PGRST116') {
        return res.status(404).json({
          success: false,
          error: { message: 'Feedback não encontrado', code: 'NOT_FOUND' }
        })
      }
      console.error('Erro ao encerrar feedback:', updateError)
      return res.status(500).json({
        success: false,
        error: { message: 'Erro ao encerrar feedback', code: 'SUPABASE_ERROR' }
      })
    }

    return res.json({
      success: true,
      data: {
        message: 'Feedback encerrado com sucesso!',
        closedAt: now
      }
    })
  } catch (err) {
    return next(err)
  }
})

/**
 * @swagger
 * /api/feedback-accept/{feedbackId}/generate:
 *   post:
 *     summary: Gera um novo token de aceite para um feedback (requer autenticação)
 *     tags: [Feedback Accept]
 *     security:
 *       - sessionAuth: []
 *     parameters:
 *       - in: path
 *         name: feedbackId
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               maxAccess:
 *                 type: integer
 *                 default: 1
 *               expiresInHours:
 *                 type: integer
 *                 default: 24
 *     responses:
 *       200:
 *         description: Token gerado com sucesso
 *       400:
 *         description: Feedback não está fechado ou já foi aceito
 *       403:
 *         description: Apenas o criador do feedback pode gerar link
 *       404:
 *         description: Feedback não encontrado
 */
router.post('/:feedbackId/generate', sessionAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { feedbackId } = req.params
    const userId = req.session?.userId

    if (!feedbackId) {
      return res.status(400).json({
        success: false,
        error: { message: 'ID do feedback é obrigatório', code: 'INVALID_REQUEST' }
      })
    }

    const fbId = parseInt(feedbackId)
    if (isNaN(fbId)) {
      return res.status(400).json({
        success: false,
        error: { message: 'ID do feedback inválido', code: 'INVALID_REQUEST' }
      })
    }

    // Verificar se feedback existe e está fechado
    const { data: feedback, error: feedbackError } = await supabaseAdmin
      .from('feedbacks')
      .select('id, feedback_user_name, is_closed, accepted')
      .eq('id', fbId)
      .single()

    if (feedbackError || !feedback) {
      return res.status(404).json({
        success: false,
        error: { message: 'Feedback não encontrado', code: 'NOT_FOUND' }
      })
    }

    // Verificar se está fechado
    if (!feedback.is_closed) {
      return res.status(400).json({
        success: false,
        error: { message: 'O feedback precisa estar encerrado para gerar link de aceite', code: 'NOT_CLOSED' }
      })
    }

    // Verificar se já foi aceito
    if (feedback.accepted) {
      return res.status(400).json({
        success: false,
        error: { message: 'Este feedback já foi aceito', code: 'ALREADY_ACCEPTED' }
      })
    }

    // Parâmetros configuráveis do body
    const maxAccess = req.body.maxAccess || DEFAULT_MAX_ACCESS
    const expiresInHours = req.body.expiresInHours || DEFAULT_EXPIRY_HOURS

    // Desativar tokens anteriores para este feedback
    await supabaseAdmin
      .from('temp_session')
      .update({ is_active: false })
      .eq('entity_id', fbId)
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
        entity_id: fbId,
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
    const acceptUrl = `${frontendUrl}/feedback-accept/${token}`

    return res.json({
      success: true,
      data: {
        token,
        url: acceptUrl,
        expiresAt: expiresAt.toISOString(),
        expiresInHours: expiresInHours,
        maxAccess: maxAccess,
        feedback: {
          id: feedback.id,
          feedbackUserName: feedback.feedback_user_name
        }
      }
    })
  } catch (err) {
    return next(err)
  }
})

/**
 * @swagger
 * /api/feedback-accept/{feedbackId}/link:
 *   get:
 *     summary: Obtém o link de aceite ativo para um feedback (requer autenticação)
 *     tags: [Feedback Accept]
 *     security:
 *       - sessionAuth: []
 *     parameters:
 *       - in: path
 *         name: feedbackId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Retorna informações do link ativo ou null se não houver
 */
router.get('/:feedbackId/link', sessionAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { feedbackId } = req.params

    if (!feedbackId) {
      return res.status(400).json({
        success: false,
        error: { message: 'ID do feedback é obrigatório', code: 'INVALID_REQUEST' }
      })
    }

    const fbId = parseInt(feedbackId)
    if (isNaN(fbId)) {
      return res.status(400).json({
        success: false,
        error: { message: 'ID do feedback inválido', code: 'INVALID_REQUEST' }
      })
    }

    // Buscar feedback para status de aceite
    const { data: feedback, error: feedbackError } = await supabaseAdmin
      .from('feedbacks')
      .select('id, accepted, accepted_at, is_closed')
      .eq('id', fbId)
      .single()

    if (feedbackError || !feedback) {
      return res.status(404).json({
        success: false,
        error: { message: 'Feedback não encontrado', code: 'NOT_FOUND' }
      })
    }

    // Buscar último token ativo válido
    const { data: session, error: sessionError } = await supabaseAdmin
      .from('temp_session')
      .select('id, expires_at, used_at, created_at, is_active, max_access, access_count')
      .eq('entity_id', fbId)
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
        accepted: feedback.accepted || false,
        acceptedAt: feedback.accepted_at,
        isClosed: feedback.is_closed || false,
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
 * /api/feedback-accept/{feedbackId}/status:
 *   get:
 *     summary: Obtém status de aceite de um feedback (requer autenticação)
 *     tags: [Feedback Accept]
 *     security:
 *       - sessionAuth: []
 *     parameters:
 *       - in: path
 *         name: feedbackId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Status do aceite
 */
router.get('/:feedbackId/status', sessionAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { feedbackId } = req.params

    if (!feedbackId) {
      return res.status(400).json({
        success: false,
        error: { message: 'ID do feedback é obrigatório', code: 'INVALID_REQUEST' }
      })
    }

    const fbId = parseInt(feedbackId)
    if (isNaN(fbId)) {
      return res.status(400).json({
        success: false,
        error: { message: 'ID do feedback inválido', code: 'INVALID_REQUEST' }
      })
    }

    // Buscar feedback
    const { data: feedback, error: feedbackError } = await supabaseAdmin
      .from('feedbacks')
      .select('id, accepted, accepted_at, is_closed, closed_at')
      .eq('id', fbId)
      .single()

    if (feedbackError || !feedback) {
      return res.status(404).json({
        success: false,
        error: { message: 'Feedback não encontrado', code: 'NOT_FOUND' }
      })
    }

    return res.json({
      success: true,
      data: {
        isClosed: feedback.is_closed || false,
        closedAt: feedback.closed_at,
        accepted: feedback.accepted || false,
        acceptedAt: feedback.accepted_at
      }
    })
  } catch (err) {
    return next(err)
  }
})

export default router
