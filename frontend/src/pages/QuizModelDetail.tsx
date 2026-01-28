/**
 * QuizModelDetail - Página de Configuração do Quiz (apenas perguntas e opções)
 * 
 * Exibe detalhes de um quiz modelo com CRUD de perguntas e opções.
 * Esta é a tela de CONFIGURAÇÃO - para gerenciar participantes use EmployeeQuizDetail.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { createPortal } from 'react-dom';
import {
  ArrowLeft,
  Plus,
  Save,
  Trash2,
  ChevronDown,
  ChevronRight,
  GripVertical,
  RefreshCw,
  CheckCircle,
  XCircle,
  X,
  HelpCircle,
  AlertCircle,
  Upload,
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
import QuizImportModal from '../components/QuizImportModal';
import {
  QuizData,
  QuizQuestionData,
  QuizQuestionOptionData,
} from '../types';

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
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden bg-white dark:bg-gray-900"
    >
      {/* Question Header */}
      <div className="flex items-center gap-3 p-4 bg-gray-50 dark:bg-gray-800">
        <button
          {...attributes}
          {...listeners}
          className="p-1 cursor-grab hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
        >
          <GripVertical className="w-5 h-5 text-gray-400" />
        </button>
        <span className="flex items-center justify-center w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 text-sm font-bold">
          {index + 1}
        </span>
        <div 
          className="flex-1 cursor-pointer"
          onClick={onToggleExpand}
        >
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
        <div className="flex items-center gap-1">
          <button
            onClick={() => onEditQuestion(question)}
            className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
            title="Editar pergunta"
          >
            <Save className="w-4 h-4" />
          </button>
          <button
            onClick={() => onDeleteQuestion(question.id)}
            className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
            title="Excluir pergunta"
          >
            <Trash2 className="w-4 h-4" />
          </button>
          <button
            onClick={onToggleExpand}
            className="p-1.5 text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            {isExpanded ? (
              <ChevronDown className="w-5 h-5" />
            ) : (
              <ChevronRight className="w-5 h-5" />
            )}
          </button>
        </div>
      </div>

      {/* Options (Collapsible) */}
      {isExpanded && (
        <div className="p-4 space-y-2 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700">
          {question.hint && (
            <div className="mb-3 p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
              <p className="text-xs text-yellow-700 dark:text-yellow-400">
                <strong>Dica:</strong> {question.hint}
              </p>
            </div>
          )}
          
          {question.options && question.options.length > 0 ? (
            question.options.map((option, optIndex) => (
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
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => onToggleCorrect(option)}
                    className={`p-1.5 rounded-lg transition-colors ${
                      option.is_correct
                        ? 'text-green-600 hover:bg-green-100 dark:hover:bg-green-900/30'
                        : 'text-gray-400 hover:text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20'
                    }`}
                    title={option.is_correct ? 'Remover como correta' : 'Marcar como correta'}
                  >
                    <CheckCircle className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => onEditOption(option)}
                    className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                    title="Editar opção"
                  >
                    <Save className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => onDeleteOption(option.id, question.id)}
                    className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                    title="Excluir opção"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          ) : (
            <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
              Nenhuma opção cadastrada
            </p>
          )}

          <button
            onClick={() => onAddOption(question.id)}
            className="w-full mt-2 px-4 py-2 text-sm font-medium text-purple-600 dark:text-purple-400 border border-dashed border-purple-300 dark:border-purple-700 rounded-lg hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Adicionar Opção
          </button>

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

const QuizModelDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  // Quiz data
  const [quiz, setQuiz] = useState<QuizData | null>(null);
  const [isLoadingQuiz, setIsLoadingQuiz] = useState(true);

  // Questions data
  const [questions, setQuestions] = useState<QuizQuestionData[]>([]);
  const [isLoadingQuestions, setIsLoadingQuestions] = useState(false);
  const [expandedQuestions, setExpandedQuestions] = useState<Set<number>>(new Set());

  // Question form
  const [showQuestionModal, setShowQuestionModal] = useState(false);
  const [questionToEdit, setQuestionToEdit] = useState<QuizQuestionData | null>(null);
  const [questionForm, setQuestionForm] = useState({
    question_text: '',
    question_type: 'single_choice' as 'single_choice' | 'multiple_choice',
    hint: '',
    explanation: '',
    points: 1,
  });

  // Option form
  const [showOptionModal, setShowOptionModal] = useState(false);
  const [optionToEdit, setOptionToEdit] = useState<QuizQuestionOptionData | null>(null);
  const [optionQuestionId, setOptionQuestionId] = useState<number | null>(null);
  const [optionForm, setOptionForm] = useState({
    option_text: '',
    is_correct: false,
    rationale: '',
  });

  // Delete confirmation
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<
    | { type: 'question'; id: number }
    | { type: 'option'; id: number; questionId: number }
    | null
  >(null);

  // Notification
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Import modal
  const [showImportModal, setShowImportModal] = useState(false);

  // DnD sensors
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
      }
    } catch (error) {
      console.error('Erro ao buscar quiz:', error);
    } finally {
      setIsLoadingQuiz(false);
    }
  }, [id]);

  const fetchQuestions = useCallback(async () => {
    if (!id) return;
    setIsLoadingQuestions(true);
    try {
      const response = await apiClient.get<QuizQuestionData[]>(`/api/quiz/${id}/questions`);
      if (response.success && response.data) {
        setQuestions(response.data);
      }
    } catch (error) {
      console.error('Erro ao buscar perguntas:', error);
    } finally {
      setIsLoadingQuestions(false);
    }
  }, [id]);

  useEffect(() => {
    void fetchQuiz();
    void fetchQuestions();
  }, [fetchQuiz, fetchQuestions]);

  // ============================================================================
  // TOGGLE QUIZ STATUS
  // ============================================================================

  const toggleQuizStatus = async () => {
    if (!quiz || !id) return;

    try {
      const response = await apiClient.patch(`/api/quiz/${id}/toggle-active`, {});

      if (response.success) {
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

      const reorderedQuestions = arrayMove(questions, oldIndex, newIndex);
      setQuestions(reorderedQuestions);

      try {
        const questionIds = reorderedQuestions.map(q => q.id);
        await apiClient.put(`/api/quiz/${id}/questions/reorder`, { question_ids: questionIds });
      } catch (error) {
        console.error('Erro ao reordenar perguntas:', error);
        setNotification({ type: 'error', message: 'Erro ao reordenar perguntas' });
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
        const response = await apiClient.put(`/api/quiz/${id}/questions/${questionToEdit.id}`, questionForm);
        if (response.success) {
          setNotification({ type: 'success', message: 'Pergunta atualizada com sucesso' });
          void fetchQuestions();
        } else {
          setNotification({ type: 'error', message: 'Erro ao atualizar pergunta' });
        }
      } else {
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
        const response = await apiClient.put(`/api/quiz/${id}/questions/${optionQuestionId}/options/${optionToEdit.id}`, optionForm);
        if (response.success) {
          setNotification({ type: 'success', message: 'Opção atualizada com sucesso' });
          void fetchQuestions();
        } else {
          setNotification({ type: 'error', message: 'Erro ao atualizar opção' });
        }
      } else {
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
  // DELETE HANDLER
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
      }

      if (response?.success) {
        setNotification({ type: 'success', message: successMessage });
        void fetchQuestions();
      } else {
        setNotification({ type: 'error', message: 'Erro ao excluir' });
      }
    } catch (error) {
      console.error('Erro ao deletar:', error);
      setNotification({ type: 'error', message: 'Erro ao excluir' });
    } finally {
      setShowDeleteConfirm(false);
      setDeleteTarget(null);
    }
  };

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
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/quizzes')}
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
                <span className="text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded">
                  Configuração
                </span>
              </div>
              {quiz.description && (
                <p className="text-sm text-gray-500 dark:text-gray-400">{quiz.description}</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Stats */}
            <div className="text-center px-4 py-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <p className="text-xs text-gray-500 dark:text-gray-400">Perguntas</p>
              <p className="text-lg font-bold text-blue-600 dark:text-blue-400">{questions.length}</p>
            </div>

            {/* Toggle Status */}
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-600 dark:text-gray-400">
                {quiz.is_active ? 'Ativo' : 'Inativo'}
              </span>
              <button
                onClick={toggleQuizStatus}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 ${
                  quiz.is_active ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-lg transition-transform ${
                    quiz.is_active ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Card de Perguntas */}
      <div className="card p-6 flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <HelpCircle className="w-5 h-5 text-purple-500" />
            Perguntas
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowImportModal(true)}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-purple-600 dark:text-purple-400 border border-purple-300 dark:border-purple-700 bg-white dark:bg-gray-800 rounded-lg hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors"
            >
              <Upload className="w-4 h-4" />
              Carregar Perguntas
            </button>
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
          </div>
        </div>

        {/* Questions List */}
        <div className="flex-1 overflow-auto">
          {isLoadingQuestions ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="w-8 h-8 animate-spin text-orange-500" />
            </div>
          ) : questions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <HelpCircle className="w-12 h-12 text-gray-300 dark:text-gray-600 mb-3" />
              <p className="text-gray-500 dark:text-gray-400">Nenhuma pergunta cadastrada</p>
              <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
                Clique em "Nova Pergunta" para começar
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
                      onToggleExpand={() => toggleQuestionExpand(question.id)}
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
      </div>

      {/* Question Modal */}
      {showQuestionModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-lg w-full">
            <div className="p-5 bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-t-2xl flex items-center justify-between">
              <h3 className="text-lg font-bold">
                {questionToEdit ? 'Editar Pergunta' : 'Nova Pergunta'}
              </h3>
              <button
                onClick={() => setShowQuestionModal(false)}
                className="text-white hover:bg-white/20 rounded-full p-1 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Texto da Pergunta: *
                </label>
                <textarea
                  value={questionForm.question_text}
                  onChange={(e) => setQuestionForm(prev => ({ ...prev, question_text: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-purple-500"
                  rows={3}
                  placeholder="Digite a pergunta..."
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Tipo:
                  </label>
                  <select
                    value={questionForm.question_type}
                    onChange={(e) => setQuestionForm(prev => ({ ...prev, question_type: e.target.value as 'single_choice' | 'multiple_choice' }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-purple-500"
                  >
                    <option value="single_choice">Única Escolha</option>
                    <option value="multiple_choice">Múltipla Escolha</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Pontos:
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={questionForm.points}
                    onChange={(e) => setQuestionForm(prev => ({ ...prev, points: parseInt(e.target.value) || 1 }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-purple-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Dica (opcional):
                </label>
                <input
                  type="text"
                  value={questionForm.hint}
                  onChange={(e) => setQuestionForm(prev => ({ ...prev, hint: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-purple-500"
                  placeholder="Uma dica para ajudar..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Explicação (opcional):
                </label>
                <textarea
                  value={questionForm.explanation}
                  onChange={(e) => setQuestionForm(prev => ({ ...prev, explanation: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-purple-500"
                  rows={2}
                  placeholder="Explicação após responder..."
                />
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowQuestionModal(false)}
                  className="px-6 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSaveQuestion}
                  className="px-6 py-2 text-sm font-medium text-white bg-green-500 rounded-lg hover:bg-green-600 transition-colors"
                >
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
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-lg w-full">
            <div className="p-5 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-t-2xl flex items-center justify-between">
              <h3 className="text-lg font-bold">
                {optionToEdit ? 'Editar Opção' : 'Nova Opção'}
              </h3>
              <button
                onClick={() => setShowOptionModal(false)}
                className="text-white hover:bg-white/20 rounded-full p-1 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Texto da Opção: *
                </label>
                <textarea
                  value={optionForm.option_text}
                  onChange={(e) => setOptionForm(prev => ({ ...prev, option_text: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  rows={2}
                  placeholder="Digite a opção de resposta..."
                />
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="is_correct"
                  checked={optionForm.is_correct}
                  onChange={(e) => setOptionForm(prev => ({ ...prev, is_correct: e.target.checked }))}
                  className="w-4 h-4 text-green-500 border-gray-300 rounded focus:ring-green-500"
                />
                <label htmlFor="is_correct" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Esta é a resposta correta
                </label>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Justificativa (opcional):
                </label>
                <textarea
                  value={optionForm.rationale}
                  onChange={(e) => setOptionForm(prev => ({ ...prev, rationale: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  rows={2}
                  placeholder="Por que esta opção é correta/incorreta..."
                />
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowOptionModal(false)}
                  className="px-6 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSaveOption}
                  className="px-6 py-2 text-sm font-medium text-white bg-green-500 rounded-lg hover:bg-green-600 transition-colors"
                >
                  Salvar
                </button>
              </div>
            </div>
          </div>
        </div>
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
              Tem certeza que deseja excluir {deleteTarget?.type === 'question' ? 'esta pergunta e todas as suas opções' : 'esta opção'}?
              Esta ação não pode ser desfeita.
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

      {/* Quiz Import Modal */}
      {showImportModal && id && (
        <QuizImportModal
          quizId={id}
          onClose={() => setShowImportModal(false)}
          onSuccess={() => {
            void fetchQuestions();
          }}
          onNotification={(type, message) => {
            setNotification({ type, message });
          }}
        />
      )}
    </div>
  );
};

export default QuizModelDetail;
