import { createClient, SupabaseClient } from '@supabase/supabase-js'

// Cliente Supabase Admin com service_role key
// Este cliente bypassa RLS e deve ser usado APENAS no backend

let _supabaseAdmin: SupabaseClient | null = null

/**
 * Retorna o cliente Supabase Admin (lazy initialization)
 * Garante que as variáveis de ambiente estão carregadas antes de criar o cliente
 */
export const getSupabaseAdmin = (): SupabaseClient => {
  if (_supabaseAdmin) {
    return _supabaseAdmin
  }

  const supabaseUrl = process.env['SUPABASE_URL']
  const supabaseServiceKey = process.env['SUPABASE_SERVICE_ROLE_KEY']

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não configurados!')
    console.error('   SUPABASE_URL:', supabaseUrl ? '✓ definido' : '✗ NÃO definido')
    console.error('   SUPABASE_SERVICE_ROLE_KEY:', supabaseServiceKey ? '✓ definido' : '✗ NÃO definido')
    throw new Error('Supabase Admin não configurado corretamente. Verifique as variáveis de ambiente.')
  }

  console.log('[SupabaseAdmin] Inicializando cliente com service_role key (bypass RLS)')
  console.log('[SupabaseAdmin] URL:', supabaseUrl)
  
  // Verificar se a key é realmente uma service_role key (começa com eyJ e contém "role":"service_role")
  const isServiceRoleKey = supabaseServiceKey.startsWith('eyJ') && supabaseServiceKey.length > 200
  console.log('[SupabaseAdmin] Service Key válida (JWT longo):', isServiceRoleKey ? '✓ SIM' : '✗ NÃO - pode ser anon key!')
  console.log('[SupabaseAdmin] Service Key (primeiros 50 chars):', supabaseServiceKey.substring(0, 50) + '...')
  
  if (!isServiceRoleKey) {
    console.error('⚠️ ATENÇÃO: A SUPABASE_SERVICE_ROLE_KEY pode não ser uma service_role key válida!')
    console.error('   Verifique se você copiou a chave correta do Supabase Dashboard > Settings > API')
  }
  
  _supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    },
    // Forçar bypass de RLS com header
    db: {
      schema: 'public'
    },
    global: {
      headers: {
        // Este header é automaticamente adicionado quando usa service_role key
        // mas vamos garantir que está presente
        'apikey': supabaseServiceKey
      }
    }
  })

  return _supabaseAdmin
}

// Para compatibilidade com imports existentes, exportar o getter como supabaseAdmin
// IMPORTANTE: Use getSupabaseAdmin() para garantir lazy initialization
export const supabaseAdmin = {
  get from() {
    return getSupabaseAdmin().from.bind(getSupabaseAdmin())
  },
  get auth() {
    return getSupabaseAdmin().auth
  },
  get storage() {
    return getSupabaseAdmin().storage
  },
  get functions() {
    return getSupabaseAdmin().functions
  },
  get realtime() {
    return getSupabaseAdmin().realtime
  },
  get rpc() {
    return getSupabaseAdmin().rpc.bind(getSupabaseAdmin())
  },
  // Métodos de Realtime Channel
  channel(name: string) {
    return getSupabaseAdmin().channel(name)
  },
  removeChannel(channel: any) {
    return getSupabaseAdmin().removeChannel(channel)
  }
}

export default supabaseAdmin
