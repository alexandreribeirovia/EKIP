import { ReactNode } from 'react'
import { useAuthStore } from '@/stores/authStore'

interface ProtectedRouteProps {
  children: ReactNode
}

const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const { isAuthenticated } = useAuthStore()

  if (!isAuthenticated) {
    return <div>Redirecionando para login...</div>
  }

  return <>{children}</>
}

export default ProtectedRoute 