/**
 * Página de Detalhe do Perfil de Acesso
 * 
 * Layout Master-Detail:
 * - Sidebar esquerda: Lista de entidades do sistema
 * - Área direita: Configuração de permissões da entidade selecionada
 *   - Tabs para subtabs da entidade
 *   - Checkboxes para cada ação
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { 
  Shield, ArrowLeft, Save, X, CheckCircle, XCircle, Check,
  LayoutDashboard, Users, FolderKanban, CalendarDays, ClipboardList,
  FileCheck, Database, UserCog, Bell
} from 'lucide-react'
import { createPortal } from 'react-dom'
import apiClient from '../lib/apiClient'
import { ENTITIES_CONFIG, Entity, Subtab, Action } from '../constants/permissions'

// =====================================================
// TYPES
// =====================================================

interface AccessProfile {
  id: number
  name: string
  description: string | null
  is_system: boolean
  is_active: boolean
}

interface Permission {
  id?: number
  profile_id: number
  screen_key: string
  action: string
  allowed: boolean
}

interface PermissionMap {
  [screenKey: string]: {
    [action: string]: boolean
  }
}

// =====================================================
// ICON MAPPING
// =====================================================

const iconMap: Record<string, React.ReactNode> = {
  LayoutDashboard: <LayoutDashboard className="w-5 h-5" />,
  Users: <Users className="w-5 h-5" />,
  FolderKanban: <FolderKanban className="w-5 h-5" />,
  CalendarDays: <CalendarDays className="w-5 h-5" />,
  ClipboardList: <ClipboardList className="w-5 h-5" />,
  FileCheck: <FileCheck className="w-5 h-5" />,
  Database: <Database className="w-5 h-5" />,
  UserCog: <UserCog className="w-5 h-5" />,
  Shield: <Shield className="w-5 h-5" />,
  Bell: <Bell className="w-5 h-5" />,
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
      setProgress(prev => prev <= 0 ? 0 : prev - 1)
    }, 100)
  }, [progress, onClose, clearTimers])

  useEffect(() => {
    if (!isHovered) startTimers()
    else clearTimers()
    return () => clearTimers()
  }, [isHovered, startTimers, clearTimers])

  useEffect(() => {
    startTimers()
    return () => clearTimers()
  }, [])

  const toastContent = (
    <div 
      className={`fixed z-[9999] rounded-xl shadow-2xl border ${
        type === 'success' 
          ? 'bg-gradient-to-r from-green-50 to-green-100 border-green-200 text-green-800' 
          : 'bg-gradient-to-r from-red-50 to-red-100 border-red-200 text-red-800'
      } max-w-md overflow-hidden`}
      style={{ position: 'fixed', top: '4rem', right: '1rem', zIndex: 9999 }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className={`h-1 ${type === 'success' ? 'bg-green-500' : 'bg-red-500'}`} 
        style={{ width: `${progress}%` }} />
      <div className="flex items-center gap-3 px-5 py-4">
        <div className={`flex items-center justify-center w-8 h-8 rounded-full ${
          type === 'success' ? 'bg-green-500' : 'bg-red-500'
        }`}>
          {type === 'success' ? <CheckCircle className="w-5 h-5 text-white" /> : <XCircle className="w-5 h-5 text-white" />}
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold">{type === 'success' ? 'Sucesso!' : 'Erro!'}</p>
          <p className="text-xs opacity-90">{message}</p>
        </div>
        <button onClick={onClose} className={`p-1 rounded-full ${
          type === 'success' ? 'hover:bg-green-200' : 'hover:bg-red-200'
        }`}>
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  )

  return createPortal(toastContent, document.body)
}

// =====================================================
// ENTITY SIDEBAR ITEM
// =====================================================

interface EntitySidebarItemProps {
  entity: Entity
  isSelected: boolean
  onClick: () => void
  permissionCount: { allowed: number; total: number }
}

const EntitySidebarItem = ({ entity, isSelected, onClick, permissionCount }: EntitySidebarItemProps) => {
  const allAllowed = permissionCount.allowed === permissionCount.total && permissionCount.total > 0
  const someAllowed = permissionCount.allowed > 0 && permissionCount.allowed < permissionCount.total
  
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all text-left ${
        isSelected 
          ? 'bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-md' 
          : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
      }`}
    >
      <div className={`${isSelected ? 'text-white' : 'text-gray-500 dark:text-gray-400'}`}>
        {iconMap[entity.icon] || <Shield className="w-5 h-5" />}
      </div>
      <div className="flex-1 min-w-0">
        <p className={`font-medium truncate ${isSelected ? 'text-white' : ''}`}>
          {entity.label}
        </p>
        <p className={`text-xs truncate ${isSelected ? 'text-white/70' : 'text-gray-500 dark:text-gray-400'}`}>
          {permissionCount.allowed}/{permissionCount.total} permissões
        </p>
      </div>
      {allAllowed && (
        <div className={`p-1 rounded-full ${isSelected ? 'bg-white/20' : 'bg-green-100 dark:bg-green-900/30'}`}>
          <Check className={`w-3 h-3 ${isSelected ? 'text-white' : 'text-green-600 dark:text-green-400'}`} />
        </div>
      )}
      {someAllowed && (
        <div className={`w-2 h-2 rounded-full ${isSelected ? 'bg-white/50' : 'bg-yellow-500'}`} />
      )}
    </button>
  )
}

// =====================================================
// PERMISSION CHECKBOX
// =====================================================

interface PermissionCheckboxProps {
  action: Action
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
}

const PermissionCheckbox = ({ action, checked, onChange, disabled }: PermissionCheckboxProps) => {
  return (
    <label className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${
      disabled 
        ? 'opacity-50 cursor-not-allowed border-gray-200 dark:border-gray-700' 
        : checked 
          ? 'border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-900/20 cursor-pointer' 
          : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 cursor-pointer'
    }`}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
        className="w-5 h-5 rounded border-gray-300 text-green-500 focus:ring-green-500 focus:ring-offset-0"
      />
      <div>
        <p className="font-medium text-gray-900 dark:text-white">{action.label}</p>
        <p className="text-xs text-gray-500 dark:text-gray-400">{action.description}</p>
      </div>
    </label>
  )
}

// =====================================================
// COMPONENTE PRINCIPAL
// =====================================================

export default function AccessProfileDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  
  const [profile, setProfile] = useState<AccessProfile | null>(null)
  const [permissions, setPermissions] = useState<PermissionMap>({})
  const [originalPermissions, setOriginalPermissions] = useState<PermissionMap>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  
  const [selectedEntity, setSelectedEntity] = useState<Entity | null>(null)
  const [selectedSubtabKey, setSelectedSubtabKey] = useState<string | null>(null)
  const [hasChanges, setHasChanges] = useState(false)

  // =====================================================
  // DATA FETCHING
  // =====================================================

  const fetchProfile = useCallback(async () => {
    if (!id) return

    setLoading(true)
    try {
      // Fetch profile
      const profileResponse = await apiClient.get(`/api/access-profiles/${id}`)
      if (!profileResponse.success) {
        setNotification({ type: 'error', message: profileResponse.error?.message || 'Erro ao carregar perfil' })
        return
      }
      setProfile(profileResponse.data)

      // Fetch permissions
      const permResponse = await apiClient.get(`/api/access-profiles/${id}/permissions`)
      if (!permResponse.success) {
        setNotification({ type: 'error', message: permResponse.error?.message || 'Erro ao carregar permissões' })
        return
      }

      // Convert to map
      const permMap: PermissionMap = {}
      
      // Initialize all entities and actions as false
      ENTITIES_CONFIG.forEach(entity => {
        permMap[entity.key] = {}
        entity.actions.forEach(action => {
          permMap[entity.key][action.key] = false
        })
        entity.subtabs.forEach(subtab => {
          permMap[subtab.key] = {}
          subtab.actions.forEach(action => {
            permMap[subtab.key][action.key] = false
          })
        })
      })

      // Set allowed permissions
      if (!permResponse.data.isSystemProfile) {
        permResponse.data.permissions.forEach((p: Permission) => {
          if (!permMap[p.screen_key]) {
            permMap[p.screen_key] = {}
          }
          permMap[p.screen_key][p.action] = p.allowed
        })
      }

      setPermissions(permMap)
      setOriginalPermissions(JSON.parse(JSON.stringify(permMap)))

      // Select first entity
      if (ENTITIES_CONFIG.length > 0) {
        setSelectedEntity(ENTITIES_CONFIG[0])
        if (ENTITIES_CONFIG[0].subtabs.length > 0) {
          setSelectedSubtabKey(ENTITIES_CONFIG[0].subtabs[0].key)
        }
      }
    } catch (err: any) {
      setNotification({ type: 'error', message: err.message || 'Erro ao carregar dados' })
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    fetchProfile()
  }, [fetchProfile])

  // Check for changes
  useEffect(() => {
    const changed = JSON.stringify(permissions) !== JSON.stringify(originalPermissions)
    setHasChanges(changed)
  }, [permissions, originalPermissions])

  // =====================================================
  // HANDLERS
  // =====================================================

  const handlePermissionChange = (screenKey: string, actionKey: string, allowed: boolean) => {
    setPermissions(prev => ({
      ...prev,
      [screenKey]: {
        ...prev[screenKey],
        [actionKey]: allowed
      }
    }))
  }

  const handleToggleAll = (screenKey: string, actions: Action[], allow: boolean) => {
    const updates: { [action: string]: boolean } = {}
    actions.forEach(action => {
      updates[action.key] = allow
    })
    
    setPermissions(prev => ({
      ...prev,
      [screenKey]: {
        ...prev[screenKey],
        ...updates
      }
    }))
  }

  const handleToggleEntity = (entity: Entity, allow: boolean) => {
    const updates: PermissionMap = { ...permissions }
    
    // Toggle entity actions
    updates[entity.key] = {}
    entity.actions.forEach(action => {
      updates[entity.key][action.key] = allow
    })
    
    // Toggle all subtabs
    entity.subtabs.forEach(subtab => {
      updates[subtab.key] = {}
      subtab.actions.forEach(action => {
        updates[subtab.key][action.key] = allow
      })
    })
    
    setPermissions(updates)
  }

  const handleSave = async () => {
    if (!id || profile?.is_system) return

    setSaving(true)
    try {
      // Convert map to array
      const permArray: Array<{ screen_key: string; action: string; allowed: boolean }> = []
      
      Object.entries(permissions).forEach(([screenKey, actions]) => {
        Object.entries(actions).forEach(([action, allowed]) => {
          permArray.push({ screen_key: screenKey, action, allowed })
        })
      })

      const response = await apiClient.put(`/api/access-profiles/${id}/permissions`, {
        permissions: permArray
      })

      if (response.success) {
        setNotification({ type: 'success', message: 'Permissões salvas com sucesso!' })
        setOriginalPermissions(JSON.parse(JSON.stringify(permissions)))
      } else {
        setNotification({ type: 'error', message: response.error?.message || 'Erro ao salvar permissões' })
      }
    } catch (err: any) {
      setNotification({ type: 'error', message: err.message || 'Erro ao salvar' })
    } finally {
      setSaving(false)
    }
  }

  const handleSelectEntity = (entity: Entity) => {
    setSelectedEntity(entity)
    if (entity.subtabs.length > 0) {
      setSelectedSubtabKey(entity.subtabs[0].key)
    } else {
      setSelectedSubtabKey(null)
    }
  }

  // =====================================================
  // HELPERS
  // =====================================================

  const getEntityPermissionCount = (entity: Entity) => {
    let allowed = 0
    let total = 0

    // Count entity actions
    entity.actions.forEach(action => {
      total++
      if (permissions[entity.key]?.[action.key]) allowed++
    })

    // Count subtab actions
    entity.subtabs.forEach(subtab => {
      subtab.actions.forEach(action => {
        total++
        if (permissions[subtab.key]?.[action.key]) allowed++
      })
    })

    return { allowed, total }
  }

  const getScreenPermissionCount = (screenKey: string, actions: Action[]) => {
    let allowed = 0
    actions.forEach(action => {
      if (permissions[screenKey]?.[action.key]) allowed++
    })
    return { allowed, total: actions.length }
  }

  // =====================================================
  // RENDER
  // =====================================================

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-4">
        <p className="text-gray-500 dark:text-gray-400">Perfil não encontrado</p>
        <button
          onClick={() => navigate('/access-profiles')}
          className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600"
        >
          Voltar para lista
        </button>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col space-y-2 overflow-hidden">
      {/* Botão Voltar - fora do card */}
      <button
        onClick={() => navigate('/access-profiles')}
        className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Voltar
      </button>

      {/* Card com informações do perfil */}
      <div className="card p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gray-100 dark:bg-gray-700 rounded-lg">
              <Shield className="w-6 h-6 text-gray-600 dark:text-gray-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                  {profile.name}
                </h1>
                {profile.is_system && (
                  <span className="px-2 py-1 rounded-full text-xs font-medium bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300">
                    Sistema
                  </span>
                )}
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                  profile.is_active
                    ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                    : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                }`}>
                  {profile.is_active ? 'Ativo' : 'Inativo'}
                </span>
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {profile.description || 'Configure as permissões deste perfil'}
              </p>
            </div>
          </div>

          {!profile.is_system && (
            <button
              onClick={handleSave}
              disabled={saving || !hasChanges}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                hasChanges 
                  ? 'bg-green-500 text-white hover:bg-green-600' 
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed'
              }`}
            >
              <Save className="w-4 h-4" />
              {saving ? 'Salvando...' : 'Salvar Alterações'}
            </button>
          )}
        </div>
      </div>

      {/* System profile warning */}
      {profile.is_system && (
        <div className="p-3 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg">
          <p className="text-purple-700 dark:text-purple-300 text-sm">
            <strong>Perfil de Sistema:</strong> Este perfil tem acesso total e suas permissões não podem ser modificadas.
          </p>
        </div>
      )}

      {/* Main content - Master Detail */}
      <div className="card flex-1 flex gap-4 min-h-0 p-4 overflow-hidden">
        {/* Sidebar - Entity List */}
        <div className="w-64 flex-shrink-0 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden flex flex-col">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="font-semibold text-gray-900 dark:text-white">Entidades</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">Selecione para configurar</p>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {ENTITIES_CONFIG.map(entity => (
              <EntitySidebarItem
                key={entity.key}
                entity={entity}
                isSelected={selectedEntity?.key === entity.key}
                onClick={() => handleSelectEntity(entity)}
                permissionCount={getEntityPermissionCount(entity)}
              />
            ))}
          </div>
        </div>

        {/* Detail Panel */}
        <div className="flex-1 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden flex flex-col">
          {selectedEntity ? (
            <>
              {/* Entity Header */}
              <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-gray-100 dark:bg-gray-700 rounded-lg text-gray-600 dark:text-gray-400">
                      {iconMap[selectedEntity.icon] || <Shield className="w-5 h-5" />}
                    </div>
                    <div>
                      <h2 className="font-semibold text-gray-900 dark:text-white">{selectedEntity.label}</h2>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{selectedEntity.description}</p>
                    </div>
                  </div>
                  {!profile.is_system && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleToggleEntity(selectedEntity, true)}
                        className="px-3 py-1.5 text-xs font-medium text-green-700 bg-green-100 dark:bg-green-900/30 dark:text-green-300 rounded-lg hover:bg-green-200 dark:hover:bg-green-900/50 transition-colors"
                      >
                        Permitir Todos
                      </button>
                      <button
                        onClick={() => handleToggleEntity(selectedEntity, false)}
                        className="px-3 py-1.5 text-xs font-medium text-red-700 bg-red-100 dark:bg-red-900/30 dark:text-red-300 rounded-lg hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors"
                      >
                        Negar Todos
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Tabs for subtabs */}
              {selectedEntity.subtabs.length > 0 && (
                <div className="border-b border-gray-200 dark:border-gray-700">
                  <nav className="flex -mb-px px-4">
                    {/* Entity root tab */}
                    <button
                      onClick={() => setSelectedSubtabKey(null)}
                      className={`whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm mr-8 ${
                        selectedSubtabKey === null
                          ? 'border-primary-500 text-primary-600'
                          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                      }`}
                    >
                      Geral
                      <span className="ml-2 text-xs text-gray-400">
                        ({getScreenPermissionCount(selectedEntity.key, selectedEntity.actions).allowed}/{selectedEntity.actions.length})
                      </span>
                    </button>
                    
                    {/* Subtab tabs */}
                    {selectedEntity.subtabs.map(subtab => {
                      const count = getScreenPermissionCount(subtab.key, subtab.actions)
                      return (
                        <button
                          key={subtab.key}
                          onClick={() => setSelectedSubtabKey(subtab.key)}
                          className={`whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm mr-8 ${
                            selectedSubtabKey === subtab.key
                              ? 'border-primary-500 text-primary-600'
                              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                          }`}
                        >
                          {subtab.label}
                          <span className="ml-2 text-xs text-gray-400">
                            ({count.allowed}/{count.total})
                          </span>
                        </button>
                      )
                    })}
                  </nav>
                </div>
              )}

              {/* Permissions Grid */}
              <div className="flex-1 overflow-y-auto p-4">
                {(() => {
                  const currentScreenKey = selectedSubtabKey || selectedEntity.key
                  const currentActions = selectedSubtabKey 
                    ? selectedEntity.subtabs.find(s => s.key === selectedSubtabKey)?.actions || []
                    : selectedEntity.actions

                  if (currentActions.length === 0) {
                    return (
                      <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                        Nenhuma ação disponível para esta seção
                      </div>
                    )
                  }

                  return (
                    <>
                      {/* Toggle all for current screen */}
                      {!profile.is_system && (
                        <div className="flex justify-end gap-2 mb-4">
                          <button
                            onClick={() => handleToggleAll(currentScreenKey, currentActions, true)}
                            className="px-3 py-1.5 text-xs font-medium text-green-700 bg-green-100 dark:bg-green-900/30 dark:text-green-300 rounded-lg hover:bg-green-200 dark:hover:bg-green-900/50 transition-colors"
                          >
                            Permitir Todos
                          </button>
                          <button
                            onClick={() => handleToggleAll(currentScreenKey, currentActions, false)}
                            className="px-3 py-1.5 text-xs font-medium text-red-700 bg-red-100 dark:bg-red-900/30 dark:text-red-300 rounded-lg hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors"
                          >
                            Negar Todos
                          </button>
                        </div>
                      )}

                      {/* Actions grid */}
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {currentActions.map(action => (
                          <PermissionCheckbox
                            key={action.key}
                            action={action}
                            checked={profile.is_system ? true : (permissions[currentScreenKey]?.[action.key] || false)}
                            onChange={(checked) => handlePermissionChange(currentScreenKey, action.key, checked)}
                            disabled={profile.is_system}
                          />
                        ))}
                      </div>
                    </>
                  )
                })()}
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-500 dark:text-gray-400">
              Selecione uma entidade para configurar
            </div>
          )}
        </div>
      </div>

      {/* Unsaved changes warning */}
      {hasChanges && !profile.is_system && (
        <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg flex items-center justify-between">
          <p className="text-yellow-700 dark:text-yellow-300 text-sm">
            Você tem alterações não salvas
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => {
                setPermissions(JSON.parse(JSON.stringify(originalPermissions)))
              }}
              className="px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
            >
              Descartar
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-3 py-1.5 text-sm font-medium text-white bg-green-500 rounded-lg hover:bg-green-600 transition-colors"
            >
              {saving ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </div>
      )}

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
