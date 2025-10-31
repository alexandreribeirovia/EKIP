import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { supabase } from '@/lib/supabaseClient'
import type { User as SupabaseUser, Session } from '@supabase/supabase-js'

interface User {
  id: string
  runrun_user_id: string
  name: string
  email: string
  role: string
  avatar?: string
}

interface AuthState {
  user: User | null
  session: Session | null
  isAuthenticated: boolean
  loading: boolean
  login: (user: User, session: Session) => void
  logout: () => Promise<void>
  updateUser: (user: Partial<User>) => void
  initializeAuth: () => Promise<void>
  setSession: (session: Session | null, supabaseUser: SupabaseUser | null) => void
}

/**
 * Mapeia o usuário do Supabase para o formato interno da aplicação
 */
const mapSupabaseUser = (supabaseUser: SupabaseUser): User => {
  return {
    id: supabaseUser.id,
    email: supabaseUser.email || '',
    name: supabaseUser.user_metadata?.name || supabaseUser.email || 'Usuário',
    role: supabaseUser.user_metadata?.role || 'user',
    avatar: supabaseUser.user_metadata?.avatar,
    runrun_user_id: supabaseUser.user_metadata?.runrun_user_id || '',
  }
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      session: null,
      isAuthenticated: false,
      loading: true,

      login: (user: User, session: Session) => {
        set({ user, session, isAuthenticated: true, loading: false });
      },

      /**
       * Inicializa a autenticação verificando sessão existente de forma segura
       */
      initializeAuth: async () => {
        try {
          // Apenas tenta obter a sessão. Se existir, atualiza o estado.
          const { data: { session } } = await supabase.auth.getSession()

          if (session?.user) {
            const user = mapSupabaseUser(session.user)
            set({ 
              user, 
              session, 
              isAuthenticated: true, 
            })
          }
        } catch (error) {
          console.error('Erro ao inicializar autenticação:', error)
        } finally {
          // Garante que o estado de loading seja finalizado
          set({ loading: false })
        }
      },

      /**
       * Faz logout e limpa a sessão
       */
      logout: async () => {
        try {
          await supabase.auth.signOut()
          set({
            user: null,
            session: null,
            isAuthenticated: false,
          })
        } catch (error) {
          console.error('Logout error:', error)
          // Mesmo com erro, limpa o estado local
          set({
            user: null,
            session: null,
            isAuthenticated: false,
          })
        }
      },

      /**
       * Atualiza dados do usuário localmente
       */
      updateUser: (userData: Partial<User>) =>
        set((state) => ({
          user: state.user ? { ...state.user, ...userData } : null,
        })),

      /**
       * Define a sessão manualmente (usado por listeners)
       */
      setSession: (session: Session | null, supabaseUser: SupabaseUser | null) => {
        if (session && supabaseUser) {
          const user = mapSupabaseUser(supabaseUser)
          set({ 
            user, 
            session, 
            isAuthenticated: true 
          })
        } else {
          set({ 
            user: null, 
            session: null, 
            isAuthenticated: false 
          })
        }
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        user: state.user,
        session: state.session,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
)

// Listener para mudanças de autenticação
supabase.auth.onAuthStateChange((event, session) => {
  const store = useAuthStore.getState()
  
  if (event === 'SIGNED_IN' && session) {
    store.setSession(session, session.user)
  } else if (event === 'SIGNED_OUT') {
    store.setSession(null, null)
  } else if (event === 'TOKEN_REFRESHED' && session) {
    store.setSession(session, session.user)
  } else if (event === 'USER_UPDATED' && session) {
    store.setSession(session, session.user)
  } else if (event === 'PASSWORD_RECOVERY' && session) {
    store.setSession(session, session.user)
  }
})