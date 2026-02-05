/**
 * Página de Listagem de Perfis de Acesso
 * 
 * Exibe lista de perfis com AG-Grid e permite:
 * - Criar novo perfil
 * - Editar perfil existente
 * - Clonar perfil
 * - Excluir perfil (exceto sistema)
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { AgGridReact } from 'ag-grid-react'
import { ColDef, ICellRendererParams, GridReadyEvent } from 'ag-grid-community'
import { Shield, Plus, Copy, Edit2, Trash2, Search, X, CheckCircle, XCircle, Layers, ShieldCheck, ShieldX } from 'lucide-react'
import { createPortal } from 'react-dom'
import apiClient from '../lib/apiClient'

// =====================================================
// TYPES
// =====================================================

interface AccessProfile {
  id: number
  name: string
  description: string | null
  is_system: boolean
  is_active: boolean
  created_at: string
  updated_at: string
}

// =====================================================
// NOTIFICATION TOAST
// =====================================================

const NotificationToast = ({ 
  type, 
  message, 
  onClose 
}: { 
  type: 'success' | 'error'
  message: string
  onClose: () => void 
}) => {
  const [isHovered, setIsHovered] = useState(false)
  const [progress, setProgress] = useState(100)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null)

  const clearTimers = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current)
      progressIntervalRef.current = null
    }
  }, [])

  const startTimers = useCallback(() => {
    clearTimers()
    const remainingTime = (progress / 100) * 10000
    
    timeoutRef.current = setTimeout(() => {
      onClose()
    }, remainingTime)
    
    progressIntervalRef.current = setInterval(() => {
      setProgress(prev => {
        if (prev <= 0) return 0
        return prev - 1
      })
    }, 100)
  }, [progress, onClose, clearTimers])

  useEffect(() => {
    if (!isHovered) {
      startTimers()
    } else {
      clearTimers()
    }
    return () => clearTimers()
  }, [isHovered, startTimers, clearTimers])

  useEffect(() => {
    startTimers()
    return () => clearTimers()
  }, [])

  const toastContent = (
    <div 
      className={`fixed top-4 right-4 z-[9999] rounded-xl shadow-2xl animate-slide-in-from-top border ${
        type === 'success' 
          ? 'bg-gradient-to-r from-green-50 to-green-100 border-green-200 text-green-800' 
          : 'bg-gradient-to-r from-red-50 to-red-100 border-red-200 text-red-800'
      } transform transition-all duration-300 ease-out max-w-md cursor-pointer overflow-hidden`}
      style={{ position: 'fixed', top: '4rem', right: '1rem', zIndex: 9999, pointerEvents: 'auto' }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className={`h-1 transition-all duration-100 ease-linear ${
        type === 'success' ? 'bg-green-500' : 'bg-red-500'
      }`} style={{ width: `${progress}%` }} />
      
      <div className="flex items-center gap-3 px-5 py-4">
        <div className={`flex items-center justify-center w-8 h-8 rounded-full ${
          type === 'success' ? 'bg-green-500' : 'bg-red-500'
        }`}>
          {type === 'success' ? (
            <CheckCircle className="w-5 h-5 text-white" />
          ) : (
            <XCircle className="w-5 h-5 text-white" />
          )}
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold">{type === 'success' ? 'Sucesso!' : 'Erro!'}</p>
          <p className="text-xs opacity-90 whitespace-pre-line">{message}</p>
        </div>
        <button 
          onClick={onClose}
          className={`ml-2 p-1 rounded-full transition-colors ${
            type === 'success' 
              ? 'text-green-400 hover:text-green-600 hover:bg-green-200' 
              : 'text-red-400 hover:text-red-600 hover:bg-red-200'
          }`}
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  )

  return createPortal(toastContent, document.body)
}

// =====================================================
// MODAL DE CRIAÇÃO/CLONE
// =====================================================

interface ProfileModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (name: string, description: string) => Promise<void>
  title: string
  initialName?: string
  initialDescription?: string
}

const ProfileModal = ({ 
  isOpen, 
  onClose, 
  onSave, 
  title,
  initialName = '',
  initialDescription = ''
}: ProfileModalProps) => {
  const [name, setName] = useState(initialName)
  const [description, setDescription] = useState(initialDescription)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen) {
      setName(initialName)
      setDescription(initialDescription)
      setError(null)
    }
  }, [isOpen, initialName, initialDescription])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      setError('Nome é obrigatório')
      return
    }

    setLoading(true)
    setError(null)

    try {
      await onSave(name.trim(), description.trim())
      onClose()
    } catch (err: any) {
      setError(err.message || 'Erro ao salvar perfil')
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-lg w-full">
        <div className="p-5 bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-t-2xl flex items-center justify-between">
          <h2 className="text-xl font-bold">{title}</h2>
          <button
            onClick={onClose}
            className="text-white hover:bg-white/20 rounded-full p-1 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Nome do Perfil: *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-orange-500"
              placeholder="Ex: RH, Gerente, Consultor..."
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Descrição:
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-orange-500 resize-none"
              placeholder="Descrição das responsabilidades deste perfil..."
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-6 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2 text-sm font-medium text-white bg-green-500 rounded-lg hover:bg-green-600 transition-colors disabled:opacity-50"
            >
              {loading ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// =====================================================
// MODAL DE CONFIRMAÇÃO DE EXCLUSÃO
// =====================================================

interface DeleteModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => Promise<void>
  profileName: string
}

const DeleteModal = ({ isOpen, onClose, onConfirm, profileName }: DeleteModalProps) => {
  const [loading, setLoading] = useState(false)

  const handleConfirm = async () => {
    setLoading(true)
    try {
      await onConfirm()
      onClose()
    } catch (err) {
      // Error handled by parent
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full">
        <div className="p-5 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-t-2xl">
          <h2 className="text-xl font-bold">Confirmar Exclusão</h2>
        </div>

        <div className="p-6">
          <p className="text-gray-700 dark:text-gray-300 mb-6">
            Tem certeza que deseja excluir o perfil <strong>"{profileName}"</strong>?
            <br />
            <span className="text-sm text-gray-500 dark:text-gray-400">
              Esta ação não pode ser desfeita.
            </span>
          </p>

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-6 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleConfirm}
              disabled={loading}
              className="px-6 py-2 text-sm font-medium text-white bg-red-500 rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50"
            >
              {loading ? 'Excluindo...' : 'Excluir'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// =====================================================
// COMPONENTE PRINCIPAL
// =====================================================

export default function AccessProfiles() {
  const navigate = useNavigate()
  const gridRef = useRef<AgGridReact>(null)
  
  const [profiles, setProfiles] = useState<AccessProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [searchText, setSearchText] = useState('')
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  
  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showCloneModal, setShowCloneModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [selectedProfile, setSelectedProfile] = useState<AccessProfile | null>(null)

  // =====================================================
  // DATA FETCHING
  // =====================================================

  const fetchProfiles = useCallback(async () => {
    setLoading(true)
    try {
      const response = await apiClient.get('/api/access-profiles')
      if (response.success) {
        setProfiles(response.data)
      } else {
        setNotification({ type: 'error', message: response.error?.message || 'Erro ao carregar perfis' })
      }
    } catch (err: any) {
      setNotification({ type: 'error', message: err.message || 'Erro ao carregar perfis' })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchProfiles()
  }, [fetchProfiles])

  // =====================================================
  // HANDLERS
  // =====================================================

  const handleCreate = async (name: string, description: string) => {
    const response = await apiClient.post('/api/access-profiles', { name, description })
    if (response.success) {
      setNotification({ type: 'success', message: 'Perfil criado com sucesso!' })
      await fetchProfiles()
      // Navega para editar o novo perfil
      navigate(`/access-profiles/${response.data.id}`)
    } else {
      throw new Error(response.error?.message || 'Erro ao criar perfil')
    }
  }

  const handleClone = async (name: string, description: string) => {
    if (!selectedProfile) return

    const response = await apiClient.post(`/api/access-profiles/${selectedProfile.id}/clone`, { 
      name, 
      description 
    })
    if (response.success) {
      setNotification({ type: 'success', message: 'Perfil clonado com sucesso!' })
      await fetchProfiles()
      navigate(`/access-profiles/${response.data.id}`)
    } else {
      throw new Error(response.error?.message || 'Erro ao clonar perfil')
    }
  }

  const handleDelete = async () => {
    if (!selectedProfile) return

    const response = await apiClient.del(`/api/access-profiles/${selectedProfile.id}`)
    if (response.success) {
      setNotification({ type: 'success', message: 'Perfil excluído com sucesso!' })
      await fetchProfiles()
    } else {
      setNotification({ type: 'error', message: response.error?.message || 'Erro ao excluir perfil' })
      throw new Error(response.error?.message)
    }
  }

  const handleEdit = (profile: AccessProfile) => {
    navigate(`/access-profiles/${profile.id}`)
  }

  const handleCloneClick = (profile: AccessProfile) => {
    setSelectedProfile(profile)
    setShowCloneModal(true)
  }

  const handleDeleteClick = (profile: AccessProfile) => {
    setSelectedProfile(profile)
    setShowDeleteModal(true)
  }

  // =====================================================
  // GRID CONFIGURATION
  // =====================================================

  const onGridReady = (params: GridReadyEvent) => {
    params.api.sizeColumnsToFit()
  }

  const ActionsCellRenderer = (params: ICellRendererParams) => {
    const profile = params.data as AccessProfile
    
    return (
      <div className="flex items-center gap-1 h-full">
        <button
          onClick={() => handleEdit(profile)}
          className="p-1.5 text-blue-600 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
          title="Editar"
        >
          <Edit2 className="w-4 h-4" />
        </button>
        <button
          onClick={() => handleCloneClick(profile)}
          className="p-1.5 text-purple-600 hover:bg-purple-100 dark:hover:bg-purple-900/30 rounded-lg transition-colors"
          title="Clonar"
        >
          <Copy className="w-4 h-4" />
        </button>
        {!profile.is_system && (
          <button
            onClick={() => handleDeleteClick(profile)}
            className="p-1.5 text-red-600 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg transition-colors"
            title="Excluir"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>
    )
  }

  const SystemBadgeRenderer = (params: ICellRendererParams) => {
    const isSystem = params.value as boolean
    
    if (isSystem) {
      return (
        <span className="px-2 py-1 rounded-full text-xs font-medium bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300">
          Sistema
        </span>
      )
    }
    return (
      <span className="px-2 py-1 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
        Customizado
      </span>
    )
  }

  const StatusBadgeRenderer = (params: ICellRendererParams) => {
    const isActive = params.value as boolean
    
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
        isActive 
          ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
          : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
      }`}>
        {isActive ? 'Ativo' : 'Inativo'}
      </span>
    )
  }

  const columnDefs: ColDef[] = [
    { 
      field: 'name', 
      headerName: 'Nome', 
      flex: 1,
      minWidth: 150,
      filter: true,
      sortable: true 
    },
    { 
      field: 'description', 
      headerName: 'Descrição', 
      flex: 2,
      minWidth: 200,
      filter: true,
      valueFormatter: (params) => params.value || '—'
    },
    { 
      field: 'is_system', 
      headerName: 'Tipo', 
      width: 120,
      cellRenderer: SystemBadgeRenderer,
      filter: true
    },
    { 
      field: 'is_active', 
      headerName: 'Status', 
      width: 100,
      cellRenderer: StatusBadgeRenderer,
      filter: true
    },
    { 
      field: 'actions', 
      headerName: 'Ações', 
      width: 130,
      cellRenderer: ActionsCellRenderer,
      sortable: false,
      filter: false,
      resizable: false
    }
  ]

  const defaultColDef: ColDef = {
    sortable: true,
    filter: true,
    resizable: true
  }

  // Filter based on search
  const filteredProfiles = profiles.filter(profile => 
    profile.name.toLowerCase().includes(searchText.toLowerCase()) ||
    (profile.description || '').toLowerCase().includes(searchText.toLowerCase())
  )

  // Estatísticas totais
  const totalStats = {
    total: profiles.length,
    active: profiles.filter(p => p.is_active).length,
    inactive: profiles.filter(p => !p.is_active).length
  }

  // =====================================================
  // RENDER
  // =====================================================

  return (
    <div className="h-full flex flex-col space-y-2">
      {/* Card de Filtros */}
      <div className="card p-6 pt-3 pb-3">
        <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center">
          {/* Busca */}
          <div className="flex-1 min-w-0">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                placeholder="Buscar por nome ou descrição..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-orange-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Botão Novo Perfil */}
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-orange-500 rounded-lg hover:bg-orange-600 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Novo Perfil
          </button>
        </div>

        {/* Cards de Estatísticas */}
        <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-3">
          {/* Total */}
          <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-2 border border-gray-200 dark:border-gray-600">
            <div className="flex items-center justify-between mb-1">
              <div className="text-xs text-gray-500 dark:text-gray-400">Total</div>
              <Layers className="w-4 h-4 text-gray-500 dark:text-gray-400" />
            </div>
            <div className="text-lg font-bold text-gray-800 dark:text-gray-200">{totalStats.total}</div>
          </div>

          {/* Ativos */}
          <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-2 border border-green-200 dark:border-green-800">
            <div className="flex items-center justify-between mb-1">
              <div className="text-xs text-green-600 dark:text-green-400">Ativos</div>
              <ShieldCheck className="w-4 h-4 text-green-600 dark:text-green-400" />
            </div>
            <div className="text-lg font-bold text-green-700 dark:text-green-300">{totalStats.active}</div>
          </div>

          {/* Inativos */}
          <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-2 border border-red-200 dark:border-red-800">
            <div className="flex items-center justify-between mb-1">
              <div className="text-xs text-red-600 dark:text-red-400">Inativos</div>
              <ShieldX className="w-4 h-4 text-red-600 dark:text-red-400" />
            </div>
            <div className="text-lg font-bold text-red-700 dark:text-red-300">{totalStats.inactive}</div>
          </div>
        </div>
      </div>

      {/* Card com Tabela */}
      <div className="card p-6 pt-3 flex-1 flex flex-col overflow-hidden">
        <div className="ag-theme-alpine w-full flex-1">
          <AgGridReact
            ref={gridRef}
            rowData={filteredProfiles}
            columnDefs={columnDefs}
            defaultColDef={defaultColDef}
            onGridReady={onGridReady}
            animateRows={true}
            rowSelection="single"
            suppressCellFocus={true}
            overlayLoadingTemplate='<span class="ag-overlay-loading-center">Carregando perfis...</span>'
            overlayNoRowsTemplate='<span class="ag-overlay-no-rows-center">Nenhum perfil encontrado</span>'
            loading={loading}
            rowHeight={48}
            headerHeight={48}
          />
        </div>
      </div>

      {/* Modals */}
      <ProfileModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSave={handleCreate}
        title="Novo Perfil de Acesso"
      />

      <ProfileModal
        isOpen={showCloneModal}
        onClose={() => {
          setShowCloneModal(false)
          setSelectedProfile(null)
        }}
        onSave={handleClone}
        title={`Clonar Perfil: ${selectedProfile?.name || ''}`}
        initialName={selectedProfile ? `${selectedProfile.name} (Cópia)` : ''}
        initialDescription={selectedProfile?.description || ''}
      />

      <DeleteModal
        isOpen={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false)
          setSelectedProfile(null)
        }}
        onConfirm={handleDelete}
        profileName={selectedProfile?.name || ''}
      />

      {/* Notification Toast */}
      {notification && (
        <NotificationToast
          type={notification.type}
          message={notification.message}
          onClose={() => setNotification(null)}
        />
      )}
    </div>
  )
}
