/**
 * Session Store - Armazena sessões no Supabase com tokens criptografados
 * 
 * Este módulo mantém os tokens do Supabase criptografados no banco de dados,
 * garantindo:
 * - Persistência entre reinicializações do servidor
 * - Suporte a múltiplas instâncias (horizontal scaling)
 * - Segurança: tokens criptografados com AES-256-GCM
 * - Auditoria: registro de sessões ativas por usuário
 * 
 * @module lib/sessionStore
 */

import { getSupabaseAdmin } from './supabaseAdmin'
import { encrypt, decrypt, hashSHA256, generateSecureToken } from './encryption'

// ==================== INTERFACES ====================

/**
 * Sessão armazenada no banco (com tokens criptografados)
 */
export interface StoredSession {
  id: string
  userId: string
  email: string
  supabaseAccessToken: string  // Descriptografado para uso
  supabaseRefreshToken: string // Descriptografado para uso
  expiresAt: number            // Unix timestamp em segundos
  createdAt: Date
  lastUsedAt: Date
  userAgent?: string
  ipAddress?: string
  isValid: boolean
}

/**
 * Dados para criar uma nova sessão
 */
export interface CreateSessionData {
  userId: string
  email: string
  supabaseAccessToken: string
  supabaseRefreshToken: string
  expiresAt: number
  userAgent?: string
  ipAddress?: string
}

/**
 * Dados do refresh token do backend
 */
export interface RefreshTokenData {
  sessionId: string
  userId: string
  createdAt: number
  expiresAt: number
}

/**
 * Registro de sessão no banco (formato do Supabase)
 */
interface SessionRecord {
  id: string
  user_id: string
  email: string
  access_token: string      // Criptografado
  refresh_token: string     // Criptografado
  backend_refresh_token: string // Hash SHA-256
  expires_at: string        // ISO timestamp
  created_at: string
  last_used_at: string
  user_agent: string | null
  ip_address: string | null
  is_valid: boolean
}

// ==================== SESSION MANAGEMENT ====================

/**
 * Cria uma nova sessão no banco de dados
 * 
 * @param data - Dados da sessão
 * @returns Objeto com sessionId e backendRefreshToken
 */
export const createSession = async (data: CreateSessionData): Promise<{
  sessionId: string
  backendRefreshToken: string
} | null> => {
  try {
    // Gerar tokens
    const backendRefreshToken = generateSecureToken(32)
    const backendRefreshTokenHash = hashSHA256(backendRefreshToken)
    
    // Criptografar tokens Supabase
    const encryptedAccessToken = encrypt(data.supabaseAccessToken)
    const encryptedRefreshToken = encrypt(data.supabaseRefreshToken)
    
    // Inserir no banco
    const { data: session, error } = await getSupabaseAdmin()
      .from('sessions')
      .insert({
        user_id: data.userId,
        email: data.email,
        access_token: encryptedAccessToken,
        refresh_token: encryptedRefreshToken,
        backend_refresh_token: backendRefreshTokenHash,
        expires_at: new Date(data.expiresAt * 1000).toISOString(),
        user_agent: data.userAgent || null,
        ip_address: data.ipAddress || null,
        is_valid: true
      })
      .select('id')
      .single()
    
    if (error) {
      console.error('[SessionStore] Erro ao criar sessão:', error)
      return null
    }
    
    console.log(`[SessionStore] Sessão criada: ${session.id} para userId: ${data.userId}`)
    
    return {
      sessionId: session.id,
      backendRefreshToken
    }
  } catch (error) {
    console.error('[SessionStore] Erro ao criar sessão:', error)
    return null
  }
}

/**
 * Busca uma sessão pelo ID
 * 
 * @param sessionId - UUID da sessão
 * @returns Sessão com tokens descriptografados ou null
 */
