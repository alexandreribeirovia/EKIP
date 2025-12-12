import { createClient } from '@supabase/supabase-js'

// Cliente Supabase Admin com service_role key
// Este cliente bypassa RLS e deve ser usado APENAS no backend
const supabaseUrl = process.env['SUPABASE_URL'] || ''
const supabaseServiceKey = process.env['SUPABASE_SERVICE_ROLE_KEY'] || ''

if (!supabaseUrl || !supabaseServiceKey) {
  console.warn('⚠️ SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não configurados')
}

export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

export default supabaseAdmin
