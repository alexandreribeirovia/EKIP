/**
 * EmployeeQuizzes - Listagem de Quizzes para Uso/Acompanhamento
 * 
 * Tela do menu Funcionários para gerenciar participantes e acompanhar resultados dos quizzes.
 * Similar a Evaluations.tsx, seguindo o mesmo padrão de layout.
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../lib/apiClient';
import { AgGridReact } from 'ag-grid-react';
import { ColDef, ICellRendererParams } from 'ag-grid-community';
import { 
  HelpCircle, 
  Users, 
  Eye, 
  CheckCircle, 
  XCircle,
  Clock,
  TrendingUp,
  ListTodo,
  ClipboardCheck,
  BarChart3
} from 'lucide-react';
import '../styles/main.css';

interface QuizListData {
  id: number;
  title: string;
  description: string | null;
  is_active: boolean;
  total_points: number;
  passing_score: number | null;
  time_limit_minutes: number | null;
  allow_review: boolean;
  randomize_questions: boolean;
  randomize_options: boolean;
  questions_count: number;
  participants_count: number;
  completed_count: number;
  completion_rate: number;
  average_score: number | null;
  created_at: string;
}

const EmployeeQuizzes = () => {
  const navigate = useNavigate();
  const [quizzes, setQuizzes] = useState<QuizListData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  
  // Filtros
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

  // Buscar quizzes com estatísticas
  const fetchQuizzes = async () => {
    if (isLoading) return;
    
    setIsLoading(true);
    
    try {
      const response = await apiClient.get<QuizListData[]>('/api/quiz?include_stats=true');

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

  // Filtrar quizzes por status
  const filteredQuizzes = quizzes.filter(quiz => {
    if (statusFilter === 'all') return true;
    if (statusFilter === 'active') return quiz.is_active;
    if (statusFilter === 'inactive') return !quiz.is_active;
    return true;
  });

  // Função para navegar para detalhes do quiz
  const handleViewQuiz = (quizId: number) => {
    navigate(`/employee-quizzes/${quizId}`);
  };

  // Estatísticas resumidas
  const stats = {
    total: quizzes.length,
    active: quizzes.filter(q => q.is_active).length,
    inactive: quizzes.filter(q => !q.is_active).length,
    totalParticipants: quizzes.reduce((sum, q) => sum + (q.participants_count || 0), 0),
    totalCompleted: quizzes.reduce((sum, q) => sum + (q.completed_count || 0), 0),
  };

  // Configuração das colunas do AG-Grid
  const columnDefs: ColDef<QuizListData>[] = [
    {
      headerName: 'Quiz',
      field: 'title',
      flex: 2,
      minWidth: 200,
      cellRenderer: (params: ICellRendererParams<QuizListData>) => {
        const data = params.data;
        if (!data) return null;
        return (
          <div className="flex flex-col justify-center h-full py-1">
            <span className="font-medium text-gray-900 dark:text-gray-100">{data.title}</span>
            {data.description && (
              <span className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-xs">
                {data.description}
              </span>
            )}
          </div>
        );
      },
    },
    {
      headerName: 'Status',
      field: 'is_active',
      width: 120,
      cellRenderer: (params: ICellRendererParams<QuizListData>) => {
        const data = params.data;
        if (!data) return null;
        return (
          <div className="flex items-center h-full">
            {data.is_active ? (
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300">
                <CheckCircle className="w-3 h-3" />
                Ativo
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                <XCircle className="w-3 h-3" />
                Inativo
              </span>
            )}
          </div>
        );
      },
    },
    {
      headerName: 'Perguntas',
      field: 'questions_count',
      width: 110,
      cellRenderer: (params: ICellRendererParams<QuizListData>) => {
        const data = params.data;
        if (!data) return null;
        return (
          <div className="flex items-center gap-1 h-full">
            <HelpCircle className="w-4 h-4 text-blue-500" />
            <span>{data.questions_count || 0}</span>
          </div>
        );
      },
    },
    {
      headerName: 'Participantes',
      field: 'participants_count',
      width: 130,
      cellRenderer: (params: ICellRendererParams<QuizListData>) => {
        const data = params.data;
        if (!data) return null;
        return (
          <div className="flex items-center gap-1 h-full">
            <Users className="w-4 h-4 text-purple-500" />
            <span>{data.participants_count || 0}</span>
          </div>
        );
      },
    },
    {
      headerName: 'Conclusão',
      field: 'completion_rate',
      width: 140,
      cellRenderer: (params: ICellRendererParams<QuizListData>) => {
        const data = params.data;
        if (!data) return null;
        
        const rate = data.completion_rate || 0;
        const completed = data.completed_count || 0;
        const total = data.participants_count || 0;
        
        let bgColor = 'bg-gray-200 dark:bg-gray-600';
        let fillColor = 'bg-gray-400';
        
        if (rate > 0) {
          if (rate >= 80) {
            fillColor = 'bg-green-500';
          } else if (rate >= 50) {
            fillColor = 'bg-yellow-500';
          } else {
            fillColor = 'bg-orange-500';
          }
        }
        
        return (
          <div className="flex flex-col justify-center h-full gap-1">
            <div className="flex items-center gap-2">
              <div className={`flex-1 h-2 rounded-full ${bgColor}`}>
                <div 
                  className={`h-full rounded-full ${fillColor}`} 
                  style={{ width: `${rate}%` }}
                />
              </div>
              <span className="text-xs font-medium w-10 text-right">{rate}%</span>
            </div>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {completed}/{total} respondidos
            </span>
          </div>
        );
      },
    },
    {
      headerName: 'Média',
      field: 'average_score',
      width: 100,
      cellRenderer: (params: ICellRendererParams<QuizListData>) => {
        const data = params.data;
        if (!data) return null;
        
        const avg = data.average_score;
        if (avg === null || avg === undefined) {
          return (
            <div className="flex items-center h-full text-gray-400">
              <span>-</span>
            </div>
          );
        }
        
        let color = 'text-gray-600 dark:text-gray-400';
        if (avg >= 80) color = 'text-green-600 dark:text-green-400';
        else if (avg >= 60) color = 'text-yellow-600 dark:text-yellow-400';
        else if (avg >= 40) color = 'text-orange-600 dark:text-orange-400';
        else color = 'text-red-600 dark:text-red-400';
        
        return (
          <div className={`flex items-center gap-1 h-full font-medium ${color}`}>
            <TrendingUp className="w-4 h-4" />
            <span>{avg}%</span>
          </div>
        );
      },
    },
    {
      headerName: 'Tempo',
      field: 'time_limit_minutes',
      width: 100,
      cellRenderer: (params: ICellRendererParams<QuizListData>) => {
        const data = params.data;
        if (!data || !data.time_limit_minutes) {
          return (
            <div className="flex items-center h-full text-gray-400">
              <span>Sem limite</span>
            </div>
          );
        }
        return (
          <div className="flex items-center gap-1 h-full text-gray-600 dark:text-gray-400">
            <Clock className="w-4 h-4" />
            <span>{data.time_limit_minutes} min</span>
          </div>
        );
      },
    },
    {
      headerName: 'Ações',
      width: 100,
      cellRenderer: (params: ICellRendererParams<QuizListData>) => {
        const data = params.data;
        if (!data) return null;
        
        return (
          <div className="flex items-center gap-1 h-full">
            <button
              onClick={() => handleViewQuiz(data.id)}
              className="p-1.5 text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
              title="Ver detalhes e participantes"
            >
              <Eye className="w-4 h-4" />
            </button>
            <button
              onClick={() => handleViewQuiz(data.id)}
              className="p-1.5 text-purple-500 hover:text-purple-700 dark:text-purple-400 dark:hover:text-purple-300 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded transition-colors"
              title="Acompanhamento"
            >
              <BarChart3 className="w-4 h-4" />
            </button>
          </div>
        );
      },
    },
  ];

  return (
    <div className="h-full flex flex-col space-y-2">
      {/* Card de Filtros e Estatísticas */}
      <div className="card p-6 pt-3 pb-3">
        {/* Header com título e filtro */}
        <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
              <HelpCircle className="w-6 h-6 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Quizzes</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Gerencie participantes e acompanhe resultados
              </p>
            </div>
          </div>

          {/* Filtro de Status */}
          <div className="w-full lg:w-48">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as 'all' | 'active' | 'inactive')}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-orange-500 focus:border-transparent"
            >
              <option value="all">Todos</option>
              <option value="active">Ativos</option>
              <option value="inactive">Inativos</option>
            </select>
          </div>
        </div>

        {/* Cards de Estatísticas - seguindo padrão Evaluations.tsx */}
        <div className="mt-3 grid grid-cols-2 sm:grid-cols-5 gap-3">
          {/* Total */}
          <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-2 border border-gray-200 dark:border-gray-600">
            <div className="flex items-center justify-between mb-1">
              <div className="text-xs text-gray-500 dark:text-gray-400">Total</div>
              <ListTodo className="w-5 h-5 text-gray-500 dark:text-gray-400" />
            </div>
            <div className="text-xl font-bold text-gray-800 dark:text-gray-200">{stats.total}</div>
          </div>

          {/* Ativos */}
          <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-2 border border-green-200 dark:border-green-800">
            <div className="flex items-center justify-between mb-1">
              <div className="text-xs text-green-600 dark:text-green-400">Ativos</div>
              <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
            </div>
            <div className="text-xl font-bold text-green-700 dark:text-green-300">{stats.active}</div>
          </div>

          {/* Inativos */}
          <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-2 border border-gray-200 dark:border-gray-600">
            <div className="flex items-center justify-between mb-1">
              <div className="text-xs text-gray-600 dark:text-gray-400">Inativos</div>
              <XCircle className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            </div>
            <div className="text-xl font-bold text-gray-700 dark:text-gray-300">{stats.inactive}</div>
          </div>

          {/* Participantes */}
          <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-2 border border-purple-200 dark:border-purple-800">
            <div className="flex items-center justify-between mb-1">
              <div className="text-xs text-purple-600 dark:text-purple-400">Participantes</div>
              <Users className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div className="text-xl font-bold text-purple-700 dark:text-purple-300">{stats.totalParticipants}</div>
          </div>

          {/* Respondidos */}
          <div className="bg-orange-50 dark:bg-orange-900/20 rounded-lg p-2 border border-orange-200 dark:border-orange-800">
            <div className="flex items-center justify-between mb-1">
              <div className="text-xs text-orange-600 dark:text-orange-400">Respondidos</div>
              <ClipboardCheck className="w-5 h-5 text-orange-600 dark:text-orange-400" />
            </div>
            <div className="text-xl font-bold text-orange-700 dark:text-orange-300">{stats.totalCompleted}</div>
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
          <div className="ag-theme-alpine dark:ag-theme-alpine-dark w-full mt-2 flex-1">
            <AgGridReact<QuizListData>
              rowData={filteredQuizzes}
              columnDefs={columnDefs}
              defaultColDef={{
                sortable: true,
                filter: true,
                resizable: true,
              }}
              animateRows={true}
              rowHeight={60}
              headerHeight={40}
              suppressRowClickSelection={true}
              onRowDoubleClicked={(event) => {
                if (event.data) {
                  handleViewQuiz(event.data.id);
                }
              }}
              overlayLoadingTemplate='<span class="ag-overlay-loading-center">Carregando quizzes...</span>'
              overlayNoRowsTemplate='<span class="ag-overlay-no-rows-center">Nenhum quiz encontrado</span>'
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default EmployeeQuizzes;
