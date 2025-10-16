import { useState, useEffect } from 'react'
import { useAuthStore } from '@/stores/authStore'
import { X, User, Mail, Shield, KeyRound, UserCheck, UserX } from 'lucide-react'
import NotificationToast from './NotificationToast'

interface UserModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  userId?: string // Se presente, é edição
}

interface UserData {
  id?: string
  email: string
  name: string
  role: 'admin' | 'user' | 'manager'
  status: 'active' | 'inactive'
}

const UserModal = ({ isOpen, onClose, onSuccess, userId }: UserModalProps) => {
  const [formData, setFormData] = useState<UserData>({
    email: '',
    name: '',
    role: 'user',
    status: 'active',
  })
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notification, setNotification] = useState<{type: 'success' | 'error', message: string} | null>(null)
  const { session } = useAuthStore()

  const isEditMode = !!userId

  // Buscar dados do usuário se for edição
  useEffect(() => {
    if (isEditMode && userId) {
      fetchUserData()
    } else {
      // Reset para modo criação
      setFormData({
        email: '',
        name: '',
        role: 'user',
        status: 'active',
      })
    }
  }, [userId, isEditMode])

  const fetchUserData = async () => {
    if (!userId) return

    try {
      const token = session?.access_token
      
      if (!token) {
        setError('Usuário não autenticado')
        return
      }

      // Buscar lista de usuários e filtrar pelo ID
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/auth/users`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        throw new Error('Erro ao buscar usuário')
      }

      const result = await response.json()
      
      if (result.success && result.data.users) {
        const user = result.data.users.find((u: any) => u.id === userId)
        
        if (user) {
          setFormData({
            id: user.id,
            email: user.email || '',
            name: user.name || '',
            role: user.role || 'user',
            status: user.status || 'active',
          })
        }
      }
    } catch (err: any) {
      console.error('Erro ao buscar usuário:', err)
      setError('Erro ao carregar dados do usuário')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setNotification(null)

    // Validações
    if (!formData.email || !formData.name) {
      setError('Email e nome são obrigatórios')
      return
    }

    setIsLoading(true)

    try {
      const token = session?.access_token
      
      if (!token) {
        setError('Usuário não autenticado')
        return
      }

      if (isEditMode && userId) {
        // Atualizar usuário existente
        const response = await fetch(`${import.meta.env.VITE_API_URL}/api/auth/users/${userId}`, {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: formData.name,
            role: formData.role,
            status: formData.status,
          }),
        })

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error?.message || 'Erro ao atualizar usuário')
        }

        setNotification({ type: 'success', message: 'Usuário atualizado com sucesso!' })
      } else {
        // Criar novo usuário
        const response = await fetch(`${import.meta.env.VITE_API_URL}/api/auth/users`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: formData.email,
            name: formData.name,
            role: formData.role,
          }),
        })

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error?.message || 'Erro ao criar usuário')
        }

        setNotification({ type: 'success', message: 'Usuário criado com sucesso!' })
      }

      setTimeout(() => {
        onSuccess()
        onClose()
      }, 1500)
    } catch (err: any) {
      console.error('Erro ao salvar usuário:', err)
      setError(err.message || 'Erro ao salvar usuário')
    } finally {
      setIsLoading(false)
    }
  }

  const handleResetPassword = async () => {
    if (!userId) return

    if (!confirm('Tem certeza que deseja enviar um e-mail de redefinição de senha para este usuário?')) {
      return
    }

    setError(null)
    setNotification(null)
    setIsLoading(true)

    try {
      const token = session?.access_token
      
      if (!token) {
        setError('Usuário não autenticado')
        setIsLoading(false)
        return
      }

      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/auth/users/${userId}/reset-password`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error?.message || 'Erro ao enviar e-mail de redefinição')
      }

      setNotification({ type: 'success', message: 'E-mail de redefinição de senha enviado com sucesso!' })
    } catch (err: any) {
      console.error('Erro ao redefinir senha:', err)
      setError(err.message || 'Erro ao redefinir senha')
    } finally {
      setIsLoading(false)
    }
  }

  const handleToggleStatus = async () => {
    if (!userId) return

    setError(null)
    setNotification(null)

    const newStatus = formData.status === 'active' ? 'inactive' : 'active'

    if (!confirm(`Tem certeza que deseja ${newStatus === 'active' ? 'ativar' : 'inativar'} este usuário?`)) {
      return
    }

    setIsLoading(true)

    try {
      const token = session?.access_token
      
      if (!token) {
        setError('Usuário não autenticado')
        return
      }

      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/auth/users/${userId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: newStatus,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error?.message || 'Erro ao alterar status')
      }

      setFormData({ ...formData, status: newStatus })
      setNotification({ type: 'success', message: `Usuário ${newStatus === 'active' ? 'ativado' : 'inativado'} com sucesso!` })
    } catch (err: any) {
      console.error('Erro ao alterar status:', err)
      setError(err.message || 'Erro ao alterar status')
    } finally {
      setIsLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <>
      {notification && (
        <NotificationToast
          type={notification.type}
          message={notification.message}
          onClose={() => setNotification(null)}
        />
      )}
      <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
          {/* Header */}
          <div className="p-5 bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-t-2xl flex items-center justify-between sticky top-0 z-10">
            <h2 className="text-xl font-bold">
              {isEditMode ? 'Editar Usuário' : 'Novo Usuário'}
            </h2>
            <button
              onClick={onClose}
              className="text-white hover:bg-white/20 rounded-full p-1 transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Content */}
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            {/* Messages */}
            {error && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            {/* Nome */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                <User className="w-4 h-4 inline mr-1" />
                Nome: *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-orange-500 focus:border-transparent"
                required
                disabled={isLoading}
              />
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                <Mail className="w-4 h-4 inline mr-1" />
                Email: *
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-orange-500 focus:border-transparent"
                required
                disabled={isLoading || isEditMode}
              />
              {isEditMode && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Email não pode ser alterado após criação
                </p>
              )}
            </div>

            {/* Senha (removido para criação via convite) */}
            {!isEditMode && (
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-400 px-4 py-3 rounded-lg text-sm">
                <p>O usuário receberá um e-mail para definir sua senha após a criação.</p>
              </div>
            )}

            {/* Perfil */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                <Shield className="w-4 h-4 inline mr-1" />
                Perfil: *
              </label>
              <select
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value as any })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-orange-500 focus:border-transparent"
                required
                disabled={isLoading}
              >
                <option value="user">Usuário</option>
                <option value="manager">Gerente</option>
                <option value="admin">Administrador</option>
              </select>
            </div>

            {/* Ações adicionais para edição */}
            {isEditMode && (
              <div className="border-t border-gray-200 dark:border-gray-700 pt-4 mt-4">
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                  Ações Adicionais:
                </p>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={handleResetPassword}
                    disabled={isLoading}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-500 rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <KeyRound className="w-4 h-4" />
                    Redefinir Senha
                  </button>

                  <button
                    type="button"
                    onClick={handleToggleStatus}
                    disabled={isLoading}
                    className={`flex items-center gap-2 px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                      formData.status === 'active'
                        ? 'bg-red-500 hover:bg-red-600'
                        : 'bg-green-500 hover:bg-green-600'
                    }`}
                  >
                    {formData.status === 'active' ? (
                      <>
                        <UserX className="w-4 h-4" />
                        Inativar Usuário
                      </>
                    ) : (
                      <>
                        <UserCheck className="w-4 h-4" />
                        Ativar Usuário
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* Footer Buttons */}
            <div className="flex justify-end gap-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                disabled={isLoading}
                className="px-6 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isLoading}
                className="px-6 py-2 text-sm font-medium text-white bg-green-500 rounded-lg hover:bg-green-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? 'Salvando...' : isEditMode ? 'Atualizar' : 'Criar Usuário'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  )
}

export default UserModal
