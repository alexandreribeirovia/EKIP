import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { usePermissionStore } from '@/stores/permissionStore'
import NotificationBell from './NotificationBell'
import {
  LayoutDashboard,
  Users,
  Settings,
  Moon,
  Sun,
  ChevronLeft,
  CalendarRange,
  ClipboardList,
  Clock,
  ChevronDown,
  MessageSquare,
  FileCheck,
  LogOut,
  Target,
  Database,
  Bell,
  ClipboardCheck,
  HelpCircle,
  Shield
} from 'lucide-react'

interface LayoutProps {
  children: React.ReactNode
}

const Layout = ({ children }: LayoutProps) => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [darkMode, setDarkMode] = useState(false)
  const [dashboardExpanded, setDashboardExpanded] = useState(false)
  const [employeesExpanded, setEmployeesExpanded] = useState(false)
  const [settingsExpanded, setSettingsExpanded] = useState(false)
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false)
  const { user, logout } = useAuthStore()
  const { hasScreenAccess, isAdmin, loaded: permissionsLoaded } = usePermissionStore()
  const location = useLocation()

  // Mapeamento de rotas para screenKey
  const getScreenKeyFromHref = (href: string): string => {
    // Mapeamento de rotas para screen_key conforme definido em permissions.ts (ENTITIES_CONFIG)
    const map: Record<string, string> = {
      '/dashboard': 'dashboard',
      '/time-entries': 'dashboard',          // Parte do Dashboard
      '/employees': 'employees',
      '/feedbacks': 'employees',             // Subtab de Employees (employees.feedbacks)
      '/employee-evaluations': 'employees',  // Subtab de Employees (employees.evaluations)
      '/pdi': 'employees',                   // Subtab de Employees (employees.pdi)
      '/employee-quizzes': 'employees',      // Subtab de Employees (employees.quizzes)
      '/projects': 'projects',
      '/allocations': 'allocations',
      '/evaluations': 'evaluation_models',   // Modelos de Avaliação
      '/quizzes': 'quizzes',
      '/access-profiles': 'access_profiles', // Perfis de Acesso
      '/users': 'users',
      '/domains': 'domains',
      '/notifications': 'notifications',
      '/settings': 'settings'
    }
    return map[href] || href.replace('/', '') || 'dashboard'
  }

  // Verificar se usuário tem acesso a um item de menu
  const hasMenuAccess = (href: string): boolean => {
    // Enquanto não carregou permissões, mostra tudo (evita flash)
    if (!permissionsLoaded) return true
    // Admin vê tudo
    if (isAdmin) return true
    // Verifica permissão
    const screenKey = getScreenKeyFromHref(href)
    return hasScreenAccess(screenKey)
  }

  const toggleDarkMode = () => {
    setDarkMode(!darkMode)
    document.documentElement.classList.toggle('dark')
  }

  const navigation = [
    {
      name: 'Dashboard',
      href: '/dashboard',
      icon: LayoutDashboard,
      hasSubmenu: true,
      submenu: [
        { name: 'Lançamento de Horas', href: '/time-entries', icon: Clock }
      ]
    },
    {
      name: 'Funcionários',
      href: '/employees',
      icon: Users,
      hasSubmenu: true,
      submenu: [
        { name: 'Feedbacks', href: '/feedbacks', icon: MessageSquare },
        { name: 'Avaliação', href: '/employee-evaluations', icon: FileCheck },
        { name: 'PDI', href: '/pdi', icon: Target },
        { name: 'Quiz', href: '/employee-quizzes', icon: HelpCircle }
      ]
    },
    { name: 'Projetos', href: '/projects', icon: ClipboardList },
    { name: 'Alocações', href: '/allocations', icon: CalendarRange },
    {
      name: 'Configurações',
      href: '/settings',
      icon: Settings,
      hasSubmenu: true,
      submenu: [
        { name: 'Avaliações Modelo', href: '/evaluations', icon: ClipboardList },
        { name: 'Quiz', href: '/quizzes', icon: ClipboardCheck },
        { name: 'Perfis de Acesso', href: '/access-profiles', icon: Shield },
        { name: 'Usuários', href: '/users', icon: Users },
        { name: 'Domínios', href: '/domains', icon: Database }
      ]
    },
  ]

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
      {/* Sidebar */}
      <div className={`bg-white dark:bg-gray-800 shadow-lg transition-all duration-300 ${sidebarCollapsed ? 'w-16' : 'w-56'
        }`}>
        <div className="flex items-center justify-between  border-b border-gray-200 dark:border-gray-700 py-2 pl-2">
          <div className="flex items-center">
            <img
              src="./img/logo.png"
              className="h-9 w-auto"
            />
            {!sidebarCollapsed && (
              <span className="ml-3 font-semibold text-lg text-gray-600 dark:text-gray-100">
                ViaEKIP
              </span>
            )}
          </div>
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
          >
            <ChevronLeft className={`w-5 h-5 transition-transform ${sidebarCollapsed ? 'rotate-180' : ''}`} />
          </button>
        </div>

        <nav className="mt-4">
          {navigation
            .filter(item => {
              // Verifica acesso ao item principal
              if (!hasMenuAccess(item.href)) {
                // Se tem submenu, verifica se tem acesso a algum submenu
                if (item.submenu) {
                  return item.submenu.some(sub => hasMenuAccess(sub.href))
                }
                return false
              }
              return true
            })
            .map((item) => {
            // Filtra submenus também
            const filteredSubmenu = item.submenu?.filter(sub => hasMenuAccess(sub.href))
            const itemWithFilteredSubmenu = { ...item, submenu: filteredSubmenu }
            const isActive = location.pathname === item.href || location.pathname.startsWith(item.href + '/')
            const isSubmenuActive = filteredSubmenu?.some(sub => location.pathname === sub.href || location.pathname.startsWith(sub.href + '/')) || false

            return (
              <div key={item.name}>
                {/* Menu principal */}
                {item.hasSubmenu ? (
                  <div className="flex items-center">
                    <Link
                      to={item.href}
                      className={`flex items-center flex-1 px-4 py-3 text-sm font-medium transition-colors ${isActive || isSubmenuActive
                          ? 'bg-primary-50 dark:bg-gray-700 text-primary-600 dark:text-primary-400'
                          : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                        }`}
                    >
                      <item.icon className="w-5 h-5" />
                      {!sidebarCollapsed && <span className="ml-3">{item.name}</span>}
                    </Link>
                    {!sidebarCollapsed && (
                      <button
                        onClick={() => {
                          if (item.name === 'Dashboard') {
                            setDashboardExpanded(!dashboardExpanded)
                          } else if (item.name === 'Funcionários') {
                            setEmployeesExpanded(!employeesExpanded)
                          } else if (item.name === 'Configurações') {
                            setSettingsExpanded(!settingsExpanded)
                          }
                        }}
                        className={`px-3 py-3 text-sm transition-colors ${isActive || isSubmenuActive
                            ? 'bg-primary-50 dark:bg-gray-700 text-primary-600 dark:text-primary-400'
                            : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                          }`}
                      >
                        <ChevronDown className={`w-4 h-4 transition-transform ${(item.name === 'Dashboard' && dashboardExpanded) ||
                            (item.name === 'Funcionários' && employeesExpanded) ||
                            (item.name === 'Configurações' && settingsExpanded)
                            ? 'rotate-180'
                            : ''
                          }`} />
                      </button>
                    )}
                  </div>
                ) : (
                  <Link
                    to={item.href}
                    className={`flex items-center px-4 py-3 text-sm font-medium transition-colors ${isActive
                        ? 'bg-primary-50 dark:bg-gray-700 text-primary-600 dark:text-primary-400'
                        : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                      }`}
                  >
                    <item.icon className="w-5 h-5" />
                    {!sidebarCollapsed && <span className="ml-3">{item.name}</span>}
                  </Link>
                )}

                {/* Submenu */}
                {item.hasSubmenu && filteredSubmenu && filteredSubmenu.length > 0 && !sidebarCollapsed &&
                  ((item.name === 'Dashboard' && dashboardExpanded) ||
                    (item.name === 'Funcionários' && employeesExpanded) ||
                    (item.name === 'Configurações' && settingsExpanded)) && (
                    <div className="bg-gray-50 dark:bg-gray-900">
                      {filteredSubmenu.map((subItem) => {
                        const isSubActive = location.pathname === subItem.href || location.pathname.startsWith(subItem.href + '/')
                        return (
                          <Link
                            key={subItem.name}
                            to={subItem.href}
                            className={`flex items-center pl-12 pr-4 py-2 text-sm transition-colors ${isSubActive
                                ? 'bg-primary-100 dark:bg-gray-700 text-primary-600 dark:text-primary-400 font-medium'
                                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                              }`}
                          >
                            <subItem.icon className="w-4 h-4" />
                            <span className="ml-2">{subItem.name}</span>
                          </Link>
                        )
                      })}
                    </div>
                  )}
              </div>
            )
          })}
        </nav>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header - sticky top-0 z-50 garante que fique sempre fixo no topo e acima de todos elementos */}
        <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700 sticky top-0 z-50">
          <div className="flex items-center justify-between px-6 py-2">
            <div className="flex items-center">
              <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                {/* Dashboard */}
              </h1>
            </div>

            <div className="flex items-center space-x-4">
              <button
                onClick={toggleDarkMode}
                className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </button>

              <NotificationBell />

              <div className="border-l border-gray-200 dark:border-gray-700 h-8"></div>

              <div className="relative">
                <button
                  onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
                  className="flex items-center focus:outline-none"
                >
                  <span className="mr-3 text-sm text-gray-700 dark:text-gray-300">
                    {user?.name}
                  </span>
                  <img
                    src={user?.avatar_large_url || user?.avatar || `https://ui-avatars.com/api/?name=${user?.name}`}
                    alt="User"
                    className="w-8 h-8 rounded-full object-cover"
                  />
                </button>

                {profileDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-md shadow-lg py-1 z-50">
                    <Link
                      to="/notifications"
                      onClick={() => setProfileDropdownOpen(false)}
                      className="flex items-center w-full px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                    >
                      <Bell className="w-4 h-4 mr-2" />
                      Minhas Notificações
                    </Link>
                    <button
                      onClick={() => {
                        void logout()
                        setProfileDropdownOpen(false)
                      }}
                      className="flex items-center w-full px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                    >
                      <LogOut className="w-4 h-4 mr-2" />
                      Sair
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  )
}

export default Layout