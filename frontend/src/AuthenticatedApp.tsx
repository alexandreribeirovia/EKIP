/**
 * AuthenticatedApp - Componente que gerencia toda a lógica de autenticação
 * 
 * Este componente é carregado via lazy loading, então só é baixado quando
 * o usuário não está em uma rota pública isolada (como EvaluationAccept).
 */

import { useEffect, lazy, Suspense } from 'react'
import { Routes, Route, useLocation, useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import Layout from '@/components/Layout'
import ProtectedRoute from '@/components/ProtectedRoute'
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
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    void initializeAuth()
  }, [initializeAuth])

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
              <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
              <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
              <Route path="/time-entries" element={<ProtectedRoute><TimeEntries /></ProtectedRoute>} />
              <Route path="/employees" element={<ProtectedRoute><Employees /></ProtectedRoute>} />
              <Route path="/employees/:id" element={<ProtectedRoute><EmployeeDetail /></ProtectedRoute>} />
              <Route path="/allocations" element={<ProtectedRoute><Allocations /></ProtectedRoute>} />
              <Route path="/feedbacks" element={<ProtectedRoute><Feedbacks /></ProtectedRoute>} />
              <Route path="/employee-evaluations" element={<ProtectedRoute><EmployeeEvaluations /></ProtectedRoute>} />
              <Route path="/employee-evaluations/:id" element={<ProtectedRoute><EvaluationResponse /></ProtectedRoute>} />
              <Route path="/evaluations" element={<ProtectedRoute><EvaluationModels /></ProtectedRoute>} />
              <Route path="/evaluations/:id" element={<ProtectedRoute><EvaluationDetail /></ProtectedRoute>} />
              <Route path="/pdi" element={<ProtectedRoute><PDI /></ProtectedRoute>} />
              <Route path="/projects" element={<ProtectedRoute><Projects /></ProtectedRoute>} />
              <Route path="/users" element={<ProtectedRoute><Users /></ProtectedRoute>} />
              <Route path="/domains" element={<ProtectedRoute><Domains /></ProtectedRoute>} />
              <Route path="/notifications" element={<ProtectedRoute><Notifications /></ProtectedRoute>} />
              {/* Quiz - Configuração (menu Configurações) */}
              <Route path="/quizzes" element={<ProtectedRoute><QuizModel /></ProtectedRoute>} />
              <Route path="/quizzes/:id" element={<ProtectedRoute><QuizModelDetail /></ProtectedRoute>} />
              {/* Quiz - Uso/Acompanhamento (menu Funcionários) */}
              <Route path="/employee-quizzes" element={<ProtectedRoute><EmployeeQuizzes /></ProtectedRoute>} />
              <Route path="/employee-quizzes/:id" element={<ProtectedRoute><EmployeeQuizDetail /></ProtectedRoute>} />
            </Routes>
          </Layout>
        } />
      </Routes>
    </Suspense>
  )
}

export default AuthenticatedApp
