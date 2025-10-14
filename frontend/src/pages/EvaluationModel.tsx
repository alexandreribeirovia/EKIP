import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { AgGridReact } from 'ag-grid-react';
import { ColDef } from 'ag-grid-community';
import { Plus, Trash2, FileText, Edit } from 'lucide-react';
import { EvaluationData } from '../types';
import EvaluationModal from '../components/EvaluationModal';
import '../styles/main.css';

const Evaluations = () => {
  const [evaluations, setEvaluations] = useState<EvaluationData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteConfirmModalOpen, setIsDeleteConfirmModalOpen] = useState(false);
  const [evaluationToDelete, setEvaluationToDelete] = useState<EvaluationData | null>(null);
  const navigate = useNavigate();

  // Buscar avaliações
  const fetchEvaluations = async () => {
    if (isLoading) return;
    
    setIsLoading(true);
    
    try {
      const { data, error } = await supabase
        .from('evaluations_model')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Erro ao buscar avaliações:', error);
        return;
      }

      setEvaluations(data || []);
    } catch (err) {
      console.error('Erro ao buscar avaliações:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Carregar avaliações ao montar o componente
  useEffect(() => {
    void fetchEvaluations();
  }, []);

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
      // 1. Primeiro, buscar todas as perguntas vinculadas a esta avaliação
      const { data: linkedQuestions, error: fetchError } = await supabase
        .from('evaluations_questions_model')
        .select('question_id')
        .eq('evaluation_id', evaluationToDelete.id);

      if (fetchError) {
        console.error('Erro ao buscar perguntas vinculadas:', fetchError);
        alert('Erro ao deletar avaliação. Tente novamente.');
        return;
      }

      // 2. Deletar os vínculos na tabela evaluations_questions_model
      const { error: linkError } = await supabase
        .from('evaluations_questions_model')
        .delete()
        .eq('evaluation_id', evaluationToDelete.id);

      if (linkError) {
        console.error('Erro ao deletar vínculos da avaliação:', linkError);
        alert('Erro ao deletar avaliação. Tente novamente.');
        return;
      }

      // 3. Deletar as perguntas da tabela questions_model
      if (linkedQuestions && linkedQuestions.length > 0) {
        const questionIds = linkedQuestions.map(q => q.question_id);
        const { error: questionsError } = await supabase
          .from('questions_model')
          .delete()
          .in('id', questionIds);

        if (questionsError) {
          console.error('Erro ao deletar perguntas:', questionsError);
          alert('Erro ao deletar avaliação. Tente novamente.');
          return;
        }
      }

      // 4. Finalmente, deletar a avaliação
      const { error: evaluationError } = await supabase
        .from('evaluations_model')
        .delete()
        .eq('id', evaluationToDelete.id);

      if (evaluationError) {
        console.error('Erro ao deletar avaliação:', evaluationError);
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

  // Função para navegar para detalhes da avaliação
  const handleViewEvaluation = (evaluationId: number) => {
    navigate(`/evaluations/${evaluationId}`);
  };

  // Configuração das colunas do AG-Grid
  const columnDefs: ColDef[] = [
    {
      headerName: 'Nome',
      field: 'name',
      flex: 2,
      minWidth: 250,
      cellRenderer: (params: any) => {
        return (
          <div 
            className="flex items-center h-full cursor-pointer hover:text-orange-600 dark:hover:text-orange-400 transition-colors"
            onClick={() => handleViewEvaluation(params.data.id)}
          >
            <FileText className="w-4 h-4 mr-2" />
            <span className="font-medium">{params.value}</span>
          </div>
        );
      },
    },
    {
      headerName: 'Descrição',
      field: 'description',
      flex: 3,
      minWidth: 300,
      cellRenderer: (params: any) => params.value || '-',
    },
    {
      headerName: 'Status',
      field: 'is_active',
      flex: 1,
      minWidth: 120,
      cellRenderer: (params: any) => {
        const isActive = params.value;
        return (
          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
            isActive 
              ? 'bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-300'
              : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
          }`}>
            {isActive ? 'Ativo' : 'Inativo'}
          </span>
        );
      },
    },
    // {
    //   headerName: 'Criado em',
    //   field: 'created_at',
    //   flex: 1,
    //   minWidth: 150,
    //   cellRenderer: (params: any) => {
    //     if (!params.value) return '-';
    //     try {
    //       const date = new Date(params.value);
    //       return date.toLocaleDateString('pt-BR');
    //     } catch (error) {
    //       return params.value;
    //     }
    //   },
    // },
    {
      headerName: 'Ações',
      field: 'id',
      width: 120,
      cellRenderer: (params: any) => {
        return (
          <div className="flex items-center justify-center h-full gap-2">
            <button
              onClick={() => handleViewEvaluation(params.value)}
              className="text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 p-1 rounded hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
              title="Ver detalhes"
            >
              <Edit className="w-4 h-4" />
            </button>
            <button
              onClick={() => handleDeleteEvaluation(params.value)}
              className="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
              title="Deletar avaliação"
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
      {/* Card de Header */}
      <div className="card p-6 pt-3 pb-3">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              Modelos de Avaliação
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Gerencie os modelos de avaliação de funcionários
            </p>
          </div>

          {/* Botão Nova Avaliação */}
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-orange-500 rounded-lg hover:bg-orange-600 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Nova Avaliação
          </button>
        </div>

        {/* Cards de Estatísticas */}
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Total */}
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 border border-blue-200 dark:border-blue-800">
            <div className="flex items-center justify-between mb-1">
              <div className="text-xs text-blue-600 dark:text-blue-400">Total de Avaliações</div>
              <FileText className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="text-2xl font-bold text-blue-700 dark:text-blue-300">
              {evaluations.length}
            </div>
          </div>

          {/* Ativas */}
          <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3 border border-green-200 dark:border-green-800">
            <div className="flex items-center justify-between mb-1">
              <div className="text-xs text-green-600 dark:text-green-400">Ativas</div>
              <FileText className="w-5 h-5 text-green-600 dark:text-green-400" />
            </div>
            <div className="text-2xl font-bold text-green-700 dark:text-green-300">
              {evaluations.filter(e => e.is_active).length}
            </div>
          </div>

          {/* Inativas */}
          <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 border border-gray-200 dark:border-gray-600">
            <div className="flex items-center justify-between mb-1">
              <div className="text-xs text-gray-600 dark:text-gray-400">Inativas</div>
              <FileText className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            </div>
            <div className="text-2xl font-bold text-gray-700 dark:text-gray-300">
              {evaluations.filter(e => !e.is_active).length}
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
              rowHeight={50}
              headerHeight={40}
              overlayNoRowsTemplate={
                '<span class="text-gray-500 dark:text-gray-400">Nenhuma avaliação encontrada.</span>'
              }
            />
          </div>
        )}
      </div>

      {/* Modal de Nova Avaliação */}
      <EvaluationModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={() => {
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
                    {evaluationToDelete.name}
                  </p>
                  {evaluationToDelete.description && (
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 italic">
                      "{evaluationToDelete.description.substring(0, 100)}{evaluationToDelete.description.length > 100 ? '...' : ''}"
                    </p>
                  )}
                </div>
                <p className="text-sm text-red-600 dark:text-red-400 font-medium">
                  ⚠️ Esta ação não pode ser desfeita e todas as perguntas associadas serão removidas
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
