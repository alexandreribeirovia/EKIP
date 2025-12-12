/**
 * Cliente Supabase com JWT do Usuário
 * 
 * Cria um cliente Supabase autenticado com o token do usuário,
 * permitindo que o RLS (Row Level Security) seja aplicado.
 * 
 * @module lib/supabaseUserClient
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env['SUPABASE_URL'] || ''
const SUPABASE_ANON_KEY = process.env['SUPABASE_ANON_KEY'] || ''

// Validar configuração no startup
if (!SUPABASE_URL) {
  console.error('❌ SUPABASE_URL não está configurada')
}

if (!SUPABASE_ANON_KEY) {
  console.error('❌ SUPABASE_ANON_KEY não está configurada')
}

/**
 * Cria um cliente Supabase autenticado com o JWT do usuário
 * 
 * Este cliente aplica RLS (Row Level Security) baseado no usuário
 * autenticado, garantindo que ele só acesse dados permitidos.
 * 
 * @param userAccessToken - JWT de acesso do Supabase (descriptografado)
 * @returns Cliente Supabase configurado com o token do usuário
 * 
 * @example
 * // No middleware/route:
 * const supabase = createUserClient(decryptedAccessToken)
 * const { data } = await supabase.from('projects').select('*')
 * // RLS aplicado automaticamente
 */
export function createUserClient(userAccessToken: string): SupabaseClient {
  if (!userAccessToken) {
    throw new Error('Token de acesso do usuário é obrigatório')
  }

  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: {
      headers: {
        Authorization: `Bearer ${userAccessToken}`
      }
    },
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false
    }
  })
}

/**
 * Tipo para extensão do Express Request
 */
declare global {
  namespace Express {
    interface Request {
      /**
       * Cliente Supabase autenticado com o JWT do usuário
       * Disponível após o middleware sessionAuth
       */
      supabaseUser?: SupabaseClient
    }
  }
}

export type { SupabaseClient }
