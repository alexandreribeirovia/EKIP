/**
 * Página Pública de Aceite de Feedback
 * 
 * Esta página é acessada via link temporário enviado ao funcionário.
 * Não requer autenticação - valida apenas o token.
 * 
 * Fluxo:
 * 1. Funcionário recebe link com token
 * 2. Acessa página e vê detalhes do feedback (tipo, comentário, data)
 * 3. Clica em "Aceitar Feedback"
 * 4. Sistema registra aceite e invalida token
 */

import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { CheckCircle, XCircle, Clock, AlertTriangle, Loader2, User, Calendar, UserCheck, ThumbsUp, MessageCircle, Trophy, TrendingUp } from 'lucide-react';
import logoWhite from '../../img/logo_white.png';
import logo from '../../img/logo.png';
import type { FeedbackAcceptInfo } from '../types';

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

// Componente para badge de tipo de feedback
const FeedbackTypeBadge = ({ type, typeId }: { type: string; typeId: number | null }) => {
  const getTypeStyle = () => {
    switch (typeId) {
      case 1: // Positivo
        return {
          bg: 'bg-green-100 dark:bg-green-900/30',
          text: 'text-green-700 dark:text-green-300',
          icon: <ThumbsUp className="w-5 h-5" />
        };
      case 2: // Orientação
        return {
          bg: 'bg-blue-100 dark:bg-blue-900/30',
          text: 'text-blue-700 dark:text-blue-300',
          icon: <MessageCircle className="w-5 h-5" />
        };
      case 3: // Elogio
        return {
          bg: 'bg-yellow-100 dark:bg-yellow-900/30',
          text: 'text-yellow-700 dark:text-yellow-300',
          icon: <Trophy className="w-5 h-5" />
        };
      case 4: // Melhoria
        return {
          bg: 'bg-purple-100 dark:bg-purple-900/30',
          text: 'text-purple-700 dark:text-purple-300',
          icon: <TrendingUp className="w-5 h-5" />
        };
      default:
        return {
          bg: 'bg-gray-100 dark:bg-gray-700',
          text: 'text-gray-700 dark:text-gray-300',
          icon: <MessageCircle className="w-5 h-5" />
        };
    }
  };

  const style = getTypeStyle();

  return (
    <span className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium ${style.bg} ${style.text}`}>
      {style.icon}
      {type}
    </span>
  );
};

const FeedbackAccept = () => {
  const { token } = useParams<{ token: string }>();
  
  const [status, setStatus] = useState<PageStatus>('loading');
  const [feedback, setFeedback] = useState<FeedbackAcceptInfo | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [errorCode, setErrorCode] = useState('');
  const [isAccepting, setIsAccepting] = useState(false);
  const [acceptedAt, setAcceptedAt] = useState<string | null>(null);

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
        const response = await publicFetch(`/api/feedback-accept/verify/${token}`);

        if (response.success) {
          setFeedback(response.data.feedback);
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
      const response = await publicFetch(`/api/feedback-accept/confirm/${token}`, {
        method: 'POST',
      });

      if (response.success) {
        setStatus('success');
        setAcceptedAt(response.data.acceptedAt);
      } else {
        setStatus('error');
        setErrorMessage(response.error?.message || 'Erro ao aceitar feedback');
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
      case 'ACCESS_LIMIT_REACHED':
        return <AlertTriangle className="w-16 h-16 text-orange-500" />;
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
        return 'Feedback Já Aceito';
      case 'TOKEN_NOT_FOUND':
      case 'INVALID_TOKEN':
        return 'Link Inválido';
      case 'ACCESS_LIMIT_REACHED':
        return 'Limite de Acessos Atingido';
      default:
        return 'Erro';
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-100 via-gray-200 to-gray-300 dark:from-gray-800 dark:via-gray-900 dark:to-black py-6 px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-lg">
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
        {status === 'valid' && feedback && (
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl overflow-hidden">
            {/* Header Compacto */}
            <div className="bg-gradient-to-r from-orange-500 to-orange-600 px-4 py-3 flex items-center gap-3">
              <div className="flex flex-col items-center gap-1">
                <img src={logoWhite} alt="EKIP" className="h-10 w-10 object-contain" />
                <span className="text-white font-bold text-xs">EKIP</span>
              </div>
              <div className="flex-1 min-w-0">
                <h1 className="text-white text-xl font-bold text-center mb-2">Feedback</h1>
                <div className="flex items-center gap-2 flex-wrap text-white text-sm text-center justify-center">
                  <div className="flex items-center gap-1">
                    <User className="w-5 h-5" />
                    <span className="font-normal">{feedback.feedbackUserName}</span>
                  </div>
                  <span className="opacity-60">•</span>
                  <div className="flex items-center gap-1">
                    <UserCheck className="w-5 h-5" />
                    <span>{feedback.ownerName}</span>
                  </div>
                  <span className="opacity-60">•</span>
                  <div className="flex items-center gap-1">
                    <Calendar className="w-5 h-5" />
                    <span>{formatDate(feedback.feedbackDate)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Body - Conteúdo do Feedback */}
            <div className="p-6 space-y-4">
              {/* Tipo do Feedback */}
              <div className="flex justify-center">
                <FeedbackTypeBadge type={feedback.type} typeId={feedback.typeId} />
              </div>
              
              {/* Comentário Público */}
              <div className="bg-gray-50 dark:bg-gray-700/30 rounded-lg p-4 border border-gray-100 dark:border-gray-600">
                <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Comentário</h3>
                <div 
                  className="prose prose-sm dark:prose-invert max-w-none text-gray-700 dark:text-gray-300"
                  dangerouslySetInnerHTML={{ __html: feedback.publicComment }}
                />
              </div>
            </div>

            {/* Footer Compacto */}
            <div className="border-t border-gray-200 dark:border-gray-700 p-3 bg-gray-50 dark:bg-gray-800 space-y-2">
              {/* Aviso compacto */}
              <div className="flex items-center gap-2 text-xs text-yellow-700 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg px-3 py-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                <span>Ao aceitar, você confirma que revisou o feedback. Esta ação não pode ser desfeita.</span>
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
                      Aceitar Feedback
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
                Feedback Aceito!
              </h2>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                Seu feedback foi aceito com sucesso.
              </p>
              {acceptedAt && (
                <p className="text-sm text-gray-500 dark:text-gray-500">
                  Aceito em: {formatDateTime(acceptedAt)}
                </p>
              )}
              {/* <div className="mt-6">
                <button
                  onClick={() => window.close()}
                  className="px-6 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                >
                  Fechar esta página
                </button>
              </div> */}
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
                  Este feedback já foi aceito anteriormente. Não é necessário aceitar novamente.
                </p>
              )}
              
              {errorCode === 'ACCESS_LIMIT_REACHED' && (
                <p className="text-sm text-gray-500 dark:text-gray-500 mb-4">
                  O limite de acessos para este link foi atingido. Solicite um novo link ao seu gestor.
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

export default FeedbackAccept;
