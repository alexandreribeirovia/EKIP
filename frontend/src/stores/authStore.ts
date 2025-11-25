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
  avatar_large_url?: string
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
  fetchUserProfile: (userId: string) => Promise<void>
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
    (set, get) => ({
      user: null,
      session: null,
      isAuthenticated: false,
      loading: true,

      login: (user: User, session: Session) => {
        set({ user, session, isAuthenticated: true, loading: false });
        void get().fetchUserProfile(user.id);
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
            void get().fetchUserProfile(user.id)
          }
        } catch (error) {
          console.error('Erro ao inicializar autenticação:', error)
        } finally {
          // Garante que o estado de loading seja finalizado
          set({ loading: false })
        }
      },

      /**
       * Busca dados adicionais do perfil do usuário na tabela users
       */
      fetchUserProfile: async (userId: string) => {
        try {
          console.log('Fetching user profile for:', userId);

          // Tenta buscar primeiro pelo user_id
          const { data: dataByUserId } = await supabase
            .from('users')
            .select('avatar_large_url')
            .eq('user_id', userId)
            .maybeSingle()

          if (dataByUserId?.avatar_large_url) {
            console.log('Found avatar by user_id:', dataByUserId.avatar_large_url);
            set((state) => ({
              user: state.user ? { ...state.user, avatar_large_url: dataByUserId.avatar_large_url || undefined } : null,
            }))
            return;
          }

          // Se não encontrar por user_id, tenta pelo email
          const currentUserEmail = get().user?.email;
          if (currentUserEmail) {
            console.log('Fetching user profile by email:', currentUserEmail);
            const { data: dataByEmail } = await supabase
              .from('users')
              .select('avatar_large_url')
              .eq('email', currentUserEmail)
              .maybeSingle()

            if (dataByEmail?.avatar_large_url) {
              console.log('Found avatar by email:', dataByEmail.avatar_large_url);
              set((state) => ({
                user: state.user ? { ...state.user, avatar_large_url: dataByEmail.avatar_large_url || undefined } : null,
              }))
              return;
            }
          }

          console.log('No avatar found in users table');

        } catch (error) {
          console.error('Erro ao buscar perfil do usuário:', error)
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
          void get().fetchUserProfile(user.id)
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