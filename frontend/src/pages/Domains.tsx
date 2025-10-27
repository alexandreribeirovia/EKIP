import { useState, useEffect } from 'react'
import { AgGridReact } from 'ag-grid-react'
import { ColDef } from 'ag-grid-community'
import { Plus, Edit, Database, FolderTree, CheckCircle, XCircle, Copy } from 'lucide-react'
import DomainModal from '@/components/DomainModal'
import NotificationToast from '@/components/NotificationToast'
import { supabase } from '@/lib/supabaseClient'
import { DbDomain } from '@/types'

const Domains = () => {
  const [domains, setDomains] = useState<DbDomain[]>([])
  const [filteredDomains, setFilteredDomains] = useState<DbDomain[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedDomain, setSelectedDomain] = useState<DbDomain | null>(null)
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  // Filtros
  const [searchText, setSearchText] = useState('')
  const [filterType, setFilterType] = useState<string>('all')
  const [filterStatus, setFilterStatus] = useState<string>('all')

  // Buscar domínios
  const fetchDomains = async () => {
    setIsLoading(true)

    try {
      // Buscar todos os domínios
      const { data: domainsData, error } = await supabase
        .from('domains')
        .select('*')
        .order('type')
        .order('value')

      if (error) {
        console.error('Erro ao buscar domínios:', error)
        return
      }

      // Criar um mapa de domínios por ID para facilitar a busca
      const domainsMap = new Map(domainsData.map(d => [d.id, d]))

      // Adicionar informações do parent a cada domínio
      const domainsWithParent = domainsData.map(domain => ({
        ...domain,
        parent: domain.parent_id ? domainsMap.get(domain.parent_id) : null
      }))

      setDomains(domainsWithParent)
      applyFilters(domainsWithParent, searchText, filterType, filterStatus)
    } catch (err) {
      console.error('Erro ao buscar domínios:', err)
    } finally {
      setIsLoading(false)
    }
  }

  // Aplicar filtros
  const applyFilters = (
    data: DbDomain[],
    search: string,
    type: string,
    status: string
  ) => {
    let filtered = [...data]

    // Filtro de texto (type ou value)
    if (search) {
      const searchLower = search.toLowerCase()
      filtered = filtered.filter(
        (domain) =>
          domain.type.toLowerCase().includes(searchLower) ||
          domain.value.toLowerCase().includes(searchLower) ||
          (domain.description && domain.description.toLowerCase().includes(searchLower))
      )
    }

    // Filtro de tipo
    if (type !== 'all') {
      filtered = filtered.filter((domain) => domain.type === type)
    }

    // Filtro de status
    if (status === 'active') {
      filtered = filtered.filter((domain) => domain.is_active)
    } else if (status === 'inactive') {
      filtered = filtered.filter((domain) => !domain.is_active)
    }

    setFilteredDomains(filtered)
  }

  // Carregar domínios ao montar
  useEffect(() => {
    void fetchDomains()
  }, [])

  // Reaplica filtros quando mudam
  useEffect(() => {
    applyFilters(domains, searchText, filterType, filterStatus)
  }, [searchText, filterType, filterStatus, domains])

  // Abrir modal para criar domínio
  const handleCreateDomain = () => {
    setSelectedDomain(null)
    setIsModalOpen(true)
  }

  // Abrir modal para editar domínio
  const handleEditDomain = (domain: DbDomain) => {
    setSelectedDomain(domain)
    setIsModalOpen(true)
  }

  // Abrir modal para clonar domínio
  const handleCloneDomain = (domain: DbDomain) => {
    // Cria um novo objeto com apenas type e parent_id do domínio original
    const clonedDomain: DbDomain = {
      id: 0, // ID temporário, será ignorado ao criar
      type: domain.type,
      value: '', // Limpar o valor para o usuário preencher
      description: null,
      is_active: true,
      parent_id: domain.parent_id,
      parent: domain.parent,
      created_at: '',
      updated_at: ''
    }
    setSelectedDomain(clonedDomain)
    setIsModalOpen(true)
  }

  // Callback de sucesso do modal
  const handleModalSuccess = () => {
    void fetchDomains()
    setIsModalOpen(false)
    const isEdit = selectedDomain && selectedDomain.id > 0
    const isClone = selectedDomain && selectedDomain.id === 0
    setSelectedDomain(null)
    setNotification({
      type: 'success',
      message: isEdit ? 'Domínio atualizado com sucesso!' : isClone ? 'Domínio clonado com sucesso!' : 'Domínio criado com sucesso!'
    })
  }

  // Obter tipos únicos para o filtro
  const uniqueTypes = Array.from(new Set(domains.map((d) => d.type))).sort()

  // Estatísticas
  const stats = {
    total: domains.length,
    active: domains.filter((d) => d.is_active).length,
    inactive: domains.filter((d) => !d.is_active).length,
    withParent: domains.filter((d) => d.parent_id !== null).length,
    types: uniqueTypes.length,
  }

  // Configuração das colunas do AG-Grid
  const columnDefs: ColDef[] = [
    {
      headerName: 'Tipo',
      field: 'type',
      flex: 1.5,
      minWidth: 180,
      cellRenderer: (params: any) => {
        return (
          <div className="flex items-center gap-2 h-full">
            
            <span className="font-medium">{params.value}</span>
          </div>


        )
      },
    },
    {
      headerName: 'Valor',
      field: 'value',
      flex: 1.5,
      minWidth: 180,
    },
    {
      headerName: 'Domínio Pai',
      field: 'parent_id',
      flex: 1.5,
      minWidth: 180,
      cellRenderer: (params: any) => {
        const parent = params.data.parent
        if (!parent) return '-'
        return (
          <div className="flex items-center gap-2 h-full">
            <FolderTree className="w-4 h-4 text-blue-500" />
            <span className="text-sm">{parent.type} - {parent.value}</span>
          </div>
        )
      },
    },
    {
      headerName: 'Descrição',
      field: 'description',
      flex: 2,
      minWidth: 200,
      cellRenderer: (params: any) => params.value || '-',
    },
    
    {
      headerName: 'Status',
      field: 'is_active',
      flex: 1,
      minWidth: 100,
      cellRenderer: (params: any) => {
        const isActive = params.value
        return (
          <span
            className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
              isActive
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
      headerName: 'Ações',
      field: 'id',
      width: 120,
      cellRenderer: (params: any) => {
        return (
          <div className="flex items-center justify-center gap-1 h-full">
            <button
              onClick={() => handleEditDomain(params.data)}
              className="text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 p-1 rounded hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
              title="Editar domínio"
            >
              <Edit className="w-4 h-4" />
            </button>
            <button
              onClick={() => handleCloneDomain(params.data)}
              className="text-green-500 hover:text-green-700 dark:text-green-400 dark:hover:text-green-300 p-1 rounded hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors"
              title="Clonar domínio"
            >
              <Copy className="w-4 h-4" />
            </button>
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
          {/* Busca por Tipo/Valor/Descrição */}
          <div className="flex-1 min-w-0">
            <input
              type="text"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="Buscar por tipo, valor ou descrição..."
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-orange-500 focus:border-transparent"
            />
          </div>

          {/* Filtro de Tipo */}
          <div className="w-full lg:w-56">
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-orange-500 focus:border-transparent"
            >
              <option value="all">Todos os Tipos</option>
              {uniqueTypes.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
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

          {/* Botão Novo Domínio */}
          <div className="flex items-end">
            <button
              onClick={handleCreateDomain}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-orange-500 rounded-lg hover:bg-orange-600 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Novo Domínio
            </button>
          </div>
        </div>

        {/* Cards de Estatísticas */}
        <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {/* Total */}
          <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-2 border border-gray-200 dark:border-gray-600">
            <div className="flex items-center justify-between mb-1">
              <div className="text-xs text-gray-500 dark:text-gray-400">Total</div>
              <Database className="w-5 h-5 text-gray-500 dark:text-gray-400" />
            </div>
            <div className="text-xl font-bold text-gray-800 dark:text-gray-200">
              {stats.total}
            </div>
          </div>

          {/* Ativos */}
          <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-2 border border-green-200 dark:border-green-800">
            <div className="flex items-center justify-between mb-1">
              <div className="text-xs text-green-600 dark:text-green-400">Ativos</div>
              <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
            </div>
            <div className="text-xl font-bold text-green-700 dark:text-green-300">
              {stats.active}
            </div>
          </div>

          {/* Inativos */}
          <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-2 border border-red-200 dark:border-red-800">
            <div className="flex items-center justify-between mb-1">
              <div className="text-xs text-red-600 dark:text-red-400">Inativos</div>
              <XCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
            </div>
            <div className="text-xl font-bold text-red-700 dark:text-red-300">
              {stats.inactive}
            </div>
          </div>

          {/* Com Pai */}
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-2 border border-blue-200 dark:border-blue-800">
            <div className="flex items-center justify-between mb-1">
              <div className="text-xs text-blue-600 dark:text-blue-400">Com Pai</div>
              <FolderTree className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="text-xl font-bold text-blue-700 dark:text-blue-300">
              {stats.withParent}
            </div>
          </div>

          {/* Tipos Únicos */}
          <div className="bg-orange-50 dark:bg-orange-900/20 rounded-lg p-2 border border-orange-200 dark:border-orange-800">
            <div className="flex items-center justify-between mb-1">
              <div className="text-xs text-orange-600 dark:text-orange-400">Tipos</div>
              <Database className="w-5 h-5 text-orange-600 dark:text-orange-400" />
            </div>
            <div className="text-xl font-bold text-orange-700 dark:text-orange-300">
              {stats.types}
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
              rowData={filteredDomains}
              pagination={false}
              paginationPageSize={20}
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
                '<span class="text-gray-500 dark:text-gray-400">Nenhum domínio encontrado.</span>'
              }
            />
          </div>
        )}
      </div>

      {/* Modal de Domínio */}
      <DomainModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false)
          setSelectedDomain(null)
        }}
        onSuccess={handleModalSuccess}
        domainData={selectedDomain}
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

export default Domains
