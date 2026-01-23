/**
 * QuizGenerateLinkModal - Modal para configurar e gerar link de acesso ao quiz
 * 
 * Permite configurar:
 * - Número máximo de acessos
 * - Data/hora de expiração
 * 
 * Similar ao modal de geração de link de avaliações
 */

import { useState } from 'react';
import { X, Link, Copy, Check, ExternalLink } from 'lucide-react';
import apiClient from '../lib/apiClient';

interface QuizGenerateLinkModalProps {
  isOpen: boolean;
  onClose: () => void;
  quizId: number;
  participantId: number;
  participantName: string;
  onSuccess: (expiresAt: string) => void;
}

const QuizGenerateLinkModal = ({
  isOpen,
  onClose,
  quizId,
  participantId,
  participantName,
  onSuccess,
}: QuizGenerateLinkModalProps) => {
  // Estado do formulário
  const [maxAccess, setMaxAccess] = useState(10);
  const [expiresInHours, setExpiresInHours] = useState(168); // 7 dias
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Estado do link gerado
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleGenerate = async () => {
    setIsGenerating(true);
    setError(null);

    try {
      // Calcular data de expiração
      const expiryDate = new Date();
      expiryDate.setHours(expiryDate.getHours() + expiresInHours);

      const response = await apiClient.post<{ link: string; expires_at: string }>(
        `/api/quiz-participants/${quizId}/${participantId}/generate-link`,
        {
          expires_at: expiryDate.toISOString(),
          max_access: maxAccess,
        }
      );

      if (response.success && response.data) {
        setGeneratedLink(response.data.link);
        setExpiresAt(response.data.expires_at);
        onSuccess(response.data.expires_at);
      } else {
        setError(response.error?.message || 'Erro ao gerar link');
      }
    } catch (err) {
      console.error('Erro ao gerar link:', err);
      setError('Erro ao gerar link');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopyLink = async () => {
    if (generatedLink) {
      await navigator.clipboard.writeText(generatedLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleClose = () => {
    if (!isGenerating) {
      setGeneratedLink(null);
      setExpiresAt(null);
      setError(null);
      setCopied(false);
      onClose();
    }
  };

  const formatExpiryDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (!isOpen) return null;

  // Se já temos um link gerado, mostramos a tela de sucesso
  if (generatedLink) {
    return (
      <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-lg w-full">
          {/* Header */}
          <div className="p-5 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-t-2xl flex items-center justify-between">
            <h3 className="text-lg font-bold flex items-center gap-2">
              <Check className="w-5 h-5" />
              Link Gerado com Sucesso!
            </h3>
            <button
              onClick={handleClose}
              className="text-white hover:bg-white/20 rounded-full p-1 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          
          <div className="p-6 space-y-4">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Link gerado para <span className="font-semibold text-gray-800 dark:text-gray-200">{participantName}</span>
            </p>

            {/* Link Box */}
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
                Link de Acesso:
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={generatedLink}
                  className="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                />
                <button
                  onClick={handleCopyLink}
                  className={`p-2 rounded-lg transition-colors ${
                    copied
                      ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                  title={copied ? 'Copiado!' : 'Copiar link'}
                >
                  {copied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                </button>
                <a
                  href={generatedLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 hover:bg-purple-200 dark:hover:bg-purple-800/30 transition-colors"
                  title="Abrir link"
                >
                  <ExternalLink className="w-5 h-5" />
                </a>
              </div>
            </div>

            {/* Informações */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3">
                <p className="text-xs text-blue-600 dark:text-blue-400 font-medium">Máximo de Acessos</p>
                <p className="text-lg font-bold text-blue-800 dark:text-blue-300">{maxAccess}</p>
              </div>
              <div className="bg-orange-50 dark:bg-orange-900/20 rounded-lg p-3">
                <p className="text-xs text-orange-600 dark:text-orange-400 font-medium">Expira em</p>
                <p className="text-sm font-bold text-orange-800 dark:text-orange-300">
                  {expiresAt ? formatExpiryDate(expiresAt) : '-'}
                </p>
              </div>
            </div>

            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3">
              <p className="text-xs text-yellow-700 dark:text-yellow-400">
                <strong>Importante:</strong> Este link é único e não pode ser recuperado depois de fechar esta janela. 
                Copie e envie ao participante agora.
              </p>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={handleClose}
                className="px-6 py-2 text-sm font-medium text-white bg-purple-500 rounded-lg hover:bg-purple-600 transition-colors"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Tela de configuração
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full">
        {/* Header */}
        <div className="p-5 bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-t-2xl flex items-center justify-between">
          <h3 className="text-lg font-bold flex items-center gap-2">
            <Link className="w-5 h-5" />
            Gerar Link de Acesso
          </h3>
          <button
            onClick={handleClose}
            disabled={isGenerating}
            className="text-white hover:bg-white/20 rounded-full p-1 transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Configure as opções do link que será gerado para{' '}
            <span className="font-semibold text-gray-800 dark:text-gray-200">{participantName}</span>.
          </p>

          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          {/* Número máximo de acessos */}
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
              disabled={isGenerating}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-purple-500 focus:border-transparent disabled:opacity-50"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Quantas vezes o link pode ser acessado (sugerido: 10 para permitir recarregar a página)
            </p>
          </div>

          {/* Expiração */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Expiração (horas):
            </label>
            <input
              type="number"
              min="1"
              max="720"
              value={expiresInHours}
              onChange={(e) => setExpiresInHours(Math.max(1, parseInt(e.target.value) || 168))}
              disabled={isGenerating}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-purple-500 focus:border-transparent disabled:opacity-50"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Tempo até o link expirar (padrão: 168h = 7 dias, máximo: 720h = 30 dias)
            </p>
          </div>

          {/* Botões de atalho para expiração */}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setExpiresInHours(24)}
              disabled={isGenerating}
              className={`px-3 py-1 text-xs rounded-full transition-colors ${
                expiresInHours === 24
                  ? 'bg-purple-500 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              24h (1 dia)
            </button>
            <button
              type="button"
              onClick={() => setExpiresInHours(72)}
              disabled={isGenerating}
              className={`px-3 py-1 text-xs rounded-full transition-colors ${
                expiresInHours === 72
                  ? 'bg-purple-500 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              72h (3 dias)
            </button>
            <button
              type="button"
              onClick={() => setExpiresInHours(168)}
              disabled={isGenerating}
              className={`px-3 py-1 text-xs rounded-full transition-colors ${
                expiresInHours === 168
                  ? 'bg-purple-500 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              168h (7 dias)
            </button>
            <button
              type="button"
              onClick={() => setExpiresInHours(336)}
              disabled={isGenerating}
              className={`px-3 py-1 text-xs rounded-full transition-colors ${
                expiresInHours === 336
                  ? 'bg-purple-500 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              336h (14 dias)
            </button>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={handleClose}
              disabled={isGenerating}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleGenerate}
              disabled={isGenerating}
              className="px-4 py-2 text-sm font-medium text-white bg-purple-500 rounded-lg hover:bg-purple-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isGenerating ? (
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
  );
};

export default QuizGenerateLinkModal;
