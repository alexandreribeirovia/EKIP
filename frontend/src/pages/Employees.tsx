import { useState, useMemo, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { AgGridReact } from 'ag-grid-react'
import { ColDef, RowClickedEvent } from 'ag-grid-community'
import { Search, User, Users, UserCheck, UserX } from 'lucide-react'
import { DbUser } from '../types'
import * as apiClient from '../lib/apiClient'
import '../styles/main.css';

const Employees = () => {
  const navigate = useNavigate()
  const [employees, setEmployees] = useState<DbUser[]>([]);
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedSkill, setSelectedSkill] = useState<string>('')
  const [statusFilter, setStatusFilter] = useState<'active' | 'inactive' | 'all'>('active')
  
  // useRef para controlar se já foi carregado (não causa re-render)
  const hasLoadedInitially = useRef(false);

  // Função para buscar dados via Backend API
  const fetchEmployees = async () => {
    try {
      const result = await apiClient.get<DbUser[]>(`/api/employees`);

      if (!result.success) {
        console.error('Erro ao buscar funcionários:', result.error);
        return;
      }

      setEmployees(result.data || []);
    } catch (error) {
      console.error('Erro na requisição:', error);
    }
  };

  // UseEffect para buscar os dados ao carregar o componente
  useEffect(() => {
    if (!hasLoadedInitially.current) {
      hasLoadedInitially.current = true;
      void fetchEmployees();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Função para formatar as habilidades do funcionário
  const formatUserSkills = (userSkills: any[]): string => {
    if (!userSkills || userSkills.length === 0) {
      return ' - ';
    }

    return userSkills
      .map(userSkill => {
        const skill = userSkill.skills;
        if (!skill) return '';
        
        // Lógica de formatação baseada no que vimos nos dados:
        // - Para DEV: area + category + skill (ex: "DEV - Frontend - React")
        // - Para DADOS: area + category (ex: "DADOS - SQL") 
        // - Para ZENDESK: apenas area (ex: "ZENDESK")
        
        if (skill.area === 'ZENDESK' && !skill.category && !skill.skill) {
          return 'ZENDESK';
        }
        
        if (skill.area === 'DADOS' && skill.category && !skill.skill) {
          return skill.category; // Para DADOS, só mostra a categoria (SQL, Python, etc.)
        }
        
        if (skill.area === 'DEV' && skill.category && skill.skill) {
          return `${skill.category} - ${skill.skill}`; // Para DEV, mostra categoria + skill
        }
        
        // Fallback para outros casos
        const parts = [];
        if (skill.area) parts.push(skill.area);
        if (skill.category && skill.category !== skill.area) parts.push(skill.category);
        if (skill.skill && skill.skill !== skill.category) parts.push(skill.skill);
        
        return parts.join(' - ') || 'Habilidade indefinida';
      })
      .filter(skill => skill.length > 0)
      .join(', ');
  };

  // Filtrar funcionários baseado nos critérios
  const filteredEmployees = useMemo(() => {
    return employees.filter(employee => {
      const matchesSearch =
        employee.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        employee.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        employee.id.toString().includes(searchTerm.toLowerCase());

      // Filtro por habilidade - busca no texto das habilidades
      const matchesSkill = !selectedSkill || 
        formatUserSkills(employee.users_skill || [])
          .toLowerCase()
          .includes(selectedSkill.toLowerCase());

      // Filtro por status
      const matchesStatus = 
        statusFilter === 'all' || 
        (statusFilter === 'active' && employee.is_active) ||
        (statusFilter === 'inactive' && !employee.is_active);

      return matchesSearch && matchesSkill && matchesStatus;
    });
  }, [searchTerm, selectedSkill, statusFilter, employees])

  // Estatísticas totais (independentes dos filtros)
  const totalStats = useMemo(() => ({
    total: employees.length,
    active: employees.filter(emp => emp.is_active).length,
    inactive: employees.filter(emp => !emp.is_active).length
  }), [employees])

  // Configuração das colunas do AG-Grid
  const columnDefs: ColDef[] = [
    {
      headerName: 'Funcionário',
      field: 'name',
      flex: 2,
      minWidth: 250,
      cellRenderer: (params: any) => (
        <div className="flex items-center gap-3">
          {params.data.avatar_large_url ? (
            <img
              src={params.data.avatar_large_url}
              alt={params.data.name} 
              className="w-8 h-8 rounded-full object-cover"
            />
          ) : (
            <User className="w-6 h-6 text-gray-400" /> 
          )}
          <span className="font-medium">{params.data.name}</span>
        </div>
      ),
    },
    {
      headerName: 'Contato',
      field: 'email',
      flex: 2,
      minWidth: 250,
    },
    {
      headerName: 'Cargo',
      field: 'position',
      flex: 1.5,
      minWidth: 50
    },
    {
      headerName: 'Habilidades',
      field: 'users_skill',
      flex: 2,
      minWidth: 200,
      cellRenderer: (params: any) => {
        const skills = formatUserSkills(params.data.users_skill || []);
        return (
          <div className="truncate" title={skills}>
            {skills}
          </div>
        );
      },
    },
   
  ]

  const handleSearch = (value: string) => {
    setSearchTerm(value)
  }

  const handleSkillFilter = (skillText: string) => {
    setSelectedSkill(skillText)
  }

  const clearFilters = () => {
    setSearchTerm('')
    setSelectedSkill('')
    setStatusFilter('active')
  }

  const handleRowClick = (event: RowClickedEvent) => {
    navigate(`/employees/${event.data.user_id}`)
  }

   return (
    
    <div className="h-full flex flex-col space-y-2">
      {/* Card de Filtros */}
      <div className="card p-6 pt-3 pb-3">
        <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center">
          {/* Busca por nome */}
          <div className="flex-1 min-w-0">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Digite para buscar..."
                value={searchTerm}
                onChange={(e) => handleSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-orange-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Filtro por habilidade */}
          <div className="w-full lg:w-64">
            <input
              type="text"
              placeholder="Filtrar por habilidade..."
              value={selectedSkill}
              onChange={(e) => handleSkillFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-orange-500 focus:border-transparent"
            />
          </div>

          {/* Filtro por status */}
          <div className="w-full lg:w-48">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as 'active' | 'inactive' | 'all')}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-orange-500 focus:border-transparent"
            >
              <option value="active">Ativo</option>
              <option value="inactive">Inativo</option>
              <option value="all">Todos</option>
            </select>
          </div>

          <div className="flex items-end">
            <button
              onClick={clearFilters}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 focus:outline-none focus:ring-1 focus:ring-orange-500 transition-colors"
            >
              Limpar Filtros
            </button>
          </div>
        </div>

        {/* Cards de Estatísticas */}
        <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-3">
          {/* Total */}
          <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-2 border border-gray-200 dark:border-gray-600">
            <div className="flex items-center justify-between mb-1">
              <div className="text-xs text-gray-500 dark:text-gray-400">Total</div>
              <Users className="w-4 h-4 text-gray-500 dark:text-gray-400" />
            </div>
            <div className="text-lg font-bold text-gray-800 dark:text-gray-200">{totalStats.total}</div>
          </div>

          {/* Ativos */}
          <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-2 border border-green-200 dark:border-green-800">
            <div className="flex items-center justify-between mb-1">
              <div className="text-xs text-green-600 dark:text-green-400">Ativos</div>
              <UserCheck className="w-4 h-4 text-green-600 dark:text-green-400" />
            </div>
            <div className="text-lg font-bold text-green-700 dark:text-green-300">{totalStats.active}</div>
          </div>

          {/* Inativos */}
          <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-2 border border-red-200 dark:border-red-800">
            <div className="flex items-center justify-between mb-1">
              <div className="text-xs text-red-600 dark:text-red-400">Inativos</div>
              <UserX className="w-4 h-4 text-red-600 dark:text-red-400" />
            </div>
            <div className="text-lg font-bold text-red-700 dark:text-red-300">{totalStats.inactive}</div>
          </div>
        </div>
      </div>

      {/* Card com Tabela */}
      <div className="card p-6 pt-3 flex-1 flex flex-col overflow-hidden">
        <div className="ag-theme-alpine w-full mt-2 flex-1">
          <AgGridReact
            columnDefs={columnDefs}
            rowData={filteredEmployees}
            onRowClicked={handleRowClick}
            pagination={false}
            paginationPageSize={10}
            defaultColDef={{
              sortable: true,
              filter: true,
              resizable: true,
            }}
            rowSelection="single"
            animateRows={true}
            suppressRowClickSelection={true}
            className="w-full"
            rowHeight={40}
            headerHeight={40}
          />
        </div>
      </div>
    </div>
  )
}

export default Employees

// (Removed local Employee interface - use the one from '../types' instead)