/**
 * QuizDetail - Página de Detalhes do Quiz
 * 
 * Exibe detalhes de um quiz com duas abas:
 * - Perguntas: CRUD de perguntas e opções com reordenação
 * - Participantes: Gerenciamento de participantes e links temporários
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { AgGridReact } from 'ag-grid-react';
import { ColDef, ICellRendererParams } from 'ag-grid-community';
import {
  ArrowLeft,
  Plus,
  Save,
  Trash2,
  ChevronDown,
  ChevronRight,
  GripVertical,
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
} from 'lucide-react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import apiClient from '../lib/apiClient';
import {
  QuizData,
  QuizQuestionData,
  QuizQuestionOptionData,
  QuizParticipantData,
} from '../types';
import QuizParticipantModal from '../components/QuizParticipantModal';
import QuizGenerateLinkModal from '../components/QuizGenerateLinkModal';
import QuizGenerateAllLinksModal from '../components/QuizGenerateAllLinksModal';

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
// SORTABLE QUESTION ITEM COMPONENT
// ============================================================================

interface SortableQuestionProps {
  question: QuizQuestionData;
  index: number;
  isExpanded: boolean;
  disabled?: boolean;
  onToggleExpand: () => void;
  onEditQuestion: (question: QuizQuestionData) => void;
  onDeleteQuestion: (questionId: number) => void;
  onAddOption: (questionId: number) => void;
  onEditOption: (option: QuizQuestionOptionData) => void;
  onDeleteOption: (optionId: number, questionId: number) => void;
  onToggleCorrect: (option: QuizQuestionOptionData) => void;
}

const SortableQuestionItem = ({
  question,
  index,
  isExpanded,
  disabled = false,
  onToggleExpand,
  onEditQuestion,
  onDeleteQuestion,
  onAddOption,
  onEditOption,
  onDeleteOption,
  onToggleCorrect,
}: SortableQuestionProps) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: question.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : 1,
  };

  const correctCount = question.options?.filter(o => o.is_correct).length || 0;
  const optionCount = question.options?.length || 0;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`bg-white dark:bg-gray-800 rounded-lg border ${
        isDragging ? 'border-orange-500 shadow-lg' : 'border-gray-200 dark:border-gray-700'
      } overflow-hidden`}
    >
      {/* Header da Pergunta */}
      <div className="flex items-center gap-3 p-4 bg-gray-50 dark:bg-gray-800/50">
        <button
          {...(disabled ? {} : { ...attributes, ...listeners })}
          className={`${
            disabled 
              ? 'text-gray-300 dark:text-gray-600 cursor-not-allowed' 
              : 'cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
          }`}
          disabled={disabled}
        >
          <GripVertical className="w-5 h-5" />
        </button>
        
        <button
          onClick={onToggleExpand}
          className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
        >
          {isExpanded ? (
            <ChevronDown className="w-5 h-5" />
          ) : (
            <ChevronRight className="w-5 h-5" />
          )}
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-gray-500 dark:text-gray-400">
              {index + 1}.
            </span>
            <span className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
              {question.question_text}
            </span>
          </div>
          <div className="flex items-center gap-3 mt-1">
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
              question.question_type === 'single_choice'
                ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                : 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300'
            }`}>
              {question.question_type === 'single_choice' ? 'Escolha Única' : 'Múltipla Escolha'}
            </span>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {question.points} pt{question.points !== 1 ? 's' : ''}
            </span>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {optionCount} opções ({correctCount} correta{correctCount !== 1 ? 's' : ''})
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => onEditQuestion(question)}
            disabled={disabled}
            className={`p-2 rounded-lg transition-colors ${
              disabled 
                ? 'text-gray-300 dark:text-gray-600 cursor-not-allowed' 
                : 'text-gray-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20'
            }`}
            title={disabled ? 'Quiz já respondido' : 'Editar pergunta'}
          >
            <HelpCircle className="w-4 h-4" />
          </button>
          <button
            onClick={() => onDeleteQuestion(question.id)}
            disabled={disabled}
            className={`p-2 rounded-lg transition-colors ${
              disabled 
                ? 'text-gray-300 dark:text-gray-600 cursor-not-allowed' 
                : 'text-gray-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20'
            }`}
            title={disabled ? 'Quiz já respondido' : 'Excluir pergunta'}
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Opções (expandível) */}
      {isExpanded && (
        <div className="p-4 border-t border-gray-200 dark:border-gray-700 space-y-2">
          {question.options && question.options.length > 0 ? (
            question.options.map((option, optIndex) => (
              <div
                key={option.id}
                className={`flex items-center gap-3 p-3 rounded-lg ${
                  option.is_correct
                    ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
                    : 'bg-gray-50 dark:bg-gray-700/50 border border-transparent'
                }`}
              >
                <span className="text-sm font-medium text-gray-400 w-6">
                  {String.fromCharCode(65 + optIndex)}.
                </span>
                <span className="flex-1 text-sm text-gray-700 dark:text-gray-300">
                  {option.option_text}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => onToggleCorrect(option)}
                    disabled={disabled}
                    className={`p-1.5 rounded-lg transition-colors ${
                      disabled
                        ? 'text-gray-300 dark:text-gray-600 cursor-not-allowed'
                        : option.is_correct
                          ? 'text-green-600 hover:bg-green-100 dark:hover:bg-green-900/30'
                          : 'text-gray-400 hover:text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20'
                    }`}
                    title={disabled ? 'Quiz já respondido' : option.is_correct ? 'Remover como correta' : 'Marcar como correta'}
                  >
                    <CheckCircle className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => onEditOption(option)}
                    disabled={disabled}
                    className={`p-1.5 rounded-lg transition-colors ${
                      disabled
                        ? 'text-gray-300 dark:text-gray-600 cursor-not-allowed'
                        : 'text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20'
                    }`}
                    title={disabled ? 'Quiz já respondido' : 'Editar opção'}
                  >
                    <HelpCircle className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => onDeleteOption(option.id, question.id)}
                    disabled={disabled}
                    className={`p-1.5 rounded-lg transition-colors ${
                      disabled
                        ? 'text-gray-300 dark:text-gray-600 cursor-not-allowed'
                        : 'text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20'
                    }`}
                    title={disabled ? 'Quiz já respondido' : 'Excluir opção'}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          ) : (
            <p className="text-sm text-gray-500 dark:text-gray-400 italic">
              Nenhuma opção cadastrada
            </p>
          )}
          
          {!disabled && (
            <button
              onClick={() => onAddOption(question.id)}
              className="flex items-center gap-2 px-3 py-2 text-sm text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-900/20 rounded-lg transition-colors"
            >
              <Plus className="w-4 h-4" />
              Adicionar Opção
            </button>
          )}
        </div>
      )}
    </div>
  );
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

const QuizDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  // Estado da aba ativa
  const [activeTab, setActiveTab] = useState<'perguntas' | 'participantes'>('perguntas');

  // Estado do quiz
  const [quiz, setQuiz] = useState<QuizData | null>(null);
  const [isLoadingQuiz, setIsLoadingQuiz] = useState(true);

  // Estado das perguntas
  const [questions, setQuestions] = useState<QuizQuestionData[]>([]);
  const [isLoadingQuestions, setIsLoadingQuestions] = useState(false);
  const [expandedQuestions, setExpandedQuestions] = useState<Set<number>>(new Set());

  // Estado dos participantes
  const [participants, setParticipants] = useState<QuizParticipantData[]>([]);
  const [isLoadingParticipants, setIsLoadingParticipants] = useState(false);

  // Modais
  const [showQuestionModal, setShowQuestionModal] = useState(false);
  const [questionToEdit, setQuestionToEdit] = useState<QuizQuestionData | null>(null);
  const [showOptionModal, setShowOptionModal] = useState(false);
  const [optionToEdit, setOptionToEdit] = useState<QuizQuestionOptionData | null>(null);
  const [optionQuestionId, setOptionQuestionId] = useState<number | null>(null);
  const [showParticipantModal, setShowParticipantModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'question' | 'option' | 'participant'; id: number; questionId?: number } | null>(null);
  const [showGenerateLinkModal, setShowGenerateLinkModal] = useState(false);
  const [generateLinkParticipant, setGenerateLinkParticipant] = useState<QuizParticipantData | null>(null);

  // Formulário de pergunta
  const [questionForm, setQuestionForm] = useState({
    question_text: '',
    question_type: 'single_choice' as 'single_choice' | 'multiple_choice',
    hint: '',
    explanation: '',
    points: 1,
  });

  // Formulário de opção
  const [optionForm, setOptionForm] = useState({
    option_text: '',
    is_correct: false,
    rationale: '',
  });

  // Notificações
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Sensors para drag and drop
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

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
      } else {
        setNotification({ type: 'error', message: 'Erro ao carregar quiz' });
      }
    } catch (error) {
      console.error('Erro ao buscar quiz:', error);
      setNotification({ type: 'error', message: 'Erro ao carregar quiz' });
    } finally {
      setIsLoadingQuiz(false);
    }
  }, [id]);

  const fetchQuestions = useCallback(async () => {
    if (!id) return;
    
    setIsLoadingQuestions(true);
    try {
      const response = await apiClient.get<QuizQuestionData[]>(`/api/quiz/${id}/questions`);
      if (response.success) {
        setQuestions(response.data || []);
      } else {
        setNotification({ type: 'error', message: 'Erro ao carregar perguntas' });
      }
    } catch (error) {
      console.error('Erro ao buscar perguntas:', error);
      setNotification({ type: 'error', message: 'Erro ao carregar perguntas' });
    } finally {
      setIsLoadingQuestions(false);
    }
  }, [id]);

  const fetchParticipants = useCallback(async () => {
    if (!id) return;
    
    setIsLoadingParticipants(true);
    try {
      const response = await apiClient.get<QuizParticipantData[]>(`/api/quiz-participants/${id}`);
      if (response.success) {
        setParticipants(response.data || []);
      } else {
        setNotification({ type: 'error', message: 'Erro ao carregar participantes' });
      }
    } catch (error) {
      console.error('Erro ao buscar participantes:', error);
      setNotification({ type: 'error', message: 'Erro ao carregar participantes' });
    } finally {
      setIsLoadingParticipants(false);
    }
  }, [id]);

  // Carregar dados iniciais
  useEffect(() => {
    void fetchQuiz();
    void fetchQuestions();
  }, [fetchQuiz, fetchQuestions]);

  // Carregar participantes quando a aba for selecionada
  useEffect(() => {
    if (activeTab === 'participantes' && participants.length === 0) {
      void fetchParticipants();
    }
  }, [activeTab, participants.length, fetchParticipants]);

  // ============================================================================
  // TOGGLE QUIZ STATUS
  // ============================================================================

  const toggleQuizStatus = async () => {
    if (!quiz || !id) return;

    try {
      const response = await apiClient.patch(`/api/quiz/${id}/toggle-active`, {});

      if (response.success) {
        // Atualiza o estado local
        setQuiz(prev => prev ? { ...prev, is_active: !prev.is_active } : null);
        setNotification({ 
          type: 'success', 
          message: `Quiz ${quiz.is_active ? 'desativado' : 'ativado'} com sucesso` 
        });
      } else {
        setNotification({ type: 'error', message: 'Erro ao alterar status do quiz' });
      }
    } catch (error) {
      console.error('Erro ao alterar status do quiz:', error);
      setNotification({ type: 'error', message: 'Erro ao alterar status do quiz' });
    }
  };

  // ============================================================================
  // QUESTION HANDLERS
  // ============================================================================

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = questions.findIndex(q => q.id === active.id);
      const newIndex = questions.findIndex(q => q.id === over.id);

      // Atualiza localmente primeiro para feedback imediato
      const reorderedQuestions = arrayMove(questions, oldIndex, newIndex);
      setQuestions(reorderedQuestions);

      // Persiste no backend
      try {
        const questionIds = reorderedQuestions.map(q => q.id);
        await apiClient.put(`/api/quiz/${id}/questions/reorder`, { question_ids: questionIds });
      } catch (error) {
        console.error('Erro ao reordenar perguntas:', error);
        setNotification({ type: 'error', message: 'Erro ao reordenar perguntas' });
        // Reverter em caso de erro
        void fetchQuestions();
      }
    }
  };

  const handleSaveQuestion = async () => {
    if (!questionForm.question_text.trim()) {
      setNotification({ type: 'error', message: 'Preencha o texto da pergunta' });
      return;
    }

    try {
      if (questionToEdit) {
        // Atualizar pergunta existente
        const response = await apiClient.put(`/api/quiz/${id}/questions/${questionToEdit.id}`, questionForm);
        if (response.success) {
          setNotification({ type: 'success', message: 'Pergunta atualizada com sucesso' });
          void fetchQuestions();
        } else {
          setNotification({ type: 'error', message: 'Erro ao atualizar pergunta' });
        }
      } else {
        // Criar nova pergunta
        const response = await apiClient.post(`/api/quiz/${id}/questions`, questionForm);
        if (response.success) {
          setNotification({ type: 'success', message: 'Pergunta criada com sucesso' });
          void fetchQuestions();
        } else {
          setNotification({ type: 'error', message: 'Erro ao criar pergunta' });
        }
      }

      setShowQuestionModal(false);
      setQuestionToEdit(null);
      setQuestionForm({
        question_text: '',
        question_type: 'single_choice',
        hint: '',
        explanation: '',
        points: 1,
      });
    } catch (error) {
      console.error('Erro ao salvar pergunta:', error);
      setNotification({ type: 'error', message: 'Erro ao salvar pergunta' });
    }
  };

  const handleEditQuestion = (question: QuizQuestionData) => {
    setQuestionToEdit(question);
    setQuestionForm({
      question_text: question.question_text,
      question_type: question.question_type,
      hint: question.hint || '',
      explanation: question.explanation || '',
      points: question.points,
    });
    setShowQuestionModal(true);
  };

  const handleDeleteQuestion = (questionId: number) => {
    setDeleteTarget({ type: 'question', id: questionId });
    setShowDeleteConfirm(true);
  };

  // ============================================================================
  // OPTION HANDLERS
  // ============================================================================

  const handleAddOption = (questionId: number) => {
    setOptionQuestionId(questionId);
    setOptionToEdit(null);
    setOptionForm({
      option_text: '',
      is_correct: false,
      rationale: '',
    });
    setShowOptionModal(true);
  };

  const handleEditOption = (option: QuizQuestionOptionData) => {
    setOptionQuestionId(option.question_id);
    setOptionToEdit(option);
    setOptionForm({
      option_text: option.option_text,
      is_correct: option.is_correct,
      rationale: option.rationale || '',
    });
    setShowOptionModal(true);
  };

  const handleSaveOption = async () => {
    if (!optionForm.option_text.trim() || !optionQuestionId) {
      setNotification({ type: 'error', message: 'Preencha o texto da opção' });
      return;
    }

    try {
      if (optionToEdit) {
        // Atualizar opção existente
        const response = await apiClient.put(`/api/quiz/${id}/questions/${optionQuestionId}/options/${optionToEdit.id}`, optionForm);
        if (response.success) {
          setNotification({ type: 'success', message: 'Opção atualizada com sucesso' });
          void fetchQuestions();
        } else {
          setNotification({ type: 'error', message: 'Erro ao atualizar opção' });
        }
      } else {
        // Criar nova opção
        const response = await apiClient.post(`/api/quiz/${id}/questions/${optionQuestionId}/options`, optionForm);
        if (response.success) {
          setNotification({ type: 'success', message: 'Opção criada com sucesso' });
          void fetchQuestions();
        } else {
          setNotification({ type: 'error', message: 'Erro ao criar opção' });
        }
      }

      setShowOptionModal(false);
      setOptionToEdit(null);
      setOptionQuestionId(null);
      setOptionForm({
        option_text: '',
        is_correct: false,
        rationale: '',
      });
    } catch (error) {
      console.error('Erro ao salvar opção:', error);
      setNotification({ type: 'error', message: 'Erro ao salvar opção' });
    }
  };

  const handleDeleteOption = (optionId: number, questionId: number) => {
    setDeleteTarget({ type: 'option', id: optionId, questionId });
    setShowDeleteConfirm(true);
  };

  const handleToggleCorrect = async (option: QuizQuestionOptionData) => {
    try {
      const response = await apiClient.put(
        `/api/quiz/${id}/questions/${option.question_id}/options/${option.id}`,
        { is_correct: !option.is_correct }
      );
      if (response.success) {
        void fetchQuestions();
      } else {
        setNotification({ type: 'error', message: 'Erro ao atualizar opção' });
      }
    } catch (error) {
      console.error('Erro ao alternar resposta correta:', error);
      setNotification({ type: 'error', message: 'Erro ao atualizar opção' });
    }
  };

  // ============================================================================
  // PARTICIPANT HANDLERS
  // ============================================================================

  const handleGenerateLink = (participant: QuizParticipantData) => {
    setGenerateLinkParticipant(participant);
    setShowGenerateLinkModal(true);
  };

  // Estado do modal de gerar links para todos
  const [showGenerateAllLinksModal, setShowGenerateAllLinksModal] = useState(false);

  const handleOpenGenerateAllLinksModal = () => {
    setShowGenerateAllLinksModal(true);
  };

  // Callback quando links são gerados para todos - atualiza estado local
  const handleAllLinksGenerated = (expiresAt: string) => {
    // Atualizar o status de todos os participantes localmente
    setParticipants(prev => prev.map(p => ({
      ...p,
      link_status: 'active' as const,
      link_expires_at: expiresAt,
    })));
    setNotification({ type: 'success', message: 'Links gerados para todos os participantes' });
  };

  // Callback quando um link individual é gerado - atualiza estado local
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

  // ============================================================================
  // DELETE CONFIRMATION HANDLER
  // ============================================================================

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;

    try {
      let response;
      let successMessage = '';

      switch (deleteTarget.type) {
        case 'question':
          response = await apiClient.delete(`/api/quiz/${id}/questions/${deleteTarget.id}`);
          successMessage = 'Pergunta excluída com sucesso';
          break;
        case 'option':
          response = await apiClient.delete(`/api/quiz/${id}/questions/${deleteTarget.questionId}/options/${deleteTarget.id}`);
          successMessage = 'Opção excluída com sucesso';
          break;
        case 'participant':
          response = await apiClient.delete(`/api/quiz-participants/${id}/${deleteTarget.id}`);
          successMessage = 'Participante removido com sucesso';
          break;
      }

      if (response?.success) {
        setNotification({ type: 'success', message: successMessage });
        if (deleteTarget.type === 'participant') {
          void fetchParticipants();
        } else {
          void fetchQuestions();
        }
      } else {
        setNotification({ type: 'error', message: 'Erro ao excluir' });
      }
    } catch (error) {
      console.error('Erro ao excluir:', error);
      setNotification({ type: 'error', message: 'Erro ao excluir' });
    } finally {
      setShowDeleteConfirm(false);
      setDeleteTarget(null);
    }
  };

  // ============================================================================
  // AG-GRID COLUMNS FOR PARTICIPANTS
  // ============================================================================

  const participantColumns: ColDef<QuizParticipantData>[] = [
    {
      field: 'user_name',
      headerName: 'Participante',
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
      field: 'link_status',
      headerName: 'Status Link',
      width: 120,
      cellRenderer: (params: ICellRendererParams<QuizParticipantData>) => {
        const status = params.value as string;
        const colors: Record<string, string> = {
          not_generated: 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300',
          active: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300',
          expired: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300',
          used: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',
        };
        const labels: Record<string, string> = {
          not_generated: 'Não gerado',
          active: 'Ativo',
          expired: 'Expirado',
          used: 'Utilizado',
        };
        return (
          <span className={`px-2 py-1 rounded-full text-xs font-medium ${colors[status] || colors.not_generated}`}>
            {labels[status] || status}
          </span>
        );
      },
    },
    {
      field: 'link_expires_at',
      headerName: 'Expira em',
      width: 130,
      valueFormatter: (params) => {
        if (!params.value) return '–';
        return new Date(params.value).toLocaleDateString('pt-BR');
      },
    },
    {
      headerName: 'Tentativas',
      width: 110,
      cellRenderer: (params: ICellRendererParams<QuizParticipantData>) => {
        const data = params.data;
        if (!data) return '';
        const limit = data.attempt_limit;
        const used = data.attempts_used || 0;
        return (
          <span className="text-orange-600 dark:text-orange-400 font-medium">
            {used}/{limit ?? '∞'}
          </span>
        );
      },
    },
    {
      field: 'best_score_percentage',
      headerName: 'Melhor N...',
      width: 120,
      cellRenderer: (params: ICellRendererParams<QuizParticipantData>) => {
        const data = params.data;
        if (!data || data.best_score === null) return '–';
        return (
          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
            data.passed ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' : 
            data.passed === false ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300' : 
            'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
          }`}>
            {data.best_score_percentage}%
          </span>
        );
      },
    },
    {
      headerName: 'Ações',
      width: 80,
      sortable: false,
      filter: false,
      cellRenderer: (params: ICellRendererParams<QuizParticipantData>) => {
        const data = params.data;
        if (!data) return null;
        
        return (
          <div className="flex items-center justify-center gap-1 h-full">
            {quiz?.is_active && (
              <button
                onClick={() => handleGenerateLink(data)}
                className="p-1.5 text-gray-500 hover:text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-900/20 rounded-lg transition-colors"
                title={data.link_status === 'active' ? 'Gerar novo link' : 'Gerar link'}
              >
                <Link className="w-4 h-4" />
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
          onClick={() => navigate('/quizzes')}
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
              onClick={() => navigate('/quizzes')}
              className="p-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {quiz.title}
              </h2>
              {quiz.description && (
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  {quiz.description}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* Indicador de status */}
            <span className={`px-2 py-1 text-xs font-medium rounded-full ${
              quiz.is_active 
                ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400' 
                : 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
            }`}>
              {quiz.is_active ? 'Ativo' : 'Inativo'}
            </span>
            
            {/* Botão toggle Status */}
            <button
              onClick={toggleQuizStatus}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 ${
                quiz.is_active 
                  ? 'bg-green-500 hover:bg-green-600' 
                  : 'bg-gray-300 hover:bg-gray-400 dark:bg-gray-600 dark:hover:bg-gray-500'
              }`}
              title={quiz.is_active ? 'Desativar quiz' : 'Ativar quiz'}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  quiz.is_active ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-4 gap-3">
          {/* Perguntas */}
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 border border-blue-200 dark:border-blue-800">
            <div className="flex items-center justify-between mb-1">
              <div className="text-xs text-blue-600 dark:text-blue-400">Perguntas</div>
              <HelpCircle className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="text-2xl font-bold text-blue-700 dark:text-blue-300">
              {questions.length}
            </div>
          </div>

          {/* Participantes */}
          <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-3 border border-purple-200 dark:border-purple-800">
            <div className="flex items-center justify-between mb-1">
              <div className="text-xs text-purple-600 dark:text-purple-400">Participantes</div>
              <Users className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div className="text-2xl font-bold text-purple-700 dark:text-purple-300">
              {quiz.participant_count || 0}
            </div>
          </div>

          {/* Nota Mínima */}
          <div className="bg-orange-50 dark:bg-orange-900/20 rounded-lg p-3 border border-orange-200 dark:border-orange-800">
            <div className="flex items-center justify-between mb-1">
              <div className="text-xs text-orange-600 dark:text-orange-400">Nota Mínima</div>
              <Award className="w-5 h-5 text-orange-600 dark:text-orange-400" />
            </div>
            <div className="text-2xl font-bold text-orange-700 dark:text-orange-300">
              {quiz.pass_score ? `${quiz.pass_score}%` : '–'}
            </div>
          </div>

          {/* Tentativas */}
          <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3 border border-green-200 dark:border-green-800">
            <div className="flex items-center justify-between mb-1">
              <div className="text-xs text-green-600 dark:text-green-400">Tentativas</div>
              <Clock className="w-5 h-5 text-green-600 dark:text-green-400" />
            </div>
            <div className="text-2xl font-bold text-green-700 dark:text-green-300">
              {quiz.attempt_limit ? quiz.attempt_limit : 'Ilimitado'}
            </div>
          </div>
        </div>
      </div>

      {/* Card com Tabs */}
      <div className="card flex-1 flex flex-col overflow-hidden">
        <div className="border-b border-gray-200 dark:border-gray-700">
          <nav className="flex justify-between items-center -mb-px px-6">
            <div className="flex">
              <button
                onClick={() => setActiveTab('perguntas')}
                className={`whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm mr-8 ${
                  activeTab === 'perguntas'
                    ? 'border-primary-500 text-primary-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-300 dark:hover:text-gray-200'
                }`}
              >
                Perguntas
              </button>
              <button
                onClick={() => setActiveTab('participantes')}
                className={`whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'participantes'
                    ? 'border-primary-500 text-primary-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-300 dark:hover:text-gray-200'
                }`}
              >
                Participantes
              </button>
            </div>
          </nav>
        </div>

        {/* Tab Content */}
        <div className="p-6 flex-1 overflow-auto">
          {/* Perguntas Tab */}
          {activeTab === 'perguntas' && (
            <div className="space-y-4">
              {/* Warning Banner quando quiz já foi respondido */}
              {quiz.has_attempts && (
                <div className="flex items-center gap-3 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                  <AlertCircle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0" />
                  <p className="text-sm text-yellow-700 dark:text-yellow-300">
                    Este quiz já foi respondido por participantes. Não é possível adicionar, editar ou remover perguntas.
                  </p>
                </div>
              )}

              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  Perguntas do Quiz
                </h3>
                {!quiz.has_attempts && (
                  <button
                    onClick={() => {
                      setQuestionToEdit(null);
                      setQuestionForm({
                        question_text: '',
                        question_type: 'single_choice',
                        hint: '',
                        explanation: '',
                        points: 1,
                      });
                      setShowQuestionModal(true);
                    }}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-orange-500 rounded-lg hover:bg-orange-600 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    Nova Pergunta
                  </button>
                )}
              </div>

              {isLoadingQuestions ? (
                <div className="flex items-center justify-center py-12">
                  <RefreshCw className="w-6 h-6 animate-spin text-orange-500" />
                </div>
              ) : questions.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <HelpCircle className="w-12 h-12 text-gray-300 dark:text-gray-600 mb-4" />
                  <p className="text-gray-500 dark:text-gray-400">
                    Nenhuma pergunta cadastrada
                  </p>
                  <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
                    Adicione perguntas para começar a montar o quiz
                  </p>
                </div>
              ) : (
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext
                    items={questions.map(q => q.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className="space-y-3">
                      {questions.map((question, index) => (
                        <SortableQuestionItem
                          key={question.id}
                          question={question}
                          index={index}
                          isExpanded={expandedQuestions.has(question.id)}
                          disabled={quiz.has_attempts}
                          onToggleExpand={() => {
                            setExpandedQuestions(prev => {
                              const newSet = new Set(prev);
                              if (newSet.has(question.id)) {
                                newSet.delete(question.id);
                              } else {
                                newSet.add(question.id);
                              }
                              return newSet;
                            });
                          }}
                          onEditQuestion={handleEditQuestion}
                          onDeleteQuestion={handleDeleteQuestion}
                          onAddOption={handleAddOption}
                          onEditOption={handleEditOption}
                          onDeleteOption={handleDeleteOption}
                          onToggleCorrect={handleToggleCorrect}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
              )}
            </div>
          )}

          {/* Participantes Tab */}
          {activeTab === 'participantes' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  Participantes do Quiz
                </h3>
                <div className="flex items-center gap-2">
                  {quiz?.is_active && participants.length > 0 && (
                    <button
                      onClick={handleOpenGenerateAllLinksModal}
                      className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-orange-600 border border-orange-300 dark:border-orange-700 rounded-lg hover:bg-orange-50 dark:hover:bg-orange-900/20 transition-colors"
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
                    Adicionar Participantes
                  </button>
                </div>
              </div>

              {isLoadingParticipants ? (
                <div className="flex items-center justify-center py-12">
                  <RefreshCw className="w-6 h-6 animate-spin text-orange-500" />
                </div>
              ) : participants.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Users className="w-12 h-12 text-gray-300 dark:text-gray-600 mb-4" />
                  <p className="text-gray-500 dark:text-gray-400">
                    Nenhum participante adicionado
                  </p>
                  <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
                    Adicione participantes para enviar o quiz
                  </p>
                </div>
              ) : (
                <div className="ag-theme-alpine w-full h-[400px]">
                  <AgGridReact
                    rowData={participants}
                    columnDefs={participantColumns}
                    defaultColDef={{
                      sortable: true,
                      filter: true,
                      resizable: true,
                    }}
                    animateRows={true}
                    rowSelection="single"
                    rowHeight={48}
                    headerHeight={48}
                  />
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Question Modal */}
      {showQuestionModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-5 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-t-2xl flex items-center justify-between sticky top-0 z-10">
              <h2 className="text-xl font-bold">
                {questionToEdit ? 'Editar Pergunta' : 'Nova Pergunta'}
              </h2>
              <button
                onClick={() => {
                  setShowQuestionModal(false);
                  setQuestionToEdit(null);
                }}
                className="text-white hover:bg-white/20 rounded-full p-1 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Pergunta <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={questionForm.question_text}
                  onChange={(e) => setQuestionForm(prev => ({ ...prev, question_text: e.target.value }))}
                  placeholder="Digite a pergunta..."
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Tipo de Resposta
                  </label>
                  <select
                    value={questionForm.question_type}
                    onChange={(e) => setQuestionForm(prev => ({ ...prev, question_type: e.target.value as 'single_choice' | 'multiple_choice' }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  >
                    <option value="single_choice">Escolha Única</option>
                    <option value="multiple_choice">Múltipla Escolha</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Pontos
                  </label>
                  <input
                    type="number"
                    value={questionForm.points}
                    onChange={(e) => setQuestionForm(prev => ({ ...prev, points: parseInt(e.target.value) || 1 }))}
                    min={1}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Dica (opcional)
                </label>
                <input
                  type="text"
                  value={questionForm.hint}
                  onChange={(e) => setQuestionForm(prev => ({ ...prev, hint: e.target.value }))}
                  placeholder="Dica para ajudar o participante..."
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Explicação (opcional)
                </label>
                <textarea
                  value={questionForm.explanation}
                  onChange={(e) => setQuestionForm(prev => ({ ...prev, explanation: e.target.value }))}
                  placeholder="Explicação exibida após a resposta..."
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent resize-none"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowQuestionModal(false);
                    setQuestionToEdit(null);
                  }}
                  className="px-6 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleSaveQuestion}
                  className="flex items-center gap-2 px-6 py-2 text-sm font-medium text-white bg-green-500 rounded-lg hover:bg-green-600 transition-colors"
                >
                  <Save className="w-4 h-4" />
                  Salvar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Option Modal */}
      {showOptionModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="p-5 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-t-2xl flex items-center justify-between sticky top-0 z-10">
              <h2 className="text-xl font-bold">
                {optionToEdit ? 'Editar Opção' : 'Nova Opção'}
              </h2>
              <button
                onClick={() => {
                  setShowOptionModal(false);
                  setOptionToEdit(null);
                  setOptionQuestionId(null);
                }}
                className="text-white hover:bg-white/20 rounded-full p-1 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Texto da Opção <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={optionForm.option_text}
                  onChange={(e) => setOptionForm(prev => ({ ...prev, option_text: e.target.value }))}
                  placeholder="Digite a opção..."
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="is_correct"
                  checked={optionForm.is_correct}
                  onChange={(e) => setOptionForm(prev => ({ ...prev, is_correct: e.target.checked }))}
                  className="w-4 h-4 text-green-600 rounded focus:ring-green-500"
                />
                <label htmlFor="is_correct" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Esta é uma resposta correta
                </label>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Justificativa (opcional)
                </label>
                <textarea
                  value={optionForm.rationale}
                  onChange={(e) => setOptionForm(prev => ({ ...prev, rationale: e.target.value }))}
                  placeholder="Explique por que esta opção está correta/incorreta..."
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowOptionModal(false);
                    setOptionToEdit(null);
                    setOptionQuestionId(null);
                  }}
                  className="px-6 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleSaveOption}
                  className="flex items-center gap-2 px-6 py-2 text-sm font-medium text-white bg-green-500 rounded-lg hover:bg-green-600 transition-colors"
                >
                  <Save className="w-4 h-4" />
                  Salvar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && deleteTarget && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full">
            <div className="p-5 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-t-2xl flex items-center justify-between">
              <h2 className="text-xl font-bold">Confirmar Exclusão</h2>
              <button
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setDeleteTarget(null);
                }}
                className="text-white hover:bg-white/20 rounded-full p-1 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6">
              <p className="text-gray-700 dark:text-gray-300">
                {deleteTarget.type === 'question' && 'Tem certeza que deseja excluir esta pergunta? Todas as opções também serão excluídas.'}
                {deleteTarget.type === 'option' && 'Tem certeza que deseja excluir esta opção?'}
                {deleteTarget.type === 'participant' && 'Tem certeza que deseja remover este participante?'}
              </p>

              <div className="flex justify-end gap-3 pt-6">
                <button
                  type="button"
                  onClick={() => {
                    setShowDeleteConfirm(false);
                    setDeleteTarget(null);
                  }}
                  className="px-6 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDelete}
                  className="flex items-center gap-2 px-6 py-2 text-sm font-medium text-white bg-red-500 rounded-lg hover:bg-red-600 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  Excluir
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Participant Modal */}
      {showParticipantModal && id && (
        <QuizParticipantModal
          isOpen={showParticipantModal}
          onClose={() => setShowParticipantModal(false)}
          quizId={parseInt(id)}
          onSuccess={handleParticipantsAdded}
          existingParticipantIds={participants.map(p => p.user_id)}
        />
      )}

      {/* Generate Link Modal */}
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

      {/* Generate All Links Modal */}
      {showGenerateAllLinksModal && id && (
        <QuizGenerateAllLinksModal
          isOpen={showGenerateAllLinksModal}
          onClose={() => setShowGenerateAllLinksModal(false)}
          quizId={parseInt(id)}
          participantCount={participants.length}
          onSuccess={handleAllLinksGenerated}
        />
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

export default QuizDetail;
