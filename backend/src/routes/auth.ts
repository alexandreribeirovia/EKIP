import { Router } from 'express'
import { createClient } from '@supabase/supabase-js'
import { supabaseAuth } from '@/middleware/supabaseAuth'

const router = Router()

// Inicializar cliente Supabase
const supabaseUrl = process.env['SUPABASE_URL'] || ''
const supabaseServiceKey = process.env['SUPABASE_SERVICE_ROLE_KEY'] || ''
const supabase = createClient(supabaseUrl, supabaseServiceKey)

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Login do usuário via Supabase Auth
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Login realizado com sucesso
 *       401:
 *         description: Credenciais inválidas
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: { message: 'Email e senha são obrigatórios' },
      })
    }

    // Autenticar via Supabase
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      console.error('Login error:', error)
      return res.status(401).json({
        success: false,
        error: {
          message: error.message === 'Invalid login credentials'
            ? 'Email ou senha inválidos'
            : error.message
        },
      })
    }

    if (!data.session || !data.user) {
      return res.status(401).json({
        success: false,
        error: { message: 'Erro ao criar sessão' },
      })
    }

    // Retornar dados do usuário e sessão
    return res.json({
      success: true,
      data: {
        user: {
          id: (data.user as any).id,
          email: (data.user as any).email,
          name: (data.user as any).user_metadata?.['name'] || (data.user as any).email,
          role: (data.user as any).user_metadata?.['role'] || 'user',
          avatar: (data.user as any).user_metadata?.['avatar'],
          runrun_user_id: (data.user as any).user_metadata?.['runrun_user_id'],
        },
        session: {
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
          expires_at: data.session.expires_at,
          expires_in: data.session.expires_in,
        },
      },
    })
  } catch (error) {
    console.error('Login error:', error)
    return res.status(500).json({
      success: false,
      error: { message: 'Erro interno do servidor' },
    })
  }
})

/**
 * @swagger
 * /api/auth/me:
 *   get:
 *     summary: Obter dados do usuário logado via Supabase Auth
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Dados do usuário
 *       401:
 *         description: Não autorizado
 */
router.get('/me', supabaseAuth, async (req, res) => {
  try {
    // O middleware já validou e adicionou o usuário ao req
    const user = req.user as any

    if (!user) {
      return res.status(401).json({
        success: false,
        error: { message: 'Usuário não autenticado' },
      })
    }

    return res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email || '',
          name: user.user_metadata?.['name'] || user.email || 'Usuário',
          role: user.user_metadata?.['role'] || 'user',
          avatar: user.user_metadata?.['avatar'],
          runrun_user_id: user.user_metadata?.['runrun_user_id'],
        },
      },
    })
  } catch (error) {
    console.error('Get user error:', error)
    return res.status(500).json({
      success: false,
      error: { message: 'Erro ao buscar dados do usuário' },
    })
  }
})

/**
 * @swagger
 * /api/auth/refresh:
 *   post:
 *     summary: Atualizar token de acesso usando refresh token
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - refresh_token
 *             properties:
 *               refresh_token:
 *                 type: string
 *     responses:
 *       200:
 *         description: Token atualizado com sucesso
 *       401:
 *         description: Refresh token inválido
 */
router.post('/refresh', async (req, res) => {
  try {
    const { refresh_token } = req.body

    if (!refresh_token) {
      return res.status(400).json({
        success: false,
        error: { message: 'Refresh token é obrigatório' },
      })
    }

    const { data, error } = await supabase.auth.refreshSession({
      refresh_token,
    })

    if (error) {
      console.error('Refresh token error:', error)
      return res.status(401).json({
        success: false,
        error: { message: 'Refresh token inválido ou expirado' },
      })
    }

    if (!data.session) {
      return res.status(401).json({
        success: false,
        error: { message: 'Erro ao atualizar sessão' },
      })
    }

    return res.json({
      success: true,
      data: {
        session: {
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
          expires_at: data.session.expires_at,
          expires_in: data.session.expires_in,
        },
      },
    })
  } catch (error) {
    console.error('Refresh token error:', error)
    return res.status(500).json({
      success: false,
      error: { message: 'Erro ao atualizar token' },
    })
  }
})

/**
 * @swagger
 * /api/auth/logout:
 *   post:
 *     summary: Fazer logout e invalidar sessão
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Logout realizado com sucesso
 */
router.post('/logout', supabaseAuth, async (req, res) => {
  try {
    // Extrair token do header
    const authHeader = req.headers.authorization
    const token = authHeader?.replace('Bearer ', '')

    if (token) {
      // Invalidar o token no Supabase
      await supabase.auth.admin.signOut(token)
    }

    return res.json({
      success: true,
      data: { message: 'Logout realizado com sucesso' },
    })
  } catch (error) {
    console.error('Logout error:', error)
    // Mesmo com erro, retorna sucesso pois o frontend vai limpar o estado
    return res.json({
      success: true,
      data: { message: 'Logout realizado' },
    })
  }
})

