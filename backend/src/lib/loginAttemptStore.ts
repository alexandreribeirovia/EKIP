/**
 * Login Attempt Store - Rastreamento de tentativas de login por IP
 * 
 * Usa tabela `login_attempts` no Supabase para persistência.
 * Funcionalidades:
 * - Rastrear tentativas falhas por IP
 * - Exigir CAPTCHA após 3 tentativas
 * - Bloquear após 5 tentativas (rate limiter)
 * - Auto-limpeza após 15 minutos
 */

import { supabaseAdmin } from './supabaseAdmin'

const WINDOW_MS = 15 * 60 * 1000 // 15 minutos em ms
const CAPTCHA_THRESHOLD = 3 // Exigir CAPTCHA após 3 tentativas
const MAX_ATTEMPTS = 5 // Bloquear após 5 tentativas

interface LoginAttemptResult {
  attemptCount: number
  requiresCaptcha: boolean
  isBlocked: boolean
  firstAttemptAt: Date | null
}

/**
 * Obtém informações de tentativas de login para um IP
 */
export async function getLoginAttempts(ipAddress: string): Promise<LoginAttemptResult> {
  try {
    const supabase = supabaseAdmin

    // Primeiro, limpa tentativas antigas (mais de 15 minutos)
    const cutoffTime = new Date(Date.now() - WINDOW_MS).toISOString()
    await supabase
      .from('login_attempts')
      .delete()
      .lt('last_attempt_at', cutoffTime)

    // Busca tentativas atuais para o IP
    const { data, error } = await supabase
      .from('login_attempts')
      .select('attempt_count, first_attempt_at, last_attempt_at')
      .eq('ip_address', ipAddress)
      .single()

    if (error && error.code !== 'PGRST116') {
      // PGRST116 = no rows returned (não é erro)
      console.error('Erro ao buscar tentativas de login:', error)
    }

    if (!data) {
      return {
        attemptCount: 0,
        requiresCaptcha: false,
        isBlocked: false,
        firstAttemptAt: null,
      }
    }

    const attemptCount = data.attempt_count || 0
    const firstAttemptAt = data.first_attempt_at ? new Date(data.first_attempt_at) : null

    return {
      attemptCount,
      requiresCaptcha: attemptCount >= CAPTCHA_THRESHOLD,
      isBlocked: attemptCount >= MAX_ATTEMPTS,
      firstAttemptAt,
    }
  } catch (error) {
    console.error('Erro ao obter tentativas de login:', error)
    return {
      attemptCount: 0,
      requiresCaptcha: false,
      isBlocked: false,
      firstAttemptAt: null,
    }
  }
}

/**
 * Incrementa contador de tentativas falhas para um IP
 */
export async function incrementLoginAttempts(ipAddress: string, email?: string): Promise<LoginAttemptResult> {
  try {
    const supabase = supabaseAdmin

    // Tenta fazer upsert (inserir ou atualizar)
    const { data: existingData } = await supabase
      .from('login_attempts')
      .select('id, attempt_count')
      .eq('ip_address', ipAddress)
      .single()

    if (existingData) {
      // Atualiza contador existente
      const newCount = (existingData.attempt_count || 0) + 1
      await supabase
        .from('login_attempts')
        .update({
          attempt_count: newCount,
          last_attempt_at: new Date().toISOString(),
          email: email || null,
        })
        .eq('id', existingData.id)

      return {
        attemptCount: newCount,
        requiresCaptcha: newCount >= CAPTCHA_THRESHOLD,
        isBlocked: newCount >= MAX_ATTEMPTS,
        firstAttemptAt: null,
      }
    } else {
      // Insere novo registro
      await supabase
        .from('login_attempts')
        .insert({
          ip_address: ipAddress,
          email: email || null,
          attempt_count: 1,
          first_attempt_at: new Date().toISOString(),
          last_attempt_at: new Date().toISOString(),
        })

      return {
        attemptCount: 1,
        requiresCaptcha: false,
        isBlocked: false,
        firstAttemptAt: new Date(),
      }
    }
  } catch (error) {
    console.error('Erro ao incrementar tentativas de login:', error)
    return {
      attemptCount: 0,
      requiresCaptcha: false,
      isBlocked: false,
      firstAttemptAt: null,
    }
  }
}

/**
 * Reseta contador de tentativas para um IP (após login bem-sucedido)
 */
export async function resetLoginAttempts(ipAddress: string): Promise<void> {
  try {
    const supabase = supabaseAdmin

    await supabase
      .from('login_attempts')
      .delete()
      .eq('ip_address', ipAddress)

    console.log(`[LoginAttemptStore] Tentativas resetadas para IP: ${ipAddress.substring(0, 10)}...`)
  } catch (error) {
    console.error('Erro ao resetar tentativas de login:', error)
  }
}

/**
 * Limpa todas as tentativas antigas (mais de 15 minutos)
 * Pode ser chamado periodicamente ou via cron
 */
export async function cleanupOldAttempts(): Promise<number> {
  try {
    const supabase = supabaseAdmin
    const cutoffTime = new Date(Date.now() - WINDOW_MS).toISOString()

    const { data, error } = await supabase
      .from('login_attempts')
      .delete()
      .lt('last_attempt_at', cutoffTime)
      .select('id')

    if (error) {
      console.error('Erro ao limpar tentativas antigas:', error)
      return 0
    }

    const deletedCount = data?.length || 0
    if (deletedCount > 0) {
      console.log(`[LoginAttemptStore] ${deletedCount} tentativas antigas removidas`)
    }

    return deletedCount
  } catch (error) {
    console.error('Erro ao limpar tentativas antigas:', error)
    return 0
  }
}

// Exporta constantes para uso externo
export const LOGIN_ATTEMPT_CONFIG = {
  WINDOW_MS,
  CAPTCHA_THRESHOLD,
  MAX_ATTEMPTS,
}