export const getSessionById = async (sessionId: string): Promise<StoredSession | null> => {
  try {
    const { data, error } = await getSupabaseAdmin()
      .from('sessions')
      .select('*')
      .eq('id', sessionId)
      .eq('is_valid', true)
      .single()
    
    if (error || !data) {
      return null
    }
    
    const record = data as SessionRecord
    
    // Verificar se expirou
    const expiresAt = Math.floor(new Date(record.expires_at).getTime() / 1000)
    const now = Math.floor(Date.now() / 1000)
    
    if (expiresAt <= now) {
      // Marcar como inválida
      await invalidateSession(sessionId)
      return null
    }
    
    // Descriptografar tokens
    const supabaseAccessToken = decrypt(record.access_token)
    const supabaseRefreshToken = decrypt(record.refresh_token)
    
    // Atualizar last_used_at
    await getSupabaseAdmin()
      .from('sessions')
      .update({ last_used_at: new Date().toISOString() })
      .eq('id', sessionId)
    
    return {
      id: record.id,
      userId: record.user_id,
      email: record.email,
      supabaseAccessToken,
      supabaseRefreshToken,
      expiresAt,
      createdAt: new Date(record.created_at),
      lastUsedAt: new Date(record.last_used_at),
      ...(record.user_agent && { userAgent: record.user_agent }),
      ...(record.ip_address && { ipAddress: record.ip_address }),
      isValid: record.is_valid
    }
  } catch (error) {
    console.error('[SessionStore] Erro ao buscar sessão:', error)
    return null
  }
}

/**
 * Busca uma sessão pelo refresh token do backend
 * 
 * @param backendRefreshToken - Token de refresh do backend (não o hash)
 * @returns Sessão com tokens descriptografados ou null
 */
export const getSessionByRefreshToken = async (backendRefreshToken: string): Promise<StoredSession | null> => {
  try {
    const tokenHash = hashSHA256(backendRefreshToken)
    
    const { data, error } = await getSupabaseAdmin()
      .from('sessions')
      .select('*')
      .eq('backend_refresh_token', tokenHash)
      .eq('is_valid', true)
      .single()
    
    if (error || !data) {
      return null
    }
    
    const record = data as SessionRecord
    
    // Verificar se expirou
    const expiresAt = Math.floor(new Date(record.expires_at).getTime() / 1000)
    const now = Math.floor(Date.now() / 1000)
    
    if (expiresAt <= now) {
      await invalidateSession(record.id)
      return null
    }
    
    // Descriptografar tokens
    const supabaseAccessToken = decrypt(record.access_token)
    const supabaseRefreshToken = decrypt(record.refresh_token)
    
    return {
      id: record.id,
      userId: record.user_id,
      email: record.email,
      supabaseAccessToken,
      supabaseRefreshToken,
      expiresAt,
      createdAt: new Date(record.created_at),
      lastUsedAt: new Date(record.last_used_at),
      ...(record.user_agent && { userAgent: record.user_agent }),
      ...(record.ip_address && { ipAddress: record.ip_address }),
      isValid: record.is_valid
    }
  } catch (error) {
    console.error('[SessionStore] Erro ao buscar sessão por refresh token:', error)
    return null
  }
}

/**
 * Atualiza os tokens de uma sessão existente
 * 
 * @param sessionId - ID da sessão
 * @param newAccessToken - Novo access token do Supabase
 * @param newRefreshToken - Novo refresh token do Supabase
 * @param newExpiresAt - Nova data de expiração (Unix timestamp)
 */
export const updateSessionTokens = async (
  sessionId: string,
  newAccessToken: string,
  newRefreshToken: string,
  newExpiresAt: number
): Promise<boolean> => {
  try {
    const encryptedAccessToken = encrypt(newAccessToken)
    const encryptedRefreshToken = encrypt(newRefreshToken)
    
    const { error } = await getSupabaseAdmin()
      .from('sessions')
      .update({
        access_token: encryptedAccessToken,
        refresh_token: encryptedRefreshToken,
        expires_at: new Date(newExpiresAt * 1000).toISOString(),
        last_used_at: new Date().toISOString()
      })
      .eq('id', sessionId)
      .eq('is_valid', true)
    
    if (error) {
      console.error('[SessionStore] Erro ao atualizar tokens:', error)
      return false
    }
    
    console.log(`[SessionStore] Tokens atualizados para sessão: ${sessionId}`)
    return true
  } catch (error) {
    console.error('[SessionStore] Erro ao atualizar tokens:', error)
    return false
  }
}