/**
 * @swagger
 * /api/auth/users:
 *   get:
 *     summary: Listar todos os usuários (requer admin)
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de usuários
 *       401:
 *         description: Não autorizado
 *       403:
 *         description: Acesso negado (requer admin)
 */
router.get('/users', supabaseAuth, async (req, res) => {
  try {
    // Verificar se o usuário é admin
    const user = req.user as any
    const userRole = user?.user_metadata?.['role']
    if (userRole !== 'admin') {
      return res.status(403).json({
        success: false,
        error: { message: 'Acesso negado. Apenas administradores podem listar usuários.' },
      })
    }

    // Listar todos os usuários
    const { data, error } = await supabase.auth.admin.listUsers()

    if (error) {
      console.error('Error listing users:', error)
      return res.status(500).json({
        success: false,
        error: { message: 'Erro ao buscar usuários' },
      })
    }

    const users = data.users.map((user) => ({
      id: user.id,
      email: user.email || '',
      name: user.user_metadata?.['name'] || user.email || 'Sem nome',
      role: user.user_metadata?.['role'] || 'user',
      status: user.user_metadata?.['status'] || 'active',
      avatar: user.user_metadata?.['avatar'],
      runrun_user_id: user.user_metadata?.['runrun_user_id'],
      created_at: user.created_at,
    }))

    return res.json({
      success: true,
      data: { users },
    })
  } catch (error) {
    console.error('Error listing users:', error)
    return res.status(500).json({
      success: false,
      error: { message: 'Erro interno do servidor' },
    })
  }
})

/**
 * @swagger
        * / api / auth / users:
 * post:
 * summary: Criar novo usuário(requer admin)
      * tags: [Auth]
      * security:
 * - bearerAuth: []
      * requestBody:
 * required: true
      * content:
 * application / json:
 * schema:
 * type: object
      * required:
 * - email
        * - name
        * properties:
 * email:
 * type: string
      * name:
 * type: string
      * role:
 * type: string
      * runrun_user_id:
 * type: string
      * responses:
 * 201:
 * description: Usuário criado com sucesso
      * 401:
 * description: Não autorizado
      * 403:
 * description: Acesso negado(requer admin)
      */
router.post('/users', supabaseAuth, async (req, res) => {
  try {
    // Verificar se o usuário é admin
    const user = req.user as any
    const userRole = user?.user_metadata?.['role']
    if (userRole !== 'admin') {
      return res.status(403).json({
        success: false,
        error: { message: 'Acesso negado. Apenas administradores podem criar usuários.' },
      })
    }

    const { email, name, role = 'user' } = req.body

    if (!email || !name) {
      return res.status(400).json({
        success: false,
        error: { message: 'Email e nome são obrigatórios' },
      })
    }

    // Buscar dados adicionais do usuário na tabela 'users' do schema 'public'
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('avatar_large_url, user_id')
      .eq('email', email)
      .single()

    if (userError && userError.code !== 'PGRST116') { // Ignora erro 'user not found'
      console.error('Error fetching user data from public.users:', userError)
      // Decide se quer bloquear a criação ou continuar sem os dados
    }

    // Convidar usuário por e-mail
    const { data, error } = await supabase.auth.admin.inviteUserByEmail(
      email,
      {
        data: {
          name,
          role,
          status: 'active',
          avatar: userData?.avatar_large_url || null,
          runrun_user_id: userData?.user_id || null,
        }
      }
    )

    if (error) {
      console.error('Error inviting user:', error)
      return res.status(400).json({
        success: false,
        error: { message: error.message },
      })
    }

    return res.status(201).json({
      success: true,
      data: {
        user: {
          id: data.user.id,
          email: data.user.email,
          name: data.user.user_metadata?.['name'],
          role: data.user.user_metadata?.['role'],
          status: data.user.user_metadata?.['status'],
          runrun_user_id: data.user.user_metadata?.['runrun_user_id'],
        },
      },
    })
  } catch (error) {
    console.error('Error creating user:', error)
    return res.status(500).json({
      success: false,
      error: { message: 'Erro interno do servidor' },
    })
  }
})

/**
 * @swagger
 * /api/auth/users/{id}:
 *   patch:
 *     summary: Atualizar usuário (requer admin)
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               role:
 *                 type: string
 *               status:
 *                 type: string
 *               password:
 *                 type: string
 *               runrun_user_id:
 *                 type: string
 *     responses:
 *       200:
 *         description: Usuário atualizado com sucesso
 *       401:
 *         description: Não autorizado
 *       403:
 *         description: Acesso negado (requer admin)
 */
