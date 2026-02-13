import { useState, useEffect } from 'react'
import { AgGridReact } from 'ag-grid-react'
import { ColDef } from 'ag-grid-community'
import { Plus, Edit, Users as UsersIcon, UserCheck, UserX, Shield } from 'lucide-react'
import UserModal from '@/components/UserModal'
import * as apiClient from '../lib/apiClient'
import { ProtectedAction } from '../components/ProtectedComponents'
import { usePermissionStore } from '../stores/permissionStore'

interface UserData {
  id: string
  email: string
  name: string
  role: string
  status: string
  avatar?: string
  runrun_user_id?: string
  profile_id?: number | null
  profile_name?: string | null
  created_at: string
}

const Users = () => {
  const { hasPermission } = usePermissionStore()
  const [users, setUsers] = useState<UserData[]>([])
  const [filteredUsers, setFilteredUsers] = useState<UserData[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedUserId, setSelectedUserId] = useState<string | undefined>(undefined)

  // Filtros
  const [searchText, setSearchText] = useState('')
  const [filterRole, setFilterRole] = useState<string>('all')
  const [filterStatus, setFilterStatus] = useState<string>('all')

  // Buscar usuários
  const fetchUsers = async () => {
    if (isLoading) return

    setIsLoading(true)

    try {
      const result = await apiClient.get<{users: UserData[]}>(`/api/auth/users`)

      if (!result.success) {
        console.error('Erro ao buscar usuários:', result.error)
        return
      }

      if (result.data?.users) {
        setUsers(result.data.users)
        applyFilters(result.data.users, searchText, filterRole, filterStatus)
      }
    } catch (err) {
      console.error('Erro ao buscar usuários:', err)
    } finally {
      setIsLoading(false)
    }
  }

  // Aplicar filtros
  const applyFilters = (
    data: UserData[],
    search: string,
    role: string,
    status: string
  ) => {
    let filtered = [...data]

    // Filtro de texto (nome ou email)
    if (search) {
      const searchLower = search.toLowerCase()
      filtered = filtered.filter(
        (user) =>
          user.name.toLowerCase().includes(searchLower) ||
          user.email.toLowerCase().includes(searchLower)
      )
    }

    // Filtro de perfil
    if (role !== 'all') {
      filtered = filtered.filter((user) => user.role === role)
    }

    // Filtro de status
    if (status !== 'all') {
      filtered = filtered.filter((user) => user.status === status)
    }

    setFilteredUsers(filtered)
  }

  // Carregar usuários ao montar
  useEffect(() => {
    void fetchUsers()
  }, [])

  // Reaplica filtros quando mudam
  useEffect(() => {
    applyFilters(users, searchText, filterRole, filterStatus)
  }, [searchText, filterRole, filterStatus, users])

  // Abrir modal para criar usuário
  const handleCreateUser = () => {
    setSelectedUserId(undefined)
    setIsModalOpen(true)
  }

  // Abrir modal para editar usuário
  const handleEditUser = (userId: string) => {
    setSelectedUserId(userId)
    setIsModalOpen(true)
  }

  // Callback de sucesso do modal
  const handleModalSuccess = () => {
    void fetchUsers()
    setIsModalOpen(false)
    setSelectedUserId(undefined)
  }

  // Estatísticas
  const stats = {
    total: users.length,
    active: users.filter((u) => u.status === 'active').length,
    inactive: users.filter((u) => u.status === 'inactive').length,
    admins: users.filter((u) => u.role === 'admin').length,
    managers: users.filter((u) => u.role === 'manager').length,
  }

  // Configuração das colunas do AG-Grid
  const columnDefs: ColDef[] = [
    {
      headerName: 'Nome',
      field: 'name',
      flex: 1.5,
      minWidth: 200,
      cellRenderer: (params: any) => {
        const avatar = params.data.avatar
        return (
          <div className="flex items-center gap-2 h-full">
            {avatar ? (
              <img
                src={avatar}
                alt={params.value}
                className="w-8 h-8 rounded-full object-cover"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                <UsersIcon className="w-4 h-4 text-gray-500 dark:text-gray-400" />
              </div>
            )}
            <span>{params.value}</span>
          </div>
        )
      },
    },
    {
      headerName: 'Email',
      field: 'email',
      flex: 2,
      minWidth: 250,
    },
    {
      headerName: 'Tipo de Usuário',
      field: 'role',
      flex: 1,
      minWidth: 120,
      cellRenderer: (params: any) => {
        const roleLabels: Record<string, string> = {
          admin: 'Administrador',
          manager: 'Gerente',
          user: 'Usuário',
        }
        const roleColors: Record<string, string> = {
          admin: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
          manager: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
          user: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
        }
        return (
          <span
            className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${roleColors[params.value] || roleColors.user
              }`}
          >
            {roleLabels[params.value] || params.value}
          </span>
        )
      },
    },
    {
      headerName: 'Perfil de Acesso',
      field: 'profile_name',
      flex: 1.2,
      minWidth: 150,
      cellRenderer: (params: any) => {
        if (!params.value) {
          return (
            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300">
              Não definido
            </span>
          )
        }
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
            <Shield className="w-3 h-3" />
            {params.value}
          </span>
        )
      },
    },
    {
      headerName: 'Status',
      field: 'status',
      flex: 1,
      minWidth: 120,
      cellRenderer: (params: any) => {
        const isActive = params.value === 'active'
        return (
          <span
            className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${isActive
                ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
              }`}
          >
            {isActive ? 'Ativo' : 'Inativo'}
          </span>
        )
      },
    },
    {
      headerName: 'RunRun ID',
      field: 'runrun_user_id',
      flex: 1,
      minWidth: 150,
      cellRenderer: (params: any) => params.value || '-',
    },
    {
      headerName: 'Criado em',
      field: 'created_at',
      flex: 1,
      minWidth: 130,
      cellRenderer: (params: any) => {
        if (!params.value) return '-'
        try {
          const date = new Date(params.value)
          return date.toLocaleDateString('pt-BR')
        } catch {
          return params.value
        }
      },
    },
    {
      headerName: 'Ações',
      field: 'id',
      width: 100,
      cellRenderer: (params: any) => {
        return (
          <div className="flex items-center justify-center h-full">
            {hasPermission('settings.users', 'edit') && (
              <button
                onClick={() => handleEditUser(params.value)}
                className="text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 p-1 rounded hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                title="Editar usuário"
              >
                <Edit className="w-4 h-4" />
              </button>
            )}
          </div>
        )
      },
      sortable: false,
      filter: false,
    },
  ]

  return (
    <div className="h-full flex flex-col space-y-2">
      {/* Card de Filtros */}
      <div className="card p-6 pt-3 pb-3">
        <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center">
          {/* Busca por Nome/Email */}
          <div className="flex-1 min-w-0">
            <input
              type="text"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="Buscar por nome ou email..."
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-orange-500 focus:border-transparent"
            />
          </div>

          {/* Filtro de Perfil */}
          <div className="w-full lg:w-48">
            <select
              value={filterRole}
              onChange={(e) => setFilterRole(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-orange-500 focus:border-transparent"
            >
              <option value="all">Todos os Perfis</option>
              <option value="admin">Administrador</option>
              <option value="manager">Gerente</option>
              <option value="user">Usuário</option>
            </select>
          </div>

          {/* Filtro de Status */}
          <div className="w-full lg:w-48">
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-orange-500 focus:border-transparent"
            >
              <option value="all">Todos os Status</option>
              <option value="active">Ativo</option>
              <option value="inactive">Inativo</option>
            </select>
          </div>

          {/* Botão Novo Usuário */}
          <div className="flex items-end">
            <ProtectedAction screenKey="settings.users" action="create">
              <button
                onClick={handleCreateUser}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-orange-500 rounded-lg hover:bg-orange-600 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Novo Usuário
              </button>
            </ProtectedAction>
          </div>
        </div>

        {/* Cards de Estatísticas */}
        <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {/* Total */}
          <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-2 border border-gray-200 dark:border-gray-600">
            <div className="flex items-center justify-between mb-1">
              <div className="text-xs text-gray-500 dark:text-gray-400">Total</div>
              <UsersIcon className="w-5 h-5 text-gray-500 dark:text-gray-400" />
            </div>
            <div className="text-xl font-bold text-gray-800 dark:text-gray-200">
              {stats.total}
            </div>
          </div>

          {/* Ativos */}
          <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-2 border border-green-200 dark:border-green-800">
            <div className="flex items-center justify-between mb-1">
              <div className="text-xs text-green-600 dark:text-green-400">Ativos</div>
              <UserCheck className="w-5 h-5 text-green-600 dark:text-green-400" />
            </div>
            <div className="text-xl font-bold text-green-700 dark:text-green-300">
              {stats.active}
            </div>
          </div>

          {/* Inativos */}
          <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-2 border border-red-200 dark:border-red-800">
            <div className="flex items-center justify-between mb-1">
              <div className="text-xs text-red-600 dark:text-red-400">Inativos</div>
              <UserX className="w-5 h-5 text-red-600 dark:text-red-400" />
            </div>
            <div className="text-xl font-bold text-red-700 dark:text-red-300">
              {stats.inactive}
            </div>
          </div>

          {/* Administradores */}
          <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-2 border border-purple-200 dark:border-purple-800">
            <div className="flex items-center justify-between mb-1">
              <div className="text-xs text-purple-600 dark:text-purple-400">Admins</div>
              <Shield className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div className="text-xl font-bold text-purple-700 dark:text-purple-300">
              {stats.admins}
            </div>
          </div>

          {/* Gerentes */}
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-2 border border-blue-200 dark:border-blue-800">
            <div className="flex items-center justify-between mb-1">
              <div className="text-xs text-blue-600 dark:text-blue-400">Gerentes</div>
              <Shield className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="text-xl font-bold text-blue-700 dark:text-blue-300">
              {stats.managers}
            </div>
          </div>
        </div>
      </div>

      {/* Card com Tabela */}
      <div className="card p-6 pt-3 flex-1 flex flex-col overflow-hidden">
        {isLoading ? (
          <div className="text-center py-8">
            <p className="text-gray-500 dark:text-gray-400 text-sm">Carregando...</p>
          </div>
        ) : (
          <div className="ag-theme-alpine w-full mt-2 flex-1">
            <AgGridReact
              columnDefs={columnDefs}
              rowData={filteredUsers}
              pagination={false}
              paginationPageSize={10}
              defaultColDef={{
                sortable: true,
                filter: true,
                resizable: true,
              }}
              animateRows={true}
              className="w-full"
              rowHeight={40}
              headerHeight={40}
              overlayNoRowsTemplate={
                '<span class="text-gray-500 dark:text-gray-400">Nenhum usuário encontrado.</span>'
              }
            />
          </div>
        )}
      </div>

      {/* Modal de Usuário */}
      <UserModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false)
          setSelectedUserId(undefined)
        }}
        onSuccess={handleModalSuccess}
        userId={selectedUserId}
      />
    </div>
  )
}

export default Users
