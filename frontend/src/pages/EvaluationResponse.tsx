import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { ChevronDown, ChevronUp, Save, Star, AlertCircle, ArrowLeft, CheckCircle, XCircle, X, MinusCircle, Target, Maximize } from 'lucide-react';
import { EvaluationInfo, CategoryData, EvaluationQuestionData, QuestionResponse } from '../types';
import PDIModal from '../components/PDIModal';

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
    
    // Resetar progresso para o valor atual proporcional
    const currentProgress = progress;
    
    // Criar timeout baseado no progresso atual
    const remainingTime = (currentProgress / 100) * 10000;
    
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

  // Modo Apresentação
  const [isPresentationMode, setIsPresentationMode] = useState(false);
  const presentationRef = useRef<HTMLDivElement>(null);

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
      const { data, error } = await supabase
        .from('evaluations')
        .select('*')
        .eq('id', parseInt(id))
        .single();

      if (error) {
        console.error('Erro ao buscar avaliação:', error);
        setError('Erro ao carregar avaliação');
        return;
      }

      setEvaluation(data);

      // Buscar nome do modelo de avaliação
      if (data.evaluation_model_id) {
        const { data: modelData, error: modelError } = await supabase
          .from('evaluations_model')
          .select('name')
          .eq('id', data.evaluation_model_id)
          .single();

        if (!modelError && modelData) {
          setEvaluationModelName(modelData.name);
        }
      }

      // Buscar status da avaliação
      if (data.status_id) {
        const { data: statusData, error: statusError } = await supabase
          .from('domains')
          .select('value')
          .eq('id', data.status_id)
          .eq('type', 'evaluation_status')
          .single();

        if (!statusError && statusData) {
          setStatusName(statusData.value);
        }
      }

      // Buscar projetos vinculados
      const { data: projectLinks, error: projectLinksError } = await supabase
        .from('evaluations_projects')
        .select('project_id')
        .eq('evaluation_id', parseInt(id));

      if (!projectLinksError && projectLinks && projectLinks.length > 0) {
        const projectIds = projectLinks.map((link: any) => link.project_id);
        
        const { data: projectsData, error: projectsError } = await supabase
          .from('projects')
          .select('name')
          .in('project_id', projectIds);

        if (!projectsError && projectsData) {
          setProjectNames(projectsData.map((p: any) => p.name));
        }
      }

      // Verificar PDI vinculado
      const { data: pdiData, error: pdiError } = await supabase
        .from('pdi')
        .select('id')
        .eq('evaluation_id', parseInt(id))
        .limit(1);

      if (pdiError) {
        console.error('Erro ao verificar PDI vinculado:', pdiError);
      } else {
        setHasLinkedPDI(pdiData && pdiData.length > 0);
      }
    } catch (err) {
      console.error('Erro ao buscar avaliação:', err);
      setError('Erro ao carregar avaliação');
    }
  };

  // Buscar perguntas do modelo de avaliação
  const fetchQuestions = async () => {
    if (!evaluation?.evaluation_model_id) return;

    try {
      // Buscar perguntas vinculadas ao modelo
      const { data: evalQuestions, error: evalError } = await supabase
        .from('evaluations_questions_model')
        .select(`
          id,
          question_id,
          category_order,
          question_order,
          subcategory_order,
          questions_model (
            id,
            question,
            description,
            category_id,
            subcategory_id,
            reply_type_id,
            weight,
            required
          )
        `)
        .eq('evaluation_id', evaluation.evaluation_model_id)
        .order('category_order', { ascending: true })
        .order('subcategory_order', { ascending: true })
        .order('question_order', { ascending: true });

      if (evalError) {
        console.error('Erro ao buscar perguntas:', evalError);
        return;
      }

      // Extrair IDs de categorias e subcategorias
      const categoryIds = new Set<number>();
      const subcategoryIds = new Set<number>();

      evalQuestions?.forEach((item: any) => {
        if (item.questions_model?.category_id) {
          categoryIds.add(item.questions_model.category_id);
        }
        if (item.questions_model?.subcategory_id) {
          subcategoryIds.add(item.questions_model.subcategory_id);
        }
      });

      const allIds = [...Array.from(categoryIds), ...Array.from(subcategoryIds)];

      // Buscar categorias e subcategorias
      const { data: domainsData, error: domainsError } = await supabase
        .from('domains')
        .select('*')
        .in('id', allIds)
        .eq('is_active', true);

      if (domainsError) {
        console.error('Erro ao buscar domínios:', domainsError);
      } else {
        setCategories(domainsData || []);
      }

      // Buscar tipos de resposta
      const replyTypeIds = evalQuestions
        ?.map((item: any) => item.questions_model?.reply_type_id)
        .filter((id: number) => id !== null);

      const { data: replyTypesData, error: replyTypesError } = await supabase
        .from('domains')
        .select('*')
        .in('id', replyTypeIds)
        .eq('type', 'evaluation_reply_type');

      if (replyTypesError) {
        console.error('Erro ao buscar tipos de resposta:', replyTypesError);
      }

      const replyTypesMap = new Map(
        replyTypesData?.map((rt: any) => [rt.id, rt.value]) || []
      );

      // Processar perguntas
      const processedQuestions: EvaluationQuestionData[] = (evalQuestions
        ?.map((item: any) => {
          const question = item.questions_model;
          if (!question) return null;

          return {
            id: item.id, // ID da tabela evaluations_questions_model
            question_id: question.id, // ID da tabela questions_model
            question: question.question,
            description: question.description,
            category_id: question.category_id,
            subcategory_id: question.subcategory_id,
            reply_type_id: question.reply_type_id,
            reply_type: replyTypesMap.get(question.reply_type_id) || '',
            weight: question.weight,
            required: question.required,
            category_order: item.category_order,
            question_order: item.question_order,
            subcategory_order: item.subcategory_order,
          };
        })
        .filter((q: any) => q !== null) || []) as EvaluationQuestionData[];

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
      const { data, error } = await supabase
        .from('evaluations_questions_reply')
        .select('*')
        .eq('evaluation_id', parseInt(id));

      if (error) {
        console.error('Erro ao buscar respostas:', error);
        return;
      }

      const responsesMap = new Map<number, QuestionResponse>();
      data?.forEach((item: any) => {
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
      // Preparar dados para inserção/atualização
      const responsesToSave = Array.from(responses.entries())
        .filter(([_, response]) => {
          // Salva apenas respostas que têm algum valor preenchido
          return response.score !== null || response.reply?.trim() || response.yes_no !== null;
        })
        .map(([questionId, response]) => {
          const question = questions.find((q) => q.question_id === questionId);
          
          return {
            evaluation_id: parseInt(id),
            question_id: questionId,
            category_id: question?.category_id || null,
            subcategory_id: question?.subcategory_id || null,
            category: categories.find((c) => c.id === question?.category_id)?.value || '',
            subcategory: question?.subcategory_id
              ? categories.find((c) => c.id === question?.subcategory_id)?.value || ''
              : '',
            question: question?.question || '',
            score: response.score,
            reply: response.reply,
            yes_no: response.yes_no,
            weight: question?.weight || 0,
            reply_type: question?.reply_type || '',
            user_id: evaluation?.user_id || null,
            owner_id: evaluation?.owner_id || null,
          };
        });

      if (responsesToSave.length === 0) {
        setError('Nenhuma resposta preenchida para salvar');
        setIsSaving(false);
        return;
      }

      // Deletar respostas existentes
      const { error: deleteError } = await supabase
        .from('evaluations_questions_reply')
        .delete()
        .eq('evaluation_id', parseInt(id));

      if (deleteError) {
        console.error('Erro ao deletar respostas antigas:', deleteError);
        setError('Erro ao salvar respostas');
        setIsSaving(false);
        return;
      }

      // Inserir novas respostas
      const { error: insertError } = await supabase
        .from('evaluations_questions_reply')
        .insert(responsesToSave);

      if (insertError) {
        console.error('Erro ao inserir respostas:', insertError);
        setError('Erro ao salvar respostas');
        setIsSaving(false);
        return;
      }

      // Atualizar status da avaliação baseado no progresso
      if (responsesToSave.length > 0) {
        // Verificar se todas as perguntas obrigatórias foram respondidas
        const allAnswered = calculateProgress() === 100;
        
        // Buscar o ID do status apropriado
        const statusValue = allAnswered ? 'concluído' : 'em andamento';
        const { data: statusData, error: statusError } = await supabase
          .from('domains')
          .select('id, value')
          .eq('type', 'evaluation_status')
          .ilike('value', statusValue)
          .single();

        if (!statusError && statusData) {
          // Atualizar o status da avaliação
          const { error: updateError } = await supabase
            .from('evaluations')
            .update({ status_id: statusData.id })
            .eq('id', parseInt(id));

          if (updateError) {
            console.error('Erro ao atualizar status da avaliação:', updateError);
          } else {
            // Atualizar o estado local
            setStatusName(statusData.value);
            if (evaluation) {
              setEvaluation({ ...evaluation, status_id: statusData.id });
            }
          }
        }
      }

      setHasUnsavedChanges(false);
      
      // Mostrar mensagem de sucesso
      setSuccessMessage(`${responsesToSave.length} resposta(s) salva(s) com sucesso!`);
      
      // Recarregar as respostas para sincronizar
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
      // Buscar o ID do status "Fechado"
      const { data: statusData, error: statusError } = await supabase
        .from('domains')
        .select('id, value')
        .eq('type', 'evaluation_status')
        .ilike('value', 'fechado')
        .single();

      if (statusError || !statusData) {
        console.error('Erro ao buscar status Fechado:', statusError);
        setError('Erro ao buscar status. Verifique se o status "Fechado" existe nos domínios.');
        setIsClosing(false);
        return;
      }

      // Atualizar avaliação para Fechado e is_closed = true
      const { error: updateError } = await supabase
        .from('evaluations')
        .update({ 
          status_id: statusData.id,
          is_closed: true 
        })
        .eq('id', parseInt(id));

      if (updateError) {
        console.error('Erro ao encerrar avaliação:', updateError);
        setError('Erro ao encerrar avaliação');
        setIsClosing(false);
        return;
      }

      // Atualizar estado local
      setStatusName(statusData.value);
      if (evaluation) {
        setEvaluation({ 
          ...evaluation, 
          status_id: statusData.id,
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
    <div ref={presentationRef} className="h-full flex flex-col space-y-2 bg-white dark:bg-gray-900 p-2">
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
                navigate('/employee-evaluations');
              }
            } else {
              navigate('/employee-evaluations');
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6 items-center">
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
                  navigate('/employee-evaluations');
                }
              } else {
                navigate('/employee-evaluations');
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
