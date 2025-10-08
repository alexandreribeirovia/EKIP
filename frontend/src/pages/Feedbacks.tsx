import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import Select from 'react-select';
import { AgGridReact } from 'ag-grid-react';
import { ColDef } from 'ag-grid-community';
import { Plus, Trash2, ListTodo, ThumbsUp, MessageCircle, Trophy, TrendingUp } from 'lucide-react';
import FeedbackModal from '../components/FeedbackModal';
import '../styles/main.css';

interface ConsultantOption {
  value: string;
  label: string;
}

interface FeedbackData {
  id: number;
  feedback_user_id: string;
  feedback_user_name: string;
  owner_user_id: string;
  owner_user_name: string;
  feedback_date: string;
  type: string;
  public_comment: string;
}

const Feedbacks = () => {
  const [feedbacks, setFeedbacks] = useState<FeedbackData[]>([]);
  const [consultants, setConsultants] = useState<ConsultantOption[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteConfirmModalOpen, setIsDeleteConfirmModalOpen] = useState(false);
  const [feedbackToDelete, setFeedbackToDelete] = useState<FeedbackData | null>(null);
  
  // Filtros
  const [periodType, setPeriodType] = useState<'current_month' | 'previous_month' | 'current_year' | 'custom'>('current_month');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedConsultants, setSelectedConsultants] = useState<ConsultantOption[]>([]);
  


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
      const { data, error } = await supabase
        .from('users')
        .select('user_id, name')
        .order('name');

      if (error) throw error;

      const options: ConsultantOption[] = (data || []).map((user) => ({
        value: user.user_id,
        label: user.name,
      }));

      setConsultants(options);
    } catch (err) {
      console.error('Erro ao buscar consultores:', err);
    }
  };

  // Buscar feedbacks
  const fetchFeedbacks = async () => {
    if (isLoading) return;
    
    setIsLoading(true);
    
    try {
      const dateRange = getDateRange();
      
      let query = supabase
        .from('feedbacks')
        .select('id, feedback_user_id, feedback_user_name, owner_user_id, owner_user_name, feedback_date, type, public_comment')
        .gte('feedback_date', dateRange.start)
        .lte('feedback_date', dateRange.end)
        .order('feedback_date', { ascending: false });

      // Filtrar por consultores selecionados
      if (selectedConsultants.length > 0) {
        const selectedIds = selectedConsultants.map(c => c.value);
        query = query.in('feedback_user_id', selectedIds);
      }

      const { data, error } = await query;

      if (error) throw error;

      setFeedbacks(data || []);
    } catch (err) {
      console.error('Erro ao buscar feedbacks:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Carregar consultores ao montar o componente
  useEffect(() => {
    void fetchConsultants();
  }, []);

  // Recarregar dados quando os filtros mudarem
  useEffect(() => {
    // Para período customizado, só buscar quando ambas as datas estiverem preenchidas
    if (periodType === 'custom' && (!startDate || !endDate)) {
      return;
    }
    
    void fetchFeedbacks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodType, startDate, endDate, selectedConsultants]);

  // Função para abrir modal de confirmação de exclusão
  const handleDeleteFeedback = (feedbackId: number) => {
    const feedback = feedbacks.find(f => f.id === feedbackId);
    if (feedback) {
      setFeedbackToDelete(feedback);
      setIsDeleteConfirmModalOpen(true);
    }
  };

  // Função para confirmar exclusão do feedback
  const handleConfirmDeleteFeedback = async () => {
    if (!feedbackToDelete) return;

    try {
      const { error } = await supabase
        .from('feedbacks')
        .delete()
        .eq('id', feedbackToDelete.id);

      if (error) throw error;

      // Remove o feedback da lista local
      setFeedbacks(prev => prev.filter(f => f.id !== feedbackToDelete.id));
      
      // Fecha modal e limpa estado
      setIsDeleteConfirmModalOpen(false);
      setFeedbackToDelete(null);
    } catch (err) {
      console.error('Erro ao deletar feedback:', err);
      alert('Erro ao deletar feedback. Tente novamente.');
    }
  };

  // Configuração das colunas do AG-Grid
  const columnDefs: ColDef[] = [
    {
      headerName: 'Consultor',
      field: 'feedback_user_name',
      flex: 1.5,
      minWidth: 200,
    },
    {
      headerName: 'Responsável',
      field: 'owner_user_name',
      flex: 1.5,
      minWidth: 200,
      cellRenderer: (params: any) => params.value || '-',
    },
    {
      headerName: 'Data',
      field: 'feedback_date',
      flex: 1,
      minWidth: 120,
      cellRenderer: (params: any) => {
        if (!params.value) return '-';
        try {
          // Trata diferentes formatos de data
          const date = new Date(params.value);
          // Verifica se a data é válida
          if (isNaN(date.getTime())) {
            // Tenta adicionar horário se for apenas data (YYYY-MM-DD)
            const dateWithTime = new Date(params.value + 'T12:00:00');
            if (isNaN(dateWithTime.getTime())) {
              return params.value; // Retorna valor original se não conseguir formatar
            }
            return dateWithTime.toLocaleDateString('pt-BR');
          }
          return date.toLocaleDateString('pt-BR');
        } catch (error) {
          return params.value;
        }
      },
    },
    {
      headerName: 'Tipo',
      field: 'type',
      flex: 1,
      minWidth: 150,
      cellRenderer: (params: any) => params.value || '-',
    },
    {
      headerName: 'Comentário',
      field: 'public_comment',
      flex: 3,
      minWidth: 300,
      cellRenderer: (params: any) => params.value || '-',
    },
    {
      headerName: 'Ação',
      field: 'id',
      width: 100,
      cellRenderer: (params: any) => {
        return (
          <div className="flex items-center justify-center h-full">
            <button
              onClick={() => handleDeleteFeedback(params.value)}
              className="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
              title="Deletar feedback"
            >
              <Trash2 className="w-4 h-4" />
            </button>
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

          {/* Botão Novo Feedback */}
          <div className="flex items-end">
            <button
              onClick={() => setIsModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-orange-500 rounded-lg hover:bg-orange-600 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Novo Feedback
            </button>
          </div>
        </div>

        {/* Cards de Estatísticas por Tipo */}
        <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {/* Total */}
          <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-2 border border-gray-200 dark:border-gray-600">
            <div className="flex items-center justify-between mb-1">
              <div className="text-xs text-gray-500 dark:text-gray-400">Total</div>
              <ListTodo className="w-5 h-5 text-gray-500 dark:text-gray-400" />
            </div>
            <div className="text-xl font-bold text-gray-800 dark:text-gray-200">{feedbacks.length}</div>
          </div>

          {/* Positivo */}
          <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-2 border border-green-200 dark:border-green-800">
            <div className="flex items-center justify-between mb-1">
              <div className="text-xs text-green-600 dark:text-green-400">Positivo</div>
              <ThumbsUp className="w-5 h-5 text-green-600 dark:text-green-400" />
            </div>
            <div className="text-xl font-bold text-green-700 dark:text-green-300">
              {feedbacks.filter(f => f.type === 'Positivo').length}
            </div>
          </div>

          {/* Orientação */}
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-2 border border-blue-200 dark:border-blue-800">
            <div className="flex items-center justify-between mb-1">
              <div className="text-xs text-blue-600 dark:text-blue-400">Orientação</div>
              <MessageCircle className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="text-xl font-bold text-blue-700 dark:text-blue-300">
              {feedbacks.filter(f => f.type === 'Orientação').length}
            </div>
          </div>

          {/* Elogio */}
          <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-2 border border-yellow-200 dark:border-yellow-800">
            <div className="flex items-center justify-between mb-1">
              <div className="text-xs text-yellow-600 dark:text-yellow-400">Elogio</div>
              <Trophy className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
            </div>
            <div className="text-xl font-bold text-yellow-700 dark:text-yellow-300">
              {feedbacks.filter(f => f.type === 'Elogio').length}
            </div>
          </div>

          {/* Melhoria */}
          <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-2 border border-purple-200 dark:border-purple-800">
            <div className="flex items-center justify-between mb-1">
              <div className="text-xs text-purple-600 dark:text-purple-400">Melhoria</div>
              <TrendingUp className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div className="text-xl font-bold text-purple-700 dark:text-purple-300">
              {feedbacks.filter(f => f.type === 'Melhoria').length}
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
              rowData={feedbacks}
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
                        '<span class="text-gray-500 dark:text-gray-400">Nenhuma feedback encontrada para os filtros selecionados.</span>'
                      }
            />
          </div>
        )}
      </div>

      {/* Modal de Novo Feedback */}
      <FeedbackModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={() => {
          // Recarrega a lista de feedbacks após sucesso
          void fetchFeedbacks();
        }}
      />

      {/* Modal de Confirmação de Exclusão */}
      {isDeleteConfirmModalOpen && feedbackToDelete && (
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
                  Deletar Feedback
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                  Tem certeza que deseja deletar este feedback?
                </p>
                <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg mb-4">
                  <p className="font-semibold text-gray-900 dark:text-gray-100 mb-2">
                    Consultor: {feedbackToDelete.feedback_user_name}
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Tipo: {feedbackToDelete.type}
                  </p>
                  {feedbackToDelete.public_comment && (
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 italic">
                      "{feedbackToDelete.public_comment.substring(0, 100)}{feedbackToDelete.public_comment.length > 100 ? '...' : ''}"
                    </p>
                  )}
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
                  setFeedbackToDelete(null);
                }}
                className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 font-semibold bg-gray-200 dark:bg-gray-700 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
              >
                Cancelar
              </button>
              <button 
                onClick={handleConfirmDeleteFeedback}
                className="px-4 py-2 text-sm text-white font-semibold bg-red-500 rounded-lg hover:bg-red-600 transition-colors flex items-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                Deletar Feedback
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Feedbacks;
