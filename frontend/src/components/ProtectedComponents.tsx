/**
 * Componentes de Proteção de Acesso
 * 
 * Componentes React para controlar visibilidade e acesso
 * baseado em permissões do usuário.
 * 
 * Componentes:
 * - ProtectedAction: Renderiza children apenas se tiver permissão
 * - ProtectedRoute: Redireciona se não tiver acesso à rota
 * - ProtectedButton: Botão que é desabilitado/oculto sem permissão
 */

import { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { usePermissionStore, useHasPermission } from '../stores/permissionStore'

// =====================================================
// PROTECTED ACTION
// =====================================================

interface ProtectedActionProps {
  /** Chave da tela (ex: 'employees', 'employees.feedbacks') */
  screenKey: string
  /** Ação requerida (ex: 'view', 'create', 'edit', 'delete') */
  action: string
  /** Conteúdo a ser renderizado se tiver permissão */
  children: ReactNode
  /** Conteúdo alternativo se não tiver permissão (opcional) */
  fallback?: ReactNode
  /** Se true, mostra o children desabilitado ao invés de ocultar */
  showDisabled?: boolean
}

/**
 * Renderiza children apenas se o usuário tiver a permissão especificada
 * 
 * @example
 * <ProtectedAction screenKey="employees" action="create">
 *   <button>Novo Funcionário</button>
 * </ProtectedAction>
 */
export function ProtectedAction({ 
  screenKey, 
  action, 
  children, 
  fallback = null,
  showDisabled = false 
}: ProtectedActionProps) {
  const hasPermission = useHasPermission(screenKey, action)

  if (hasPermission) {
    return <>{children}</>
  }

  if (showDisabled) {
    // Retorna children envolvido em div com opacity e pointer-events desabilitados
    return (
      <div className="opacity-50 pointer-events-none cursor-not-allowed">
        {children}
      </div>
    )
  }

  return <>{fallback}</>
}

// =====================================================
// PROTECTED ROUTE
// =====================================================

interface ProtectedRouteByPermissionProps {
  /** Chave da tela */
  screenKey: string
  /** Ação requerida (padrão: 'view') */
  action?: string
  /** Conteúdo da rota */
  children: ReactNode
  /** Rota de redirecionamento se não tiver acesso */
  redirectTo?: string
}

/**
 * Protege uma rota baseado em permissões
 * Redireciona para dashboard se não tiver acesso
 * 
 * @example
 * <Route path="/employees" element={
 *   <ProtectedRouteByPermission screenKey="employees">
 *     <Employees />
 *   </ProtectedRouteByPermission>
 * } />
 */
export function ProtectedRouteByPermission({ 
  screenKey, 
  action = 'view', 
  children, 
  redirectTo = '/dashboard' 
}: ProtectedRouteByPermissionProps) {
  const location = useLocation()
  const hasPermission = useHasPermission(screenKey, action)
  const { loaded, loading, isAdmin } = usePermissionStore()

  // Enquanto carrega, mostra loading ou nada
  if (loading || !loaded) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
      </div>
    )
  }

  // Admin sempre tem acesso
  if (isAdmin) {
    return <>{children}</>
  }

  // Verifica permissão
  if (!hasPermission) {
    return <Navigate to={redirectTo} state={{ from: location }} replace />
  }

  return <>{children}</>
}

// =====================================================
// PROTECTED BUTTON
// =====================================================

interface ProtectedButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Chave da tela */
  screenKey: string
  /** Ação requerida */
  action: string
  /** Comportamento quando não tem permissão: 'hide' ou 'disable' */
  behavior?: 'hide' | 'disable'
  /** Tooltip quando desabilitado */
  disabledTooltip?: string
}

/**
 * Botão que verifica permissões antes de exibir/habilitar
 * 
 * @example
 * <ProtectedButton 
 *   screenKey="employees" 
 *   action="create"
 *   onClick={handleCreate}
 *   className="btn-primary"
 * >
 *   Novo Funcionário
 * </ProtectedButton>
 */
export function ProtectedButton({ 
  screenKey, 
  action, 
  behavior = 'hide',
  disabledTooltip = 'Você não tem permissão para esta ação',
  children,
  className = '',
  ...props 
}: ProtectedButtonProps) {
  const hasPermission = useHasPermission(screenKey, action)

  if (!hasPermission) {
    if (behavior === 'hide') {
      return null
    }

    // Disable
    return (
      <button
        {...props}
        disabled
        title={disabledTooltip}
        className={`${className} opacity-50 cursor-not-allowed`}
      >
        {children}
      </button>
    )
  }

  return (
    <button {...props} className={className}>
      {children}
    </button>
  )
}

// =====================================================
// PROTECTED MENU ITEM
// =====================================================

interface ProtectedMenuItemProps {
  /** Chave da tela */
  screenKey: string
  /** Conteúdo do item de menu */
  children: ReactNode
}

/**
 * Item de menu que só aparece se tiver acesso à tela
 * 
 * @example
 * <ProtectedMenuItem screenKey="employees">
 *   <NavLink to="/employees">Funcionários</NavLink>
 * </ProtectedMenuItem>
 */
export function ProtectedMenuItem({ screenKey, children }: ProtectedMenuItemProps) {
  const hasPermission = useHasPermission(screenKey, 'view')
  const { isAdmin, loaded } = usePermissionStore()

  // Enquanto não carregou, mostra o item (para não causar flash)
  if (!loaded) {
    return <>{children}</>
  }

  // Admin sempre vê
  if (isAdmin) {
    return <>{children}</>
  }

  // Só mostra se tiver permissão
  if (!hasPermission) {
    return null
  }

  return <>{children}</>
}

// =====================================================
// HOOK useRequirePermission
// =====================================================

/**
 * Hook que redireciona se não tiver permissão
 * Útil para verificar permissão no início de um componente
 * 
 * @example
 * function EditEmployee() {
 *   useRequirePermission('employees', 'edit')
 *   // ...resto do componente
 * }
 */
export function useRequirePermission(screenKey: string, action: string): void {
  const hasPermission = useHasPermission(screenKey, action)
  const { loaded, isAdmin } = usePermissionStore()

  if (loaded && !isAdmin && !hasPermission) {
    // Poderia redirecionar, mas é melhor usar ProtectedRouteByPermission
    console.warn(`Acesso negado: ${screenKey}:${action}`)
  }
}
