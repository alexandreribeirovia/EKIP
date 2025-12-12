import { Router, Request, Response, NextFunction } from 'express'
import { supabaseAdmin } from '../lib/supabaseAdmin'
import { sessionAuth } from '../middleware/sessionAuth'

const router = Router()

// Aplicar middleware de autenticação por sessão em todas as rotas
// O middleware injeta req.supabaseUser com o cliente autenticado (RLS ativo)
router.use(sessionAuth)

// Helper para obter o cliente Supabase do request
// Usa o cliente do usuário (com RLS) se disponível, senão usa admin (fallback)
const getSupabaseClient = (req: Request) => {
  return req.supabaseUser || supabaseAdmin
}

/**
 * @swagger
 * /api/employees:
 *   get:
 *     summary: Lista todos os funcionários
 *     tags: [Employees]
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [active, inactive, all]
 *         description: Filtrar por status do funcionário
 *     responses:
 *       200:
 *         description: Lista de funcionários
 */
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status } = req.query

    const supabase = getSupabaseClient(req)
    let query = supabase
      .from('users')
      .select(`
        *,
        users_skill (
          id,
          skills (
            id,
            area,
            category,
            skill
          )
        )
      `)
      .order('name', { ascending: true })

    // Filtro por status
    if (status === 'active') {
      query = query.eq('is_active', true)
    } else if (status === 'inactive') {
      query = query.eq('is_active', false)
    }

    const { data, error } = await query

    if (error) {
      console.error('Erro ao buscar funcionários:', error)
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
 * /api/employees/{id}:
 *   get:
 *     summary: Busca um funcionário específico
 *     tags: [Employees]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID do usuário (user_id)
 *     responses:
 *       200:
 *         description: Dados do funcionário
 *       404:
 *         description: Funcionário não encontrado
 */
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params

    const supabase = getSupabaseClient(req)
    const { data, error } = await supabase
      .from('users')
      .select(`
        *,
        users_skill (
          id,
          skills (
            id,
            area,
            category,
            skill
          )
        )
      `)
      .eq('user_id', id)
      .single()

    if (error) {
      console.error('Erro ao buscar funcionário:', error)
      return res.status(404).json({
        success: false,
        error: { message: 'Funcionário não encontrado', code: 'NOT_FOUND' }
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
 * /api/employees/{id}:
 *   patch:
 *     summary: Atualiza dados de um funcionário
 *     tags: [Employees]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID do usuário (user_id)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Funcionário atualizado
 *       404:
 *         description: Funcionário não encontrado
 */
router.patch('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params
    const updateData = req.body

    // Remove campos que não devem ser atualizados diretamente
    delete updateData.id
    delete updateData.user_id
    delete updateData.created_at
    delete updateData.users_skill

    const supabase = getSupabaseClient(req)
    const { data, error } = await supabase
      .from('users')
      .update(updateData)
      .eq('user_id', id)
      .select()
      .single()

    if (error) {
      console.error('Erro ao atualizar funcionário:', error)
      return res.status(404).json({
        success: false,
        error: { message: 'Erro ao atualizar funcionário', code: 'UPDATE_ERROR' }
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
 * /api/employees/{id}/skills:
 *   get:
 *     summary: Busca as habilidades de um funcionário
 *     tags: [Employees]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID do usuário (user_id)
 *     responses:
 *       200:
 *         description: Lista de habilidades do funcionário
 */
router.get('/:id/skills', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params

    const supabase = getSupabaseClient(req)
    const { data, error } = await supabase
      .from('users_skill')
      .select(`
        id,
        skill_id,
        skills (
          id,
          area,
          category,
          skill
        )
      `)
      .eq('user_id', id)

    if (error) {
      console.error('Erro ao buscar habilidades:', error)
      return res.status(500).json({
        success: false,
        error: { message: error.message, code: 'SUPABASE_ERROR' }
      })
    }

    // Mapear para o formato esperado pelo frontend (skill ao invés de skills)
    const formattedData = (data || []).map((item: any) => ({
      id: item.id,
      skill_id: item.skill_id,
      skill: item.skills // Renomeia 'skills' para 'skill'
    }))

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
 * /api/employees/{id}/skills:
 *   post:
 *     summary: Adiciona uma habilidade ao funcionário
 *     tags: [Employees]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID do usuário (user_id)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               skill_id:
 *                 type: number
 *     responses:
 *       201:
 *         description: Habilidade adicionada
 */
router.post('/:id/skills', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params
    const { skill_id } = req.body

    if (!skill_id) {
      return res.status(400).json({
        success: false,
        error: { message: 'skill_id é obrigatório', code: 'VALIDATION_ERROR' }
      })
    }

    const supabase = getSupabaseClient(req)
    const { data, error } = await supabase
      .from('users_skill')
      .insert({ user_id: id, skill_id })
      .select(`
        id,
        skills (
          id,
          area,
          category,
          skill
        )
      `)
      .single()

    if (error) {
      console.error('Erro ao adicionar habilidade:', error)
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
 * /api/employees/{id}/skills/{skillId}:
 *   delete:
 *     summary: Remove uma habilidade do funcionário
 *     tags: [Employees]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID do usuário (user_id)
 *       - in: path
 *         name: skillId
 *         required: true
 *         schema:
 *           type: number
 *         description: ID do registro users_skill
 *     responses:
 *       200:
 *         description: Habilidade removida
 */
router.delete('/:id/skills/:skillId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id, skillId } = req.params

    const supabase = getSupabaseClient(req)
    const { error } = await supabase
      .from('users_skill')
      .delete()
      .eq('user_id', id)
      .eq('id', skillId)

    if (error) {
      console.error('Erro ao remover habilidade:', error)
      return res.status(500).json({
        success: false,
        error: { message: error.message, code: 'SUPABASE_ERROR' }
      })
    }

    return res.json({
      success: true,
      message: 'Habilidade removida com sucesso'
    })
  } catch (err) {
    return next(err)
  }
})

export default router