/**
 * Invalida uma sessão (soft delete)
 */
export const invalidateSession = async (sessionId: string): Promise<boolean> => {
  try {
    const { error } = await getSupabaseAdmin()
      .from('sessions')
      .update({ is_valid: false })
      .eq('id', sessionId)
    
    if (error) {
      console.error('[SessionStore] Erro ao invalidar sessão:', error)
      return false
    }
    
    console.log(`[SessionStore] Sessão invalidada: ${sessionId}`)
    return true
  } catch (error) {
    console.error('[SessionStore] Erro ao invalidar sessão:', error)
    return false
  }
}

/**
 * Invalida todas as sessões de um usuário
 * 
 * @param userId - ID do usuário
 * @param exceptSessionId - Sessão a manter (opcional, para "logout outros dispositivos")
 * @returns Número de sessões invalidadas
 */
export const invalidateAllUserSessions = async (
  userId: string,
  exceptSessionId?: string
): Promise<number> => {
  try {
    let query = getSupabaseAdmin()
      .from('sessions')
      .update({ is_valid: false })
      .eq('user_id', userId)
      .eq('is_valid', true)
    
    if (exceptSessionId) {
      query = query.neq('id', exceptSessionId)
    }
    
    const { data, error } = await query.select('id')
    
    if (error) {
      console.error('[SessionStore] Erro ao invalidar sessões do usuário:', error)
      return 0
    }
    
    const count = data?.length || 0
    console.log(`[SessionStore] ${count} sessões invalidadas para userId: ${userId}`)
    return count
  } catch (error) {
    console.error('[SessionStore] Erro ao invalidar sessões do usuário:', error)
    return 0
  }
}

/**
 * Lista todas as sessões ativas de um usuário
 */
export const getUserSessions = async (userId: string): Promise<Omit<StoredSession, 'supabaseAccessToken' | 'supabaseRefreshToken'>[]> => {
  try {
    const { data, error } = await getSupabaseAdmin()
      .from('sessions')
      .select('id, user_id, email, expires_at, created_at, last_used_at, user_agent, ip_address, is_valid')
      .eq('user_id', userId)
      .eq('is_valid', true)
      .order('last_used_at', { ascending: false })
    
    if (error) {
      console.error('[SessionStore] Erro ao listar sessões:', error)
      return []
    }
    
    return (data || []).map(record => ({
      id: record.id,
      userId: record.user_id,
      email: record.email,
      expiresAt: Math.floor(new Date(record.expires_at).getTime() / 1000),
      createdAt: new Date(record.created_at),
      lastUsedAt: new Date(record.last_used_at),
      userAgent: record.user_agent || undefined,
      ipAddress: record.ip_address || undefined,
      isValid: record.is_valid
    }))
  } catch (error) {
    console.error('[SessionStore] Erro ao listar sessões:', error)
    return []
  }
}

// ==================== REFRESH SESSION ====================

/**
 * Renova a sessão Supabase se estiver próxima de expirar
 * 
 * @param sessionId - ID da sessão
 * @returns Sessão atualizada ou null se falhar
 */
