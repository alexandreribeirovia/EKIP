/**
 * API Client - Cliente HTTP com autenticação automática via Session
 * 
 * Este módulo fornece um wrapper do fetch que:
 * - Injeta automaticamente o sessionId via header X-Session-Id
 * - Envia cookies (para refresh token httpOnly)
 * - Faz refresh automático da sessão quando expira (401)
 * - Fornece métodos convenientes: get, post, patch, delete
 */

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000'

// Tipo para as opções do request
interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown
}

// Tipo para a resposta da API
interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: {
    message: string
    code?: string
    details?: unknown
  }
}

// Callbacks para gerenciar o estado de autenticação
let getSessionId: () => string | null = () => null
let setSessionId: (sessionId: string | null) => void = () => {}
let onAuthError: () => void = () => {}

/**
 * Configura os callbacks de autenticação
 * Deve ser chamado no início da aplicação (App.tsx)
 */
export const configureApiClient = (config: {
  getSessionId: () => string | null
  setSessionId: (sessionId: string | null) => void
  onAuthError: () => void
}) => {
  getSessionId = config.getSessionId
  setSessionId = config.setSessionId
  onAuthError = config.onAuthError
}

// Flag para evitar múltiplos refreshes simultâneos
let isRefreshing = false
let refreshPromise: Promise<boolean> | null = null

/**
 * Tenta renovar a sessão usando o refresh token (cookie httpOnly)
 */
const refreshSession = async (): Promise<boolean> => {
  // Se já está renovando, aguarda a promise existente
  if (isRefreshing && refreshPromise) {
    return refreshPromise
  }

  isRefreshing = true
  
  refreshPromise = (async () => {
    try {
      const response = await fetch(`${API_URL}/api/auth/refresh`, {
        method: 'POST',
        credentials: 'include', // Envia o cookie httpOnly
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        console.error('[apiClient] Refresh session falhou:', response.status)
        return false
      }

      const result: ApiResponse<{ sessionId: string }> = await response.json()

      if (result.success && result.data?.sessionId) {
        setSessionId(result.data.sessionId)
        console.log('[apiClient] Sessão renovada com sucesso')
        return true
      }

      return false
    } catch (error) {
      console.error('[apiClient] Erro ao renovar sessão:', error)
      return false
    } finally {
      isRefreshing = false
      refreshPromise = null
    }
  })()

  return refreshPromise
}

/**
 * Faz uma requisição HTTP com autenticação automática
 */
const request = async <T = unknown>(
  endpoint: string,
  options: RequestOptions = {}
): Promise<ApiResponse<T>> => {
  const { body, headers: customHeaders, ...restOptions } = options

  // Monta os headers
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...customHeaders,
  }

  // Adiciona o sessionId se disponível
  const sessionId = getSessionId()
  if (sessionId) {
    (headers as Record<string, string>)['X-Session-Id'] = sessionId
  }

  // Monta a URL completa
  const url = endpoint.startsWith('http') ? endpoint : `${API_URL}${endpoint}`

  // Faz a requisição
  const makeRequest = async (): Promise<Response> => {
    return fetch(url, {
      ...restOptions,
      headers,
      credentials: 'include', // Sempre envia cookies
      body: body ? JSON.stringify(body) : undefined,
    })
  }

  try {
    let response = await makeRequest()

    // Se recebeu 401 (não autorizado), tenta renovar a sessão
    if (response.status === 401) {
      const errorData: ApiResponse = await response.clone().json().catch(() => ({}))
      
      // Se o erro é de sessão expirada, tenta renovar
      if (errorData.error?.code === 'SESSION_INVALID' || errorData.error?.code === 'SESSION_MISSING') {
        console.log('[apiClient] Sessão expirada, tentando renovar...')
        
        const refreshed = await refreshSession()
        
        if (refreshed) {
          // Atualiza o header com o novo sessionId
          const newSessionId = getSessionId()
          if (newSessionId) {
            (headers as Record<string, string>)['X-Session-Id'] = newSessionId
          }
          
          // Refaz a requisição com o novo sessionId
          response = await fetch(url, {
            ...restOptions,
            headers,
            credentials: 'include',
            body: body ? JSON.stringify(body) : undefined,
          })
        } else {
          // Refresh falhou - usuário precisa fazer login novamente
          console.error('[apiClient] Refresh falhou, redirecionando para login')
          onAuthError()
          return {
            success: false,
            error: { message: 'Sessão expirada. Faça login novamente.', code: 'SESSION_EXPIRED' },
          }
        }
      } else if (errorData.error?.code === 'SESSION_EXPIRED') {
        // Sessão expirou no backend - usuário precisa fazer login
        onAuthError()
        return {
          success: false,
          error: { message: 'Sessão expirada. Faça login novamente.', code: 'SESSION_EXPIRED' },
        }
      }
    }

    // Parse da resposta
    const result: ApiResponse<T> = await response.json()

    // Se ainda é 401 após refresh, chama onAuthError
    if (!response.ok && response.status === 401) {
      onAuthError()
    }

    return result
  } catch (error) {
    console.error('[apiClient] Erro na requisição:', error)
    return {
      success: false,
      error: { 
        message: error instanceof Error ? error.message : 'Erro de conexão',
        code: 'NETWORK_ERROR',
      },
    }
  }
}

// ==================== MÉTODOS CONVENIENTES ====================

/**
 * GET request
 */
export const get = <T = unknown>(
  endpoint: string,
  options?: Omit<RequestOptions, 'body'>
): Promise<ApiResponse<T>> => {
  return request<T>(endpoint, { ...options, method: 'GET' })
}

/**
 * POST request
 */
export const post = <T = unknown>(
  endpoint: string,
  body?: unknown,
  options?: Omit<RequestOptions, 'body'>
): Promise<ApiResponse<T>> => {
  return request<T>(endpoint, { ...options, method: 'POST', body })
}

/**
 * PATCH request
 */
export const patch = <T = unknown>(
  endpoint: string,
  body?: unknown,
  options?: Omit<RequestOptions, 'body'>
): Promise<ApiResponse<T>> => {
  return request<T>(endpoint, { ...options, method: 'PATCH', body })
}

/**
 * PUT request
 */
export const put = <T = unknown>(
  endpoint: string,
  body?: unknown,
  options?: Omit<RequestOptions, 'body'>
): Promise<ApiResponse<T>> => {
  return request<T>(endpoint, { ...options, method: 'PUT', body })
}

/**
 * DELETE request
 */
export const del = <T = unknown>(
  endpoint: string,
  options?: Omit<RequestOptions, 'body'>
): Promise<ApiResponse<T>> => {
  return request<T>(endpoint, { ...options, method: 'DELETE' })
}

// Export do objeto apiClient para uso mais organizado
export const apiClient = {
  get,
  post,
  patch,
  put,
  delete: del,
  configure: configureApiClient,
}

export default apiClient
