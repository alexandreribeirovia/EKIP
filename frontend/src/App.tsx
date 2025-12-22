/**
 * App.tsx - Entry Point Principal
 * 
 * Este componente é ultra-leve. Apenas verifica a rota e decide:
 * - Se é rota pública isolada (EvaluationAccept, FeedbackAccept): carrega APENAS esse componente
 * - Caso contrário: carrega o AuthenticatedApp com toda a lógica de auth
 * 
 * Isso garante que páginas públicas não carreguem authStore, Layout, Supabase, etc.
 */

import { lazy, Suspense } from 'react'
import { Routes, Route, useLocation } from 'react-router-dom'

// Lazy loading do EvaluationAccept - completamente isolado
const EvaluationAccept = lazy(() => import('@/pages/EvaluationAccept'))

// Lazy loading do FeedbackAccept - completamente isolado
const FeedbackAccept = lazy(() => import('@/pages/FeedbackAccept'))

// Lazy loading do AuthenticatedApp - contém toda lógica de auth e páginas
const AuthenticatedApp = lazy(() => import('./AuthenticatedApp'))

// Fallback de loading mínimo
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

function App() {
  const location = useLocation()

  // Rota pública isolada - carrega APENAS o EvaluationAccept
  // Não carrega authStore, Layout, ProtectedRoute, supabaseClient, etc.
  if (location.pathname.startsWith('/evaluation-accept/')) {
    return (
      <Suspense fallback={<LazyLoadingFallback />}>
        <Routes>
          <Route path="/evaluation-accept/:token" element={<EvaluationAccept />} />
        </Routes>
      </Suspense>
    )
  }

  // Rota pública isolada - carrega APENAS o FeedbackAccept
  if (location.pathname.startsWith('/feedback-accept/')) {
    return (
      <Suspense fallback={<LazyLoadingFallback />}>
        <Routes>
          <Route path="/feedback-accept/:token" element={<FeedbackAccept />} />
        </Routes>
      </Suspense>
    )
  }

  // Todas as outras rotas - carrega o app completo com autenticação
  return (
    <Suspense fallback={<LazyLoadingFallback />}>
      <AuthenticatedApp />
    </Suspense>
  )
}

export default App