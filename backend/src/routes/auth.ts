import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { sessionAuth } from '@/middleware/sessionAuth'
import { 
  createSession,
  getSessionById,
  getSessionByRefreshToken,
  updateSessionTokens,
  invalidateSession,
  invalidateAllUserSessions,
  getUserSessions
} from '@/lib/sessionStore'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { 
  getLoginAttempts, 
  incrementLoginAttempts, 
  resetLoginAttempts,
  LOGIN_ATTEMPT_CONFIG 
} from '@/lib/loginAttemptStore'
import { validatePasswordStrength } from '@/lib/passwordValidation'

const router = Router()

// Rate limiter específico para login (5 tentativas por IP a cada 15 minutos)
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  limit: LOGIN_ATTEMPT_CONFIG.MAX_ATTEMPTS, // 5 tentativas
  message: {
    success: false,
    error: {
      message: 'Muitas tentativas de login. Aguarde 15 minutos antes de tentar novamente.',
      code: 'RATE_LIMIT_EXCEEDED',
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Usa IP real considerando proxies
    return req.ip || req.headers['x-forwarded-for']?.toString().split(',')[0] || 'unknown'
  },
})

// Usar cliente Supabase Admin centralizado (bypassa RLS)
const supabase = supabaseAdmin

// Configuração de cookies
const isProduction = process.env['NODE_ENV'] === 'production'
const REFRESH_TOKEN_COOKIE_NAME = 'ekip_refresh_token'
const SESSION_ID_COOKIE_NAME = 'ekip_session_id'
const REFRESH_TOKEN_MAX_AGE = 7 * 24 * 60 * 60 * 1000 // 7 dias em ms
const SESSION_MAX_AGE = 7 * 24 * 60 * 60 * 1000 // 7 dias em ms

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Login do usuário - retorna sessionId (tokens ficam criptografados no servidor)
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
 *         description: Login realizado com sucesso. Retorna sessionId no body e em httpOnly cookie.
 *       401:
 *         description: Credenciais inválidas
 */
