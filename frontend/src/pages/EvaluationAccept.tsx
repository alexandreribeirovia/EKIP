/**
 * Página Pública de Aceite de Avaliação
 * 
 * Esta página é acessada via link temporário enviado ao funcionário.
 * Não requer autenticação - valida apenas o token.
 * 
 * Fluxo:
 * 1. Funcionário recebe link com token
 * 2. Acessa página e vê detalhes da avaliação (categorias, perguntas, notas)
 * 3. Clica em "Aceitar Avaliação"
 * 4. Sistema registra aceite e invalida token
 */

import { useState, useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { CheckCircle, XCircle, Clock, AlertTriangle, Loader2, User, Calendar, UserCheck, Star, ChevronDown, ChevronUp } from 'lucide-react';
import logoWhite from '../../img/logo_white.png';
import logo from '../../img/logo.png';
import type { EvaluationAcceptInfo, EvaluationAcceptQuestion, EvaluationAcceptCategory } from '../types';

// API fetch sem autenticação (rota pública)
const publicFetch = async (url: string, options?: RequestInit) => {
  const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
  const response = await fetch(`${baseUrl}${url}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });
  return response.json();
};

type PageStatus = 'loading' | 'valid' | 'error' | 'success';

// Componente para renderizar estrelas de nota
const StarRating = ({ score }: { score: number }) => {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={`w-4 h-4 ${
            star <= score
              ? 'text-yellow-400 fill-yellow-400'
              : 'text-gray-300 dark:text-gray-600'
          }`}
        />
      ))}
      <span className="ml-2 text-sm text-gray-600 dark:text-gray-400">({score}/5)</span>
    </div>
  );
};

// Componente para badge Sim/Não
const YesNoBadge = ({ value }: { value: boolean }) => (
  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
    value 
      ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
      : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
  }`}>
    {value ? 'Sim' : 'Não'}
  </span>
);

// Componente para exibir uma pergunta com sua resposta (read-only)
const QuestionDisplay = ({ question, index }: { question: EvaluationAcceptQuestion; index: number }) => {
  const replyType = question.reply_type?.toLowerCase() || '';
  
  // Verifica se deve exibir a pergunta (ocultar perguntas de texto sem resposta)
  const hasResponse = question.score !== null || question.reply || question.yes_no !== null;
  const isTextType = replyType.includes('texto');
  
  // Se é tipo texto e não tem resposta, não exibe
  if (isTextType && !question.reply) {
    return null;
  }

  return (
    <div className="bg-gray-50 dark:bg-gray-700/30 rounded-lg p-3 border border-gray-100 dark:border-gray-600">
      {/* Pergunta */}
      <p className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
        {index + 1}. {question.question}
      </p>
      
      {/* Descrição (se houver) */}
      {question.description && (
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-2 italic">
          {question.description}
        </p>
      )}
      
      {/* Resposta */}
      <div className="mt-2">
        {/* Tipo Escala - Exibe estrelas */}
        {replyType.includes('escala') && question.score !== null && (
          <StarRating score={question.score} />
        )}
        
        {/* Tipo Texto - Exibe texto da resposta */}
        {isTextType && question.reply && (
          <div className="bg-white dark:bg-gray-800 rounded p-2 text-sm text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-600">
            {question.reply}
          </div>
        )}
        
        {/* Tipo Sim/Não - Exibe badge */}
        {replyType.includes('sim') && question.yes_no !== null && (
          <YesNoBadge value={question.yes_no} />
        )}
        
        {/* Sem resposta */}
        {!hasResponse && (
          <span className="text-xs text-gray-400 dark:text-gray-500 italic">Não respondido</span>
        )}
      </div>
    </div>
  );
};

const EvaluationAccept = () => {
  const { token } = useParams<{ token: string }>();
  
  const [status, setStatus] = useState<PageStatus>('loading');
  const [evaluation, setEvaluation] = useState<EvaluationAcceptInfo | null>(null);
  const [questions, setQuestions] = useState<EvaluationAcceptQuestion[]>([]);
  const [categories, setCategories] = useState<EvaluationAcceptCategory[]>([]);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [errorCode, setErrorCode] = useState('');
  const [isAccepting, setIsAccepting] = useState(false);
  const [acceptedAt, setAcceptedAt] = useState<string | null>(null);
  
  // Estados para accordion (iniciam colapsados)
  const [expandedCategories, setExpandedCategories] = useState<Set<number>>(new Set());
  const [expandedSubcategories, setExpandedSubcategories] = useState<Set<number>>(new Set());

  // Agrupar perguntas por categoria e subcategoria
  const groupedQuestions = useMemo(() => {
    const categoriesMap = new Map<number, EvaluationAcceptCategory>();
    categories.forEach(cat => categoriesMap.set(cat.id, cat));

    // Agrupar por categoria
    const byCategory = new Map<number, {
      category: EvaluationAcceptCategory;
      subcategories: Map<number | null, {
        subcategory: EvaluationAcceptCategory | null;
        questions: EvaluationAcceptQuestion[];
      }>;
    }>();

    questions.forEach(q => {
      if (!byCategory.has(q.category_id)) {
        byCategory.set(q.category_id, {
          category: categoriesMap.get(q.category_id) || { id: q.category_id, type: 'evaluation_category', value: q.category, is_active: true, parent_id: null },
          subcategories: new Map()
        });
      }
      
      const categoryGroup = byCategory.get(q.category_id)!;
      const subId = q.subcategory_id;
      
      if (!categoryGroup.subcategories.has(subId)) {
        categoryGroup.subcategories.set(subId, {
          subcategory: subId ? (categoriesMap.get(subId) || { id: subId, type: 'evaluation_subcategory', value: q.subcategory, is_active: true, parent_id: q.category_id }) : null,
          questions: []
        });
      }
      
      categoryGroup.subcategories.get(subId)!.questions.push(q);
    });

    // Ordenar e converter para array
    return Array.from(byCategory.values())
      .sort((a, b) => {
        const aOrder = a.subcategories.values().next().value?.questions[0]?.category_order || 0;
        const bOrder = b.subcategories.values().next().value?.questions[0]?.category_order || 0;
        return aOrder - bOrder;
      })
      .map(catGroup => ({
        ...catGroup,
        subcategories: Array.from(catGroup.subcategories.values())
          .sort((a, b) => {
            const aOrder = a.questions[0]?.subcategory_order || 0;
            const bOrder = b.questions[0]?.subcategory_order || 0;
            return aOrder - bOrder;
          })
          .map(subGroup => ({
            ...subGroup,
            questions: subGroup.questions.sort((a, b) => a.question_order - b.question_order)
          }))
      }));
  }, [questions, categories]);

  // Toggle categoria
  const toggleCategory = (categoryId: number) => {
    setExpandedCategories(prev => {
      const newSet = new Set(prev);
      if (newSet.has(categoryId)) {
        newSet.delete(categoryId);
      } else {
        newSet.add(categoryId);
      }
      return newSet;
    });
  };

  // Toggle subcategoria
  const toggleSubcategory = (subcategoryId: number) => {
    setExpandedSubcategories(prev => {
      const newSet = new Set(prev);
      if (newSet.has(subcategoryId)) {
        newSet.delete(subcategoryId);
      } else {
        newSet.add(subcategoryId);
      }
      return newSet;
    });
  };

  useEffect(() => {
    const verifyToken = async () => {
      if (!token) {
        setStatus('error');
        setErrorMessage('Token não fornecido');
        setErrorCode('MISSING_TOKEN');
        return;
      }

      if (token.length !== 64) {
        setStatus('error');
        setErrorMessage('Token inválido');
        setErrorCode('INVALID_TOKEN');
        return;
      }

      try {
        const response = await publicFetch(`/api/evaluation-accept/verify/${token}`);

        if (response.success) {
          setEvaluation(response.data.evaluation);
          setQuestions(response.data.questions || []);
          setCategories(response.data.categories || []);
          setExpiresAt(response.data.expiresAt);
          setStatus('valid');
        } else {
          setStatus('error');
          setErrorMessage(response.error?.message || 'Erro ao verificar token');
          setErrorCode(response.error?.code || 'UNKNOWN_ERROR');
        }
      } catch (err) {
        setStatus('error');
        setErrorMessage('Erro de conexão. Tente novamente.');
        setErrorCode('CONNECTION_ERROR');
      }
    };

    verifyToken();
  }, [token]);

  const handleAccept = async () => {
    if (!token || isAccepting) return;

    setIsAccepting(true);

    try {
      const response = await publicFetch(`/api/evaluation-accept/confirm/${token}`, {
        method: 'POST',
      });

      if (response.success) {
        setStatus('success');
        setAcceptedAt(response.data.acceptedAt);
      } else {
        setStatus('error');
        setErrorMessage(response.error?.message || 'Erro ao aceitar avaliação');
        setErrorCode(response.error?.code || 'UNKNOWN_ERROR');
      }
    } catch (err) {
      setStatus('error');
      setErrorMessage('Erro de conexão. Tente novamente.');
      setErrorCode('CONNECTION_ERROR');
    } finally {
      setIsAccepting(false);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const formatDateTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getTimeRemaining = () => {
    if (!expiresAt) return null;
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

  const getErrorIcon = () => {
    switch (errorCode) {
      case 'TOKEN_EXPIRED':
        return <Clock className="w-16 h-16 text-yellow-500" />;
      case 'TOKEN_ALREADY_USED':
      case 'ALREADY_ACCEPTED':
        return <CheckCircle className="w-16 h-16 text-blue-500" />;
      default:
        return <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />;
    }
  };

  const getErrorTitle = () => {
    switch (errorCode) {
      case 'TOKEN_EXPIRED':
        return 'Link Expirado';
      case 'TOKEN_ALREADY_USED':
        return 'Link Já Utilizado';
      case 'ALREADY_ACCEPTED':
        return 'Avaliação Já Aceita';
      case 'TOKEN_NOT_FOUND':
      case 'INVALID_TOKEN':
        return 'Link Inválido';
      default:
        return 'Erro';
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-100 via-gray-200 to-gray-300 dark:from-gray-800 dark:via-gray-900 dark:to-black py-6 px-4 sm:px-6 lg:px-8">
      <div className={`w-full ${status === 'valid' ? 'max-w-3xl' : 'max-w-lg'}`}>
        {/* Loading State */}
        {status === 'loading' && (
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl overflow-hidden">
            {/* Header com Logo */}
            <div className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-700 dark:to-gray-800 px-8 py-6 text-center border-b border-gray-200 dark:border-gray-700">
              <div className="mx-auto h-20 w-20 mb-3 flex items-center justify-center">
                <img src={logo} alt="EKIP" className="h-full w-full object-contain" />
              </div>
              <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Bem vindo ao EKIP</h2>
            </div>
            <div className="p-8 text-center">
            <Loader2 className="w-16 h-16 text-orange-500 animate-spin mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-700 dark:text-gray-300">
              Verificando link...
            </h2>
            <p className="text-gray-500 dark:text-gray-400 mt-2">
              Aguarde enquanto validamos seu link de aceite.
            </p>
            </div>
            
            {/* Rodapé laranja */}
            <div className="bg-gradient-to-r from-orange-500 to-orange-600 px-8 py-1 text-center">
              <p className="text-sm text-white font-medium">
                Via Consulting
              </p>
            </div>
          </div>
        )}

        {/* Valid Token - Show Acceptance Form */}
        {status === 'valid' && evaluation && (
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-[95vh]">
            {/* Header Compacto - Fixo no topo */}
            <div className="bg-gradient-to-r from-orange-500 to-orange-600 px-4 py-3 flex items-center gap-3 flex-shrink-0">
              <div className="flex flex-col items-center gap-1">
              <img src={logoWhite} alt="EKIP" className="h-10 w-10 object-contain" />
              <span className="text-white font-bold text-xs">EKIP</span>
              </div>
                <div className="flex-1 min-w-0">
                <h1 className="text-white text-xl font-bold text-center mb-2">Avaliação</h1>
                <div className="flex items-center gap-2 flex-wrap text-white text-sm text-center justify-center">
                <div className="flex items-center gap-1">
                <User className="w-5 h-5" />
                <span className="font-normal">{evaluation.userName}</span>
                </div>
                <span className="opacity-60">•</span>
                <div className="flex items-center gap-1">
                <UserCheck className="w-5 h-5" />
                <span>{evaluation.ownerName}</span>
                </div>
                <span className="opacity-60">•</span>
                <div className="flex items-center gap-1">
                <Calendar className="w-5 h-5" />
                <span>{formatDate(evaluation.periodStart)} - {formatDate(evaluation.periodEnd)}</span>
                </div>
                </div>
                </div>
              {/* Badge de Nota Média */}
              {evaluation.averageScore !== null && (
              <div className="flex items-center gap-1 bg-white/20 rounded-full px-2 py-1">
                <Star className="w-4 h-4 text-yellow-300 fill-yellow-300" />
                <span className="text-white font-bold text-sm">{evaluation.averageScore.toFixed(1)}</span>
              </div>
              )}
            </div>

            {/* Body - Accordion de Perguntas (scrollável - único elemento com scroll) */}
            <div className="flex-1 overflow-y-auto min-h-0 p-4 space-y-3">
              {groupedQuestions.length === 0 ? (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  <p>Nenhuma pergunta encontrada para esta avaliação.</p>
                </div>
              ) : (
                groupedQuestions.map((categoryGroup) => {
                  const categoryId = categoryGroup.category.id;
                  const isCategoryExpanded = expandedCategories.has(categoryId);
                  
                  return (
                    <div key={categoryId} className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
                      {/* Header da Categoria */}
                      <button
                        onClick={() => toggleCategory(categoryId)}
                        className="w-full flex items-center justify-between p-3 bg-gradient-to-r from-orange-500 to-red-500 text-white hover:from-orange-600 hover:to-red-600 transition-colors"
                      >
                        <span className="font-bold text-sm">{categoryGroup.category.value}</span>
                        {isCategoryExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                      </button>
                      
                      {/* Conteúdo da Categoria */}
                      {isCategoryExpanded && (
                        <div className="bg-white dark:bg-gray-800">
                          {categoryGroup.subcategories.map((subGroup, subIdx) => {
                            const subcategoryId = subGroup.subcategory?.id;
                            const isSubcategoryExpanded = subcategoryId ? expandedSubcategories.has(subcategoryId) : true;
                            
                            // Se tem subcategoria, renderiza com accordion
                            if (subGroup.subcategory) {
                              return (
                                <div key={subcategoryId || subIdx} className="border-t border-gray-100 dark:border-gray-700">
                                  {/* Header da Subcategoria */}
                                  <button
                                    onClick={() => subcategoryId && toggleSubcategory(subcategoryId)}
                                    className="w-full flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                                  >
                                    <span className="font-semibold text-sm text-gray-700 dark:text-gray-300">{subGroup.subcategory.value}</span>
                                    {isSubcategoryExpanded ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
                                  </button>
                                  
                                  {/* Perguntas da Subcategoria */}
                                  {isSubcategoryExpanded && (
                                    <div className="p-3 space-y-3">
                                      {subGroup.questions.map((question, qIdx) => (
                                        <QuestionDisplay key={question.question_id} question={question} index={qIdx} />
                                      ))}
                                    </div>
                                  )}
                                </div>
                              );
                            }
                            
                            // Sem subcategoria, renderiza perguntas direto
                            return (
                              <div key={subIdx} className="p-3 space-y-3">
                                {subGroup.questions.map((question, qIdx) => (
                                  <QuestionDisplay key={question.question_id} question={question} index={qIdx} />
                                ))}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer Compacto - Fixo no rodapé */}
            <div className="border-t border-gray-200 dark:border-gray-700 p-3 bg-gray-50 dark:bg-gray-800 flex-shrink-0 space-y-2">
              {/* Aviso compacto */}
              <div className="flex items-center gap-2 text-xs text-yellow-700 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg px-3 py-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                <span>Ao aceitar, você confirma que revisou a avaliação. Esta ação não pode ser desfeita.</span>
              </div>
              
              {/* Linha com tempo restante e botão */}
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                  <Clock className="w-3 h-3" />
                  <span>Válido por {getTimeRemaining()}</span>
                </div>
                
                <button
                  onClick={handleAccept}
                  disabled={isAccepting}
                  className="py-2 px-6 bg-green-500 hover:bg-green-600 disabled:bg-green-400 text-white font-semibold rounded-lg transition-colors flex items-center gap-2 text-sm"
                >
                  {isAccepting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Processando...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-4 h-4" />
                      Aceitar Avaliação
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Success State */}
        {status === 'success' && (
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl overflow-hidden">
            {/* Header com Logo */}
            <div className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-700 dark:to-gray-800 px-8 py-6 text-center border-b border-gray-200 dark:border-gray-700">
              <div className="mx-auto h-20 w-20 mb-3 flex items-center justify-center">
                <img src={logo} alt="EKIP" className="h-full w-full object-contain" />
              </div>
              <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Bem vindo ao EKIP</h2>
            </div>
            <div className="p-8 text-center">
            <div className="w-20 h-20 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-12 h-12 text-green-500" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
              Avaliação Aceita!
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Sua avaliação foi aceita com sucesso.
            </p>
            {acceptedAt && (
              <p className="text-sm text-gray-500 dark:text-gray-500">
                Aceito em: {formatDateTime(acceptedAt)}
              </p>
            )}
            <div className="mt-6">
              <button
                onClick={() => window.close()}
                className="px-6 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                Fechar esta página
              </button>
            </div>
            </div>
            
            {/* Rodapé laranja */}
            <div className="bg-gradient-to-r from-orange-500 to-orange-600 px-8 py-1 text-center">
              <p className="text-sm text-white font-medium">
                Via Consulting
              </p>
            </div>
          </div>
        )}

        {/* Error State */}
        {status === 'error' && (
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl overflow-hidden">
            {/* Header com Logo */}
            <div className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-700 dark:to-gray-800 px-8 py-6 text-center border-b border-gray-200 dark:border-gray-700">
              <div className="mx-auto h-20 w-20 mb-3 flex items-center justify-center">
                <img src={logo} alt="EKIP" className="h-full w-full object-contain" />
              </div>
              <h2 className="text-3xl font-bold text-gray-800 dark:text-gray-100">Bem vindo ao EKIP</h2>
            </div>
            <div className="p-8 text-center">
            <div className="flex justify-center mb-4">
              {getErrorIcon()}
            </div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-4 mb-2">
              {getErrorTitle()}
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              {errorMessage}
            </p>
            
            {errorCode === 'TOKEN_EXPIRED' && (
              <p className="text-sm text-gray-500 dark:text-gray-500 mb-4">
                Entre em contato com seu gestor para solicitar um novo link de aceite.
              </p>
            )}
            
            {(errorCode === 'TOKEN_ALREADY_USED' || errorCode === 'ALREADY_ACCEPTED') && (
              <p className="text-sm text-gray-500 dark:text-gray-500 mb-4">
                Esta avaliação já foi aceita anteriormente. Não é necessário aceitar novamente.
              </p>
            )}
            
           
            </div>
            
            {/* Rodapé laranja */}
            <div className="bg-gradient-to-r from-orange-500 to-orange-600 px-8 py-1 text-center">
              <p className="text-sm text-white font-medium">
                Via Consulting
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default EvaluationAccept;
