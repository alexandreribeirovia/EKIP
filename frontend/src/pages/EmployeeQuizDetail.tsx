/**
 * EmployeeQuizDetail - Página de Detalhes do Quiz (Uso/Acompanhamento)
 * 
 * Exibe detalhes de um quiz com três abas:
 * - Perguntas: Visualização read-only das perguntas e opções (colapsável)
 * - Participantes: Gerenciamento de participantes e links temporários
 * - Acompanhamento: Métricas e gráficos de participação
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { AgGridReact } from 'ag-grid-react';
import { ColDef, ICellRendererParams } from 'ag-grid-community';
import {
  ArrowLeft,
  Plus,
  Trash2,
  ChevronDown,
  ChevronRight,
  Link,
  Users,
  RefreshCw,
  CheckCircle,
  XCircle,
  X,
  Clock,
  Award,
  HelpCircle,
  AlertCircle,
  BarChart3,
  TrendingUp,
  Target,
  Medal,
  Percent,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Legend,
} from 'recharts';
import apiClient from '../lib/apiClient';
import {
  QuizData,
  QuizQuestionData,
  QuizParticipantData,
} from '../types';
import QuizParticipantModal from '../components/QuizParticipantModal';
import QuizGenerateLinkModal from '../components/QuizGenerateLinkModal';
import QuizGenerateAllLinksModal from '../components/QuizGenerateAllLinksModal';

// ============================================================================
// TYPES
// ============================================================================

interface AnalyticsData {
  quiz: {
    id: number;
    title: string;
    total_points: number;
  };
  summary: {
    total_participants: number;
    completed_count: number;
    completion_rate: number;
    average_score: number;
    total_attempts: number;
    avg_attempts_per_participant: number;
  };
  ranking: Array<{
    participant_id: number;
    user_id: string;
    name: string;
    score: number;
    total_points: number;
    percentage: number;
    completed_at: string;
  }>;
  distribution: Array<{
    range: string;
    count: number;
    color: string;
  }>;
  temporal_evolution: Array<{
    date: string;
    count: number;
    avgScore: number;
  }>;
}

// ============================================================================
// NOTIFICATION TOAST COMPONENT
// ============================================================================

const NotificationToast = ({ type, message, onClose }: { 
  type: 'success' | 'error', 
  message: string, 
  onClose: () => void 
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [progress, setProgress] = useState(100);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const clearTimers = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
  }, []);

  const startTimers = useCallback(() => {
    clearTimers();
    const remainingTime = (progress / 100) * 10000;
    
    timeoutRef.current = setTimeout(() => {
      onClose();
    }, remainingTime);
    
    progressIntervalRef.current = setInterval(() => {
      setProgress(prev => {
        const newProgress = prev - 1;
        if (newProgress <= 0) return 0;
        return newProgress;
      });
    }, 100);
  }, [progress, onClose, clearTimers]);

  useEffect(() => {
    if (!isHovered) {
      startTimers();
    } else {
      clearTimers();
    }
    return () => clearTimers();
  }, [isHovered, startTimers, clearTimers]);

  useEffect(() => {
    startTimers();
    return () => clearTimers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleMouseEnter = useCallback(() => setIsHovered(true), []);
  const handleMouseLeave = useCallback(() => setIsHovered(false), []);

  const toastContent = (
    <div 
      className={`fixed top-4 right-4 z-[9999] rounded-xl shadow-2xl animate-slide-in-from-top border ${
        type === 'success' 
          ? 'bg-gradient-to-r from-green-50 to-green-100 border-green-200 text-green-800' 
          : 'bg-gradient-to-r from-red-50 to-red-100 border-red-200 text-red-800'
      } transform transition-all duration-300 ease-out max-w-md cursor-pointer overflow-hidden`}
      style={{ position: 'fixed', top: '4rem', right: '1rem', zIndex: 9999, pointerEvents: 'auto' }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div className={`h-1 transition-all duration-100 ease-linear ${
        type === 'success' ? 'bg-green-500' : 'bg-red-500'
      }`} style={{ width: `${progress}%` }} />
      
      <div className="flex items-center gap-3 px-5 py-4">
        <div className={`flex items-center justify-center w-8 h-8 rounded-full ${
          type === 'success' ? 'bg-green-500' : 'bg-red-500'
        }`}>
          {type === 'success' ? (
            <CheckCircle className="w-5 h-5 text-white" />
          ) : (
            <XCircle className="w-5 h-5 text-white" />
          )}
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold">{type === 'success' ? 'Sucesso!' : 'Erro!'}</p>
          <p className="text-xs opacity-90 whitespace-pre-line">{message}</p>
        </div>
        <button 
          onClick={onClose}
          className={`ml-2 p-1 rounded-full transition-colors ${
            type === 'success' 
              ? 'text-green-400 hover:text-green-600 hover:bg-green-200' 
              : 'text-red-400 hover:text-red-600 hover:bg-red-200'
          }`}
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );

  return createPortal(toastContent, document.body);
};

// ============================================================================
// COLLAPSIBLE QUESTION COMPONENT (Read-only)
// ============================================================================

interface CollapsibleQuestionProps {
  question: QuizQuestionData;
  index: number;
  isExpanded: boolean;
  onToggle: () => void;
}

const CollapsibleQuestion = ({ question, index, isExpanded, onToggle }: CollapsibleQuestionProps) => {
  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
      {/* Question Header */}
      <div 
        className="flex items-center gap-3 p-4 bg-gray-50 dark:bg-gray-800 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        onClick={onToggle}
      >
        <span className="flex items-center justify-center w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 text-sm font-bold">
          {index + 1}
        </span>
        <div className="flex-1">
          <p className="font-medium text-gray-900 dark:text-gray-100">{question.question_text}</p>
          <div className="flex items-center gap-3 mt-1">
            <span className={`text-xs px-2 py-0.5 rounded-full ${
              question.question_type === 'single_choice'
                ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                : 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300'
            }`}>
              {question.question_type === 'single_choice' ? 'Única Escolha' : 'Múltipla Escolha'}
            </span>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {question.points} {question.points === 1 ? 'ponto' : 'pontos'}
            </span>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {question.options?.length || 0} opções
            </span>
          </div>
        </div>
        {isExpanded ? (
          <ChevronDown className="w-5 h-5 text-gray-400" />
        ) : (
          <ChevronRight className="w-5 h-5 text-gray-400" />
        )}
      </div>

      {/* Options (Collapsible) */}
      {isExpanded && question.options && question.options.length > 0 && (
        <div className="p-4 space-y-2 bg-white dark:bg-gray-900">
          {question.hint && (
            <div className="mb-3 p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
              <p className="text-xs text-yellow-700 dark:text-yellow-400">
                <strong>Dica:</strong> {question.hint}
              </p>
            </div>
          )}
          {question.options.map((option, optIndex) => (
            <div 
              key={option.id}
              className={`flex items-center gap-3 p-3 rounded-lg border ${
                option.is_correct
                  ? 'border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-900/20'
                  : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800'
              }`}
            >
              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400 text-xs font-medium">
                {String.fromCharCode(65 + optIndex)}
              </span>
              <span className="flex-1 text-sm text-gray-700 dark:text-gray-300">{option.option_text}</span>
              {option.is_correct && (
                <CheckCircle className="w-5 h-5 text-green-500" />
              )}
            </div>
          ))}
          {question.explanation && (
            <div className="mt-3 p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <p className="text-xs text-blue-700 dark:text-blue-400">
                <strong>Explicação:</strong> {question.explanation}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

const EmployeeQuizDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  // Tab state
  const [activeTab, setActiveTab] = useState<'perguntas' | 'participantes' | 'acompanhamento'>('perguntas');

  // Quiz data
  const [quiz, setQuiz] = useState<QuizData | null>(null);
  const [isLoadingQuiz, setIsLoadingQuiz] = useState(true);

  // Questions data
  const [questions, setQuestions] = useState<QuizQuestionData[]>([]);
  const [expandedQuestions, setExpandedQuestions] = useState<Set<number>>(new Set());

  // Participants data
  const [participants, setParticipants] = useState<QuizParticipantData[]>([]);

  // Analytics data
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [isLoadingAnalytics, setIsLoadingAnalytics] = useState(false);

  // Modals
  const [showParticipantModal, setShowParticipantModal] = useState(false);
  const [showGenerateLinkModal, setShowGenerateLinkModal] = useState(false);
  const [showGenerateAllLinksModal, setShowGenerateAllLinksModal] = useState(false);
  const [generateLinkParticipant, setGenerateLinkParticipant] = useState<QuizParticipantData | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'participant'; id: number } | null>(null);

  // Notification
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // ============================================================================
  // DATA FETCHING
  // ============================================================================

  const fetchQuiz = useCallback(async () => {
    if (!id) return;
    setIsLoadingQuiz(true);
    try {
      const response = await apiClient.get<QuizData>(`/api/quiz/${id}`);
      if (response.success && response.data) {
        setQuiz(response.data);
      }
    } catch (error) {
      console.error('Erro ao buscar quiz:', error);
    } finally {
      setIsLoadingQuiz(false);
    }
  }, [id]);

  const fetchQuestions = useCallback(async () => {
    if (!id) return;
    try {
      const response = await apiClient.get<QuizQuestionData[]>(`/api/quiz/${id}/questions`);
      if (response.success && response.data) {
        setQuestions(response.data);
      }
    } catch (error) {
      console.error('Erro ao buscar perguntas:', error);
    }
  }, [id]);

  const fetchParticipants = useCallback(async () => {
    if (!id) return;
    try {
      const response = await apiClient.get<QuizParticipantData[]>(`/api/quiz-participants/${id}`);
      if (response.success && response.data) {
        setParticipants(response.data);
      }
    } catch (error) {
      console.error('Erro ao buscar participantes:', error);
    }
  }, [id]);

  const fetchAnalytics = useCallback(async () => {
    if (!id) return;
    setIsLoadingAnalytics(true);
    try {
      const response = await apiClient.get<AnalyticsData>(`/api/quiz-participants/${id}/analytics`);
      if (response.success && response.data) {
        setAnalytics(response.data);
      }
    } catch (error) {
      console.error('Erro ao buscar analytics:', error);
    } finally {
      setIsLoadingAnalytics(false);
    }
  }, [id]);

  useEffect(() => {
    void fetchQuiz();
    void fetchQuestions();
  }, [fetchQuiz, fetchQuestions]);

  useEffect(() => {
    if (activeTab === 'participantes') {
      void fetchParticipants();
    } else if (activeTab === 'acompanhamento') {
      void fetchAnalytics();
    }
  }, [activeTab, fetchParticipants, fetchAnalytics]);

  // ============================================================================
  // QUESTION HANDLERS
  // ============================================================================

  const toggleQuestionExpand = (questionId: number) => {
    setExpandedQuestions(prev => {
      const newSet = new Set(prev);
      if (newSet.has(questionId)) {
        newSet.delete(questionId);
      } else {
        newSet.add(questionId);
      }
      return newSet;
    });
  };

  const expandAllQuestions = () => {
    setExpandedQuestions(new Set(questions.map(q => q.id)));
  };

  const collapseAllQuestions = () => {
    setExpandedQuestions(new Set());
  };

  // ============================================================================
  // PARTICIPANT HANDLERS
  // ============================================================================

  const handleGenerateLink = (participant: QuizParticipantData) => {
    setGenerateLinkParticipant(participant);
    setShowGenerateLinkModal(true);
  };

  const handleOpenGenerateAllLinksModal = () => {
    setShowGenerateAllLinksModal(true);
  };

  const handleAllLinksGenerated = (expiresAt: string) => {
    setParticipants(prev => prev.map(p => ({
      ...p,
      link_status: 'active' as const,
      link_expires_at: expiresAt,
    })));
    setNotification({ type: 'success', message: 'Links gerados para todos os participantes' });
  };

  const handleLinkGenerated = (participantId: number, expiresAt: string) => {
    setParticipants(prev => prev.map(p => 
      p.id === participantId 
        ? { ...p, link_status: 'active' as const, link_expires_at: expiresAt }
        : p
    ));
  };

  const handleRemoveParticipant = (participantId: number) => {
    setDeleteTarget({ type: 'participant', id: participantId });
    setShowDeleteConfirm(true);
  };

  const handleParticipantsAdded = () => {
    void fetchParticipants();
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;

    try {
      const response = await apiClient.delete(`/api/quiz-participants/${id}/${deleteTarget.id}`);

      if (response?.success) {
        setNotification({ type: 'success', message: 'Participante removido com sucesso' });
        void fetchParticipants();
      } else {
        setNotification({ type: 'error', message: 'Erro ao remover participante' });
      }
    } catch (error) {
      console.error('Erro ao deletar:', error);
      setNotification({ type: 'error', message: 'Erro ao remover participante' });
    } finally {
      setShowDeleteConfirm(false);
      setDeleteTarget(null);
    }
  };

  // ============================================================================
  // PARTICIPANTS TABLE COLUMNS
  // ============================================================================

  const participantColumnDefs: ColDef<QuizParticipantData>[] = [
    {
      headerName: 'Participante',
      field: 'user_name',
      flex: 2,
      minWidth: 200,
      cellRenderer: (params: ICellRendererParams<QuizParticipantData>) => {
        const data = params.data;
        if (!data) return null;
        return (
          <span className="font-medium text-gray-900 dark:text-gray-100">
            {data.user_name}
          </span>
        );
      },
    },
    {
      headerName: 'Status Link',
      field: 'link_status',
      width: 130,
      cellRenderer: (params: ICellRendererParams<QuizParticipantData>) => {
        const data = params.data;
        if (!data) return null;
        
        const getStatusBadge = () => {
          switch (data.link_status) {
            case 'active':
              return (
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300">
                  <CheckCircle className="w-3 h-3" />
                  Ativo
                </span>
              );
            case 'expired':
              return (
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300">
                  <Clock className="w-3 h-3" />
                  Expirado
                </span>
              );
            default:
              return (
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                  <XCircle className="w-3 h-3" />
                  Sem link
                </span>
              );
          }
        };
        
        return (
          <div className="flex items-center h-full">
            {getStatusBadge()}
          </div>
        );
      },
    },
    {
      headerName: 'Expira em',
      field: 'link_expires_at',
      width: 150,
      cellRenderer: (params: ICellRendererParams<QuizParticipantData>) => {
        const data = params.data;
        if (!data || !data.link_expires_at) return <span className="text-gray-400">-</span>;
        
        const expiresAt = new Date(data.link_expires_at);
        const now = new Date();
        const isExpired = expiresAt < now;
        
        return (
          <div className={`flex items-center gap-1 h-full text-sm ${isExpired ? 'text-red-500' : 'text-gray-600 dark:text-gray-400'}`}>
            <Clock className="w-4 h-4" />
            {expiresAt.toLocaleDateString('pt-BR')}
          </div>
        );
      },
    },
    {
      headerName: 'Tentativas',
      field: 'attempts_used',
      width: 110,
      cellRenderer: (params: ICellRendererParams<QuizParticipantData>) => {
        const data = params.data;
        if (!data) return null;
        
        return (
          <div className="flex items-center gap-1 h-full">
            <span className={`font-medium ${data.attempts_used ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400'}`}>
              {data.attempts_used || 0}
            </span>
          </div>
        );
      },
    },
    {
      headerName: 'Melhor Nota',
      field: 'best_score',
      width: 120,
      cellRenderer: (params: ICellRendererParams<QuizParticipantData>) => {
        const data = params.data;
        if (!data || data.best_score === null || data.best_score === undefined) {
          return <span className="text-gray-400">-</span>;
        }
        
        const percentage = data.best_score_percentage || 0;
        let color = 'text-gray-600';
        if (percentage >= 80) color = 'text-green-600 dark:text-green-400';
        else if (percentage >= 60) color = 'text-yellow-600 dark:text-yellow-400';
        else if (percentage >= 40) color = 'text-orange-600 dark:text-orange-400';
        else color = 'text-red-600 dark:text-red-400';
        
        return (
          <div className={`flex items-center gap-1 h-full font-medium ${color}`}>
            <Award className="w-4 h-4" />
            {percentage}%
          </div>
        );
      },
    },
    {
      headerName: 'Ações',
      width: 120,
      cellRenderer: (params: ICellRendererParams<QuizParticipantData>) => {
        const data = params.data;
        if (!data) return null;
        
        return (
          <div className="flex items-center gap-1 h-full">
            {quiz?.is_active && (
              <button
                onClick={() => handleGenerateLink(data)}
                className="p-1.5 text-gray-500 hover:text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-900/20 rounded-lg transition-colors"
                title={data.link_status === 'active' ? 'Gerar novo link' : 'Gerar link'}
              >
                <Link className="w-4 h-4" />
              </button>
            )}
            {(!data.attempts_used || data.attempts_used === 0) && (
              <button
                onClick={() => handleRemoveParticipant(data.id)}
                className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                title="Remover participante"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        );
      },
    },
  ];

  // ============================================================================
  // RENDER
  // ============================================================================

  if (isLoadingQuiz) {
    return (
      <div className="flex items-center justify-center h-96">
        <RefreshCw className="w-8 h-8 animate-spin text-orange-500" />
      </div>
    );
  }

  if (!quiz) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-4">
        <AlertCircle className="w-12 h-12 text-gray-400" />
        <p className="text-gray-500 dark:text-gray-400">Quiz não encontrado</p>
        <button
          onClick={() => navigate('/employee-quizzes')}
          className="px-4 py-2 text-sm font-medium text-white bg-orange-500 rounded-lg hover:bg-orange-600 transition-colors"
        >
          Voltar para Quizzes
        </button>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col space-y-2">
      {/* Card de Header */}
      <div className="card p-6 pt-3 pb-3">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/employee-quizzes')}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-gray-500" />
            </button>
            <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
              <HelpCircle className="w-6 h-6 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">{quiz.title}</h1>
                {quiz.is_active ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300">
                    <CheckCircle className="w-3 h-3" />
                    Ativo
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                    <XCircle className="w-3 h-3" />
                    Inativo
                  </span>
                )}
              </div>
              {quiz.description && (
                <p className="text-sm text-gray-500 dark:text-gray-400">{quiz.description}</p>
              )}
            </div>
          </div>

          {/* Stats Cards */}
          <div className="flex items-center gap-4">
            <div className="text-center px-4 py-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <p className="text-xs text-gray-500 dark:text-gray-400">Perguntas</p>
              <p className="text-lg font-bold text-blue-600 dark:text-blue-400">{questions.length}</p>
            </div>
            <div className="text-center px-4 py-2 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
              <p className="text-xs text-gray-500 dark:text-gray-400">Participantes</p>
              <p className="text-lg font-bold text-purple-600 dark:text-purple-400">{participants.length}</p>
            </div>
            <div className="text-center px-4 py-2 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
              <p className="text-xs text-gray-500 dark:text-gray-400">Pontos</p>
              <p className="text-lg font-bold text-orange-600 dark:text-orange-400">{analytics?.quiz?.total_points || quiz.pass_score || 0}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Card de Conteúdo com Abas */}
      <div className="card p-6 pt-0 flex-1 flex flex-col">
        {/* Tabs Navigation */}
        <nav className="flex border-b border-gray-200 dark:border-gray-700 -mx-6 px-6">
          <button
            onClick={() => setActiveTab('perguntas')}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'perguntas'
                ? 'border-orange-500 text-orange-600 dark:text-orange-400'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300'
            }`}
          >
            <HelpCircle className="w-4 h-4" />
            Perguntas
          </button>
          <button
            onClick={() => setActiveTab('participantes')}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'participantes'
                ? 'border-orange-500 text-orange-600 dark:text-orange-400'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300'
            }`}
          >
            <Users className="w-4 h-4" />
            Participantes
          </button>
          <button
            onClick={() => setActiveTab('acompanhamento')}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'acompanhamento'
                ? 'border-orange-500 text-orange-600 dark:text-orange-400'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            Acompanhamento
          </button>
        </nav>

        {/* Tab Content */}
        <div className="flex-1 pt-4 overflow-auto">
          {/* Perguntas Tab */}
          {activeTab === 'perguntas' && (
            <div className="space-y-4">
              {/* Actions */}
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {questions.length} {questions.length === 1 ? 'pergunta' : 'perguntas'}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={expandAllQuestions}
                    className="px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                  >
                    Expandir Todas
                  </button>
                  <button
                    onClick={collapseAllQuestions}
                    className="px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                  >
                    Recolher Todas
                  </button>
                </div>
              </div>

              {/* Questions List */}
              {questions.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <HelpCircle className="w-12 h-12 text-gray-300 dark:text-gray-600 mb-3" />
                  <p className="text-gray-500 dark:text-gray-400">Nenhuma pergunta cadastrada</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {questions.map((question, index) => (
                    <CollapsibleQuestion
                      key={question.id}
                      question={question}
                      index={index}
                      isExpanded={expandedQuestions.has(question.id)}
                      onToggle={() => toggleQuestionExpand(question.id)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Participantes Tab */}
          {activeTab === 'participantes' && (
            <div className="flex flex-col h-full">
              {/* Actions */}
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {participants.length} {participants.length === 1 ? 'participante' : 'participantes'}
                </p>
                <div className="flex items-center gap-2">
                  {quiz.is_active && participants.length > 0 && (
                    <button
                      onClick={handleOpenGenerateAllLinksModal}
                      className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-purple-700 dark:text-purple-300 bg-purple-100 dark:bg-purple-900/30 rounded-lg hover:bg-purple-200 dark:hover:bg-purple-900/50 transition-colors"
                    >
                      <Link className="w-4 h-4" />
                      Gerar Links para Todos
                    </button>
                  )}
                  <button
                    onClick={() => setShowParticipantModal(true)}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-orange-500 rounded-lg hover:bg-orange-600 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    Adicionar Participante
                  </button>
                </div>
              </div>

              {/* AG-Grid Table */}
              <div className="flex-1 ag-theme-alpine dark:ag-theme-alpine-dark">
                <AgGridReact<QuizParticipantData>
                  rowData={participants}
                  columnDefs={participantColumnDefs}
                  defaultColDef={{
                    sortable: true,
                    filter: true,
                    resizable: true,
                  }}
                  animateRows={true}
                  rowHeight={50}
                  headerHeight={40}
                  suppressRowClickSelection={true}
                  overlayLoadingTemplate='<span class="ag-overlay-loading-center">Carregando participantes...</span>'
                  overlayNoRowsTemplate='<span class="ag-overlay-no-rows-center">Nenhum participante encontrado</span>'
                />
              </div>
            </div>
          )}

          {/* Acompanhamento Tab */}
          {activeTab === 'acompanhamento' && (
            <div className="space-y-6">
              {isLoadingAnalytics ? (
                <div className="flex items-center justify-center py-12">
                  <RefreshCw className="w-8 h-8 animate-spin text-orange-500" />
                </div>
              ) : analytics ? (
                <>
                  {/* Summary Cards */}
                  <div className="grid grid-cols-6 gap-4">
                    <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
                      <div className="flex items-center gap-2 mb-2">
                        <Users className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                        <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Participantes</span>
                      </div>
                      <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                        {analytics.summary.total_participants}
                      </p>
                    </div>
                    <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-xl">
                      <div className="flex items-center gap-2 mb-2">
                        <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
                        <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Completaram</span>
                      </div>
                      <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                        {analytics.summary.completed_count}
                      </p>
                    </div>
                    <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-xl">
                      <div className="flex items-center gap-2 mb-2">
                        <Percent className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                        <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Taxa Conclusão</span>
                      </div>
                      <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                        {analytics.summary.completion_rate}%
                      </p>
                    </div>
                    <div className="p-4 bg-orange-50 dark:bg-orange-900/20 rounded-xl">
                      <div className="flex items-center gap-2 mb-2">
                        <Target className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                        <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Média Geral</span>
                      </div>
                      <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                        {analytics.summary.average_score}%
                      </p>
                    </div>
                    <div className="p-4 bg-cyan-50 dark:bg-cyan-900/20 rounded-xl">
                      <div className="flex items-center gap-2 mb-2">
                        <RefreshCw className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
                        <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Tentativas</span>
                      </div>
                      <p className="text-2xl font-bold text-cyan-600 dark:text-cyan-400">
                        {analytics.summary.total_attempts}
                      </p>
                    </div>
                    <div className="p-4 bg-pink-50 dark:bg-pink-900/20 rounded-xl">
                      <div className="flex items-center gap-2 mb-2">
                        <TrendingUp className="w-5 h-5 text-pink-600 dark:text-pink-400" />
                        <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Média/Participante</span>
                      </div>
                      <p className="text-2xl font-bold text-pink-600 dark:text-pink-400">
                        {analytics.summary.avg_attempts_per_participant}
                      </p>
                    </div>
                  </div>

                  {/* Charts Row */}
                  <div className="grid grid-cols-2 gap-6">
                    {/* Distribution Chart */}
                    <div className="p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
                      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">
                        Distribuição de Notas
                      </h3>
                      <ResponsiveContainer width="100%" height={250}>
                        <BarChart data={analytics.distribution}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.2} />
                          <XAxis 
                            dataKey="range" 
                            tick={{ fill: '#6B7280', fontSize: 12 }}
                          />
                          <YAxis 
                            tick={{ fill: '#6B7280', fontSize: 12 }}
                            allowDecimals={false}
                          />
                          <Tooltip 
                            contentStyle={{ 
                              backgroundColor: '#1F2937', 
                              border: 'none', 
                              borderRadius: '8px',
                              color: '#F9FAFB'
                            }}
                          />
                          <Bar 
                            dataKey="count" 
                            name="Participantes"
                            radius={[4, 4, 0, 0]}
                          >
                            {analytics.distribution.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>

                    {/* Completion Pie Chart */}
                    <div className="p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
                      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">
                        Respondidos vs Pendentes
                      </h3>
                      <ResponsiveContainer width="100%" height={250}>
                        <PieChart>
                          <Pie
                            data={[
                              { name: 'Respondidos', value: analytics.summary.completed_count, color: '#22c55e' },
                              { name: 'Pendentes', value: analytics.summary.total_participants - analytics.summary.completed_count, color: '#e5e7eb' },
                            ]}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={90}
                            paddingAngle={2}
                            dataKey="value"
                          >
                            <Cell fill="#22c55e" />
                            <Cell fill="#e5e7eb" />
                          </Pie>
                          <Tooltip 
                            contentStyle={{ 
                              backgroundColor: '#1F2937', 
                              border: 'none', 
                              borderRadius: '8px',
                              color: '#F9FAFB'
                            }}
                          />
                          <Legend />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Temporal Evolution Chart */}
                  <div className="p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
                    <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">
                      Evolução Temporal (últimos 30 dias)
                    </h3>
                    <ResponsiveContainer width="100%" height={250}>
                      <LineChart data={analytics.temporal_evolution}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.2} />
                        <XAxis 
                          dataKey="date" 
                          tick={{ fill: '#6B7280', fontSize: 10 }}
                          tickFormatter={(value) => {
                            const date = new Date(value);
                            return `${date.getDate()}/${date.getMonth() + 1}`;
                          }}
                        />
                        <YAxis 
                          yAxisId="left"
                          tick={{ fill: '#6B7280', fontSize: 12 }}
                          allowDecimals={false}
                        />
                        <YAxis 
                          yAxisId="right"
                          orientation="right"
                          tick={{ fill: '#6B7280', fontSize: 12 }}
                          domain={[0, 100]}
                        />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: '#1F2937', 
                            border: 'none', 
                            borderRadius: '8px',
                            color: '#F9FAFB'
                          }}
                          labelFormatter={(value) => {
                            const date = new Date(value);
                            return date.toLocaleDateString('pt-BR');
                          }}
                        />
                        <Legend />
                        <Line 
                          yAxisId="left"
                          type="monotone" 
                          dataKey="count" 
                          name="Respostas" 
                          stroke="#8b5cf6" 
                          strokeWidth={2}
                          dot={false}
                        />
                        <Line 
                          yAxisId="right"
                          type="monotone" 
                          dataKey="avgScore" 
                          name="Média %" 
                          stroke="#f97316" 
                          strokeWidth={2}
                          dot={false}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Ranking Table */}
                  <div className="p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
                    <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4 flex items-center gap-2">
                      <Medal className="w-5 h-5 text-yellow-500" />
                      Ranking de Participantes (Top 10)
                    </h3>
                    {analytics.ranking.length === 0 ? (
                      <p className="text-center text-gray-500 dark:text-gray-400 py-8">
                        Nenhum participante completou o quiz ainda
                      </p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="text-left border-b border-gray-200 dark:border-gray-700">
                              <th className="pb-3 font-medium text-gray-500 dark:text-gray-400 w-12">#</th>
                              <th className="pb-3 font-medium text-gray-500 dark:text-gray-400">Participante</th>
                              <th className="pb-3 font-medium text-gray-500 dark:text-gray-400 text-right">Pontuação</th>
                              <th className="pb-3 font-medium text-gray-500 dark:text-gray-400 text-right">Percentual</th>
                              <th className="pb-3 font-medium text-gray-500 dark:text-gray-400 text-right">Data</th>
                            </tr>
                          </thead>
                          <tbody>
                            {analytics.ranking.map((participant, index) => (
                              <tr 
                                key={participant.participant_id} 
                                className="border-b border-gray-100 dark:border-gray-700/50"
                              >
                                <td className="py-3">
                                  {index < 3 ? (
                                    <span className={`flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
                                      index === 0 ? 'bg-yellow-100 text-yellow-700' :
                                      index === 1 ? 'bg-gray-200 text-gray-700' :
                                      'bg-orange-100 text-orange-700'
                                    }`}>
                                      {index + 1}
                                    </span>
                                  ) : (
                                    <span className="text-gray-500 dark:text-gray-400 pl-2">{index + 1}</span>
                                  )}
                                </td>
                                <td className="py-3 font-medium text-gray-900 dark:text-gray-100">
                                  {participant.name}
                                </td>
                                <td className="py-3 text-right text-gray-600 dark:text-gray-400">
                                  {participant.score}/{participant.total_points}
                                </td>
                                <td className="py-3 text-right">
                                  <span className={`font-semibold ${
                                    participant.percentage >= 80 ? 'text-green-600 dark:text-green-400' :
                                    participant.percentage >= 60 ? 'text-yellow-600 dark:text-yellow-400' :
                                    participant.percentage >= 40 ? 'text-orange-600 dark:text-orange-400' :
                                    'text-red-600 dark:text-red-400'
                                  }`}>
                                    {participant.percentage}%
                                  </span>
                                </td>
                                <td className="py-3 text-right text-gray-500 dark:text-gray-400">
                                  {new Date(participant.completed_at).toLocaleDateString('pt-BR')}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <BarChart3 className="w-12 h-12 text-gray-300 dark:text-gray-600 mb-3" />
                  <p className="text-gray-500 dark:text-gray-400">Nenhum dado de acompanhamento disponível</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      {showParticipantModal && id && (
        <QuizParticipantModal
          isOpen={showParticipantModal}
          onClose={() => setShowParticipantModal(false)}
          quizId={parseInt(id)}
          onSuccess={handleParticipantsAdded}
          existingParticipantIds={participants.map(p => p.user_id)}
        />
      )}

      {showGenerateLinkModal && id && generateLinkParticipant && (
        <QuizGenerateLinkModal
          isOpen={showGenerateLinkModal}
          onClose={() => {
            setShowGenerateLinkModal(false);
            setGenerateLinkParticipant(null);
          }}
          quizId={parseInt(id)}
          participantId={generateLinkParticipant.id}
          participantName={generateLinkParticipant.user_name}
          onSuccess={(expiresAt) => handleLinkGenerated(generateLinkParticipant.id, expiresAt)}
        />
      )}

      {showGenerateAllLinksModal && id && (
        <QuizGenerateAllLinksModal
          isOpen={showGenerateAllLinksModal}
          onClose={() => setShowGenerateAllLinksModal(false)}
          quizId={parseInt(id)}
          participantCount={participants.length}
          onSuccess={handleAllLinksGenerated}
        />
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-full">
                <AlertCircle className="w-6 h-6 text-red-600 dark:text-red-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Confirmar Exclusão
              </h3>
            </div>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Tem certeza que deseja remover este participante? Esta ação não pode ser desfeita.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setDeleteTarget(null);
                }}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmDelete}
                className="px-4 py-2 text-sm font-medium text-white bg-red-500 rounded-lg hover:bg-red-600 transition-colors"
              >
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Notification Toast */}
      {notification && (
        <NotificationToast
          type={notification.type}
          message={notification.message}
          onClose={() => setNotification(null)}
        />
      )}
    </div>
  );
};

export default EmployeeQuizDetail;
