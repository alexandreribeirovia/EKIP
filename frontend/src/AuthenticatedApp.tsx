/**
 * AuthenticatedApp - Componente que gerencia toda a lógica de autenticação
 * 
 * Este componente é carregado via lazy loading, então só é baixado quando
 * o usuário não está em uma rota pública isolada (como EvaluationAccept).
 */

import { useEffect, lazy, Suspense } from 'react'
import { Routes, Route, useLocation, useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { usePermissionStore } from '@/stores/permissionStore'
import Layout from '@/components/Layout'
import ProtectedRoute from '@/components/ProtectedRoute'
import { ProtectedRouteByPermission } from '@/components/ProtectedComponents'
import { supabase } from './lib/supabaseClient'

// Lazy loading para páginas
// Páginas públicas de auth
const Login = lazy(() => import('@/pages/Login'))
const ForgotPassword = lazy(() => import('@/pages/ForgotPassword'))
const ResetPassword = lazy(() => import('@/pages/ResetPassword'))

// Páginas autenticadas
const Dashboard = lazy(() => import('@/pages/Dashboard'))
const Employees = lazy(() => import('@/pages/Employees'))
const EmployeeDetail = lazy(() => import('@/pages/EmployeeDetail'))
const Allocations = lazy(() => import('@/pages/Allocations'))
const Projects = lazy(() => import('@/pages/Projects'))
const TimeEntries = lazy(() => import('@/pages/TimeEntries'))
const Feedbacks = lazy(() => import('@/pages/Feedbacks'))
const EvaluationModels = lazy(() => import('@/pages/EvaluationModel'))
const EvaluationDetail = lazy(() => import('@/pages/EvaluationDetailModel'))
const EmployeeEvaluations = lazy(() => import('@/pages/Evaluations'))
const PDI = lazy(() => import('@/pages/PDI'))
const EvaluationResponse = lazy(() => import('@/pages/EvaluationResponse'))
const Users = lazy(() => import('@/pages/Users'))
const Domains = lazy(() => import('@/pages/Domains'))
const Notifications = lazy(() => import('@/pages/Notifications'))
// Quiz - Configuração (menu Configurações)
const QuizModel = lazy(() => import('@/pages/QuizModel'))
const QuizModelDetail = lazy(() => import('@/pages/QuizModelDetail'))
// Quiz - Uso/Acompanhamento (menu Funcionários)
const EmployeeQuizzes = lazy(() => import('@/pages/EmployeeQuizzes'))
const EmployeeQuizDetail = lazy(() => import('@/pages/EmployeeQuizDetail'))
// Perfis de Acesso
const AccessProfiles = lazy(() => import('@/pages/AccessProfiles'))
const AccessProfileDetail = lazy(() => import('@/pages/AccessProfileDetail'))

// Fallback de loading
const LazyLoadingFallback = () => (
  <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-100 via-gray-200 to-gray-300 dark:from-gray-800 dark:via-gray-900 dark:to-black">
    <div className="text-center">
      <svg className="animate-spin h-12 w-12 text-orange-500 mx-auto mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
      </svg>
      <p className="text-gray-700 dark:text-gray-300 text-lg font-medium">Carregando...</p>
    </div>
  </div>
)

function AuthenticatedApp() {
  const { isAuthenticated, loading, initializeAuth } = useAuthStore()
  const { loadPermissions, loaded: permissionsLoaded, loading: permissionsLoading, clearPermissions } = usePermissionStore()
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    void initializeAuth()
  }, [initializeAuth])

  // Carregar permissões quando autenticado
  useEffect(() => {
    if (isAuthenticated && !permissionsLoaded && !permissionsLoading) {
      void loadPermissions()
    }
    // Limpar permissões quando deslogar
    if (!isAuthenticated && permissionsLoaded) {
      clearPermissions()
    }
  }, [isAuthenticated, permissionsLoaded, permissionsLoading, loadPermissions, clearPermissions])

  useEffect(() => {
    // Check for invite link on initial load and set a flag.
    if (window.location.hash.includes('type=invite')) {
      sessionStorage.setItem('isInvite', 'true')
    }

    const { data: authListener } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        navigate('/reset-password')
      } else if (event === 'SIGNED_IN') {
        const isInvite = sessionStorage.getItem('isInvite')
        if (isInvite === 'true') {
          sessionStorage.removeItem('isInvite')
          navigate('/reset-password')
        }
      }
    })

    return () => {
      authListener.subscription.unsubscribe()
    }
  }, [navigate])

  if (loading) {
    return <LazyLoadingFallback />
  }

  if (!isAuthenticated && !['/reset-password', '/forgot-password'].includes(location.pathname)) {
    return (
      <Suspense fallback={<LazyLoadingFallback />}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="*" element={<Login />} />
        </Routes>
      </Suspense>
    )
  }

  return (
    <Suspense fallback={<LazyLoadingFallback />}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/*" element={
          <Layout>
            <Routes>
              <Route path="/" element={<ProtectedRouteByPermission screenKey="dashboard"><Dashboard /></ProtectedRouteByPermission>} />
              <Route path="/dashboard" element={<ProtectedRouteByPermission screenKey="dashboard"><Dashboard /></ProtectedRouteByPermission>} />
              <Route path="/time-entries" element={<ProtectedRouteByPermission screenKey="dashboard"><TimeEntries /></ProtectedRouteByPermission>} />
              <Route path="/employees" element={<ProtectedRouteByPermission screenKey="employees"><Employees /></ProtectedRouteByPermission>} />
              <Route path="/employees/:id" element={<ProtectedRouteByPermission screenKey="employees.detail"><EmployeeDetail /></ProtectedRouteByPermission>} />
              <Route path="/allocations" element={<ProtectedRouteByPermission screenKey="allocations"><Allocations /></ProtectedRouteByPermission>} />
              <Route path="/feedbacks" element={<ProtectedRouteByPermission screenKey="employees.feedbacks"><Feedbacks /></ProtectedRouteByPermission>} />
              <Route path="/employee-evaluations" element={<ProtectedRouteByPermission screenKey="employees.evaluations"><EmployeeEvaluations /></ProtectedRouteByPermission>} />
              <Route path="/employee-evaluations/:id" element={<ProtectedRouteByPermission screenKey="employees.evaluations"><EvaluationResponse /></ProtectedRouteByPermission>} />
              <Route path="/evaluations" element={<ProtectedRouteByPermission screenKey="settings.evaluations"><EvaluationModels /></ProtectedRouteByPermission>} />
              <Route path="/evaluations/:id" element={<ProtectedRouteByPermission screenKey="settings.evaluations"><EvaluationDetail /></ProtectedRouteByPermission>} />
              <Route path="/pdi" element={<ProtectedRouteByPermission screenKey="employees.pdi"><PDI /></ProtectedRouteByPermission>} />
              <Route path="/projects" element={<ProtectedRouteByPermission screenKey="projects"><Projects /></ProtectedRouteByPermission>} />
              <Route path="/users" element={<ProtectedRouteByPermission screenKey="settings.users"><Users /></ProtectedRouteByPermission>} />
              <Route path="/domains" element={<ProtectedRouteByPermission screenKey="settings.domains"><Domains /></ProtectedRouteByPermission>} />
              <Route path="/notifications" element={<ProtectedRouteByPermission screenKey="notifications"><Notifications /></ProtectedRouteByPermission>} />
              {/* Quiz - Configuração (menu Configurações) */}
              <Route path="/quizzes" element={<ProtectedRouteByPermission screenKey="settings.quizzes"><QuizModel /></ProtectedRouteByPermission>} />
              <Route path="/quizzes/:id" element={<ProtectedRouteByPermission screenKey="settings.quizzes"><QuizModelDetail /></ProtectedRouteByPermission>} />
              {/* Quiz - Uso/Acompanhamento (menu Funcionários) */}
              <Route path="/employee-quizzes" element={<ProtectedRouteByPermission screenKey="employees.quizzes"><EmployeeQuizzes /></ProtectedRouteByPermission>} />
              <Route path="/employee-quizzes/:id" element={<ProtectedRouteByPermission screenKey="employees.quizzes"><EmployeeQuizDetail /></ProtectedRouteByPermission>} />
              {/* Perfis de Acesso */}
              <Route path="/access-profiles" element={<ProtectedRouteByPermission screenKey="settings.access-profiles"><AccessProfiles /></ProtectedRouteByPermission>} />
              <Route path="/access-profiles/:id" element={<ProtectedRouteByPermission screenKey="settings.access-profiles"><AccessProfileDetail /></ProtectedRouteByPermission>} />
            </Routes>
          </Layout>
        } />
      </Routes>
    </Suspense>
  )
}

export default AuthenticatedApp
