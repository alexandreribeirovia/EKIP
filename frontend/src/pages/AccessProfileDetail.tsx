/**
 * Página de Detalhe do Perfil de Acesso
 * 
 * Layout Master-Detail com hierarquia de 3 níveis:
 * - NÍVEL 1: Entidades (Dashboard, Funcionários, Projetos, etc.)
 * - NÍVEL 2: SubEntidades (páginas de menu OU páginas de detalhe)
 * - NÍVEL 3: Tabs (abas dentro das páginas de detalhe)
 * 
 * Estrutura visual:
 * - Sidebar esquerda: Lista colapsável de entidades → sub-entidades → tabs
 * - Área direita: Configuração de ações CRUD do item selecionado
 * 
 * Comportamento:
 * - Desabilitar entidade = desabilita todas sub-entidades e tabs
 * - Desabilitar sub-entidade de detalhe = desabilita todas tabs
 * - Habilitar item = view marcado por padrão
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { 
  Shield, ArrowLeft, Save, X, CheckCircle, XCircle,
  LayoutDashboard, Users, ClipboardList, CalendarRange, Settings,
  Clock, MessageSquare, FileCheck, Target, HelpCircle,
  ClipboardCheck, Database, ChevronDown, ChevronRight,
  User, FolderOpen, TrendingUp, Key, AlertTriangle, BarChart
} from 'lucide-react'
import { createPortal } from 'react-dom'
import apiClient from '../lib/apiClient'
import { ENTITIES_CONFIG, Entity, SubEntity, Action, TabEntity } from '../constants/permissions'
import { AccessProfile, EnabledMap, PermissionMap } from '../types'

// =====================================================
// ICON MAPPING
// =====================================================

const getIcon = (iconName: string, size: 'sm' | 'md' = 'md') => {
  const sizeClass = size === 'sm' ? 'w-4 h-4' : 'w-5 h-5'
  const icons: Record<string, React.ElementType> = {
    LayoutDashboard, Users, ClipboardList, CalendarRange, Settings,
    Clock, MessageSquare, FileCheck, Target, HelpCircle,
    ClipboardCheck, Database, Shield, User, FolderOpen,
    TrendingUp, Key, AlertTriangle, BarChart
  }
  const IconComponent = icons[iconName] || Shield
  return <IconComponent className={sizeClass} />
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
// TOGGLE SWITCH COMPONENT
// =====================================================

interface ToggleSwitchProps {
  enabled: boolean
  onChange: (enabled: boolean) => void
  disabled?: boolean
  size?: 'sm' | 'md'
}

const ToggleSwitch = ({ enabled, onChange, disabled, size = 'md' }: ToggleSwitchProps) => {
  const sizeClasses = size === 'sm' 
    ? 'w-8 h-4' 
    : 'w-10 h-5'
  const dotSizeClasses = size === 'sm'
    ? 'w-3 h-3'
    : 'w-4 h-4'
  const translateClass = size === 'sm'
    ? 'translate-x-4'
    : 'translate-x-5'

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        if (!disabled) onChange(!enabled)
      }}
      disabled={disabled}
      className={`relative inline-flex items-center rounded-full transition-colors ${sizeClasses} ${
        disabled 
          ? 'opacity-50 cursor-not-allowed' 
          : 'cursor-pointer'
      } ${
        enabled 
          ? 'bg-green-500' 
          : 'bg-gray-300 dark:bg-gray-600'
      }`}
    >
      <span
        className={`inline-block ${dotSizeClasses} transform rounded-full bg-white shadow transition-transform ${
          enabled ? translateClass : 'translate-x-0.5'
        }`}
      />
    </button>
  )
}

// =====================================================
// ENTITY ACCORDION ITEM (NÍVEL 1)
// =====================================================

interface EntityAccordionItemProps {
  entity: Entity
  isExpanded: boolean
  onToggleExpand: () => void
  enabled: EnabledMap
  onToggleEntity: (entityKey: string, enabled: boolean) => void
  onToggleSubEntity: (subKey: string, enabled: boolean) => void
  onToggleTab: (tabKey: string, enabled: boolean) => void
  isSystemProfile: boolean
  selectedKey: string | null
  onSelectItem: (key: string, type: 'entity' | 'subentity' | 'tab') => void
  expandedSubEntities: Set<string>
  onToggleExpandSubEntity: (subKey: string) => void
}

const EntityAccordionItem = ({ 
  entity, 
  isExpanded, 
  onToggleExpand,
  enabled,
  onToggleEntity,
  onToggleSubEntity,
  onToggleTab,
  isSystemProfile,
  selectedKey,
  onSelectItem,
  expandedSubEntities,
  onToggleExpandSubEntity
}: EntityAccordionItemProps) => {
  const entityEnabled = enabled[entity.key] ?? true
  const hasSubEntities = entity.subEntities.length > 0
  
  // Separar sub-entidades de menu das páginas de detalhe
  const menuSubEntities = entity.subEntities.filter(s => !s.isDetailPage)
  const detailSubEntities = entity.subEntities.filter(s => s.isDetailPage)
  
  const enabledSubCount = entity.subEntities.filter(s => enabled[s.key] ?? true).length

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
      {/* Entity Header (Nível 1) */}
      <div 
        className={`flex items-center gap-2 px-3 py-2 ${
          entityEnabled
            ? 'bg-white dark:bg-gray-800' 
            : 'bg-gray-50 dark:bg-gray-900 opacity-60'
        }`}
      >
        {/* Expand/Collapse button */}
        {hasSubEntities ? (
          <button
            onClick={onToggleExpand}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
          >
            {isExpanded 
              ? <ChevronDown className="w-4 h-4 text-gray-500" />
              : <ChevronRight className="w-4 h-4 text-gray-500" />
            }
          </button>
        ) : (
          <div className="w-6" />
        )}

        {/* Icon */}
        <div className={`${entityEnabled ? 'text-gray-600 dark:text-gray-400' : 'text-gray-400 dark:text-gray-600'}`}>
          {getIcon(entity.icon)}
        </div>

        {/* Label */}
        <div 
          className="flex-1 cursor-pointer"
          onClick={() => {
            if (!hasSubEntities && entityEnabled) {
              onSelectItem(entity.key, 'entity')
            } else {
              onToggleExpand()
            }
          }}
        >
          <p className={`font-medium text-sm ${
            entityEnabled ? 'text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-500'
          }`}>
            {entity.label}
          </p>
          {hasSubEntities && (
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {enabledSubCount}/{entity.subEntities.length} habilitadas
            </p>
          )}
        </div>

        {/* Toggle Switch */}
        <ToggleSwitch
          enabled={entityEnabled}
          onChange={(val) => onToggleEntity(entity.key, val)}
          disabled={isSystemProfile}
        />
      </div>

      {/* Sub-entities (Nível 2) */}
      {hasSubEntities && isExpanded && (
        <div className="border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
          {/* Páginas de detalhe primeiro (ex: Detalhes do Funcionário) */}
          {detailSubEntities.map(subEntity => {
            const subEnabled = enabled[subEntity.key] ?? true
            const isSelected = selectedKey === subEntity.key
            const isSubExpanded = expandedSubEntities.has(subEntity.key)
            const hasTabs = subEntity.tabs && subEntity.tabs.length > 0
            const enabledTabsCount = hasTabs 
              ? subEntity.tabs!.filter(t => enabled[t.key] ?? true).length 
              : 0
            
            return (
              <div key={subEntity.key}>
                {/* Sub-entity header */}
                <div 
                  className={`flex items-center gap-2 px-3 py-2 pl-8 border-b border-gray-200 dark:border-gray-700 ${
                    isSelected 
                      ? 'bg-orange-50 dark:bg-orange-900/20 border-l-2 border-l-orange-500' 
                      : 'hover:bg-gray-100 dark:hover:bg-gray-800'
                  } ${!subEnabled ? 'opacity-60' : ''}`}
                >
                  {/* Expand/Collapse for tabs */}
                  {hasTabs ? (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        onToggleExpandSubEntity(subEntity.key)
                      }}
                      className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-colors"
                    >
                      {isSubExpanded 
                        ? <ChevronDown className="w-3 h-3 text-gray-500" />
                        : <ChevronRight className="w-3 h-3 text-gray-500" />
                      }
                    </button>
                  ) : (
                    <div className="w-5" />
                  )}

                  {/* Icon */}
                  <div className={`${subEnabled ? 'text-orange-500 dark:text-orange-400' : 'text-gray-400 dark:text-gray-600'}`}>
                    {getIcon(subEntity.icon, 'sm')}
                  </div>

                  {/* Label */}
                  <div 
                    className="flex-1 cursor-pointer"
                    onClick={() => {
                      if (subEnabled) {
                        onSelectItem(subEntity.key, 'subentity')
                        if (hasTabs && !isSubExpanded) {
                          onToggleExpandSubEntity(subEntity.key)
                        }
                      }
                    }}
                  >
                    <span className={`text-sm font-medium ${
                      subEnabled ? 'text-gray-700 dark:text-gray-300' : 'text-gray-400 dark:text-gray-600'
                    }`}>
                      {subEntity.label}
                    </span>
                    {hasTabs && (
                      <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">
                        ({enabledTabsCount}/{subEntity.tabs!.length} abas)
                      </span>
                    )}
                    <span className="ml-2 px-1.5 py-0.5 text-xs rounded bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300">
                      Detalhe
                    </span>
                  </div>

                  {/* Toggle */}
                  <ToggleSwitch
                    enabled={subEnabled}
                    onChange={(val) => onToggleSubEntity(subEntity.key, val)}
                    disabled={isSystemProfile || !entityEnabled}
                    size="sm"
                  />
                </div>

                {/* Tabs (Nível 3) */}
                {hasTabs && isSubExpanded && subEnabled && (
                  <div className="bg-gray-100 dark:bg-gray-800">
                    {subEntity.tabs!.map(tab => {
                      const tabEnabled = enabled[tab.key] ?? true
                      const isTabSelected = selectedKey === tab.key
                      
                      return (
                        <div 
                          key={tab.key}
                          className={`flex items-center gap-2 px-3 py-1.5 pl-16 border-b border-gray-200 dark:border-gray-700 cursor-pointer transition-colors ${
                            isTabSelected 
                              ? 'bg-orange-100 dark:bg-orange-900/30 border-l-2 border-l-orange-500' 
                              : 'hover:bg-gray-200 dark:hover:bg-gray-700'
                          } ${!tabEnabled ? 'opacity-60' : ''}`}
                          onClick={() => tabEnabled && onSelectItem(tab.key, 'tab')}
                        >
                          {/* Icon */}
                          <div className={`${tabEnabled ? 'text-gray-500 dark:text-gray-400' : 'text-gray-400 dark:text-gray-600'}`}>
                            {getIcon(tab.icon, 'sm')}
                          </div>

                          {/* Label */}
                          <span className={`flex-1 text-xs ${
                            tabEnabled ? 'text-gray-600 dark:text-gray-300' : 'text-gray-400 dark:text-gray-600'
                          }`}>
                            {tab.label}
                          </span>

                          {/* Toggle */}
                          <ToggleSwitch
                            enabled={tabEnabled}
                            onChange={(val) => onToggleTab(tab.key, val)}
                            disabled={isSystemProfile || !subEnabled}
                            size="sm"
                          />
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}

          {/* Sub-entidades de menu (itens normais) */}
          {menuSubEntities.map(subEntity => {
            const subEnabled = enabled[subEntity.key] ?? true
            const isSelected = selectedKey === subEntity.key
            
            return (
              <div 
                key={subEntity.key}
                className={`flex items-center gap-2 px-3 py-2 pl-10 border-b last:border-b-0 border-gray-200 dark:border-gray-700 cursor-pointer transition-colors ${
                  isSelected 
                    ? 'bg-orange-50 dark:bg-orange-900/20 border-l-2 border-l-orange-500' 
                    : 'hover:bg-gray-100 dark:hover:bg-gray-800'
                } ${!subEnabled ? 'opacity-60' : ''}`}
                onClick={() => subEnabled && onSelectItem(subEntity.key, 'subentity')}
              >
                {/* Icon */}
                <div className={`${subEnabled ? 'text-gray-500 dark:text-gray-400' : 'text-gray-400 dark:text-gray-600'}`}>
                  {getIcon(subEntity.icon, 'sm')}
                </div>

                {/* Label */}
                <span className={`flex-1 text-sm ${
                  subEnabled ? 'text-gray-700 dark:text-gray-300' : 'text-gray-400 dark:text-gray-600'
                }`}>
                  {subEntity.label}
                </span>

                {/* Toggle */}
                <ToggleSwitch
                  enabled={subEnabled}
                  onChange={(val) => onToggleSubEntity(subEntity.key, val)}
                  disabled={isSystemProfile || !entityEnabled}
                  size="sm"
                />
              </div>
            )
          })}
        </div>
      )}
    </div>
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
// PERMISSION INTERFACE
// =====================================================

interface Permission {
  screen_key: string
  action: string
  allowed: boolean
}

// =====================================================
// COMPONENTE PRINCIPAL
// =====================================================

export default function AccessProfileDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  
  // Profile data
  const [profile, setProfile] = useState<AccessProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  
  // Permissions state (separated: enabled map + actions map)
  const [enabled, setEnabled] = useState<EnabledMap>({})
  const [actions, setActions] = useState<PermissionMap>({})
  const [originalEnabled, setOriginalEnabled] = useState<EnabledMap>({})
  const [originalActions, setOriginalActions] = useState<PermissionMap>({})
  
  // UI state
  const [expandedEntities, setExpandedEntities] = useState<Set<string>>(new Set())
  const [expandedSubEntities, setExpandedSubEntities] = useState<Set<string>>(new Set())
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [selectedType, setSelectedType] = useState<'entity' | 'subentity' | 'tab' | null>(null)
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
      setProfile(profileResponse.data as AccessProfile)

      // Fetch permissions
      const permResponse = await apiClient.get(`/api/access-profiles/${id}/permissions`)
      if (!permResponse.success) {
        setNotification({ type: 'error', message: permResponse.error?.message || 'Erro ao carregar permissões' })
        return
      }

      const permData = permResponse.data as { isSystemProfile: boolean; permissions: Permission[] }

      // Initialize maps
      const enabledMap: EnabledMap = {}
      const actionsMap: PermissionMap = {}
      
      // Initialize all entities, sub-entities, and tabs
      ENTITIES_CONFIG.forEach(entity => {
        // Entity enabled defaults to true
        enabledMap[entity.key] = true
        actionsMap[entity.key] = {}
        entity.actions.forEach(action => {
          actionsMap[entity.key][action.key] = false
        })
        
        // Sub-entities
        entity.subEntities.forEach(subEntity => {
          enabledMap[subEntity.key] = true
          actionsMap[subEntity.key] = {}
          subEntity.actions.forEach(action => {
            actionsMap[subEntity.key][action.key] = false
          })
          
          // Tabs (Nível 3)
          if (subEntity.tabs) {
            subEntity.tabs.forEach(tab => {
              enabledMap[tab.key] = true
              actionsMap[tab.key] = {}
              tab.actions.forEach(action => {
                actionsMap[tab.key][action.key] = false
              })
            })
          }
        })
      })

      // Set permissions from backend
      if (!permData.isSystemProfile) {
        // First pass: detect enabled state from 'enabled' action
        permData.permissions.forEach((p: Permission) => {
          if (p.action === 'enabled') {
            enabledMap[p.screen_key] = p.allowed
          }
        })
        
        // Second pass: set action permissions
        permData.permissions.forEach((p: Permission) => {
          if (p.action !== 'enabled' && actionsMap[p.screen_key]) {
            actionsMap[p.screen_key][p.action] = p.allowed
          }
        })
      }

      setEnabled(enabledMap)
      setActions(actionsMap)
      setOriginalEnabled(JSON.parse(JSON.stringify(enabledMap)))
      setOriginalActions(JSON.parse(JSON.stringify(actionsMap)))

      // Expand first entity by default
      if (ENTITIES_CONFIG.length > 0) {
        const firstEntity = ENTITIES_CONFIG[0]
        setExpandedEntities(new Set([firstEntity.key]))
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
    const enabledChanged = JSON.stringify(enabled) !== JSON.stringify(originalEnabled)
    const actionsChanged = JSON.stringify(actions) !== JSON.stringify(originalActions)
    setHasChanges(enabledChanged || actionsChanged)
  }, [enabled, actions, originalEnabled, originalActions])

  // =====================================================
  // HANDLERS
  // =====================================================

  const handleToggleEntity = (entityKey: string, isEnabled: boolean) => {
    const entity = ENTITIES_CONFIG.find(e => e.key === entityKey)
    if (!entity) return

    setEnabled(prev => {
      const newEnabled = { ...prev, [entityKey]: isEnabled }
      
      // If disabling, disable all sub-entities and their tabs too
      if (!isEnabled) {
        entity.subEntities.forEach(sub => {
          newEnabled[sub.key] = false
          if (sub.tabs) {
            sub.tabs.forEach(tab => {
              newEnabled[tab.key] = false
            })
          }
        })
      }
      
      return newEnabled
    })
  }

  const handleToggleSubEntity = (subKey: string, isEnabled: boolean) => {
    // Find the sub-entity to get its tabs
    let subEntityWithTabs: SubEntity | undefined
    for (const entity of ENTITIES_CONFIG) {
      const found = entity.subEntities.find(s => s.key === subKey)
      if (found) {
        subEntityWithTabs = found
        break
      }
    }

    setEnabled(prev => {
      const newEnabled = { ...prev, [subKey]: isEnabled }
      
      // If disabling, disable all tabs too
      if (!isEnabled && subEntityWithTabs?.tabs) {
        subEntityWithTabs.tabs.forEach(tab => {
          newEnabled[tab.key] = false
        })
      }
      
      return newEnabled
    })
    
    // If enabling, set default view permission
    if (isEnabled) {
      setActions(prev => ({
        ...prev,
        [subKey]: {
          ...prev[subKey],
          view: true
        }
      }))
      // Select this sub-entity
      setSelectedKey(subKey)
      setSelectedType('subentity')
    }
  }

  const handleToggleTab = (tabKey: string, isEnabled: boolean) => {
    setEnabled(prev => ({ ...prev, [tabKey]: isEnabled }))
    
    // If enabling, set default view permission
    if (isEnabled) {
      setActions(prev => ({
        ...prev,
        [tabKey]: {
          ...prev[tabKey],
          view: true
        }
      }))
      // Select this tab
      setSelectedKey(tabKey)
      setSelectedType('tab')
    }
  }

  const handleActionChange = (screenKey: string, actionKey: string, allowed: boolean) => {
    setActions(prev => ({
      ...prev,
      [screenKey]: {
        ...prev[screenKey],
        [actionKey]: allowed
      }
    }))
  }

  const handleToggleAllActions = (screenKey: string, actionsList: Action[], allow: boolean) => {
    const updates: { [action: string]: boolean } = {}
    actionsList.forEach(action => {
      updates[action.key] = allow
    })
    
    setActions(prev => ({
      ...prev,
      [screenKey]: {
        ...prev[screenKey],
        ...updates
      }
    }))
  }

  const handleToggleExpandEntity = (entityKey: string) => {
    setExpandedEntities(prev => {
      const newSet = new Set(prev)
      if (newSet.has(entityKey)) {
        newSet.delete(entityKey)
      } else {
        newSet.add(entityKey)
      }
      return newSet
    })
  }

  const handleToggleExpandSubEntity = (subKey: string) => {
    setExpandedSubEntities(prev => {
      const newSet = new Set(prev)
      if (newSet.has(subKey)) {
        newSet.delete(subKey)
      } else {
        newSet.add(subKey)
      }
      return newSet
    })
  }

  const handleSelectItem = (key: string, type: 'entity' | 'subentity' | 'tab') => {
    setSelectedKey(key)
    setSelectedType(type)
  }

  const handleSave = async () => {
    if (!id || profile?.is_system) return

    setSaving(true)
    try {
      // Convert maps to array
      const permArray: Array<{ screen_key: string; action: string; allowed: boolean }> = []
      
      // Add enabled states
      Object.entries(enabled).forEach(([screenKey, isEnabled]) => {
        permArray.push({ screen_key: screenKey, action: 'enabled', allowed: isEnabled })
      })
      
      // Add action permissions
      Object.entries(actions).forEach(([screenKey, actionMap]) => {
        Object.entries(actionMap).forEach(([action, allowed]) => {
          permArray.push({ screen_key: screenKey, action, allowed })
        })
      })

      const response = await apiClient.put(`/api/access-profiles/${id}/permissions`, {
        permissions: permArray
      })

      if (response.success) {
        setNotification({ type: 'success', message: 'Permissões salvas com sucesso!' })
        setOriginalEnabled(JSON.parse(JSON.stringify(enabled)))
        setOriginalActions(JSON.parse(JSON.stringify(actions)))
      } else {
        setNotification({ type: 'error', message: response.error?.message || 'Erro ao salvar permissões' })
      }
    } catch (err: any) {
      setNotification({ type: 'error', message: err.message || 'Erro ao salvar' })
    } finally {
      setSaving(false)
    }
  }

  // =====================================================
  // HELPERS
  // =====================================================

  const getSelectedItem = (): { label: string; description: string; icon: string; actions: Action[] } | null => {
    if (!selectedKey || !selectedType) return null
    
    if (selectedType === 'entity') {
      const entity = ENTITIES_CONFIG.find(e => e.key === selectedKey)
      if (!entity) return null
      return { label: entity.label, description: entity.description, icon: entity.icon, actions: entity.actions }
    }
    
    if (selectedType === 'subentity') {
      for (const entity of ENTITIES_CONFIG) {
        const sub = entity.subEntities.find(s => s.key === selectedKey)
        if (sub) {
          return { 
            label: sub.label, 
            description: sub.isDetailPage ? 'Página de detalhe' : 'Página de menu',
            icon: sub.icon, 
            actions: sub.actions 
          }
        }
      }
    }
    
    if (selectedType === 'tab') {
      for (const entity of ENTITIES_CONFIG) {
        for (const sub of entity.subEntities) {
          if (sub.tabs) {
            const tab = sub.tabs.find(t => t.key === selectedKey)
            if (tab) {
              return { 
                label: tab.label, 
                description: `Aba em ${sub.label}`,
                icon: tab.icon, 
                actions: tab.actions 
              }
            }
          }
        }
      }
    }
    
    return null
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

  const selectedItem = getSelectedItem()
  const isItemEnabled = selectedKey ? (enabled[selectedKey] ?? true) : false

  return (
    <div className="h-full flex flex-col space-y-2 overflow-hidden">
      {/* Botão Voltar */}
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
        {/* Sidebar - Entity Accordion */}
        <div className="w-80 flex-shrink-0 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden flex flex-col">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="font-semibold text-gray-900 dark:text-white">Entidades</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">Habilite e clique para configurar ações</p>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-2">
            {ENTITIES_CONFIG.map(entity => (
              <EntityAccordionItem
                key={entity.key}
                entity={entity}
                isExpanded={expandedEntities.has(entity.key)}
                onToggleExpand={() => handleToggleExpandEntity(entity.key)}
                enabled={enabled}
                onToggleEntity={handleToggleEntity}
                onToggleSubEntity={handleToggleSubEntity}
                onToggleTab={handleToggleTab}
                isSystemProfile={profile.is_system}
                selectedKey={selectedKey}
                onSelectItem={handleSelectItem}
                expandedSubEntities={expandedSubEntities}
                onToggleExpandSubEntity={handleToggleExpandSubEntity}
              />
            ))}
          </div>
        </div>

        {/* Detail Panel */}
        <div className="flex-1 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden flex flex-col">
          {selectedItem && isItemEnabled ? (
            <>
              {/* Header */}
              <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-gray-100 dark:bg-gray-700 rounded-lg text-gray-600 dark:text-gray-400">
                      {getIcon(selectedItem.icon)}
                    </div>
                    <div>
                      <h2 className="font-semibold text-gray-900 dark:text-white">{selectedItem.label}</h2>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{selectedItem.description}</p>
                    </div>
                  </div>
                  {!profile.is_system && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleToggleAllActions(selectedKey!, selectedItem.actions, true)}
                        className="px-3 py-1.5 text-xs font-medium text-green-700 bg-green-100 dark:bg-green-900/30 dark:text-green-300 rounded-lg hover:bg-green-200 dark:hover:bg-green-900/50 transition-colors"
                      >
                        Permitir Todos
                      </button>
                      <button
                        onClick={() => handleToggleAllActions(selectedKey!, selectedItem.actions, false)}
                        className="px-3 py-1.5 text-xs font-medium text-red-700 bg-red-100 dark:bg-red-900/30 dark:text-red-300 rounded-lg hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors"
                      >
                        Negar Todos
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Actions grid */}
              <div className="flex-1 overflow-y-auto p-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {selectedItem.actions.map(action => (
                    <PermissionCheckbox
                      key={action.key}
                      action={action}
                      checked={profile.is_system ? true : (actions[selectedKey!]?.[action.key] || false)}
                      onChange={(checked) => handleActionChange(selectedKey!, action.key, checked)}
                      disabled={profile.is_system}
                    />
                  ))}
                </div>
              </div>
            </>
          ) : (
            /* No item selected or item disabled */
            <div className="flex-1 flex flex-col items-center justify-center text-gray-500 dark:text-gray-400 p-8">
              <Shield className="w-12 h-12 mb-4 opacity-50" />
              <p className="text-lg font-medium mb-2">
                {selectedKey && !isItemEnabled 
                  ? 'Item desabilitado' 
                  : 'Selecione um item'}
              </p>
              <p className="text-sm text-center max-w-md">
                {selectedKey && !isItemEnabled 
                  ? 'Habilite o item na lista à esquerda para configurar suas permissões.'
                  : 'Escolha uma entidade, sub-entidade ou aba na lista à esquerda para configurar suas ações.'}
              </p>
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
                setEnabled(JSON.parse(JSON.stringify(originalEnabled)))
                setActions(JSON.parse(JSON.stringify(originalActions)))
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
