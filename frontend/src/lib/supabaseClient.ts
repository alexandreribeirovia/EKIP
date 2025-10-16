/// <reference types="vite/client" />
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Supabase URL and Anon Key must be provided in environment variables.");
}

// Cliente Supabase com persistência de sessão automática
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true, // Persiste a sessão no localStorage
    autoRefreshToken: true, // Atualiza automaticamente o token
    detectSessionInUrl: true, // Detecta sessão em URLs (útil para magic links)
  }
})

/**
 * Helper para obter o JWT token da sessão atual
 */
export const getSupabaseToken = async (): Promise<string | null> => {
  const { data: { session } } = await supabase.auth.getSession()
  return session?.access_token || null
}

/**
 * Helper para obter o usuário autenticado
 */
export const getCurrentUser = async () => {
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error) {
    console.error('Error fetching user:', error)
    return null
  }
  return user
}

/**
 * Tipo para o usuário autenticado com metadados
 */
export interface AuthUser {
  id: string
  email: string
  user_metadata: {
    name?: string
    avatar?: string
    role?: string
    runrun_user_id?: string
  }
}