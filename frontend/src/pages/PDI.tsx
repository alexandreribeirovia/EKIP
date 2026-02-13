import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/lib/apiClient';
import Select from 'react-select';
import { AgGridReact } from 'ag-grid-react';
import { ColDef } from 'ag-grid-community';
import { Plus, Trash2, ListTodo, ClipboardCheck, Clock, CheckCircle, Edit } from 'lucide-react';
import { PdiData } from '@/types';
import PDIModal from '@/components/PDIModal';
import NotificationToast from '@/components/NotificationToast';
import { ProtectedAction } from '@/components/ProtectedComponents';
import { usePermissionStore } from '@/stores/permissionStore';

interface ConsultantOption {
  value: string;
  label: string;
}

const PDI = () => {
  const { hasPermission } = usePermissionStore();
  const [pdis, setPdis] = useState<PdiData[]>([]);
  const [consultants, setConsultants] = useState<ConsultantOption[]>([]);
  const [managers, setManagers] = useState<ConsultantOption[]>([]);
  const [statusOptions, setStatusOptions] = useState<ConsultantOption[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isDeleteConfirmModalOpen, setIsDeleteConfirmModalOpen] = useState(false);
  const [pdiToDelete, setPdiToDelete] = useState<PdiData | null>(null);
  const [isPDIModalOpen, setIsPDIModalOpen] = useState(false);
  const [editingPdiId, setEditingPdiId] = useState<number | null>(null);
  const [errorNotification, setErrorNotification] = useState<string | null>(null);
  const [successNotification, setSuccessNotification] = useState<string | null>(null);

  const showErrorNotification = useCallback((message: string) => {
    setErrorNotification(message);
  }, []);

  const showSuccessNotification = useCallback((message: string) => {
    setSuccessNotification(message);
  }, []);
  
  // Filtros
  const [periodType, setPeriodType] = useState<'all' | 'current_month' | 'previous_month' | 'current_year' | 'custom'>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedConsultants, setSelectedConsultants] = useState<ConsultantOption[]>([]);
  const [selectedManagers, setSelectedManagers] = useState<ConsultantOption[]>([]);
  const [selectedStatus, setSelectedStatus] = useState<ConsultantOption[]>([]);

  // Função para calcular o intervalo de datas baseado no tipo de período
  const getDateRange = (): { start: string; end: string } | null => {
    const now = new Date();
    let start: Date, end: Date;

    switch (periodType) {
      case 'all':
        return null; // Sem filtro de data - retorna todos os registros
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
          return null; // Datas customizadas não preenchidas
        }
        break;
      default:
        return null;
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

      if (!response.success) {
        console.error('Erro ao buscar consultores:', response.error);
        return;
      }

      const options: ConsultantOption[] = (response.data || []).map((user) => ({
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

      if (!response.success) {
        console.error('Erro ao buscar gestores:', response.error);
        return;
      }

      const options: ConsultantOption[] = (response.data || []).map((user) => ({
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
      const response = await apiClient.get<{ id: number; value: string }[]>('/api/domains?type=pdi_status&is_active=true');

      if (!response.success) {
        console.error('Erro ao buscar status:', response.error);
        return;
      }

      const options: ConsultantOption[] = (response.data || []).map((status) => ({
        value: status.id.toString(),
        label: status.value,
      }));

      setStatusOptions(options);
    } catch (err) {
      console.error('Erro ao buscar status:', err);
    }
  };

  // Buscar PDIs - Filtro de período baseado na data de atualização (updated_at)
  const fetchPdis = async () => {
    if (isLoading) return;
    
    setIsLoading(true);
    
    try {
      const dateRange = getDateRange();
      
      // Montar query params para a API
      const queryParams = new URLSearchParams();

      // Adicionar filtro de datas apenas se houver intervalo definido
      if (dateRange) {
        queryParams.append('startDate', dateRange.start);
        queryParams.append('endDate', dateRange.end);
      }

      // Filtrar por consultores selecionados
      if (selectedConsultants.length > 0) {
        const selectedIds = selectedConsultants.map(c => c.value);
        queryParams.append('consultantIds', selectedIds.join(','));
      }

      // Filtrar por gestores selecionados
      if (selectedManagers.length > 0) {
        const selectedIds = selectedManagers.map(m => m.value);
        queryParams.append('managerIds', selectedIds.join(','));
      }

      // Filtrar por status selecionados
      if (selectedStatus.length > 0) {
        const selectedIds = selectedStatus.map(s => s.value);
        queryParams.append('statusIds', selectedIds.join(','));
      }

      const response = await apiClient.get<PdiData[]>(`/api/pdi?${queryParams.toString()}`);

      if (!response.success) {
        console.error('Erro ao buscar PDIs:', response.error);
        return;
      }

      setPdis(response.data || []);
    } catch (err) {
      console.error('Erro ao buscar PDIs:', err);
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
    
    void fetchPdis();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodType, startDate, endDate, selectedConsultants, selectedManagers, selectedStatus]);

  // Função para abrir modal de edição
  const handleEditPdi = (pdiId: number) => {
    setEditingPdiId(pdiId);
    setIsPDIModalOpen(true);
  };

  // Função para abrir modal de criação
  const handleCreatePdi = () => {
    setEditingPdiId(null);
    setIsPDIModalOpen(true);
  };

  // Função para fechar modal e limpar estado de edição
  const handleClosePDIModal = () => {
    setIsPDIModalOpen(false);
    setEditingPdiId(null);
  };

  // Função para abrir modal de confirmação de exclusão
  const handleDeletePdi = (pdiId: number) => {
    const pdi = pdis.find(e => e.id === pdiId);
    if (pdi) {
      setPdiToDelete(pdi);
      setIsDeleteConfirmModalOpen(true);
    }
  };

  // Função para confirmar exclusão do PDI
  const handleConfirmDeletePdi = async () => {
    if (!pdiToDelete) return;

    try {
      // Deletar o PDI (cascade deleta itens automaticamente)
      const response = await apiClient.delete(`/api/pdi/${pdiToDelete.id}`);

      if (!response.success) {
        console.error('Erro ao deletar PDI:', response.error);
        showErrorNotification(response.error?.message || 'Erro ao deletar PDI. Tente novamente.');
        return;
      }

      // Remove o PDI da lista local
      setPdis(prev => prev.filter(e => e.id !== pdiToDelete.id));
      
      // Fecha modal e limpa estado
      setIsDeleteConfirmModalOpen(false);
      setPdiToDelete(null);
      showSuccessNotification('PDI deletado com sucesso!');
    } catch (err) {
      console.error('Erro ao deletar PDI:', err);
      showErrorNotification('Erro ao deletar PDI. Tente novamente.');
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
      headerName: 'Responsável',
      field: 'owner_name',
      flex: 1.5,
      minWidth: 180,
    },
    {
      headerName: 'Competências',
      field: 'competency_count',
      flex: 0.8,
      minWidth: 120,
      cellRenderer: (params: any) => {
        const count = params.value || 0;
        return (
          <div className="flex items-center justify-left h-full">
            <span className="px-2 py-1 rounded-full text-xs font-medium bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300">
              {count} {count === 1 ? 'competência' : 'competências'}
            </span>
          </div>
        );
      },
    },
    {
      headerName: 'Vínculo',
      field: 'link_type',
      flex: 0.8,
      minWidth: 110,
      cellRenderer: (params: any) => {
        const hasEvaluation = params.data.evaluation_id;
        const hasFeedback = params.data.feedback_id;
        
        let text = 'Não';
        let colorClass = 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400';
        
        if (hasEvaluation) {
          text = 'Avaliação';
          colorClass = 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300';
        } else if (hasFeedback) {
          text = 'Feedback';
          colorClass = 'bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300';
        }
        
        return (
          <div className="flex items-center justify-left h-full">
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${colorClass}`}>
              {text}
            </span>
          </div>
        );
      },
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
      headerName: 'Ações',
      field: 'id',
      width: 120,
      cellRenderer: (params: any) => {
        const isClosed = params.data.is_closed;
        
        return (
          <div className="flex items-center justify-center h-full gap-2">
            {(isClosed ? hasPermission('employees.pdi', 'view') : hasPermission('employees.pdi', 'edit')) && (
              <button
                onClick={() => handleEditPdi(params.value)}
                className="text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 p-1 rounded hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                title={isClosed ? "Visualizar PDI" : "Editar PDI"}
              >
                <Edit className="w-4 h-4" />
              </button>
            )}
            
            {/* Botão deletar só aparece se o PDI não estiver encerrado */}
            {!isClosed && hasPermission('employees.pdi', 'delete') && (
              <button
                onClick={() => handleDeletePdi(params.value)}
                className="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                title="Deletar PDI"
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
    <>
      {errorNotification && (
        <NotificationToast 
          type="error" 
          message={errorNotification} 
          onClose={() => setErrorNotification(null)} 
        />
      )}
      {successNotification && (
        <NotificationToast 
          type="success" 
          message={successNotification} 
          onClose={() => setSuccessNotification(null)} 
        />
      )}
      
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
              <option value="all">Todos</option>
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

          {/* Filtro de Responsável */}
          <div className="flex-1 min-w-0">
            <Select
              isMulti
              value={selectedManagers}
              onChange={(selected) => setSelectedManagers(selected as ConsultantOption[])}
              options={managers}
              placeholder="Filtrar responsável"
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

          {/* Botão Novo PDI */}
          <div className="flex items-end">
            <ProtectedAction screenKey="employees.pdi" action="create">
              <button
                onClick={handleCreatePdi}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-orange-500 rounded-lg hover:bg-orange-600 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 transition-colors whitespace-nowrap"
              >
                <Plus className="w-4 h-4" />
                Novo PDI
              </button>
            </ProtectedAction>
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
            <div className="text-xl font-bold text-gray-800 dark:text-gray-200">{pdis.length}</div>
          </div>

          {/* Aberto/Pendente */}
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-2 border border-blue-200 dark:border-blue-800">
            <div className="flex items-center justify-between mb-1">
              <div className="text-xs text-blue-600 dark:text-blue-400">Aberto</div>
              <ClipboardCheck className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="text-xl font-bold text-blue-700 dark:text-blue-300">
              {pdis.filter(e => {
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
              {pdis.filter(e => {
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
              {pdis.filter(e => {
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
              {pdis.filter(e => {
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
              rowData={pdis}
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
                '<span class="text-gray-500 dark:text-gray-400">Nenhum PDI encontrado para os filtros selecionados.</span>'
              }
            />
          </div>
        )}
      </div>

      {/* Modal de PDI (Criar/Editar) */}
      <PDIModal
        isOpen={isPDIModalOpen}
        onClose={handleClosePDIModal}
        onSuccess={() => {
          void fetchPdis();
        }}
        pdiId={editingPdiId}
        onError={showErrorNotification}
        onSuccessMessage={showSuccessNotification}
      />

      {/* Modal de Confirmação de Exclusão */}
      {isDeleteConfirmModalOpen && pdiToDelete && (
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
                  Deletar PDI
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                  Tem certeza que deseja deletar este PDI?
                </p>
                <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg mb-4">
                  <p className="font-semibold text-gray-900 dark:text-gray-100 mb-2">
                    Consultor: {pdiToDelete.user_name}
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Responsável: {pdiToDelete.owner_name}
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    ID Status: {pdiToDelete.status_id || 'Não definido'}
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
                  setPdiToDelete(null);
                }}
                className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 font-semibold bg-gray-200 dark:bg-gray-700 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
              >
                Cancelar
              </button>
              <button 
                onClick={handleConfirmDeletePdi}
                className="px-4 py-2 text-sm text-white font-semibold bg-red-500 rounded-lg hover:bg-red-600 transition-colors flex items-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                Deletar PDI
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </>
  );
};

export default PDI;