router.post('/login', loginLimiter, async (req, res) => {
  try {
    const { email, password, captchaToken } = req.body
    const clientIp = req.ip || req.headers['x-forwarded-for']?.toString().split(',')[0] || 'unknown'

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: { message: 'Email e senha são obrigatórios' },
      })
    }

    // Verificar tentativas de login para este IP
    const loginAttempts = await getLoginAttempts(clientIp)

    // Se bloqueado (>= 5 tentativas), retornar erro
    if (loginAttempts.isBlocked) {
      return res.status(429).json({
        success: false,
        error: { 
          message: 'Muitas tentativas de login. Aguarde 15 minutos antes de tentar novamente.',
          code: 'RATE_LIMIT_EXCEEDED',
        },
      })
    }

    // Se precisa CAPTCHA (>= 3 tentativas) e não foi fornecido
    if (loginAttempts.requiresCaptcha && !captchaToken) {
      return res.status(400).json({
        success: false,
        error: { 
          message: 'Verificação de segurança necessária',
          code: 'CAPTCHA_REQUIRED',
        },
        requiresCaptcha: true,
        failedAttempts: loginAttempts.attemptCount,
      })
    }

    // Autenticar via Supabase (passando captchaToken se fornecido)
    const signInOptions = captchaToken 
      ? { email, password, options: { captchaToken } }
      : { email, password }
    
    const { data, error } = await supabase.auth.signInWithPassword(signInOptions)

    if (error) {
      console.error('Login error:', error)
      
      // Incrementar contador de tentativas falhas
      const updatedAttempts = await incrementLoginAttempts(clientIp, email)
      
      return res.status(401).json({
        success: false,
        error: {
          // Sempre retornar mensagem genérica para evitar enumeração de usuários
          message: 'Email ou senha inválidos',
          code: 'INVALID_CREDENTIALS',
        },
        requiresCaptcha: updatedAttempts.requiresCaptcha,
        failedAttempts: updatedAttempts.attemptCount,
      })
    }

    if (!data.session || !data.user) {
      return res.status(401).json({
        success: false,
        error: { message: 'Erro ao criar sessão' },
      })
    }

    // Login bem-sucedido - resetar contador de tentativas
    await resetLoginAttempts(clientIp)

    const userId = data.user.id
    const userEmail = data.user.email || ''
    
    // Buscar dados do usuário da plataforma na nova tabela users (por UUID)
    let { data: platformUser, error: platformUserError } = await supabase
      .from('users')
      .select('id, name, email, avatar_url, role, profile_id, employee_id')
      .eq('id', userId)
      .single()
    
    // Se não encontrar na tabela users, criar registro
    if (platformUserError && platformUserError.code === 'PGRST116') {
      console.log('Usuário não encontrado em public.users, criando registro...')
      
      // Buscar dados do funcionário (se existir) para vincular
      const { data: employeeData } = await supabase
        .from('employees')
        .select('user_id, name, avatar_large_url')
        .eq('email', userEmail)
        .single()
      
      // Criar registro na tabela users (usuários da plataforma)
      const { data: newUser, error: createError } = await supabase
        .from('users')
        .insert({
          id: userId,
          email: userEmail,
          name: employeeData?.name || data.user.user_metadata?.['name'] || userEmail.split('@')[0],
          avatar_url: employeeData?.avatar_large_url || data.user.user_metadata?.['avatar'],
          role: data.user.user_metadata?.['role'] || 'user',
          employee_id: employeeData?.user_id || null,
          is_active: true,
        })
        .select()
        .single()
      
      if (createError) {
        console.error('Erro ao criar registro em public.users:', createError)
      } else {
        platformUser = newUser
      }
    }

    // Buscar dados complementares do funcionário se houver vínculo
    let employeeAvatar: string | null = null
    if (platformUser?.employee_id) {
      const { data: empData } = await supabase
        .from('employees')
        .select('avatar_large_url')
        .eq('user_id', platformUser.employee_id)
        .single()
      employeeAvatar = empData?.avatar_large_url || null
    }

    // Montar dados do usuário
    const userName = platformUser?.name || data.user.user_metadata?.['name'] || userEmail
    const userRole = platformUser?.role || data.user.user_metadata?.['role'] || 'user'
    const userAvatar = platformUser?.avatar_url || employeeAvatar || data.user.user_metadata?.['avatar']
    const employeeId = platformUser?.employee_id || null

    // Criar sessão segura no banco (tokens criptografados)
    const sessionResult = await createSession({
      userId,
      email: userEmail,
      supabaseAccessToken: data.session.access_token,
      supabaseRefreshToken: data.session.refresh_token,
      expiresAt: data.session.expires_at || Math.floor(Date.now() / 1000) + 3600,
      userAgent: req.headers['user-agent'] || '',
      ipAddress: clientIp,
    })

    if (!sessionResult) {
      console.error('Erro ao criar sessão')
      return res.status(500).json({
        success: false,
        error: { message: 'Erro ao criar sessão segura' },
      })
    }

    const { sessionId, backendRefreshToken } = sessionResult

    // Enviar sessionId e backendRefreshToken como httpOnly cookies
    res.cookie(SESSION_ID_COOKIE_NAME, sessionId, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'strict',
      maxAge: SESSION_MAX_AGE,
      path: '/',
    })

    res.cookie(REFRESH_TOKEN_COOKIE_NAME, backendRefreshToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'strict',
      maxAge: REFRESH_TOKEN_MAX_AGE,
      path: '/',
    })

    // Retornar sessionId e dados do usuário (SEM tokens Supabase)
    return res.json({
      success: true,
      data: {
        user: {
          id: userId,
          email: userEmail,
          name: userName,
          role: userRole,
          avatar: userAvatar,
          employee_id: employeeId,
          runrun_user_id: employeeId, // Compatibilidade com frontend
        },
        sessionId, // Frontend usa isso para as próximas requisições
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
 * /api/auth/login-attempts:
 *   get:
 *     summary: Verificar tentativas de login para o IP atual
 *     tags: [Auth]
 *     responses:
 *       200:
 *         description: Informações sobre tentativas de login
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
 *                     failedAttempts:
 *                       type: number
 *                     requiresCaptcha:
 *                       type: boolean
 *                     isBlocked:
 *                       type: boolean
 */
router.get('/login-attempts', async (req, res) => {
  try {
    const clientIp = req.ip || req.headers['x-forwarded-for']?.toString().split(',')[0] || 'unknown'
    const loginAttempts = await getLoginAttempts(clientIp)

    return res.json({
      success: true,
      data: {
        failedAttempts: loginAttempts.attemptCount,
        requiresCaptcha: loginAttempts.requiresCaptcha,
        isBlocked: loginAttempts.isBlocked,
      },
    })
  } catch (error) {
    console.error('Erro ao verificar tentativas de login:', error)
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
 *     summary: Obter dados do usuário logado via sessionId
 *     tags: [Auth]
 *     security:
 *       - sessionAuth: []
 *     responses:
 *       200:
 *         description: Dados do usuário
 *       401:
 *         description: Não autorizado
 */
router.get('/me', sessionAuth, async (req, res) => {
  try {
    // O middleware sessionAuth já validou a sessão
    const session = req.session

    if (!session) {
      return res.status(401).json({
        success: false,
        error: { message: 'Usuário não autenticado' },
      })
    }

    // Buscar dados completos do usuário no Supabase
    const { data: userData, error: userError } = await supabase.auth.admin.getUserById(session.userId)

    if (userError || !userData.user) {
      return res.status(404).json({
        success: false,
        error: { message: 'Usuário não encontrado' },
      })
    }

    const user = userData.user

    // Buscar dados do usuário da plataforma (nova tabela users)
    const { data: platformUser } = await supabase
      .from('users')
      .select('name, avatar_url, role, profile_id, employee_id')
      .eq('id', session.userId)
      .maybeSingle()

    // Buscar dados do funcionário se houver vínculo
    let avatar_large_url: string | undefined
    if (platformUser?.employee_id) {
      const { data: empData } = await supabase
        .from('employees')
        .select('avatar_large_url')
        .eq('user_id', platformUser.employee_id)
        .single()
      avatar_large_url = empData?.avatar_large_url || undefined
    }

    return res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          name: platformUser?.name || user.user_metadata?.['name'] || user.email,
          role: platformUser?.role || user.user_metadata?.['role'] || 'user',
          avatar: platformUser?.avatar_url || avatar_large_url || user.user_metadata?.['avatar'],
          employee_id: platformUser?.employee_id || null,
          runrun_user_id: platformUser?.employee_id || null, // Compatibilidade com frontend
          profile_id: platformUser?.profile_id || null,
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
 *     summary: Atualizar sessão usando refresh token do cookie httpOnly
 *     tags: [Auth]
 *     responses:
 *       200:
 *         description: Sessão atualizada com sucesso
 *       401:
 *         description: Refresh token inválido ou expirado
 */
router.post('/refresh', async (req, res) => {
  try {
    // Ler refresh token do cookie httpOnly
    const backendRefreshToken = req.cookies?.[REFRESH_TOKEN_COOKIE_NAME]

    if (!backendRefreshToken) {
      return res.status(401).json({
        success: false,
        error: { message: 'Refresh token não encontrado', code: 'NO_REFRESH_TOKEN' },
      })
    }

    // Buscar sessão pelo backendRefreshToken
    const session = await getSessionByRefreshToken(backendRefreshToken)
    
    if (!session) {
      // Limpar cookies inválidos
      res.clearCookie(REFRESH_TOKEN_COOKIE_NAME, { path: '/' })
      res.clearCookie(SESSION_ID_COOKIE_NAME, { path: '/' })
      return res.status(401).json({
        success: false,
        error: { message: 'Refresh token inválido ou expirado', code: 'INVALID_REFRESH_TOKEN' },
      })
    }

    // Verificar se precisa renovar tokens do Supabase
    const now = Math.floor(Date.now() / 1000)
    const tokenExpiresIn = session.expiresAt - now
    
    const newSessionId = session.id

    // Se token do Supabase está próximo de expirar (menos de 5 minutos), renovar
    if (tokenExpiresIn < 300) {
      // Usar supabaseAdmin para renovar tokens (bypassa RLS)
      const { data: refreshData, error: refreshError } = await supabaseAdmin.auth.refreshSession({
        refresh_token: session.supabaseRefreshToken,
      })

      if (refreshError || !refreshData.session) {
        console.error('Erro ao renovar tokens Supabase:', refreshError)
        // Invalidar sessão antiga
        await invalidateSession(session.id)
        res.clearCookie(REFRESH_TOKEN_COOKIE_NAME, { path: '/' })
        res.clearCookie(SESSION_ID_COOKIE_NAME, { path: '/' })
        return res.status(401).json({
          success: false,
          error: { message: 'Sessão expirada. Faça login novamente.', code: 'SESSION_EXPIRED' },
        })
      }

      // Atualizar tokens na sessão
      const updateSuccess = await updateSessionTokens(
        session.id,
        refreshData.session.access_token,
        refreshData.session.refresh_token,
        refreshData.session.expires_at || Math.floor(Date.now() / 1000) + 3600
      )

      if (!updateSuccess) {
        return res.status(500).json({
          success: false,
          error: { message: 'Erro ao atualizar sessão' },
        })
      }
    }

    // Buscar dados atualizados do usuário
    const { data: userData } = await supabase.auth.admin.getUserById(session.userId)

    // Buscar dados da tabela public.users para obter employee_id
    const { data: platformUser } = await supabaseAdmin
      .from('users')
      .select('employee_id, name, role, avatar_url')
      .eq('id', session.userId)
      .single()

    return res.json({
      success: true,
      data: {
        sessionId: newSessionId,
        user: userData?.user ? {
          id: userData.user.id,
          email: userData.user.email,
          name: userData.user.user_metadata?.['name'] || userData.user.email,
          role: userData.user.user_metadata?.['role'] || 'user',
          avatar: userData.user.user_metadata?.['avatar'],
          runrun_user_id: platformUser?.employee_id || userData.user.user_metadata?.['runrun_user_id'],
          employee_id: platformUser?.employee_id || null,
        } : null,
      },
    })
  } catch (error) {
    console.error('Refresh token error:', error)
    return res.status(500).json({
      success: false,
      error: { message: 'Erro ao atualizar sessão' },
    })
  }
})

/**
 * @swagger
 * /api/auth/logout:
 *   post:
 *     summary: Fazer logout - invalida sessão no banco e limpa cookies
 *     tags: [Auth]
 *     security:
 *       - sessionAuth: []
 *     responses:
 *       200:
 *         description: Logout realizado com sucesso
 */
router.post('/logout', sessionAuth, async (req, res) => {
  try {
    const sessionId = req.sessionId

    if (sessionId) {
      // Invalidar sessão no banco
      await invalidateSession(sessionId)
    }

    // Limpar cookies
    res.clearCookie(REFRESH_TOKEN_COOKIE_NAME, { path: '/' })
    res.clearCookie(SESSION_ID_COOKIE_NAME, { path: '/' })

    return res.json({
      success: true,
      data: { message: 'Logout realizado com sucesso' },
    })
  } catch (error) {
    console.error('Logout error:', error)
    
    // Mesmo com erro, limpa os cookies
    res.clearCookie(REFRESH_TOKEN_COOKIE_NAME, { path: '/' })
    res.clearCookie(SESSION_ID_COOKIE_NAME, { path: '/' })
    
    // Retorna sucesso pois o frontend vai limpar o estado
    return res.json({
      success: true,
      data: { message: 'Logout realizado' },
    })
  }
})

/**
 * @swagger
 * /api/auth/logout-all:
 *   post:
 *     summary: Fazer logout de todas as sessões do usuário
 *     tags: [Auth]
 *     security:
 *       - sessionAuth: []
 *     responses:
 *       200:
 *         description: Todas as sessões foram invalidadas
 */
router.post('/logout-all', sessionAuth, async (req, res) => {
  try {
    const session = req.session

    if (session) {
      // Invalidar todas as sessões do usuário
      await invalidateAllUserSessions(session.userId)
    }

    // Limpar cookies
    res.clearCookie(REFRESH_TOKEN_COOKIE_NAME, { path: '/' })
    res.clearCookie(SESSION_ID_COOKIE_NAME, { path: '/' })

    return res.json({
      success: true,
      data: { message: 'Todas as sessões foram encerradas' },
    })
  } catch (error) {
    console.error('Logout-all error:', error)
    return res.status(500).json({
      success: false,
      error: { message: 'Erro ao encerrar sessões' },
    })
  }
})

/**
 * @swagger
 * /api/auth/sessions:
 *   get:
 *     summary: Listar todas as sessões ativas do usuário
 *     tags: [Auth]
 *     security:
 *       - sessionAuth: []
 *     responses:
 *       200:
 *         description: Lista de sessões ativas
 */
router.get('/sessions', sessionAuth, async (req, res) => {
  try {
    const session = req.session
    const currentSessionId = req.sessionId

    if (!session) {
      return res.status(401).json({
        success: false,
        error: { message: 'Não autenticado' },
      })
    }

    const sessions = await getUserSessions(session.userId)

    // Retornar sessões com indicação de qual é a atual
    const formattedSessions = sessions.map(s => ({
      id: s.id,
      createdAt: new Date(s.createdAt || 0).toISOString(),
      lastUsedAt: new Date(s.lastUsedAt || 0).toISOString(),
      userAgent: s.userAgent,
      ipAddress: s.ipAddress,
      isCurrent: s.id === currentSessionId,
    }))

    return res.json({
      success: true,
      data: { sessions: formattedSessions },
    })
  } catch (error) {
    console.error('Get sessions error:', error)
    return res.status(500).json({
      success: false,
      error: { message: 'Erro ao buscar sessões' },
    })
  }
})

/**
 * @swagger
 * /api/auth/sessions/{id}:
 *   delete:
 *     summary: Revogar uma sessão específica
 *     tags: [Auth]
 *     security:
 *       - sessionAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Sessão revogada com sucesso
 */
router.delete('/sessions/:id', sessionAuth, async (req, res) => {
  try {
    const session = req.session
    const targetSessionId = req.params['id']

    if (!session) {
      return res.status(401).json({
        success: false,
        error: { message: 'Não autenticado' },
      })
    }

    if (!targetSessionId) {
      return res.status(400).json({
        success: false,
        error: { message: 'ID da sessão é obrigatório' },
      })
    }

    // Verificar se a sessão pertence ao usuário
    const targetSession = await getSessionById(targetSessionId)
    
    if (!targetSession || targetSession.userId !== session.userId) {
      return res.status(404).json({
        success: false,
        error: { message: 'Sessão não encontrada' },
      })
    }

    // Invalidar a sessão
    await invalidateSession(targetSessionId)

    return res.json({
      success: true,
      data: { message: 'Sessão revogada com sucesso' },
    })
  } catch (error) {
    console.error('Delete session error:', error)
    return res.status(500).json({
      success: false,
      error: { message: 'Erro ao revogar sessão' },
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
router.get('/users', sessionAuth, async (req, res) => {
  try {
    // Verificar se o usuário é admin usando o cliente autenticado
    const { data: { user }, error: userError } = await req.supabaseUser!.auth.getUser()
    if (userError || !user) {
      return res.status(401).json({
        success: false,
        error: { message: 'Usuário não autenticado' },
      })
    }
    const userRole = user?.user_metadata?.['role']
    if (userRole !== 'admin') {
      return res.status(403).json({
        success: false,
        error: { message: 'Acesso negado. Apenas administradores podem listar usuários.' },
      })
    }

    // Listar todos os usuários do auth.users
    const { data, error } = await supabase.auth.admin.listUsers()

    if (error) {
      console.error('Error listing users:', error)
      return res.status(500).json({
        success: false,
        error: { message: 'Erro ao buscar usuários' },
      })
    }

    // Buscar dados da nova tabela users (profile_id, employee_id, etc.)
    const userIds = data.users.map(u => u.id)
    const { data: platformUsersData } = await supabase
      .from('users')
      .select('id, name, avatar_url, role, profile_id, employee_id, is_active, access_profiles(name)')
      .in('id', userIds)

    // Criar mapa de id -> dados do usuário da plataforma
    const platformUserMap = new Map<string, {
      name: string | null
      avatar_url: string | null
      role: string | null
      profile_id: number | null
      profile_name: string | null
      employee_id: string | null
      is_active: boolean
    }>()
    platformUsersData?.forEach(u => {
      const profileName = (u.access_profiles as any)?.name || null
      platformUserMap.set(u.id, {
        name: u.name,
        avatar_url: u.avatar_url,
        role: u.role,
        profile_id: u.profile_id,
        profile_name: profileName,
        employee_id: u.employee_id,
        is_active: u.is_active,
      })
    })

    const users = data.users.map((user) => {
      const platformUser = platformUserMap.get(user.id)
      return {
        id: user.id,
        email: user.email || '',
        name: platformUser?.name || user.user_metadata?.['name'] || user.email || 'Sem nome',
        role: platformUser?.role || user.user_metadata?.['role'] || 'user',
        status: user.user_metadata?.['status'] || 'active',
        avatar: platformUser?.avatar_url || user.user_metadata?.['avatar'],
        employee_id: platformUser?.employee_id || null,
        profile_id: platformUser?.profile_id || null,
        profile_name: platformUser?.profile_name || null,
        is_active: platformUser?.is_active ?? true,
        created_at: user.created_at,
      }
    })

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
 * /api/auth/users:
 *   post:
 *     summary: Criar novo usuário (requer admin)
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - name
 *             properties:
 *               email:
 *                 type: string
 *               name:
 *                 type: string
 *               role:
 *                 type: string
 *               runrun_user_id:
 *                 type: string
 *     responses:
 *       201:
 *         description: Usuário criado com sucesso
 *       401:
 *         description: Não autorizado
 *       403:
 *         description: Acesso negado (requer admin)
 */
router.post('/users', sessionAuth, async (req, res) => {
  try {
    // Verificar se o usuário é admin usando o cliente autenticado
    const { data: { user }, error: authError } = await req.supabaseUser!.auth.getUser()
    if (authError || !user) {
      return res.status(401).json({
        success: false,
        error: { message: 'Usuário não autenticado' },
      })
    }
    const userRole = user?.user_metadata?.['role']
    if (userRole !== 'admin') {
      return res.status(403).json({
        success: false,
        error: { message: 'Acesso negado. Apenas administradores podem criar usuários.' },
      })
    }

    const { email, name, role = 'user', profile_id, employee_id } = req.body

    if (!email || !name) {
      return res.status(400).json({
        success: false,
        error: { message: 'Email e nome são obrigatórios' },
      })
    }

    // Buscar dados do funcionário na tabela employees (se existir por email ou employee_id)
    let employeeData: { user_id: string; avatar_large_url: string | null } | null = null
    if (employee_id) {
      const { data } = await supabase
        .from('employees')
        .select('user_id, avatar_large_url')
        .eq('user_id', employee_id)
        .single()
      employeeData = data
    } else {
      const { data } = await supabase
        .from('employees')
        .select('user_id, avatar_large_url')
        .eq('email', email)
        .maybeSingle()
      employeeData = data
    }

    // Convidar usuário por e-mail (cria em auth.users)
    const { data, error } = await supabase.auth.admin.inviteUserByEmail(
      email,
      {
        data: {
          name,
          role,
          status: 'active',
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

    // Criar registro na nova tabela users (usuários da plataforma)
    const { error: createUserError } = await supabase
      .from('users')
      .insert({
        id: data.user.id,
        email: email,
        name: name,
        avatar_url: employeeData?.avatar_large_url || null,
        role: role,
        profile_id: profile_id || null,
        employee_id: employeeData?.user_id || employee_id || null,
        is_active: true,
      })

    if (createUserError) {
      console.error('Error creating user in public.users:', createUserError)
      // Não falha a operação, apenas loga
    }

    return res.status(201).json({
      success: true,
      data: {
        user: {
          id: data.user.id,
          email: data.user.email,
          name: name,
          role: role,
          status: 'active',
          employee_id: employeeData?.user_id || employee_id || null,
          profile_id: profile_id || null,
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
router.patch('/users/:id', sessionAuth, async (req, res) => {
  try {
    // Verificar se o usuário é admin usando o cliente autenticado
    const { data: { user }, error: userError } = await req.supabaseUser!.auth.getUser()
    if (userError || !user) {
      return res.status(401).json({
        success: false,
        error: { message: 'Usuário não autenticado' },
      })
    }
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

    const { name, role, status, password, profile_id, employee_id } = req.body

    const updateData: {
      user_metadata?: Record<string, any>
      password?: string
      email?: string
    } = {}

    // Obter dados atuais do usuário
    const { data: currentUserData, error: getUserError } = await supabase.auth.admin.getUserById(id)
    if (getUserError) {
      return res.status(404).json({ success: false, error: { message: 'Usuário não encontrado' } })
    }
    const currentUser = currentUserData.user

    // Atualizar metadados no auth.users se fornecidos
    if (name || role || status) {
      updateData.user_metadata = {
        ...currentUser?.user_metadata,
        ...(name && { name }),
        ...(role && { role }),
        ...(status && { status }),
      }
    }

    // Atualizar senha se fornecida (com validação de força)
    if (password) {
      const passwordValidation = validatePasswordStrength(password)
      if (!passwordValidation.valid) {
        return res.status(400).json({
          success: false,
          error: { 
            message: passwordValidation.errors.join('. '),
            code: 'WEAK_PASSWORD',
            details: passwordValidation.errors,
          },
        })
      }
      updateData.password = password
    }

    // Atualizar auth.users se houver metadados ou senha
    if (Object.keys(updateData).length > 0) {
      const { error } = await supabase.auth.admin.updateUserById(id, updateData)
      if (error) {
        console.error('Error updating auth user:', error)
        return res.status(400).json({
          success: false,
          error: { message: error.message },
        })
      }
    }

    // Atualizar dados na nova tabela users (usuários da plataforma)
    const platformUserUpdate: Record<string, any> = {}
    if (name !== undefined) platformUserUpdate['name'] = name
    if (role !== undefined) platformUserUpdate['role'] = role
    if (profile_id !== undefined) platformUserUpdate['profile_id'] = profile_id
    if (employee_id !== undefined) platformUserUpdate['employee_id'] = employee_id

    if (Object.keys(platformUserUpdate).length > 0) {
      // Verificar se existe registro na tabela users
      const { data: existingUser } = await supabase
        .from('users')
        .select('id')
        .eq('id', id)
        .single()

      if (existingUser) {
        // Atualizar registro existente
        const { error: updateError } = await supabase
          .from('users')
          .update(platformUserUpdate)
          .eq('id', id)

        if (updateError) {
          console.error('Error updating user in public.users:', updateError)
        }
      } else {
        // Criar registro se não existir
        const { error: insertError } = await supabase
          .from('users')
          .insert({
            id: id,
            email: currentUser.email || '',
            name: name || currentUser.user_metadata?.['name'] || currentUser.email || '',
            role: role || 'user',
            profile_id: profile_id || null,
            employee_id: employee_id || null,
            is_active: true,
          })

        if (insertError) {
          console.error('Error inserting user in public.users:', insertError)
        }
      }
    }

    // Buscar dados atualizados
    const { data: updatedPlatformUser } = await supabase
      .from('users')
      .select('name, role, profile_id, employee_id, avatar_url')
      .eq('id', id)
      .single()

    return res.json({
      success: true,
      data: {
        user: {
          id: id,
          email: currentUser.email,
          name: updatedPlatformUser?.name || name || currentUser.user_metadata?.['name'],
          role: updatedPlatformUser?.role || role || currentUser.user_metadata?.['role'],
          status: status || currentUser.user_metadata?.['status'],
          employee_id: updatedPlatformUser?.employee_id || null,
          profile_id: updatedPlatformUser?.profile_id || null,
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
router.post('/users/:id/reset-password', sessionAuth, async (req, res) => {
  try {
    // Verificar se o usuário é admin usando o cliente autenticado
    const { data: { user }, error: authError } = await req.supabaseUser!.auth.getUser()
    if (authError || !user) {
      return res.status(401).json({
        success: false,
        error: { message: 'Usuário não autenticado' },
      })
    }
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
    const { data: userData, error: getUserError } = await supabase.auth.admin.getUserById(id)
    if (getUserError || !userData?.user?.email) {
      console.error('Error getting user email:', getUserError)
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