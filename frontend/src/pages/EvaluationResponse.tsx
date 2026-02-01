import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useParams, useNavigate } from 'react-router-dom';
import { apiClient } from '../lib/apiClient';
import { ChevronDown, ChevronUp, Save, Star, AlertCircle, ArrowLeft, CheckCircle, XCircle, X, MinusCircle, Target, Maximize, Link, Copy, Clock } from 'lucide-react';
import { EvaluationInfo, CategoryData, EvaluationQuestionData, QuestionResponse } from '../types';
import PDIModal from '../components/PDIModal';
import EvaluationsOverallRating from '../components/EvaluationsOverallRating';

const NotificationToast = ({ type, message, onClose }: { 
  type: 'success' | 'error', 
  message: string, 
  onClose: () => void 
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [progress, setProgress] = useState(100);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Função para limpar todos os timers
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

  // Função para iniciar os timers
  const startTimers = useCallback(() => {
    clearTimers();
    
    // Criar timeout baseado no progresso atual
    const remainingTime = (progress / 100) * 10000;
    
    timeoutRef.current = setTimeout(() => {
      onClose();
    }, remainingTime);
    
    // Criar interval para atualizar barra de progresso
    progressIntervalRef.current = setInterval(() => {
      setProgress(prev => {
        const newProgress = prev - 1; // Diminui 1% a cada 100ms
        if (newProgress <= 0) {
          return 0;
        }
        return newProgress;
      });
    }, 100);
  }, [progress, onClose, clearTimers]);

  // Effect para controlar os timers baseado no hover
  useEffect(() => {
    if (!isHovered) {
      startTimers();
    } else {
      clearTimers();
    }

    // Cleanup ao desmontar
    return () => {
      clearTimers();
    };
  }, [isHovered, startTimers, clearTimers]);

  // Effect inicial para começar os timers
  useEffect(() => {
    startTimers();
    return () => {
      clearTimers();
    };
  }, []);

  const handleMouseEnter = useCallback(() => {
    setIsHovered(true);
  }, []);

  const handleMouseLeave = useCallback(() => {
    setIsHovered(false);
  }, []);

  const toastContent = (
    <div 
      className={`fixed top-4 right-4 z-[9999] rounded-xl shadow-2xl animate-slide-in-from-top border ${
        type === 'success' 
          ? 'bg-gradient-to-r from-green-50 to-green-100 border-green-200 text-green-800' 
          : 'bg-gradient-to-r from-red-50 to-red-100 border-red-200 text-red-800'
      } transform transition-all duration-300 ease-out max-w-md cursor-pointer overflow-hidden`}
      style={{ 
        position: 'fixed',
        top: '4rem',
        right: '1rem',
        zIndex: 9999,
        pointerEvents: 'auto'
      }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Barra de progresso */}
      <div className={`h-1 transition-all duration-100 ease-linear ${
        type === 'success' ? 'bg-green-500' : 'bg-red-500'
      }`} style={{ width: `${progress}%` }} />
      
      {/* Conteúdo do toast */}
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

const EvaluationResponse = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [evaluation, setEvaluation] = useState<EvaluationInfo | null>(null);
  const [evaluationModelName, setEvaluationModelName] = useState<string>('');
  const [projectNames, setProjectNames] = useState<string[]>([]);
  const [statusName, setStatusName] = useState<string>('');
  const [categories, setCategories] = useState<CategoryData[]>([]);
  const [questions, setQuestions] = useState<EvaluationQuestionData[]>([]);
  const [responses, setResponses] = useState<Map<number, QuestionResponse>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [isClosing, setIsClosing] = useState(false);

  const [expandedCategories, setExpandedCategories] = useState<Set<number>>(new Set());
  const [expandedSubcategories, setExpandedSubcategories] = useState<Set<number>>(new Set());
  
  // Estados para PDI Modal
  const [isPDIModalOpen, setIsPDIModalOpen] = useState(false);
  const [hasLinkedPDI, setHasLinkedPDI] = useState(false);

  // Estados para Aceite de Avaliação
  const [acceptLinkInfo, setAcceptLinkInfo] = useState<{
    hasValidLink: boolean;
    linkExpiresAt: string | null;
    accepted: boolean;
    acceptedAt: string | null;
  } | null>(null);
  const [generatedAcceptUrl, setGeneratedAcceptUrl] = useState<string | null>(null);
  const [isGeneratingLink, setIsGeneratingLink] = useState(false);
  const [showAcceptLinkModal, setShowAcceptLinkModal] = useState(false);
  const [showGenerateLinkModal, setShowGenerateLinkModal] = useState(false);
  const [maxAccess, setMaxAccess] = useState(1);
  const [expiresInHours, setExpiresInHours] = useState(24);

  // Modo Apresentação
  const [isPresentationMode, setIsPresentationMode] = useState(false);
  const presentationRef = useRef<HTMLDivElement>(null);

  // Nota Geral
  const [averageScore, setAverageScore] = useState<number | null>(null);

  // Calcular nota geral (média ponderada dos scores)
  const calculateAverageScore = () => {
    if (questions.length === 0) return null;

    const scoredQuestions = questions.filter(q => {
      const replyType = q.reply_type.toLowerCase();
      return replyType.includes('escala');
    });

    if (scoredQuestions.length === 0) return null;

    let totalWeightedScore = 0;
    let totalWeight = 0;

    scoredQuestions.forEach((question) => {
      const response = responses.get(question.question_id);
      if (response && response.score !== null && response.score !== undefined && response.score > 0) {
        const weight = question.weight || 1;
        totalWeightedScore += response.score * weight;
        totalWeight += weight;
      }
    });

    return totalWeight > 0 ? totalWeightedScore / totalWeight : null;
  };

  // Calcular progresso de preenchimento (somente perguntas obrigatórias)
  const calculateProgress = () => {
    // Filtrar apenas perguntas obrigatórias
    const requiredQuestions = questions.filter(q => q.required);
    
    if (requiredQuestions.length === 0) return 0;

    let answeredCount = 0;
    requiredQuestions.forEach((question) => {
      const response = responses.get(question.question_id);
      if (response) {
        const replyType = question.reply_type.toLowerCase();
        
        if (replyType.includes('escala') && response.score !== null) {
          answeredCount++;
        } else if (replyType.includes('texto') && response.reply?.trim()) {
          answeredCount++;
        } else if (replyType.includes('sim') && response.yes_no !== null) {
          answeredCount++;
        }
      }
    });

    return Math.round((answeredCount / requiredQuestions.length) * 100);
  };

  // Verificar se todas as perguntas obrigatórias estão respondidas E SALVAS
  const isAllRequiredAnsweredAndSaved = () => {
    // Filtrar apenas perguntas obrigatórias
    const requiredQuestions = questions.filter(q => q.required);
    
    if (requiredQuestions.length === 0) return false;

    // Verificar se todas as perguntas obrigatórias têm respostas SALVAS
    let allAnswered = true;
    
    requiredQuestions.forEach((question) => {
      const response = responses.get(question.question_id);
      if (!response) {
        allAnswered = false;
        return;
      }

      const replyType = question.reply_type.toLowerCase();
      
      // Verificar se tem resposta válida
      if (replyType.includes('escala') && response.score === null) {
        allAnswered = false;
      } else if (replyType.includes('texto') && !response.reply?.trim()) {
        allAnswered = false;
      } else if (replyType.includes('sim') && response.yes_no === null) {
        allAnswered = false;
      }
    });

    // Se tem mudanças não salvas, não pode encerrar
    if (hasUnsavedChanges) {
      allAnswered = false;
    }

    return allAnswered;
  };

  // Buscar dados da avaliação
  const fetchEvaluation = async () => {
    if (!id) return;

    try {
      const response = await apiClient.get<{
        id: number;
        user_id: string;
        owner_id: string;
        user_name: string;
        owner_name: string;
        evaluation_model_id: number;
        status_id: number;
        is_closed: boolean;
        is_pdi: boolean;
        period_start: string;
        period_end: string;
        evaluation_model_name: string | null;
        status_name: string | null;
        project_names: string[];
        has_linked_pdi: boolean;
      }>(`/api/employee-evaluations/${id}`);

      if (!response.success || !response.data) {
        console.error('Erro ao buscar avaliação:', response.error);
        setError('Erro ao carregar avaliação');
        return;
      }

      const data = response.data;
      
      // Mapear para o formato esperado pelo state
      setEvaluation({
        id: data.id,
        name: data.evaluation_model_name || '',
        user_id: data.user_id,
        owner_id: data.owner_id,
        user_name: data.user_name,
        owner_name: data.owner_name,
        evaluation_model_id: data.evaluation_model_id,
        status_id: data.status_id,
        is_closed: data.is_closed,
        is_done: data.is_closed,
        period_start: data.period_start,
        period_end: data.period_end,
      });

      setEvaluationModelName(data.evaluation_model_name || '');
      setStatusName(data.status_name || '');
      setProjectNames(data.project_names || []);
      setHasLinkedPDI(data.has_linked_pdi);

      // Se avaliação está fechada, buscar status do link de aceite
      if (data.is_closed) {
        await fetchAcceptLinkStatus();
      }
    } catch (err) {
      console.error('Erro ao buscar avaliação:', err);
      setError('Erro ao carregar avaliação');
    }
  };

  // Buscar status do link de aceite
  const fetchAcceptLinkStatus = async () => {
    if (!id) return;

    try {
      const response = await apiClient.get<{
        accepted: boolean;
        acceptedAt: string | null;
        isClosed: boolean;
        hasValidLink: boolean;
        linkExpiresAt: string | null;
        linkCreatedAt: string | null;
      }>(`/api/evaluation-accept/${id}/link`);

      if (response.success && response.data) {
        setAcceptLinkInfo({
          hasValidLink: response.data.hasValidLink,
          linkExpiresAt: response.data.linkExpiresAt,
          accepted: response.data.accepted,
          acceptedAt: response.data.acceptedAt
        });
      }
    } catch (err) {
      console.error('Erro ao buscar status do link de aceite:', err);
    }
  };

  // Gerar link de aceite
  const generateAcceptLink = async () => {
    if (!id || isGeneratingLink) return;

    setIsGeneratingLink(true);
    setError(null);

    try {
      const response = await apiClient.post<{
        token: string;
        url: string;
        expiresAt: string;
        expiresInHours: number;
        maxAccess: number;
        evaluation: { id: number; name: string; userName: string };
      }>(`/api/evaluation-accept/${id}/generate`, {
        maxAccess,
        expiresInHours
      });

      if (response.success && response.data) {
        setGeneratedAcceptUrl(response.data.url);
        setShowGenerateLinkModal(false);
        setShowAcceptLinkModal(true);
        
        // Atualizar info do link
        setAcceptLinkInfo(prev => ({
          ...prev!,
          hasValidLink: true,
          linkExpiresAt: response.data!.expiresAt
        }));

        // Copiar para clipboard
        try {
          await navigator.clipboard.writeText(response.data.url);
          setSuccessMessage('Link de aceite gerado e copiado para a área de transferência!');
        } catch {
          // Se não conseguir copiar, mostra modal mesmo assim
          setSuccessMessage('Link de aceite gerado com sucesso!');
        }
      } else {
        setError(response.error?.message || 'Erro ao gerar link de aceite');
      }
    } catch (err) {
      console.error('Erro ao gerar link de aceite:', err);
      setError('Erro ao gerar link de aceite');
    } finally {
      setIsGeneratingLink(false);
    }
  };

  // Copiar link para clipboard
  const copyAcceptLink = async () => {
    if (!generatedAcceptUrl) return;

    try {
      await navigator.clipboard.writeText(generatedAcceptUrl);
      setSuccessMessage('Link copiado para a área de transferência!');
    } catch {
      setError('Não foi possível copiar o link');
    }
  };

  // Formatar tempo restante do link
  const formatTimeRemaining = (expiresAt: string) => {
    const now = new Date();
    const expires = new Date(expiresAt);
    const diff = expires.getTime() - now.getTime();
    
    if (diff <= 0) return 'Expirado';
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 0) {
      return `${hours}h ${minutes}min`;
    }
    return `${minutes} minutos`;
  };

  // Buscar perguntas do modelo de avaliação
  const fetchQuestions = async () => {
    if (!id) return;

    try {
      const response = await apiClient.get<{
        questions: Array<{
          evaluation_question_id: number;
          question_id: number;
          question: string;
          description: string | null;
          category_id: number;
          category: string;
          subcategory_id: number | null;
          subcategory: string;
          reply_type_id: number;
          reply_type: string;
          weight: number;
          required: boolean;
          category_order: number;
          subcategory_order: number;
          question_order: number;
        }>;
        categories: Array<{
          id: number;
          type: string;
          value: string;
          description: string | null;
          is_active: boolean;
          parent_id: number | null;
        }>;
      }>(`/api/employee-evaluations/${id}/questions`);

      if (!response.success || !response.data) {
        console.error('Erro ao buscar perguntas:', response.error);
        return;
      }

      // Mapear categorias
      setCategories(response.data.categories || []);

      // Mapear perguntas para o formato esperado
      const processedQuestions: EvaluationQuestionData[] = response.data.questions.map((q) => ({
        id: q.evaluation_question_id,
        question_id: q.question_id,
        question: q.question,
        description: q.description,
        category_id: q.category_id,
        subcategory_id: q.subcategory_id ?? 0,
        reply_type_id: q.reply_type_id,
        reply_type: q.reply_type,
        weight: q.weight,
        required: q.required,
        category_order: q.category_order,
        question_order: q.question_order,
        subcategory_order: q.subcategory_order,
      }));

      setQuestions(processedQuestions);

      // Expandir todas as categorias por padrão
      const allCategoryIds = new Set(
        processedQuestions.map((q) => q.category_id)
      );
      setExpandedCategories(allCategoryIds);

      // Subcategorias começam FECHADAS por padrão
      setExpandedSubcategories(new Set());
    } catch (err) {
      console.error('Erro ao buscar perguntas:', err);
    }
  };

  // Buscar respostas já salvas
  const fetchResponses = async () => {
    if (!id) return;

    try {
      const response = await apiClient.get<Array<{
        question_id: number;
        score: number | null;
        reply: string | null;
        yes_no: boolean | null;
      }>>(`/api/employee-evaluations/${id}/responses`);

      if (!response.success || !response.data) {
        console.error('Erro ao buscar respostas:', response.error);
        return;
      }

      const responsesMap = new Map<number, QuestionResponse>();
      response.data.forEach((item) => {
        responsesMap.set(item.question_id, {
          question_id: item.question_id,
          score: item.score,
          reply: item.reply,
          yes_no: item.yes_no,
        });
      });

      setResponses(responsesMap);
    } catch (err) {
      console.error('Erro ao buscar respostas:', err);
    }
  };

  // Carregar dados ao montar o componente
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      await fetchEvaluation();
      setIsLoading(false);
    };

    void loadData();
  }, [id]);

  useEffect(() => {
    if (evaluation) {
      const loadQuestions = async () => {
        await fetchQuestions();
        await fetchResponses();
      };
      void loadQuestions();
    }
  }, [evaluation]);

  // Atualizar nota geral quando responses ou questions mudarem
  useEffect(() => {
    const score = calculateAverageScore();
    setAverageScore(score);
  }, [responses, questions]);

  // Toggle categoria expandida/colapsada
  const toggleCategory = (categoryId: number) => {
    setExpandedCategories((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(categoryId)) {
        newSet.delete(categoryId);
      } else {
        newSet.add(categoryId);
      }
      return newSet;
    });
  };

  // Toggle subcategoria expandida/colapsada
  const toggleSubcategory = (subcategoryId: number) => {
    setExpandedSubcategories((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(subcategoryId)) {
        newSet.delete(subcategoryId);
      } else {
        newSet.add(subcategoryId);
      }
      return newSet;
    });
  };

  // Atualizar resposta
  const updateResponse = (questionId: number, field: 'score' | 'reply' | 'yes_no', value: any) => {
    // Bloquear edição se a avaliação estiver fechada
    if (evaluation?.is_closed) {
      setError('Esta avaliação foi encerrada e não pode mais ser alterada.');
      return;
    }

    setHasUnsavedChanges(true);
    setResponses((prev) => {
      const newMap = new Map(prev);
      const existing = newMap.get(questionId) || {
        question_id: questionId,
        score: null,
        reply: null,
        yes_no: null,
      };

      newMap.set(questionId, {
        ...existing,
        [field]: value,
      });

      return newMap;
    });
  };

  // Salvar respostas (permite salvamento parcial)
  const handleSave = async () => {
    if (!id || !evaluation) {
      setError('Dados da avaliação não encontrados');
      return;
    }

    // Bloquear salvamento se a avaliação estiver fechada
    if (evaluation.is_closed) {
      setError('Esta avaliação foi encerrada e não pode mais ser alterada.');
      return;
    }

    // Verifica se há pelo menos uma resposta para salvar
    if (responses.size === 0) {
      setError('Nenhuma resposta para salvar');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      // Preparar dados para a API (formato simplificado)
      const responsesToSave = Array.from(responses.entries())
        .filter(([_, response]) => {
          // Salva apenas respostas que têm algum valor preenchido
          return response.score !== null || response.reply?.trim() || response.yes_no !== null;
        })
        .map(([questionId, response]) => {
          const question = questions.find((q) => q.question_id === questionId);
          
          return {
            question_id: questionId,
            score: response.score,
            reply: response.reply,
            yes_no: response.yes_no,
            weight: question?.weight || 1,
          };
        });

      if (responsesToSave.length === 0) {
        setError('Nenhuma resposta preenchida para salvar');
        setIsSaving(false);
        return;
      }

      // Salvar via API (backend faz delete + insert e atualiza status)
      const result = await apiClient.put<{ message: string; count: number }>(
        `/api/employee-evaluations/${id}/responses`,
        { responses: responsesToSave }
      );

      if (!result.success) {
        console.error('Erro ao salvar respostas:', result.error);
        setError(result.error?.message || 'Erro ao salvar respostas');
        setIsSaving(false);
        return;
      }

      setHasUnsavedChanges(false);
      
      // Mostrar mensagem de sucesso
      setSuccessMessage(`${responsesToSave.length} resposta(s) salva(s) com sucesso!`);
      
      // Recarregar dados para sincronizar status
      await fetchEvaluation();
      await fetchResponses();
    } catch (err) {
      console.error('Erro ao salvar respostas:', err);
      setError('Erro ao salvar respostas');
    } finally {
      setIsSaving(false);
    }
  };

  // Verificar se há respostas diferentes das salvas
  const hasResponseChanges = () => {
    // Compara respostas em memória com respostas carregadas do banco
    for (const [, currentResponse] of responses.entries()) {
      const hasValue = currentResponse.score !== null || 
                      currentResponse.reply?.trim() || 
                      currentResponse.yes_no !== null;
      
      if (hasValue && hasUnsavedChanges) {
        return true;
      }
    }
    return false;
  };

  // Encerrar avaliação
  const handleCloseEvaluation = async () => {
    if (!id || !evaluation) return;

    setIsClosing(true);
    setError(null);

    try {
      // Encerrar via API
      const result = await apiClient.patch<{ is_closed: boolean; status_id: number }>(
        `/api/employee-evaluations/${id}/close`
      );

      if (!result.success) {
        console.error('Erro ao encerrar avaliação:', result.error);
        setError(result.error?.message || 'Erro ao encerrar avaliação');
        setIsClosing(false);
        return;
      }

      // Atualizar estado local
      setStatusName('Fechado');
      if (evaluation) {
        setEvaluation({ 
          ...evaluation, 
          status_id: result.data?.status_id || evaluation.status_id,
          is_closed: true 
        });
      }

      setShowCloseModal(false);
      setSuccessMessage('Avaliação encerrada com sucesso! Agora ela está somente em modo de visualização.');
    } catch (err) {
      console.error('Erro ao encerrar avaliação:', err);
      setError('Erro ao encerrar avaliação');
    } finally {
      setIsClosing(false);
    }
  };

  // Efeito para modo apresentação (tela cheia)
  useEffect(() => {
    const handleFullScreenChange = () => {
      setIsPresentationMode(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullScreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullScreenChange);
  }, []);

  const togglePresentationMode = async () => {
    try {
      if (!document.fullscreenElement) {
        if (presentationRef.current) {
          await presentationRef.current.requestFullscreen();
        }
      } else {
        await document.exitFullscreen();
      }
    } catch (error) {
      console.error('Erro ao alternar modo apresentação:', error);
    }
  };

  // Prevenir navegação com dados não salvos
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges && hasResponseChanges()) {
        e.preventDefault();
        // Modern browsers show a generic message, returnValue is deprecated
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges, responses]);

  // Obter categorias principais com ordem
  const mainCategories = categories
    .filter((c) => c.type === 'evaluation_category')
    .map((cat) => {
      const categoryQuestions = questions.filter((q) => q.category_id === cat.id);
      const minOrder = categoryQuestions.length > 0
        ? Math.min(...categoryQuestions.map((q) => q.category_order))
        : 0;
      return { ...cat, order: minOrder };
    })
    .sort((a, b) => a.order - b.order);

  // Obter subcategorias de uma categoria
  const getSubcategories = (categoryId: number) => {
    const subcats = categories.filter(
      (c) => c.type === 'evaluation_subcategory' && c.parent_id === categoryId
    );

    return subcats
      .map((sub) => {
        const subQuestions = questions.filter((q) => q.subcategory_id === sub.id);
        const minOrder = subQuestions.length > 0
          ? Math.min(...subQuestions.map((q) => q.subcategory_order))
          : 0;
        return { ...sub, order: minOrder };
      })
      .sort((a, b) => a.order - b.order);
  };

  // Obter perguntas de uma categoria/subcategoria
  const getQuestions = (categoryId: number, subcategoryId: number | null = null) => {
    return questions
      .filter(
        (q) =>
          q.category_id === categoryId &&
          (subcategoryId === null
            ? q.subcategory_id === null
            : q.subcategory_id === subcategoryId)
      )
      .sort((a, b) => a.question_order - b.question_order);
  };

  // Contar perguntas respondidas em uma subcategoria (somente obrigatórias)
  const countAnsweredQuestions = (subQuestions: EvaluationQuestionData[]) => {
    // Filtrar apenas perguntas obrigatórias
    const requiredQuestions = subQuestions.filter(q => q.required);
    let answeredCount = 0;
    
    requiredQuestions.forEach((question) => {
      const response = responses.get(question.question_id);
      if (response) {
        const replyType = question.reply_type.toLowerCase();
        
        // Considera respondida se tiver algum valor válido (incluindo 0 para N/A)
        if (replyType.includes('escala') && response.score !== null && response.score !== undefined) {
          answeredCount++;
        } else if (replyType.includes('texto') && response.reply?.trim()) {
          answeredCount++;
        } else if (replyType.includes('sim') && response.yes_no !== null) {
          answeredCount++;
        }
      }
    });

    return answeredCount;
  };

  // Renderizar campo de resposta baseado no tipo
  const renderResponseField = (question: EvaluationQuestionData) => {
    const response = responses.get(question.question_id);
    const replyType = question.reply_type.toLowerCase();

    // Escala (1-5)
    if (replyType.includes('escala')) {
      return (
        <div className="flex items-center gap-3">
          {/* Botão N/A */}
          <button
            type="button"
            onClick={() => updateResponse(question.question_id, 'score', 0)}
            className="focus:outline-none transition-all hover:scale-110 flex flex-col items-center gap-1"
            title="Não se aplica"
          >
            <MinusCircle
              className={`w-8 h-8 ${
                response?.score === 0
                  ? 'fill-gray-400 text-gray-600 dark:fill-gray-500 dark:text-gray-400'
                  : 'text-gray-300 dark:text-gray-600'
              }`}
            />
            
          </button>

          {/* Separador */}
          <div className="h-10 w-px bg-gray-300 dark:bg-gray-600"></div>

          {/* Estrelas 1-5 */}
          {[1, 2, 3, 4, 5].map((rating) => (
            <button
              key={rating}
              type="button"
              onClick={() => updateResponse(question.question_id, 'score', rating)}
              className="focus:outline-none transition-transform hover:scale-110"
            >
              <Star
                className={`w-8 h-8 ${
                  response?.score && response.score > 0 && response.score >= rating
                    ? 'fill-yellow-400 text-yellow-400'
                    : 'text-gray-300 dark:text-gray-600'
                }`}
              />
            </button>
          ))}
          
          {/* Indicador de pontuação */}
          {response?.score !== null && response?.score !== undefined && (
            <span className="ml-2 text-sm font-medium text-gray-700 dark:text-gray-300">
              {response.score === 0 ? 'N/A' : `${response.score}/5`}
            </span>
          )}
        </div>
      );
    }

    // Texto
    if (replyType.includes('texto')) {
      return (
        <textarea
          value={response?.reply || ''}
          onChange={(e) => updateResponse(question.question_id, 'reply', e.target.value)}
          placeholder="Digite sua resposta aqui..."
          rows={4}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-orange-500 focus:border-transparent resize-none"
        />
      );
    }

    // Sim/Não
    if (replyType.includes('sim')) {
      return (
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => updateResponse(question.question_id, 'yes_no', true)}
            className={`px-6 py-2 rounded-lg font-medium transition-colors ${
              response?.yes_no === true
                ? 'bg-green-500 text-white'
                : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
            }`}
          >
            Sim
          </button>
          <button
            type="button"
            onClick={() => updateResponse(question.question_id, 'yes_no', false)}
            className={`px-6 py-2 rounded-lg font-medium transition-colors ${
              response?.yes_no === false
                ? 'bg-red-500 text-white'
                : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
            }`}
          >
            Não
          </button>
        </div>
      );
    }

    return null;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-gray-500 dark:text-gray-400">Carregando...</p>
      </div>
    );
  }

  if (!evaluation) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-red-500">Avaliação não encontrada</p>
      </div>
    );
  }

  return (
    <div ref={presentationRef} className="h-full flex flex-col space-y-2 bg-gray-50 dark:bg-gray-900 pt-0">
      {/* Notificação de Sucesso */}
      {successMessage && (
        <NotificationToast
          type="success"
          message={successMessage}
          onClose={() => setSuccessMessage(null)}
        />
      )}

      {/* Modal de Confirmação de Encerramento */}
      {showCloseModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full">
            {/* Header */}
            <div className="p-5 bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-t-2xl flex items-center justify-between">
              <h2 className="text-xl font-bold">Encerrar Avaliação</h2>
              <button
                onClick={() => setShowCloseModal(false)}
                className="text-white hover:bg-white/20 rounded-full p-1 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-6 h-6 text-orange-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-gray-900 dark:text-gray-100 font-medium mb-2">
                    Atenção!
                  </p>
                  <p className="text-gray-700 dark:text-gray-300 text-sm">
                    Se a avaliação for encerrada, ela não poderá mais ser alterada. 
                    Apenas será possível visualizá-la.
                  </p>
                  <p className="text-gray-700 dark:text-gray-300 text-sm mt-2">
                    Deseja continuar?
                  </p>
                </div>
              </div>

              {/* Footer Buttons */}
              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCloseModal(false)}
                  disabled={isClosing}
                  className="px-6 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleCloseEvaluation}
                  disabled={isClosing}
                  className="px-6 py-2 text-sm font-medium text-white bg-blue-500 rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {isClosing ? 'Encerrando...' : 'Sim, Encerrar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Botão Voltar */}
      {!isPresentationMode && (
        <button
          onClick={() => {
            if (hasUnsavedChanges && hasResponseChanges()) {
              if (
                window.confirm(
                  'Você tem alterações não salvas. Se sair da tela sem salvar, perderá o que foi preenchido. Deseja continuar?'
                )
              ) {
                navigate(-1);
              }
            } else {
              navigate(-1);
            }
          }}
          className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar
        </button>
      )}

      {/* Card de Informações Básicas */}
      <div className="card p-6 pt-2 pb-2">
        {/* Linha 1: Avaliado */}
        <div className="flex justify-between items-center mb-3">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
            {evaluation.user_name}
          </h2>
          <button
            onClick={togglePresentationMode}
            className="flex items-center gap-2 px-3 py-1 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            title={isPresentationMode ? "Sair do modo apresentação" : "Modo Apresentação"}
          >
            <Maximize className="w-4 h-4" />
            {!isPresentationMode}
          </button>
        </div>

        {/* Linha 2: Demais informações */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-7 gap-6 items-center">
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Avaliador</p>
            <p className="text-md font-medium text-gray-900 dark:text-gray-100">
              {evaluation.owner_name}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Modelo de Avaliação</p>
            <p className="text-md font-medium text-gray-900 dark:text-gray-100">
              {evaluationModelName || `Modelo #${evaluation.evaluation_model_id}`}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Período da Avaliação</p>
            <p className="text-md font-medium text-gray-900 dark:text-gray-100">
              {new Date(evaluation.period_start).toLocaleDateString('pt-BR')} -{' '}
              {new Date(evaluation.period_end).toLocaleDateString('pt-BR')}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Projeto(s)</p>
            <p className="text-md font-medium text-gray-900 dark:text-gray-100">
              {projectNames.length > 0 ? (
                projectNames.join(', ')
              ) : (
                <span className="text-gray-500 dark:text-gray-400 italic">
                  Nenhum projeto
                </span>
              )}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Status</p>
            <p className="text-md font-medium text-gray-900 dark:text-gray-100">
              {statusName ? (
                <span className={`px-2 py-1 rounded-full text-xs ${
                  statusName.toLowerCase().includes('aberto') || statusName.toLowerCase().includes('pendente')
                    ? 'bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400'
                    : statusName.toLowerCase().includes('em andamento') || statusName.toLowerCase().includes('progresso')
                    ? 'bg-yellow-100 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400'
                    : statusName.toLowerCase().includes('concluído') || statusName.toLowerCase().includes('finalizado')
                    ? 'bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400'
                    : statusName.toLowerCase().includes('cancelado') || statusName.toLowerCase().includes('rejeitado')
                    ? 'bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-400'
                    : 'bg-gray-100 dark:bg-gray-700/20 text-gray-700 dark:text-gray-400'
                }`}>
                  {statusName}
                </span>
              ) : (
                <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700/20 text-gray-700 dark:text-gray-400 rounded-full text-xs">
                  Sem status
                </span>
              )}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Nota Geral</p>
            <p className="text-md font-medium text-gray-900 dark:text-gray-100">
              <EvaluationsOverallRating score={averageScore} />
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Progresso -
                <span className="text-xs text-gray-600 dark:text-gray-400">
                    {questions.length > 0
                    ? ` ${Math.round((calculateProgress() / 100) * questions.filter(q => q.required).length)}/${questions.filter(q => q.required).length}`
                    : ' Carregando...'}
                </span>
            </p>
            <div className="flex items-center gap-2">
              <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-3 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-green-500 to-green-600 transition-all duration-500 ease-out rounded-full"
                  style={{ width: `${calculateProgress()}%` }}
                />
              </div>
              <span className="text-xs font-bold text-gray-900 dark:text-gray-100 min-w-[35px] text-right">
                {calculateProgress()}%
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Mensagem de Avaliação Encerrada */}
      {evaluation?.is_closed && (
        <div className="bg-gray-50 dark:bg-gray-900/20 border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 px-4 py-3 rounded-lg flex items-center gap-2">
          <AlertCircle className="w-5 h-5" />
          <span>Esta avaliação foi encerrada e está disponível apenas para visualização. Não é possível fazer alterações.</span>
        </div>
      )}

      {/* Mensagem de PDI Vinculado */}
      {hasLinkedPDI && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-400 px-4 py-3 rounded-lg flex items-center gap-2">
          <Target className="w-5 h-5" />
          <span>Existe PDI vinculado a esta avaliação.</span>
        </div>
      )}

      {/* Card de Aceite de Avaliação - visível quando fechada e não aceita */}
      {evaluation?.is_closed && acceptLinkInfo && (
        <div className={`border rounded-lg px-4 py-3 ${
          acceptLinkInfo.accepted
            ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
            : 'bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800'
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {acceptLinkInfo.accepted ? (
                <>
                  <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
                  <span className="text-green-700 dark:text-green-400 font-medium">
                    Avaliação aceita em {new Date(acceptLinkInfo.acceptedAt!).toLocaleString('pt-BR')}
                  </span>
                </>
              ) : (
                <>
                  <Link className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                  <span className="text-purple-700 dark:text-purple-400">
                    {acceptLinkInfo.hasValidLink ? (
                      <>Link de aceite ativo • Expira em {formatTimeRemaining(acceptLinkInfo.linkExpiresAt!)}</>
                    ) : (
                      <>Aguardando aceite do funcionário</>
                    )}
                  </span>
                </>
              )}
            </div>
            
            {!acceptLinkInfo.accepted && (
              <div className="flex items-center gap-2">
                {acceptLinkInfo.hasValidLink && generatedAcceptUrl && (
                  <button
                    onClick={() => setShowAcceptLinkModal(true)}
                    className="px-3 py-1.5 text-sm font-medium text-purple-700 dark:text-purple-300 bg-purple-100 dark:bg-purple-900/30 rounded-lg hover:bg-purple-200 dark:hover:bg-purple-900/50 transition-colors flex items-center gap-1"
                  >
                    <Copy className="w-4 h-4" />
                    Exibir Link
                  </button>
                )}
                <button
                  onClick={() => setShowGenerateLinkModal(true)}
                  disabled={isGeneratingLink}
                  className="px-3 py-1.5 text-sm font-medium text-white bg-purple-500 rounded-lg hover:bg-purple-600 disabled:opacity-50 transition-colors flex items-center gap-1"
                >
                  <Link className="w-4 h-4" />
                  {acceptLinkInfo.hasValidLink ? 'Gerar Novo Link' : 'Gerar Link de Aceite'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal para Gerar Link de Aceite */}
      {showGenerateLinkModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full">
            <div className="p-5 bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-t-2xl flex items-center justify-between">
              <h3 className="text-lg font-bold">Gerar Link de Aceite</h3>
              <button
                onClick={() => setShowGenerateLinkModal(false)}
                className="text-white hover:bg-white/20 rounded-full p-1 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Configure as opções do link de aceite que será gerado para o funcionário.
              </p>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Número máximo de acessos:
                </label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={maxAccess}
                  onChange={(e) => setMaxAccess(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-purple-500 focus:border-transparent"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Quantas vezes o link pode ser acessado antes de expirar
                </p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Expiração (horas):
                </label>
                <input
                  type="number"
                  min="1"
                  max="720"
                  value={expiresInHours}
                  onChange={(e) => setExpiresInHours(Math.max(1, parseInt(e.target.value) || 24))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-purple-500 focus:border-transparent"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Tempo até o link expirar (máximo 30 dias = 720 horas)
                </p>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowGenerateLinkModal(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={generateAcceptLink}
                  disabled={isGeneratingLink}
                  className="px-4 py-2 text-sm font-medium text-white bg-purple-500 rounded-lg hover:bg-purple-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {isGeneratingLink ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Gerando...
                    </>
                  ) : (
                    <>
                      <Link className="w-4 h-4" />
                      Gerar Link
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Link de Aceite */}
      {showAcceptLinkModal && generatedAcceptUrl && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-lg w-full">
            {/* Header */}
            <div className="p-5 bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-t-2xl flex items-center justify-between">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <Link className="w-5 h-5" />
                Link de Aceite
              </h2>
              <button
                onClick={() => setShowAcceptLinkModal(false)}
                className="text-white hover:bg-white/20 rounded-full p-1 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-4">
              <p className="text-gray-700 dark:text-gray-300 text-sm">
                Copie o link abaixo e envie ao funcionário para que ele aceite a avaliação.
              </p>

              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={generatedAcceptUrl}
                  readOnly
                  className="flex-1 px-3 py-2 text-sm bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300"
                />
                <button
                  onClick={copyAcceptLink}
                  className="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors flex items-center gap-2"
                >
                  <Copy className="w-4 h-4" />
                  Copiar
                </button>
              </div>

              {acceptLinkInfo?.linkExpiresAt && (
                <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                  <Clock className="w-4 h-4" />
                  <span>Expira em: {formatTimeRemaining(acceptLinkInfo.linkExpiresAt)}</span>
                </div>
              )}

              <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3 flex gap-2">
                <AlertCircle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0" />
                <p className="text-sm text-yellow-700 dark:text-yellow-300">
                  Se você gerar um novo link, o link anterior será automaticamente invalidado.
                </p>
              </div>

              <div className="flex justify-end">
                <button
                  onClick={() => setShowAcceptLinkModal(false)}
                  className="px-6 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Mensagem de Erro */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-lg flex items-center gap-2">
          <AlertCircle className="w-5 h-5" />
          {error}
        </div>
      )}

      {/* Perguntas */}
      <div className="card p-6 pt-2 flex-1 overflow-y-auto space-y-4">
        {mainCategories.map((category) => {
          const isExpanded = expandedCategories.has(category.id);
          const categoryQuestions = getQuestions(category.id);
          const subcategories = getSubcategories(category.id);

          return (
            <div key={category.id} className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
              {/* Header da Categoria */}
              <button
                type="button"
                onClick={() => toggleCategory(category.id)}
                className="w-full flex items-center justify-between p-4 pt-2 pb-2 bg-gradient-to-r from-orange-500 to-red-500 text-white hover:from-orange-600 hover:to-red-600 transition-colors"
              >
                <span className="font-bold text-lg">{category.value}</span>
                {isExpanded ? (
                  <ChevronUp className="w-5 h-5" />
                ) : (
                  <ChevronDown className="w-5 h-5" />
                )}
              </button>

              {/* Conteúdo da Categoria */}
              {isExpanded && (
                <div className="p-4 bg-white dark:bg-gray-800 space-y-4">
                  {/* Perguntas sem subcategoria */}
                  {categoryQuestions.map((question, idx) => (
                    <div
                      key={question.id}
                      className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <h4 className="font-semibold text-gray-900 dark:text-gray-100">
                            {idx + 1}. {question.question}
                            {question.required && (
                              <span className="text-red-500 ml-1">*</span>
                            )}
                          </h4>
                          {question.description && (
                            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                              {question.description}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="mt-3">{renderResponseField(question)}</div>
                    </div>
                  ))}

                  {/* Subcategorias */}
                  {subcategories.map((subcategory) => {
                    const isSubExpanded = expandedSubcategories.has(subcategory.id);
                    const subQuestions = getQuestions(category.id, subcategory.id);
                    const answeredCount = countAnsweredQuestions(subQuestions);
                    // Conta apenas perguntas obrigatórias
                    const totalCount = subQuestions.filter(q => q.required).length;

                    return (
                      <div
                        key={subcategory.id}
                        className="border border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden"
                      >
                        {/* Header da Subcategoria */}
                        <button
                          type="button"
                          onClick={() => toggleSubcategory(subcategory.id)}
                          className="w-full flex items-center justify-between p-3 pt-2 pb-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <span className="font-semibold text-gray-900 dark:text-gray-100">
                              {subcategory.value}
                            </span>
                            <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                              answeredCount === totalCount
                                ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                                : answeredCount > 0
                                ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400'
                                : 'bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300'
                            }`}>
                              {answeredCount}/{totalCount}
                            </span>
                          </div>
                          {isSubExpanded ? (
                            <ChevronUp className="w-4 h-4" />
                          ) : (
                            <ChevronDown className="w-4 h-4" />
                          )}
                        </button>

                        {/* Perguntas da Subcategoria */}
                        {isSubExpanded && (
                          <div className="p-3 bg-white dark:bg-gray-800 space-y-3">
                            {subQuestions.map((question, idx) => (
                              <div
                                key={question.id}
                                className="p-4 pt-2 pb-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600"
                              >
                                <div className="flex items-start justify-between mb-2">
                                  <div className="flex-1">
                                    <h4 className="font-semibold text-gray-900 dark:text-gray-100">
                                      {idx + 1}. {question.question}
                                      {question.required && (
                                        <span className="text-red-500 ml-1">*</span>
                                      )}
                                    </h4>
                                    {question.description && (
                                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                                        {question.description}
                                      </p>
                                    )}
                                  </div>
                                </div>
                                <div className="mt-3">{renderResponseField(question)}</div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Botão Salvar */}
      <div className="flex justify-between items-center gap-3 p-1 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
        <div className="text-sm text-gray-600 dark:text-gray-400">
          {evaluation?.is_closed ? (
            <span className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
              <AlertCircle className="w-4 h-4" />
              Avaliação encerrada - Somente visualização
            </span>
          ) : hasUnsavedChanges ? (
            <span className="flex items-center gap-2 text-orange-600 dark:text-orange-400">
              <AlertCircle className="w-4 h-4" />
              Você tem alterações não salvas
            </span>
          ) : calculateProgress() === 100 ? (
            <span className="flex items-center gap-2 text-green-600 dark:text-green-400">
              <CheckCircle className="w-4 h-4" />
              Todas as respostas obrigatórias foram preenchidas e salvas
            </span>
          ) : null}
        </div>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => {
              if (hasUnsavedChanges && hasResponseChanges() && !evaluation?.is_closed) {
                if (
                  window.confirm(
                    'Você tem alterações não salvas. Se sair da tela sem salvar, perderá o que foi preenchido. Deseja continuar?'
                  )
                ) {
                  navigate(-1);
                }
              } else {
                navigate(-1);
              }
            }}
            className="px-6 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
          >
            Voltar
          </button>
          
          {/* Botão Adicionar/Exibir PDI */}
          <button
            onClick={() => setIsPDIModalOpen(true)}
            className="px-6 py-2 text-sm font-medium text-white bg-orange-500 rounded-lg hover:bg-orange-600 transition-colors flex items-center gap-2"
          >
            <Target className="w-4 h-4" />
            {hasLinkedPDI ? 'Exibir PDI' : 'Adicionar PDI'}
          </button>
          
          {/* Botão Encerrar Avaliação - só aparece se estiver concluída, salva e não fechada */}
          {isAllRequiredAnsweredAndSaved() && !evaluation?.is_closed && (
            <button
              type="button"
              onClick={() => setShowCloseModal(true)}
              className="px-6 py-2 text-sm font-medium text-white bg-blue-500 rounded-lg hover:bg-blue-600 transition-colors flex items-center gap-2"
            >
              <XCircle className="w-4 h-4" />
              Encerrar Avaliação
            </button>
          )}

          {/* Botão Salvar - só aparece se não estiver fechada */}
          {!evaluation?.is_closed && (
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving || !hasUnsavedChanges}
              className="px-6 py-2 text-sm font-medium text-white bg-green-500 rounded-lg hover:bg-green-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <Save className="w-4 h-4" />
              {isSaving ? 'Salvando...' : 'Salvar Progresso'}
            </button>
          )}
        </div>
      </div>

      {/* Modal de PDI */}
      <PDIModal
        isOpen={isPDIModalOpen}
        onClose={() => setIsPDIModalOpen(false)}
        onSuccess={() => {
          setIsPDIModalOpen(false);
        }}
        evaluationId={evaluation?.id || null}
        prefilledConsultant={evaluation ? { value: evaluation.user_id, label: evaluation.user_name } : null}
        prefilledManager={evaluation ? { value: evaluation.owner_id, label: evaluation.owner_name } : null}
        onError={(message) => setError(message)}
        onSuccessMessage={(message) => setSuccessMessage(message)}
      />
    </div>
  );
};

export default EvaluationResponse;
