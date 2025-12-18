import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../lib/apiClient';
import Select from 'react-select';
import { AgGridReact } from 'ag-grid-react';
import { ColDef } from 'ag-grid-community';
import { Plus, Trash2, ListTodo, ClipboardCheck, Clock, CheckCircle, Edit } from 'lucide-react';
import EmployeeEvaluationModal from '../components/EmployeeEvaluationModal';
import EvaluationsOverallRating from '../components/EvaluationsOverallRating';
import { EmployeeEvaluationData } from '../types';
import '../styles/main.css';

interface ConsultantOption {
  value: string;
  label: string;
}

const Evaluations = () => {
  const navigate = useNavigate();
  const [evaluations, setEvaluations] = useState<EmployeeEvaluationData[]>([]);
  const [consultants, setConsultants] = useState<ConsultantOption[]>([]);
  const [managers, setManagers] = useState<ConsultantOption[]>([]);
  const [statusOptions, setStatusOptions] = useState<ConsultantOption[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteConfirmModalOpen, setIsDeleteConfirmModalOpen] = useState(false);
  const [evaluationToDelete, setEvaluationToDelete] = useState<EmployeeEvaluationData | null>(null);
  
  // Filtros
  const [periodType, setPeriodType] = useState<'current_month' | 'previous_month' | 'current_year' | 'custom'>('current_year');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedConsultants, setSelectedConsultants] = useState<ConsultantOption[]>([]);
  const [selectedManagers, setSelectedManagers] = useState<ConsultantOption[]>([]);
  const [selectedStatus, setSelectedStatus] = useState<ConsultantOption[]>([]);

  // Função para calcular o intervalo de datas baseado no tipo de período
  const getDateRange = () => {
    const now = new Date();
    let start: Date, end: Date;

    switch (periodType) {
      case 'current_month':
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        break;
      case 'previous_month':
        start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        end = new Date(now.getFullYear(), now.getMonth(), 0);
        break;
      case 'current_year':
        start = new Date(now.getFullYear(), 0, 1);
        end = new Date(now.getFullYear(), 11, 31);
        break;
      case 'custom':
        if (startDate && endDate) {
          start = new Date(startDate);
          end = new Date(endDate);
        } else {
          start = new Date(now.getFullYear(), now.getMonth(), 1);
          end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        }
        break;
      default:
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    }

    return {
      start: start.toISOString().split('T')[0],
      end: end.toISOString().split('T')[0],
    };
  };

  // Buscar consultores para o filtro
  const fetchConsultants = async () => {
    try {
      const response = await apiClient.get<{ user_id: string; name: string }[]>('/api/lookups/users');

      if (!response.success || !response.data) {
        console.error('Erro ao buscar consultores:', response.error);
        return;
      }

      const options: ConsultantOption[] = response.data.map((user) => ({
        value: user.user_id,
        label: user.name,
      }));

      setConsultants(options);
    } catch (err) {
      console.error('Erro ao buscar consultores:', err);
    }
  };

  // Buscar gestores (usuários com posição contendo "Gestor")
  const fetchManagers = async () => {
    try {
      const response = await apiClient.get<{ user_id: string; name: string }[]>('/api/lookups/managers');

      if (!response.success || !response.data) {
        console.error('Erro ao buscar gestores:', response.error);
        return;
      }

      const options: ConsultantOption[] = response.data.map((user) => ({
        value: user.user_id,
        label: user.name,
      }));

      setManagers(options);
    } catch (err) {
      console.error('Erro ao buscar gestores:', err);
    }
  };

  // Buscar status disponíveis
  const fetchStatus = async () => {
    try {
      const response = await apiClient.get<{ id: number; value: string }[]>('/api/lookups/evaluation-statuses');

      if (!response.success || !response.data) {
        console.error('Erro ao buscar status:', response.error);
        return;
      }

      const options: ConsultantOption[] = response.data.map((status) => ({
        value: status.id.toString(),
        label: status.value,
      }));

      setStatusOptions(options);
    } catch (err) {
      console.error('Erro ao buscar status:', err);
    }
  };

  // Buscar avaliações
  const fetchEvaluations = async () => {
    if (isLoading) return;
    
    setIsLoading(true);
    
    try {
      const dateRange = getDateRange();
      
      // Construir parâmetros de query
      const params = new URLSearchParams();
      params.append('start_date', dateRange.start);
      params.append('end_date', dateRange.end);
      
      if (selectedConsultants.length > 0) {
        params.append('consultant_ids', selectedConsultants.map(c => c.value).join(','));
      }
      
      if (selectedManagers.length > 0) {
        params.append('manager_ids', selectedManagers.map(m => m.value).join(','));
      }
      
      if (selectedStatus.length > 0) {
        params.append('status_ids', selectedStatus.map(s => s.value).join(','));
      }

      const response = await apiClient.get<EmployeeEvaluationData[]>(`/api/employee-evaluations?${params.toString()}`);

      if (!response.success || !response.data) {
        console.error('Erro ao buscar avaliações:', response.error);
        return;
      }

      setEvaluations(response.data);
    } catch (err) {
      console.error('Erro ao buscar avaliações:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Carregar consultores, gestores e status ao montar o componente
  useEffect(() => {
    void fetchConsultants();
    void fetchManagers();
    void fetchStatus();
  }, []);

  // Recarregar dados quando os filtros mudarem
  useEffect(() => {
    // Para período customizado, só buscar quando ambas as datas estiverem preenchidas
    if (periodType === 'custom' && (!startDate || !endDate)) {
      return;
    }
    
    void fetchEvaluations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodType, startDate, endDate, selectedConsultants, selectedManagers, selectedStatus]);

  // Função para abrir modal de confirmação de exclusão
  const handleDeleteEvaluation = (evaluationId: number) => {
    const evaluation = evaluations.find(e => e.id === evaluationId);
    if (evaluation) {
      setEvaluationToDelete(evaluation);
      setIsDeleteConfirmModalOpen(true);
    }
  };

  // Função para confirmar exclusão da avaliação
  const handleConfirmDeleteEvaluation = async () => {
    if (!evaluationToDelete) return;

    try {
      const response = await apiClient.delete(`/api/employee-evaluations/${evaluationToDelete.id}`);

      if (!response.success) {
        console.error('Erro ao deletar avaliação:', response.error);
        alert('Erro ao deletar avaliação. Tente novamente.');
        return;
      }

      // Remove a avaliação da lista local
      setEvaluations(prev => prev.filter(e => e.id !== evaluationToDelete.id));
      
      // Fecha modal e limpa estado
      setIsDeleteConfirmModalOpen(false);
      setEvaluationToDelete(null);
    } catch (err) {
      console.error('Erro ao deletar avaliação:', err);
      alert('Erro ao deletar avaliação. Tente novamente.');
    }
  };

  // Configuração das colunas do AG-Grid
  const columnDefs: ColDef[] = [
    {
      headerName: 'Consultor',
      field: 'user_name',
      flex: 1.5,
      minWidth: 180,
    },
    {
      headerName: 'Avaliador',
      field: 'owner_name',
      flex: 1.5,
      minWidth: 180,
    },
    {
      headerName: 'Período',
      field: 'period_start',
      flex: 1.5,
      minWidth: 180,
      cellRenderer: (params: any) => {
        if (!params.value || !params.data.period_end) return '-';
        try {
          const start = new Date(params.value + 'T12:00:00');
          const end = new Date(params.data.period_end + 'T12:00:00');
          return `${start.toLocaleDateString('pt-BR')} - ${end.toLocaleDateString('pt-BR')}`;
        } catch (error) {
          return `${params.value} - ${params.data.period_end}`;
        }
      },
    },
    {
      headerName: 'Projeto(s)',
      field: 'evaluations_projects',
      flex: 2,
      minWidth: 200,
      cellRenderer: (params: any) => {
        const projects = params.value;
        if (!projects || projects.length === 0) return '-';
        
        // Se houver apenas 1 projeto, exibir o nome completo
        if (projects.length === 1) {
          return projects[0].project_name;
        }
        
        // Se houver múltiplos projetos, exibir os nomes separados por vírgula
        return projects.map((p: any) => p.project_name).join(' | ');
      },
    },
    {
      headerName: 'PDI',
      field: 'is_pdi',
      flex: 0.8,
      minWidth: 120,
      cellRenderer: (params: any) => {
        if (params.value) {
          return (
            <div className="flex items-center justify-left h-full">
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300">
                Sim
              </span>
            </div>
          );
        }
        return (
          <div className="flex items-center justify-left h-full">
            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400">
              Não
            </span>
          </div>
        );
      },
    },
    {
      headerName: 'Nota Geral',
      field: 'average_score',
      flex: 1,
      minWidth: 120,
      cellRenderer: (params: any) => <EvaluationsOverallRating score={params.value} />,
    },
    {
      headerName: 'Status',
      field: 'status',
      flex: 1,
      minWidth: 130,
      cellRenderer: (params: any) => {
        const status = params.value;
        const statusValue = status?.value;
        
        let colorClass = 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300';
        let statusText = 'Não definido';
        
        if (statusValue) {
          statusText = statusValue;
          
          // Definir cores baseadas no status
          const statusLower = statusValue.toLowerCase();
          if (statusLower.includes('aberto') || statusLower.includes('pendente')) {
            colorClass = 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300';
          } else if (statusLower.includes('em andamento') || statusLower.includes('progresso')) {
            colorClass = 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300';
          } else if (statusLower.includes('concluído') || statusLower.includes('finalizado')) {
            colorClass = 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300';
          } else if (statusLower.includes('cancelado') || statusLower.includes('rejeitado')) {
            colorClass = 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300';
          }
        }
        
        return (
          <span className={`px-2 py-1 rounded-full text-xs font-medium ${colorClass}`}>
            {statusText}
          </span>
        );
      },
    },
    {
      headerName: 'Aceite',
      field: 'accepted',
      flex: 0.8,
      minWidth: 100,
      cellRenderer: (params: any) => {
        const isClosed = params.data.is_closed;
        const accepted = params.value;

        // Só exibe status de aceite se a avaliação estiver fechada
        if (!isClosed) {
          return (
            <div className="flex items-center justify-left h-full">
              <span className="text-gray-400 dark:text-gray-600 text-xs">-</span>
            </div>
          );
        }

        if (accepted) {
          return (
            <div className="flex items-center justify-left h-full">
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300">
                <CheckCircle className="w-3 h-3 mr-1" />
                Aceito
              </span>
            </div>
          );
        }

        return (
          <div className="flex items-center justify-left h-full">
            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300">
              <Clock className="w-3 h-3 mr-1" />
              Pendente
            </span>
          </div>
        );
      },
    },
    
    {
      headerName: 'Ações',
      field: 'id',
      width: 120,
      cellRenderer: (params: any) => {
        const isClosed = params.data.is_closed;
        
        return (
          <div className="flex items-center justify-center h-full gap-2">
            <button
              onClick={() => navigate(`/employee-evaluations/${params.value}`)}
              className="text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 p-1 rounded hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
              title={isClosed ? "Visualizar avaliação" : "Responder avaliação"}
            >
              <Edit className="w-4 h-4" />
            </button>
            
            {/* Botão deletar só aparece se a avaliação não estiver encerrada */}
            {!isClosed && (
              <button
                onClick={() => handleDeleteEvaluation(params.value)}
                className="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                title="Deletar avaliação"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        );
      },
      sortable: false,
      filter: false,
    },
  ];

  return (
    <div className="h-full flex flex-col space-y-2">
      {/* Card de Filtros */}
      <div className="card p-6 pt-3 pb-3">
        <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center">
          {/* Filtro de Período */}
          <div className="w-full lg:w-48">
            <select
              value={periodType}
              onChange={(e) => setPeriodType(e.target.value as any)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-orange-500 focus:border-transparent"
            >
              <option value="current_month">Mês Atual</option>
              <option value="previous_month">Mês Anterior</option>
              <option value="current_year">Ano Atual</option>
              <option value="custom">Personalizar</option>
            </select>
          </div>

          {/* Campos de Data Personalizada */}
          {periodType === 'custom' && (
            <>
              <div className="w-full lg:w-48">
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  placeholder="Data Início"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-orange-500 focus:border-transparent"
                />
              </div>
              <div className="w-full lg:w-48">
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  placeholder="Data Fim"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-orange-500 focus:border-transparent"
                />
              </div>
            </>
          )}

          {/* Filtro de Consultor */}
          <div className="flex-1 min-w-0">
            <Select
              isMulti
              value={selectedConsultants}
              onChange={(selected) => setSelectedConsultants(selected as ConsultantOption[])}
              options={consultants}
              placeholder="Filtrar consultor"
              className="react-select-container"
              classNamePrefix="react-select"
            />
          </div>

          {/* Filtro de Avaliador */}
          <div className="flex-1 min-w-0">
            <Select
              isMulti
              value={selectedManagers}
              onChange={(selected) => setSelectedManagers(selected as ConsultantOption[])}
              options={managers}
              placeholder="Filtrar avaliador"
              className="react-select-container"
              classNamePrefix="react-select"
            />
          </div>

          {/* Filtro de Status */}
          <div className="w-full lg:w-64">
            <Select
              isMulti
              value={selectedStatus}
              onChange={(selected) => setSelectedStatus(selected as ConsultantOption[])}
              options={statusOptions}
              placeholder="Filtrar status"
              className="react-select-container"
              classNamePrefix="react-select"
            />
          </div>

          {/* Botão Nova Avaliação */}
          <div className="flex items-end">
            <button
              onClick={() => setIsModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-orange-500 rounded-lg hover:bg-orange-600 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 transition-colors whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              Nova Avaliação
            </button>
          </div>
        </div>

        {/* Cards de Estatísticas por Status */}
        <div className="mt-3 grid grid-cols-2 sm:grid-cols-5 gap-3">
          {/* Total */}
          <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-2 border border-gray-200 dark:border-gray-600">
            <div className="flex items-center justify-between mb-1">
              <div className="text-xs text-gray-500 dark:text-gray-400">Total</div>
              <ListTodo className="w-5 h-5 text-gray-500 dark:text-gray-400" />
            </div>
            <div className="text-xl font-bold text-gray-800 dark:text-gray-200">{evaluations.length}</div>
          </div>

          {/* Aberto/Pendente */}
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-2 border border-blue-200 dark:border-blue-800">
            <div className="flex items-center justify-between mb-1">
              <div className="text-xs text-blue-600 dark:text-blue-400">Aberto</div>
              <ClipboardCheck className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="text-xl font-bold text-blue-700 dark:text-blue-300">
              {evaluations.filter(e => {
                const statusValue = e.status?.value?.toLowerCase() || '';
                return statusValue.includes('aberto') || statusValue.includes('pendente');
              }).length}
            </div>
          </div>

          {/* Em Andamento */}
          <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-2 border border-yellow-200 dark:border-yellow-800">
            <div className="flex items-center justify-between mb-1">
              <div className="text-xs text-yellow-600 dark:text-yellow-400">Em Andamento</div>
              <Clock className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
            </div>
            <div className="text-xl font-bold text-yellow-700 dark:text-yellow-300">
              {evaluations.filter(e => {
                const statusValue = e.status?.value?.toLowerCase() || '';
                return statusValue.includes('em andamento') || statusValue.includes('progresso');
              }).length}
            </div>
          </div>

          {/* Concluído */}
          <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-2 border border-green-200 dark:border-green-800">
            <div className="flex items-center justify-between mb-1">
              <div className="text-xs text-green-600 dark:text-green-400">Concluído</div>
              <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
            </div>
            <div className="text-xl font-bold text-green-700 dark:text-green-300">
              {evaluations.filter(e => {
                const statusValue = e.status?.value?.toLowerCase() || '';
                return statusValue.includes('concluído') || statusValue.includes('finalizado');
              }).length}
            </div>
          </div>

          {/* Fechado */}
          <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-2 border border-gray-200 dark:border-gray-600">
            <div className="flex items-center justify-between mb-1">
              <div className="text-xs text-gray-600 dark:text-gray-400">Fechado</div>
              <CheckCircle className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            </div>
            <div className="text-xl font-bold text-gray-700 dark:text-gray-300">
              {evaluations.filter(e => {
                const statusValue = e.status?.value?.toLowerCase() || '';
                return statusValue.includes('fechado');
              }).length}
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
              rowData={evaluations}
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
                '<span class="text-gray-500 dark:text-gray-400">Nenhuma avaliação encontrada para os filtros selecionados.</span>'
              }
            />
          </div>
        )}
      </div>

      {/* Modal de Nova Avaliação */}
      <EmployeeEvaluationModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={() => {
          // Recarrega a lista de avaliações após sucesso
          void fetchEvaluations();
        }}
      />

      {/* Modal de Confirmação de Exclusão */}
      {isDeleteConfirmModalOpen && evaluationToDelete && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl max-w-md w-full">
            {/* Header */}
            <div className="p-5 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-t-2xl flex items-center gap-3">
              <Trash2 className="w-6 h-6" />
              <h2 className="text-xl font-bold">Confirmar Exclusão</h2>
            </div>

            {/* Content */}
            <div className="p-6">
              <div className="text-center">
                <div className="mx-auto flex items-center justify-center w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/20 mb-4">
                  <Trash2 className="w-6 h-6 text-red-600 dark:text-red-400" />
                </div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
                  Deletar Avaliação
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                  Tem certeza que deseja deletar esta avaliação?
                </p>
                <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg mb-4">
                  <p className="font-semibold text-gray-900 dark:text-gray-100 mb-2">
                    Consultor: {evaluationToDelete.user_name}
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Avaliador: {evaluationToDelete.owner_name}
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    ID Status: {evaluationToDelete.status_id || 'Não definido'}
                  </p>
                </div>
                <p className="text-sm text-red-600 dark:text-red-400 font-medium">
                  ⚠️ Esta ação não pode ser desfeita
                </p>
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 rounded-b-2xl flex justify-end gap-3">
              <button 
                onClick={() => {
                  setIsDeleteConfirmModalOpen(false);
                  setEvaluationToDelete(null);
                }}
                className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 font-semibold bg-gray-200 dark:bg-gray-700 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
              >
                Cancelar
              </button>
              <button 
                onClick={handleConfirmDeleteEvaluation}
                className="px-4 py-2 text-sm text-white font-semibold bg-red-500 rounded-lg hover:bg-red-600 transition-colors flex items-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                Deletar Avaliação
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Evaluations;
