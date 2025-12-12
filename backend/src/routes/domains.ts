import { Router, Request, Response, NextFunction } from 'express'
import { supabaseAdmin } from '../lib/supabaseAdmin'
import { sessionAuth } from '../middleware/sessionAuth'

const router = Router()

// Aplicar middleware de autenticação por sessão em todas as rotas
router.use(sessionAuth)

// Helper para obter o cliente Supabase do request
const getSupabaseClient = (req: Request) => {
  return req.supabaseUser || supabaseAdmin
}

/**
 * @swagger
 * /api/domains:
 *   get:
 *     summary: Lista todos os domínios
 *     tags: [Domains]
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [active, inactive, all]
 *         description: Filtrar por status do domínio
 *     responses:
 *       200:
 *         description: Lista de domínios com informações do parent
 */
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status } = req.query
    const supabase = getSupabaseClient(req)

    let query = supabase
      .from('domains')
      .select('*')
      .order('type')
      .order('value')

    // Filtro por status
    if (status === 'active') {
      query = query.eq('is_active', true)
    } else if (status === 'inactive') {
      query = query.eq('is_active', false)
    }

    const { data, error } = await query

    if (error) {
      console.error('Erro ao buscar domínios:', error)
      return res.status(500).json({
        success: false,
        error: { message: error.message, code: 'SUPABASE_ERROR' }
      })
    }

    // Criar um mapa de domínios por ID para facilitar a busca do parent
    const domainsMap = new Map((data || []).map(d => [d.id, d]))

    // Adicionar informações do parent a cada domínio
    const domainsWithParent = (data || []).map(domain => ({
      ...domain,
      parent: domain.parent_id ? domainsMap.get(domain.parent_id) : null
    }))

    return res.json({
      success: true,
      data: domainsWithParent
    })
  } catch (err) {
    return next(err)
  }
})

/**
 * @swagger
 * /api/domains/parents:
 *   get:
 *     summary: Lista domínios ativos para seleção de parent (dropdowns)
 *     tags: [Domains]
 *     responses:
 *       200:
 *         description: Lista de domínios ativos para dropdown
 */
router.get('/parents', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const supabase = getSupabaseClient(req)

    const { data, error } = await supabase
      .from('domains')
      .select('id, type, value')
      .eq('is_active', true)
      .order('type')
      .order('value')

    if (error) {
      console.error('Erro ao buscar domínios pais:', error)
      return res.status(500).json({
        success: false,
        error: { message: error.message, code: 'SUPABASE_ERROR' }
      })
    }

    // Formatar como options para o Select do frontend
    const options = (data || []).map(d => ({
      value: d.id,
      label: `${d.type} - ${d.value}`
    }))

    return res.json({
      success: true,
      data: options
    })
  } catch (err) {
    return next(err)
  }
})

/**
 * @swagger
 * /api/domains/check-duplicate:
 *   post:
 *     summary: Verifica se já existe domínio com mesmo type e tag
 *     tags: [Domains]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               type:
 *                 type: string
 *               tag:
 *                 type: string
 *               excludeId:
 *                 type: number
 *                 description: ID do domínio a excluir da verificação (para edição)
 *     responses:
 *       200:
 *         description: Resultado da verificação de duplicidade
 */
router.post('/check-duplicate', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { type, tag, excludeId } = req.body
    const supabase = getSupabaseClient(req)

    if (!type || !tag) {
      return res.status(400).json({
        success: false,
        error: { message: 'Type e tag são obrigatórios', code: 'VALIDATION_ERROR' }
      })
    }

    let query = supabase
      .from('domains')
      .select('id, type, tag')
      .eq('type', type.trim())
      .eq('tag', tag.trim())

    // Se tem excludeId, exclui da busca (para edição)
    if (excludeId && excludeId > 0) {
      query = query.neq('id', excludeId)
    }

    const { data, error } = await query.maybeSingle()

    if (error) {
      console.error('Erro ao verificar duplicidade:', error)
      return res.status(500).json({
        success: false,
        error: { message: error.message, code: 'SUPABASE_ERROR' }
      })
    }

    return res.json({
      success: true,
      data: {
        exists: !!data,
        existingDomain: data
      }
    })
  } catch (err) {
    return next(err)
  }
})

/**
 * @swagger
 * /api/domains:
 *   post:
 *     summary: Cria um novo domínio
 *     tags: [Domains]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - type
 *               - value
 *               - tag
 *             properties:
 *               type:
 *                 type: string
 *               value:
 *                 type: string
 *               tag:
 *                 type: string
 *               description:
 *                 type: string
 *               is_active:
 *                 type: boolean
 *               parent_id:
 *                 type: number
 *     responses:
 *       201:
 *         description: Domínio criado com sucesso
 */
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { type, value, tag, description, is_active, parent_id } = req.body
    const supabase = getSupabaseClient(req)

    // Validações
    if (!type?.trim()) {
      return res.status(400).json({
        success: false,
        error: { message: 'O tipo do domínio é obrigatório', code: 'VALIDATION_ERROR' }
      })
    }

    if (!value?.trim()) {
      return res.status(400).json({
        success: false,
        error: { message: 'O valor do domínio é obrigatório', code: 'VALIDATION_ERROR' }
      })
    }

    if (!tag?.trim()) {
      return res.status(400).json({
        success: false,
        error: { message: 'A tag do domínio é obrigatória', code: 'VALIDATION_ERROR' }
      })
    }

    const domainPayload = {
      type: type.trim(),
      value: value.trim(),
      tag: tag.trim(),
      description: description?.trim() || null,
      is_active: is_active ?? true,
      parent_id: parent_id || null
    }

    const { data, error } = await supabase
      .from('domains')
      .insert(domainPayload)
      .select()
      .single()

    if (error) {
      console.error('Erro ao criar domínio:', error)
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
 * /api/domains/{id}:
 *   put:
 *     summary: Atualiza um domínio existente
 *     tags: [Domains]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: number
 *         description: ID do domínio
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               type:
 *                 type: string
 *               value:
 *                 type: string
 *               tag:
 *                 type: string
 *               description:
 *                 type: string
 *               is_active:
 *                 type: boolean
 *               parent_id:
 *                 type: number
 *     responses:
 *       200:
 *         description: Domínio atualizado com sucesso
 */
router.put('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params
    const { type, value, tag, description, is_active, parent_id } = req.body
    const supabase = getSupabaseClient(req)

    if (!id) {
      return res.status(400).json({
        success: false,
        error: { message: 'ID do domínio é obrigatório', code: 'VALIDATION_ERROR' }
      })
    }

    // Validações
    if (!type?.trim()) {
      return res.status(400).json({
        success: false,
        error: { message: 'O tipo do domínio é obrigatório', code: 'VALIDATION_ERROR' }
      })
    }

    if (!value?.trim()) {
      return res.status(400).json({
        success: false,
        error: { message: 'O valor do domínio é obrigatório', code: 'VALIDATION_ERROR' }
      })
    }

    if (!tag?.trim()) {
      return res.status(400).json({
        success: false,
        error: { message: 'A tag do domínio é obrigatória', code: 'VALIDATION_ERROR' }
      })
    }

    const domainPayload = {
      type: type.trim(),
      value: value.trim(),
      tag: tag.trim(),
      description: description?.trim() || null,
      is_active: is_active ?? true,
      parent_id: parent_id || null
    }

    const { data, error } = await supabase
      .from('domains')
      .update(domainPayload)
      .eq('id', parseInt(id))
      .select()
      .single()

    if (error) {
      console.error('Erro ao atualizar domínio:', error)
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
