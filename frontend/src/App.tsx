import { Routes, Route } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import Layout from '@/components/Layout'
import Dashboard from '@/pages/Dashboard'
import Employees from '@/pages/Employees'
import EmployeeDetail from '@/pages/EmployeeDetail'
import Allocations from '@/pages/Allocations'
import Projects from '@/pages/Projects'
import TimeEntries from '@/pages/TimeEntries'
import Feedbacks from '@/pages/Feedbacks'
import Evaluations from '@/pages/Evaluations'
import EvaluationDetail from '@/pages/EvaluationDetail'
import Login from '@/pages/Login'
import ProtectedRoute from '@/components/ProtectedRoute'

function App() {
  const { isAuthenticated } = useAuthStore()

  if (!isAuthenticated) {
    return <Login />
  }

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/time-entries" element={<ProtectedRoute><TimeEntries /></ProtectedRoute>} />
        <Route path="/employees" element={<ProtectedRoute><Employees /></ProtectedRoute>} />
        <Route path="/employees/:id" element={<ProtectedRoute><EmployeeDetail /></ProtectedRoute>} />
        <Route path="/allocations" element={<ProtectedRoute><Allocations /></ProtectedRoute>} />
        <Route path="/feedbacks" element={<ProtectedRoute><Feedbacks /></ProtectedRoute>} />
        <Route path="/evaluations" element={<ProtectedRoute><Evaluations /></ProtectedRoute>} />
        <Route path="/evaluations/:id" element={<ProtectedRoute><EvaluationDetail /></ProtectedRoute>} />
        <Route path="/projects" element={<ProtectedRoute><Projects /></ProtectedRoute>} />
      </Routes>
    </Layout>
  )
}

export default App 