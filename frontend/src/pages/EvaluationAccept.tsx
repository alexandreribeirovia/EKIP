/**
 * Página Pública de Aceite de Avaliação
 * 
 * Esta página é acessada via link temporário enviado ao funcionário.
 * Não requer autenticação - valida apenas o token.
 * 
 * Fluxo:
 * 1. Funcionário recebe link com token
 * 2. Acessa página e vê detalhes da avaliação
 * 3. Clica em "Aceitar Avaliação"
 * 4. Sistema registra aceite e invalida token
 */

import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { CheckCircle, XCircle, Clock, AlertTriangle, Loader2, User, Calendar, UserCheck } from 'lucide-react';
import logo from '../../img/logo.png';

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

interface EvaluationData {
  id: number;
  name: string;
  userName: string;
  ownerName: string;
  periodStart: string;
  periodEnd: string;
}

type PageStatus = 'loading' | 'valid' | 'error' | 'success';

const EvaluationAccept = () => {
  const { token } = useParams<{ token: string }>();
  
  const [status, setStatus] = useState<PageStatus>('loading');
  const [evaluation, setEvaluation] = useState<EvaluationData | null>(null);
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
        const response = await publicFetch(`/api/evaluation-accept/verify/${token}`);

        if (response.success) {
          setEvaluation(response.data.evaluation);
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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-100 via-gray-200 to-gray-300 dark:from-gray-800 dark:via-gray-900 dark:to-black py-12 px-4 sm:px-6 lg:px-8">
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
        {status === 'valid' && evaluation && (
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl overflow-hidden">
            {/* Header com Logo */}
            <div className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-700 dark:to-gray-800 px-8 py-6 text-center">
              <div className="mx-auto h-20 w-20 mb-3 flex items-center justify-center">
                <img src={logo} alt="EKIP" className="h-full w-full object-contain" />
              </div>
              <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Bem vindo ao EKIP</h2>
              <p className="text-base text-gray-600 dark:text-gray-400 mt-1">Aceite de Avaliação</p>
            </div>
            
            {/* Barra laranja */}
            <div className="bg-gradient-to-r from-orange-500 to-orange-600 px-6 py-3">
              <p className="text-center text-white text-sm font-medium">
                Confirme que você revisou e aceita esta avaliação
              </p>
            </div>

            {/* Content */}
            <div className="p-6 space-y-4">
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4 space-y-4">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
                    <User className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                  </div>
                  <div>
                    <span className="text-sm text-gray-500 dark:text-gray-400">Avaliado</span>
                    <p className="font-medium text-gray-900 dark:text-gray-100">{evaluation.userName}</p>
                  </div>
                </div>
                
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                    <UserCheck className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <span className="text-sm text-gray-500 dark:text-gray-400">Avaliador</span>
                    <p className="font-medium text-gray-900 dark:text-gray-100">{evaluation.ownerName}</p>
                  </div>
                </div>
                
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                    <Calendar className="w-5 h-5 text-green-600 dark:text-green-400" />
                  </div>
                  <div>
                    <span className="text-sm text-gray-500 dark:text-gray-400">Período da Avaliação</span>
                    <p className="font-medium text-gray-900 dark:text-gray-100">
                      {formatDate(evaluation.periodStart)} a {formatDate(evaluation.periodEnd)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Tempo restante */}
              <div className="flex items-center justify-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                <Clock className="w-4 h-4" />
                <span>Link válido por mais {getTimeRemaining()}</span>
              </div>

              <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl p-4 flex gap-3">
                <AlertTriangle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-yellow-700 dark:text-yellow-300">
                  <p className="font-medium">Atenção</p>
                  <p>Ao clicar em "Aceitar Avaliação", você confirma que:</p>
                  <ul className="list-disc list-inside mt-1 space-y-1">
                    <li>Revisou o conteúdo da avaliação</li>
                    <li>Concorda com os termos apresentados</li>
                    <li>Esta ação não pode ser desfeita</li>
                  </ul>
                </div>
              </div>

              <button
                onClick={handleAccept}
                disabled={isAccepting}
                className="w-full py-3 px-4 bg-green-500 hover:bg-green-600 disabled:bg-green-400 text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                {isAccepting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Processando...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-5 h-5" />
                    Aceitar Avaliação
                  </>
                )}
              </button>
            </div>
            
            {/* Rodapé laranja */}
            <div className="bg-gradient-to-r from-orange-500 to-orange-600 px-8 py-1 text-center">
              <p className="text-sm text-white font-medium p-2">
                
              </p>
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
                Desenvolvido por Via Consulting
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
            {getErrorIcon()}
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