router.patch('/users/:id', supabaseAuth, async (req, res) => {
  try {
    // Verificar se o usuário é admin
    const user = req.user as any
    const userRole = user?.user_metadata?.['role']
    if (userRole !== 'admin') {
      return res.status(403).json({
        success: false,
        error: { message: 'Acesso negado. Apenas administradores podem atualizar usuários.' },
      })
    }

    const { id } = req.params
    if (!id) {
      return res.status(400).json({
        success: false,
        error: { message: 'ID do usuário é obrigatório' },
      })
    }

    const { name, role, status, password } = req.body

    const updateData: {
      user_metadata?: Record<string, any> // Alterado para 'any' para aceitar null
      password?: string
      email?: string
    } = {}

    // Obter dados atuais do usuário para pegar o email
    const { data: currentUserData, error: getUserError } = await supabase.auth.admin.getUserById(id)
    if (getUserError) {
      return res.status(404).json({ success: false, error: { message: 'Usuário não encontrado' } })
    }
    const currentUser = currentUserData.user
    const currentEmail = currentUser.email

    // Se houver um email, buscar dados do RunRun
    if (currentEmail) {
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('avatar_large_url, user_id')
        .eq('email', currentEmail)
        .single()

      if (userError && userError.code !== 'PGRST116') {
        console.error('Error fetching user data from public.users:', userError)
      }

      // Adicionar dados do RunRun aos metadados a serem atualizados
      updateData.user_metadata = {
        ...currentUser?.user_metadata,
        avatar: userData?.avatar_large_url || currentUser?.user_metadata?.['avatar'],
        runrun_user_id: userData?.user_id || currentUser?.user_metadata?.['runrun_user_id'],
      }
    }


    // Atualizar metadados se fornecidos
    if (name || role || status) {
      updateData.user_metadata = {
        ...updateData.user_metadata, // Manter dados do RunRun
        ...(name && { name }),
        ...(role && { role }),
        ...(status && { status }),
      }
    }

    // Atualizar senha se fornecida
    if (password) {
      updateData.password = password
    }

    const { data, error } = await supabase.auth.admin.updateUserById(id, updateData)

    if (error) {
      console.error('Error updating user:', error)
      return res.status(400).json({
        success: false,
        error: { message: error.message },
      })
    }

    return res.json({
      success: true,
      data: {
        user: {
          id: data.user.id,
          email: data.user.email,
          name: data.user.user_metadata?.['name'],
          role: data.user.user_metadata?.['role'],
          status: data.user.user_metadata?.['status'],
          runrun_user_id: data.user.user_metadata?.['runrun_user_id'],
        },
      },
    })
  } catch (error) {
    console.error('Error updating user:', error)
    return res.status(500).json({
      success: false,
      error: { message: 'Erro interno do servidor' },
    })
  }
})

/**
 * @swagger
 * /api/auth/users/{id}/reset-password:
 *   post:
 *     summary: Enviar e-mail de redefinição de senha (requer admin)
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: E-mail de redefinição enviado
 *       401:
 *         description: Não autorizado
 *       403:
 *         description: Acesso negado (requer admin)
 */
router.post('/users/:id/reset-password', supabaseAuth, async (req, res) => {
  try {
    // Verificar se o usuário é admin
    const user = req.user as any
    const userRole = user?.user_metadata?.['role']
    if (userRole !== 'admin') {
      return res.status(403).json({
        success: false,
        error: { message: 'Acesso negado. Apenas administradores podem redefinir senhas.' },
      })
    }

    const { id } = req.params
    if (!id) {
      return res.status(400).json({
        success: false,
        error: { message: 'ID do usuário é obrigatório' },
      })
    }

    // Obter o email do usuário
    const { data: userData, error: userError } = await supabase.auth.admin.getUserById(id)
    if (userError || !userData.user.email) {
      console.error('Error getting user email:', userError)
      return res.status(404).json({
        success: false,
        error: { message: 'Usuário não encontrado ou sem e-mail.' },
      })
    }

    // Enviar e-mail de redefinição de senha
    const { error } = await supabase.auth.resetPasswordForEmail(userData.user.email, {
      redirectTo: `${process.env['SITE_URL']}/reset-password`,
    })

    if (error) {
      console.error('Error sending password reset email:', error)
      return res.status(500).json({
        success: false,
        error: { message: 'Erro ao enviar e-mail de redefinição de senha.' },
      })
    }

    return res.json({
      success: true,
      data: { message: 'E-mail de redefinição de senha enviado com sucesso.' },
    })
  } catch (error) {
    console.error('Error sending password reset email:', error)
    return res.status(500).json({
      success: false,
      error: { message: 'Erro interno do servidor.' },
    })
  }
})

export default router