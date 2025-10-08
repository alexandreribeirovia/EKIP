import { useState, useMemo, useEffect, useRef } from 'react';
import { AgGridReact } from 'ag-grid-react';
import { ColDef, RowClickedEvent } from 'ag-grid-community'; 
import { Search, FolderOpen, FolderCheck, Layers } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { DbProject } from '../types';
import '../styles/main.css';
import ProjectDetail from './ProjectDetail';
import ProjectOwnersGridRenderer from '../components/ProjectOwnersGridRenderer'; 



const Projects = () => {
  const [projects, setProjects] = useState<DbProject[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('open');
  const [selectedProject, setSelectedProject] = useState<DbProject | null>(null);
  
  // useRef para controlar se já foi carregado (não causa re-render)
  const hasLoadedInitially = useRef(false);

  const fetchProjects = async () => {
    const { data, error } = await supabase
      .from('projects')
      .select(`
        *,
        projects_owner(
          id,
          created_at,
          updated_at,
          project_id,
          user_id,
          users(
            user_id,
            name,
            avatar_large_url
          )
        )
      `)
      .order('name', { ascending: true });

    if (error) {
      console.error('Erro ao buscar projetos:', error);
    } else {
      // Transformar os dados para incluir owners formatados
      const projectsWithOwners = (data || []).map(project => ({
        ...project,
        owners: (project.projects_owner || []).map((ownerData: any) => {
          const userData = Array.isArray(ownerData.users) && ownerData.users.length > 0 ? ownerData.users[0] : ownerData.users;
          return {
            id: ownerData.id,
            created_at: ownerData.created_at,
            updated_at: ownerData.updated_at,
            project_id: ownerData.project_id,
            user_id: ownerData.user_id,
            users: userData && !Array.isArray(userData) ? {
              user_id: userData.user_id,
              name: userData.name,
              avatar_large_url: userData.avatar_large_url
            } : null
          };
        }).filter((owner: any) => owner.users !== null)
      }));
      setProjects(projectsWithOwners);
    }
  };

  useEffect(() => {
    if (!hasLoadedInitially.current) {
      hasLoadedInitially.current = true;
      fetchProjects();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredProjects = useMemo(() => {
    const statusFiltered = projects.filter(project => {
      if (statusFilter === 'open') return !project.is_closed;
      if (statusFilter === 'closed') return project.is_closed;
      return true;
    });

    if (!searchTerm) return statusFiltered;

    return statusFiltered.filter(project =>
      project.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      project.client_name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [searchTerm, statusFilter, projects]);

  // Estatísticas totais (independentes dos filtros)
  const totalStats = useMemo(() => ({
    total: projects.length,
    open: projects.filter(proj => !proj.is_closed).length,
    closed: projects.filter(proj => proj.is_closed).length
  }), [projects]);
  
  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('pt-BR');
  };

  const formatSecondsToHours = (seconds: number | null) => {
    if (seconds === null || seconds === 0) return '0.00h';
    const hours = seconds / 3600;
    return `${hours.toFixed(2)}h`;
  };

  const columnDefs: ColDef[] = [
    { headerName: 'Projeto', field: 'name', flex: 2, minWidth: 200 },
    { headerName: 'Cliente', field: 'client_name', flex: 1.5, minWidth: 150 },
    { headerName: 'Data Início', field: 'start_date', flex: 1, minWidth: 120, valueFormatter: params => formatDate(params.value) },
    { headerName: 'Data Fim', field: 'close_date', flex: 1, minWidth: 120, valueFormatter: params => formatDate(params.value) },
    { headerName: 'Tarefas', field: 'tasks_count', flex: 0.8, minWidth: 90, type: 'numericColumn' },
    { headerName: 'Entregues', field: 'tasks_closed_count', flex: 0.8, minWidth: 100, type: 'numericColumn' },
    { headerName: 'Andamento', field: 'tasks_working_on_count', flex: 0.8, minWidth: 110, type: 'numericColumn' },
    { headerName: 'Fila', field: 'tasks_queued_count', flex: 0.8, minWidth: 90, type: 'numericColumn' },
    {
      headerName: 'Não Atribuídas', flex: 1, minWidth: 130, type: 'numericColumn',
      valueGetter: params => {
        const p = params.data as DbProject;
        if (!p) return 0;
        const assigned = (p.tasks_closed_count || 0) + (p.tasks_working_on_count || 0) + (p.tasks_queued_count || 0);
        return (p.tasks_count || 0) - assigned;
      }
    },
    {
      headerName: 'Horas',
      field: 'time_total',
      flex: 1,
      minWidth: 100,
      type: 'numericColumn',
      valueFormatter: params => formatSecondsToHours(params.value)
    },
    {
      headerName: 'Responsável',
      field: 'owners',
      flex: 1,
      minWidth: 120,
      cellRenderer: ProjectOwnersGridRenderer,
      sortable: false,
      filter: false
    }
  ];

  const handleSearch = (value: string) => {
    setSearchTerm(value);
  };
  

  const handleRowClick = (event: RowClickedEvent<DbProject>) => {
    setSelectedProject(event.data!);
  };
  
  const handleGoBackToList = () => {
    setSelectedProject(null);
  };

  return (
    <div className="h-full flex flex-col space-y-2">
      {selectedProject ? (
        <ProjectDetail project={selectedProject} onBack={handleGoBackToList} />
      ) : (
        <>
          {/* Card de Filtros */}
          <div className="card p-6 pt-3 pb-3">
            <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center">
              {/* Busca */}
              <div className="flex-1 min-w-0">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Buscar por projeto ou cliente..."
                    value={searchTerm}
                    onChange={(e) => handleSearch(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-orange-500 focus:border-transparent"
                  />
                </div>
              </div>

              {/* Filtro de Status */}
              <div className="w-full lg:w-48">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-orange-500 focus:border-transparent"
                >
                  <option value="open">Abertos</option>
                  <option value="closed">Fechados</option>
                  <option value="all">Todos</option>
                </select>
              </div>
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

              {/* Abertos */}
              <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-2 border border-green-200 dark:border-green-800">
                <div className="flex items-center justify-between mb-1">
                  <div className="text-xs text-green-600 dark:text-green-400">Abertos</div>
                  <FolderOpen className="w-4 h-4 text-green-600 dark:text-green-400" />
                </div>
                <div className="text-lg font-bold text-green-700 dark:text-green-300">{totalStats.open}</div>
              </div>

              {/* Fechados */}
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-2 border border-blue-200 dark:border-blue-800">
                <div className="flex items-center justify-between mb-1">
                  <div className="text-xs text-blue-600 dark:text-blue-400">Fechados</div>
                  <FolderCheck className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="text-lg font-bold text-blue-700 dark:text-blue-300">{totalStats.closed}</div>
              </div>
            </div>
          </div>

          {/* Card com Tabela */}
          <div className="card p-6 pt-3 flex-1 flex flex-col overflow-hidden">
            <div className="ag-theme-alpine w-full flex-1">
              <AgGridReact
                columnDefs={columnDefs}
                rowData={filteredProjects}
                onRowClicked={handleRowClick} 
                pagination={false}
                defaultColDef={{ sortable: true, filter: true, resizable: true }}
                rowSelection="single"
                animateRows={true}
                // Habilitando a seleção da linha no clique
                // suppressRowClickSelection={true} <-- REMOVIDO
                rowHeight={48}
                headerHeight={48}
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default Projects;