export const refreshSessionIfNeeded = async (sessionId: string): Promise<StoredSession | null> => {
  const session = await getSessionById(sessionId)
  
  if (!session) {
    return null
  }
  
  // Verificar se precisa renovar (margem de 5 minutos)
  const now = Math.floor(Date.now() / 1000)
  const margin = 5 * 60 // 5 minutos
  
  if (session.expiresAt - margin > now) {
    // Ainda não precisa renovar
    return session
  }
  
  console.log(`[SessionStore] Renovando sessão: ${sessionId}`)
  
  try {
    // Usar refresh token para obter novos tokens
    const { data, error } = await getSupabaseAdmin().auth.refreshSession({
      refresh_token: session.supabaseRefreshToken
    })
    
    if (error || !data.session) {
      console.error('[SessionStore] Erro ao renovar sessão Supabase:', error)
      await invalidateSession(sessionId)
      return null
    }
    
    // Atualizar tokens no banco
    const newExpiresAt = data.session.expires_at || Math.floor(Date.now() / 1000) + 3600
    
    await updateSessionTokens(
      sessionId,
      data.session.access_token,
      data.session.refresh_token,
      newExpiresAt
    )
    
    // Retornar sessão atualizada
    return {
      ...session,
      supabaseAccessToken: data.session.access_token,
      supabaseRefreshToken: data.session.refresh_token,
      expiresAt: newExpiresAt
    }
  } catch (error) {
    console.error('[SessionStore] Erro ao renovar sessão:', error)
    await invalidateSession(sessionId)
    return null
  }
}

// ==================== UTILIDADES ====================

/**
 * Verifica se uma sessão está expirada ou próxima de expirar
 */
export const isSessionExpired = (session: StoredSession, marginSeconds: number = 60): boolean => {
  const now = Math.floor(Date.now() / 1000)
  return session.expiresAt - marginSeconds <= now
}

/**
 * Retorna estatísticas das sessões (para monitoring)
 */
export const getSessionStats = async (): Promise<{
  totalActive: number
  totalInvalid: number
}> => {
  try {
    const { count: activeCount } = await getSupabaseAdmin()
      .from('sessions')
      .select('*', { count: 'exact', head: true })
      .eq('is_valid', true)
    
    const { count: invalidCount } = await getSupabaseAdmin()
      .from('sessions')
      .select('*', { count: 'exact', head: true })
      .eq('is_valid', false)
    
    return {
      totalActive: activeCount || 0,
      totalInvalid: invalidCount || 0
    }
  } catch (error) {
    console.error('[SessionStore] Erro ao obter estatísticas:', error)
    return { totalActive: 0, totalInvalid: 0 }
  }
}

/**
 * Executa limpeza de sessões expiradas
 * Chama a função do banco de dados
 */
export const cleanupExpiredSessions = async (): Promise<{
  invalidated: number
  deleted: number
} | null> => {
  try {
    const { data, error } = await getSupabaseAdmin().rpc('cleanup_expired_sessions')
    
    if (error) {
      console.error('[SessionStore] Erro no cleanup:', error)
      return null
    }
    
    console.log('[SessionStore] Cleanup executado:', data)
    return data
  } catch (error) {
    console.error('[SessionStore] Erro no cleanup:', error)
    return null
  }
}

// ==================== COMPATIBILIDADE (DEPRECATED) ====================

/**
 * @deprecated Use createSession() em vez disso
 * Mantido para compatibilidade durante migração
 */
export const setSession = async (userId: string, session: {
  supabaseAccessToken: string
  supabaseRefreshToken: string
  expiresAt: number
  email: string
}): Promise<{ sessionId: string; backendRefreshToken: string } | null> => {
  console.warn('[SessionStore] setSession() está deprecated. Use createSession()')
  return createSession({
    userId,
    email: session.email,
    supabaseAccessToken: session.supabaseAccessToken,
    supabaseRefreshToken: session.supabaseRefreshToken,
    expiresAt: session.expiresAt
  })
}

/**
 * @deprecated Use getSessionById() em vez disso
 * Mantido para compatibilidade durante migração
 */
export const getSession = async (userId: string): Promise<StoredSession | null> => {
  console.warn('[SessionStore] getSession(userId) está deprecated. Use getSessionById(sessionId)')
  // Buscar sessão mais recente do usuário
  const sessions = await getUserSessions(userId)
  const firstSession = sessions[0]
  if (!firstSession) return null
  
  // Retornar a mais recente
  return getSessionById(firstSession.id)
}

/**
 * @deprecated Use invalidateSession() em vez disso
 */
export const removeSession = async (userId: string): Promise<boolean> => {
  console.warn('[SessionStore] removeSession() está deprecated. Use invalidateSession()')
  const count = await invalidateAllUserSessions(userId)
  return count > 0
}
