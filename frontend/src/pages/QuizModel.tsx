import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../lib/apiClient';
import { AgGridReact } from 'ag-grid-react';
import { ColDef } from 'ag-grid-community';
import { Plus, Trash2, FileText, Edit, ClipboardCheck, Users, HelpCircle } from 'lucide-react';
import { QuizData } from '../types';
import QuizModal from '../components/QuizModal';

const QuizModel = () => {
  const [quizzes, setQuizzes] = useState<QuizData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [quizToEdit, setQuizToEdit] = useState<QuizData | null>(null);
  const [isDeleteConfirmModalOpen, setIsDeleteConfirmModalOpen] = useState(false);
  const [quizToDelete, setQuizToDelete] = useState<QuizData | null>(null);
  const navigate = useNavigate();

  // Buscar quizzes
  const fetchQuizzes = async () => {
    if (isLoading) return;
    
    setIsLoading(true);
    
    try {
      const response = await apiClient.get<QuizData[]>('/api/quiz');

      if (!response.success) {
        console.error('Erro ao buscar quizzes:', response.error);
        return;
      }

      setQuizzes(response.data || []);
    } catch (err) {
      console.error('Erro ao buscar quizzes:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Carregar quizzes ao montar o componente
  useEffect(() => {
    void fetchQuizzes();
  }, []);

  // Função para abrir modal de confirmação de exclusão
  const handleDeleteQuiz = (quizId: number) => {
    const quiz = quizzes.find(q => q.id === quizId);
    if (quiz) {
      setQuizToDelete(quiz);
      setIsDeleteConfirmModalOpen(true);
    }
  };

  // Função para abrir modal de edição
  const handleEditQuiz = (quizId: number) => {
    const quiz = quizzes.find(q => q.id === quizId);
    if (quiz) {
      setQuizToEdit(quiz);
      setIsModalOpen(true);
    }
  };

  // Função para fechar modal e limpar estado de edição
  const handleCloseModal = () => {
    setIsModalOpen(false);
    setQuizToEdit(null);
  };

  // Função para confirmar exclusão do quiz
  const handleConfirmDeleteQuiz = async () => {
    if (!quizToDelete) return;

    try {
      const response = await apiClient.delete(`/api/quiz/${quizToDelete.id}`);

      if (!response.success) {
        console.error('Erro ao deletar quiz:', response.error);
        alert('Erro ao deletar quiz. Tente novamente.');
        return;
      }

      // Remove o quiz da lista local
      setQuizzes(prev => prev.filter(q => q.id !== quizToDelete.id));
      
      // Fecha modal e limpa estado
      setIsDeleteConfirmModalOpen(false);
      setQuizToDelete(null);
    } catch (err) {
      console.error('Erro ao deletar quiz:', err);
      alert('Erro ao deletar quiz. Tente novamente.');
    }
  };

  // Função para navegar para detalhes do quiz
  const handleViewQuiz = (quizId: number) => {
    navigate(`/quizzes/${quizId}`);
  };

  // Função para toggle do status ativo
  const handleToggleActive = async (quizId: number) => {
    try {
      const response = await apiClient.patch(`/api/quiz/${quizId}/toggle-active`, {});

      if (!response.success) {
        console.error('Erro ao alterar status:', response.error);
        return;
      }

      // Atualiza a lista
      void fetchQuizzes();
    } catch (err) {
      console.error('Erro ao alterar status:', err);
    }
  };

  // Configuração das colunas do AG-Grid
  const columnDefs: ColDef[] = [
    {
      headerName: 'Título',
      field: 'title',
      flex: 2,
      minWidth: 250,
      cellRenderer: (params: any) => {
        return (
          <div 
            className="flex items-center h-full cursor-pointer hover:text-orange-600 dark:hover:text-orange-400 transition-colors"
            onClick={() => handleViewQuiz(params.data.id)}
          >
            <ClipboardCheck className="w-4 h-4 mr-2" />
            <span className="font-medium">{params.value}</span>
          </div>
        );
      },
    },
    {
      headerName: 'Descrição',
      field: 'description',
      flex: 2,
      minWidth: 200,
      cellRenderer: (params: any) => (
        <span className="text-gray-600 dark:text-gray-400">
          {params.value || '-'}
        </span>
      ),
    },
    {
      headerName: 'Perguntas',
      field: 'question_count',
      width: 110,
      cellRenderer: (params: any) => (
        <div className="flex items-center justify-center h-full">
          <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
            <HelpCircle className="w-3 h-3 inline mr-1" />
            {params.value || 0}
          </span>
        </div>
      ),
    },
    {
      headerName: 'Nota Mín.',
      field: 'pass_score',
      width: 100,
      cellRenderer: (params: any) => (
        <span className="text-gray-600 dark:text-gray-400">
          {params.value ? `${params.value}%` : '-'}
        </span>
      ),
    },
    {
      headerName: 'Tentativas',
      field: 'attempt_limit',
      width: 110,
      cellRenderer: (params: any) => (
        <span className="text-gray-600 dark:text-gray-400">
          {params.value || 'Ilimitado'}
        </span>
      ),
    },
    {
      headerName: 'Status',
      field: 'is_active',
      width: 120,
      cellRenderer: (params: any) => {
        const isActive = params.value;
        return (
          <div className="flex items-center h-full">
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleToggleActive(params.data.id);
              }}
              className={`px-2 py-1 rounded-full text-xs font-medium cursor-pointer transition-colors ${
                isActive 
                  ? 'bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-300 hover:bg-green-200 dark:hover:bg-green-900/40'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
              title={`Clique para ${isActive ? 'desativar' : 'ativar'}`}
            >
              {isActive ? 'Ativo' : 'Inativo'}
            </button>
          </div>
        );
      },
    },
    {
      headerName: 'Ações',
      field: 'id',
      width: 150,
      cellRenderer: (params: any) => {
        return (
          <div className="flex items-center justify-center h-full gap-2">
            <button
              onClick={() => handleEditQuiz(params.value)}
              className="text-orange-500 hover:text-orange-700 dark:text-orange-400 dark:hover:text-orange-300 p-1 rounded hover:bg-orange-50 dark:hover:bg-orange-900/20 transition-colors"
              title="Editar quiz"
            >
              <Edit className="w-4 h-4" />
            </button>
            <button
              onClick={() => handleViewQuiz(params.value)}
              className="text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 p-1 rounded hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
              title="Ver detalhes"
            >
              <FileText className="w-4 h-4" />
            </button>
            <button
              onClick={() => handleDeleteQuiz(params.value)}
              className="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
              title="Deletar quiz"
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
              Quizzes
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Gerencie os testes de conhecimento
            </p>
          </div>

          {/* Botão Novo Quiz */}
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-orange-500 rounded-lg hover:bg-orange-600 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Novo Quiz
          </button>
        </div>

        {/* Cards de Estatísticas */}
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-4 gap-3">
          {/* Total */}
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 border border-blue-200 dark:border-blue-800">
            <div className="flex items-center justify-between mb-1">
              <div className="text-xs text-blue-600 dark:text-blue-400">Total de Quizzes</div>
              <ClipboardCheck className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="text-2xl font-bold text-blue-700 dark:text-blue-300">
              {quizzes.length}
            </div>
          </div>

          {/* Ativos */}
          <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3 border border-green-200 dark:border-green-800">
            <div className="flex items-center justify-between mb-1">
              <div className="text-xs text-green-600 dark:text-green-400">Ativos</div>
              <ClipboardCheck className="w-5 h-5 text-green-600 dark:text-green-400" />
            </div>
            <div className="text-2xl font-bold text-green-700 dark:text-green-300">
              {quizzes.filter(q => q.is_active).length}
            </div>
          </div>

          {/* Total de Perguntas */}
          <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-3 border border-purple-200 dark:border-purple-800">
            <div className="flex items-center justify-between mb-1">
              <div className="text-xs text-purple-600 dark:text-purple-400">Total de Perguntas</div>
              <HelpCircle className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div className="text-2xl font-bold text-purple-700 dark:text-purple-300">
              {quizzes.reduce((sum, q) => sum + (q.question_count || 0), 0)}
            </div>
          </div>

          {/* Total de Participantes */}
          <div className="bg-orange-50 dark:bg-orange-900/20 rounded-lg p-3 border border-orange-200 dark:border-orange-800">
            <div className="flex items-center justify-between mb-1">
              <div className="text-xs text-orange-600 dark:text-orange-400">Total de Participantes</div>
              <Users className="w-5 h-5 text-orange-600 dark:text-orange-400" />
            </div>
            <div className="text-2xl font-bold text-orange-700 dark:text-orange-300">
              {quizzes.reduce((sum, q) => sum + (q.participant_count || 0), 0)}
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
              rowData={quizzes}
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
                '<span class="text-gray-500 dark:text-gray-400">Nenhum quiz encontrado.</span>'
              }
            />
          </div>
        )}
      </div>

      {/* Modal de Novo/Editar Quiz */}
      <QuizModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onSuccess={() => {
          void fetchQuizzes();
        }}
        quizToEdit={quizToEdit}
      />

      {/* Modal de Confirmação de Exclusão */}
      {isDeleteConfirmModalOpen && quizToDelete && (
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
                  Deletar Quiz
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                  Tem certeza que deseja deletar este quiz?
                </p>
                <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg mb-4">
                  <p className="font-semibold text-gray-900 dark:text-gray-100 mb-2">
                    {quizToDelete.title}
                  </p>
                  {quizToDelete.description && (
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 italic">
                      "{quizToDelete.description.substring(0, 100)}{quizToDelete.description.length > 100 ? '...' : ''}"
                    </p>
                  )}
                  <div className="flex justify-center gap-4 mt-2">
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      <HelpCircle className="w-3 h-3 inline mr-1" />
                      {quizToDelete.question_count || 0} perguntas
                    </span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      <Users className="w-3 h-3 inline mr-1" />
                      {quizToDelete.participant_count || 0} participantes
                    </span>
                  </div>
                </div>
                <p className="text-sm text-red-600 dark:text-red-400 font-medium">
                  ⚠️ Esta ação não pode ser desfeita. Todas as perguntas, participantes e resultados serão removidos.
                </p>
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 rounded-b-2xl flex justify-end gap-3">
              <button 
                onClick={() => {
                  setIsDeleteConfirmModalOpen(false);
                  setQuizToDelete(null);
                }}
                className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 font-semibold bg-gray-200 dark:bg-gray-700 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
              >
                Cancelar
              </button>
              <button 
                onClick={handleConfirmDeleteQuiz}
                className="px-4 py-2 text-sm text-white font-semibold bg-red-500 rounded-lg hover:bg-red-600 transition-colors flex items-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                Deletar Quiz
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default QuizModel;
