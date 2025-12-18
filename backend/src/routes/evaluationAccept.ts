/**
 * Rotas de Aceite de Avaliação
 * 
 * Este módulo gerencia o fluxo de aceite de avaliação pelo funcionário:
 * - Geração de token temporário (24h) para aceite
 * - Validação de token (rota pública)
 * - Confirmação de aceite (rota pública)
 * - Consulta de link ativo
 * 
 * Segurança:
 * - Token armazenado como hash SHA-256 no banco
 * - Token expira em 24h ou após primeiro uso
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

const TOKEN_EXPIRY_HOURS = 24
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
      .from('evaluation_accept_session')
      .select(`
        id,
        evaluation_id,
        expires_at,
        used_at,
        is_active
      `)
      .eq('token_hash', tokenHash)
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

    // Buscar dados da avaliação
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
        accepted_at
      `)
      .eq('id', session.evaluation_id)
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

    return res.json({
      success: true,
      data: {
        evaluation: {
          id: evaluation.id,
          name: evaluation.name,
          userName: evaluation.user_name,
          ownerName: evaluation.owner_name,
          periodStart: evaluation.period_start,
          periodEnd: evaluation.period_end
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
      .from('evaluation_accept_session')
      .select('id, evaluation_id, expires_at, used_at, is_active')
      .eq('token_hash', tokenHash)
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

    // Verificar se avaliação já foi aceita
    const { data: evaluation, error: evalCheckError } = await supabaseAdmin
      .from('evaluations')
      .select('id, accepted')
      .eq('id', session.evaluation_id)
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
      .eq('id', session.evaluation_id)

    if (updateEvalError) {
      console.error('Erro ao aceitar avaliação:', updateEvalError)
      return res.status(500).json({
        success: false,
        error: { message: 'Erro ao aceitar avaliação', code: 'SUPABASE_ERROR' }
      })
    }

    // Marcar sessão como utilizada
    const { error: updateSessionError } = await supabaseAdmin
      .from('evaluation_accept_session')
      .update({ used_at: now })
      .eq('id', session.id)

    if (updateSessionError) {
      console.error('Erro ao marcar token como usado:', updateSessionError)
      // Não retorna erro pois a avaliação já foi aceita
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

    // Desativar tokens anteriores para esta avaliação
    await supabaseAdmin
      .from('evaluation_accept_session')
      .update({ is_active: false })
      .eq('evaluation_id', evalId)
      .eq('is_active', true)

    // Gerar novo token
    const token = generateSecureToken(TOKEN_BYTES)
    const tokenHash = hashSHA256(token)
    
    const expiresAt = new Date()
    expiresAt.setHours(expiresAt.getHours() + TOKEN_EXPIRY_HOURS)

    // Inserir nova sessão de aceite
    const { error: insertError } = await supabaseAdmin
      .from('evaluation_accept_session')
      .insert({
        evaluation_id: evalId,
        token_hash: tokenHash,
        expires_at: expiresAt.toISOString(),
        created_by: userId,
        is_active: true
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
        expiresInHours: TOKEN_EXPIRY_HOURS,
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
      .from('evaluation_accept_session')
      .select('id, expires_at, used_at, created_at, is_active')
      .eq('evaluation_id', evalId)
      .eq('is_active', true)
      .is('used_at', null)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    // Se não encontrou sessão válida
    const hasValidLink = !sessionError && session !== null

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
