/**
 * Auth Store - Gerenciamento de autenticação baseada em Sessão
 * 
 * Este store gerencia a autenticação usando sessionId em vez de JWT.
 * Os tokens do Supabase ficam criptografados no banco, nunca no frontend.
 * 
 * Fluxo:
 * 1. Login via Backend -> Recebe sessionId no body e em cookie httpOnly
 * 2. sessionId armazenado no Zustand (persiste em localStorage)
 * 3. Requisições enviam sessionId via header X-Session-Id
 * 4. Backend descriptografa tokens e aplica RLS
 */

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { supabase } from '@/lib/supabaseClient'
import { configureApiClient } from '@/lib/apiClient'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000'

// Flag para evitar múltiplas inicializações simultâneas
let isInitializing = false
let initPromise: Promise<void> | null = null

interface User {
  id: string
  runrun_user_id?: string
  name: string
  email: string
  role: string
  avatar?: string
  avatar_large_url?: string
}

interface AuthState {
  user: User | null
  sessionId: string | null
  isAuthenticated: boolean
  loading: boolean
  
  // Actions
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>
  logout: () => Promise<void>
  updateUser: (user: Partial<User>) => void
  initializeAuth: () => Promise<void>
  setSessionId: (sessionId: string | null) => void
  refreshSession: () => Promise<boolean>
  fetchUserProfile: (userId: string) => Promise<void>
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      sessionId: null,
      isAuthenticated: false,
      loading: true,

      /**
       * Faz login via Backend API
       * Backend autentica com Supabase e retorna sessionId
       */
      login: async (email: string, password: string) => {
        try {
          const response = await fetch(`${API_URL}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include', // Para receber o cookie httpOnly
            body: JSON.stringify({ email, password }),
          })

          const result = await response.json()

          if (!result.success) {
            return { 
              success: false, 
              error: result.error?.message || 'Erro ao fazer login' 
            }
          }

          const { user, sessionId } = result.data

          // Atualiza o estado
          set({ 
            user, 
            sessionId, 
            isAuthenticated: true, 
            loading: false 
          })

          // Busca dados adicionais do perfil
          void get().fetchUserProfile(user.id)

          return { success: true }
        } catch (error) {
          console.error('Login error:', error)
          return { 
            success: false, 
            error: 'Erro de conexão. Verifique sua internet.' 
          }
        }
      },

      /**
       * Faz logout - limpa estado local e chama backend
       */
      logout: async () => {
        const { sessionId } = get()

        // Limpa o estado local primeiro
        set({
          user: null,
          sessionId: null,
          isAuthenticated: false,
        })

        // Tenta chamar o backend para limpar sessão
        if (sessionId) {
          try {
            await fetch(`${API_URL}/api/auth/logout`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'X-Session-Id': sessionId,
              },
              credentials: 'include', // Para limpar o cookie
            })
          } catch (error) {
            console.error('Logout error:', error)
            // Ignora erro - o estado local já foi limpo
          }
        }
      },

      /**
       * Inicializa a autenticação verificando se há sessão salva
       * Usa flag para evitar múltiplas execuções simultâneas
       */
      initializeAuth: async () => {
        // Se já está inicializando, retorna a promise existente
        if (isInitializing && initPromise) {
          return initPromise
        }

        isInitializing = true
        
        initPromise = (async () => {
          try {
            const { sessionId, user } = get()

            // Configura o apiClient com os callbacks (apenas uma vez)
            configureApiClient({
              getSessionId: () => get().sessionId,
              setSessionId: (id) => get().setSessionId(id),
              onAuthError: () => {
                // Quando a sessão expira e não consegue renovar
                console.log('[authStore] Sessão expirada, fazendo logout')
                void get().logout()
              },
            })

            // Se tem sessionId salvo, verifica se ainda é válido
            if (sessionId && user) {
              // Tenta chamar /api/auth/me para validar a sessão
              const response = await fetch(`${API_URL}/api/auth/me`, {
                headers: {
                  'X-Session-Id': sessionId,
                },
                credentials: 'include',
              })

              if (response.ok) {
                // Sessão válida, mantém o estado
                set({ isAuthenticated: true, loading: false })
                void get().fetchUserProfile(user.id)
                return
              }

              // Sessão expirada, tenta renovar
              const refreshed = await get().refreshSession()
              
              if (refreshed) {
                set({ isAuthenticated: true, loading: false })
                return
              }

              // Não conseguiu renovar, limpa o estado
              set({
                user: null,
                sessionId: null,
                isAuthenticated: false,
              })
            }
          } catch (error) {
            console.error('Erro ao inicializar autenticação:', error)
          } finally {
            set({ loading: false })
            isInitializing = false
            initPromise = null
          }
        })()

        return initPromise
      },

      /**
       * Tenta renovar a sessão usando o refresh token (cookie)
       */
      refreshSession: async () => {
        try {
          const response = await fetch(`${API_URL}/api/auth/refresh`, {
            method: 'POST',
            credentials: 'include', // Envia o cookie httpOnly
            headers: { 'Content-Type': 'application/json' },
          })

          if (!response.ok) {
            return false
          }

          const result = await response.json()

          if (result.success && result.data?.sessionId) {
            set({ sessionId: result.data.sessionId })
            if (result.data.user) {
              set({ user: result.data.user })
            }
            return true
          }

          return false
        } catch (error) {
          console.error('Refresh session error:', error)
          return false
        }
      },

      /**
       * Define o session ID
       */
      setSessionId: (sessionId: string | null) => {
        set({ sessionId })
      },

      /**
       * Busca dados adicionais do perfil do usuário na tabela users
       * Ainda usa Supabase diretamente (será migrado posteriormente)
       */
      fetchUserProfile: async (userId: string) => {
        try {
          console.log('Fetching user profile for:', userId)

          // Tenta buscar primeiro pelo user_id
          const { data: dataByUserId } = await supabase
            .from('users')
            .select('avatar_large_url, runrun_user_id')
            .eq('user_id', userId)
            .maybeSingle()

          if (dataByUserId) {
            console.log('Found profile by user_id:', dataByUserId)
            set((state) => ({
              user: state.user ? { 
                ...state.user, 
                avatar_large_url: dataByUserId.avatar_large_url || undefined,
                runrun_user_id: dataByUserId.runrun_user_id || undefined,
              } : null,
            }))
            return
          }

          // Se não encontrar por user_id, tenta pelo email
          const currentUserEmail = get().user?.email
          if (currentUserEmail) {
            console.log('Fetching user profile by email:', currentUserEmail)
            const { data: dataByEmail } = await supabase
              .from('users')
              .select('avatar_large_url, runrun_user_id')
              .eq('email', currentUserEmail)
              .maybeSingle()

            if (dataByEmail) {
              console.log('Found profile by email:', dataByEmail)
              set((state) => ({
                user: state.user ? { 
                  ...state.user, 
                  avatar_large_url: dataByEmail.avatar_large_url || undefined,
                  runrun_user_id: dataByEmail.runrun_user_id || undefined,
                } : null,
              }))
              return
            }
          }

          console.log('No additional profile data found in users table')
        } catch (error) {
          console.error('Erro ao buscar perfil do usuário:', error)
        }
      },

      /**
       * Atualiza dados do usuário localmente
       */
      updateUser: (userData: Partial<User>) =>
        set((state) => ({
          user: state.user ? { ...state.user, ...userData } : null,
        })),
    }),
    {
      name: 'ekip-auth-storage',
      partialize: (state) => ({
        user: state.user,
        sessionId: state.sessionId,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
)