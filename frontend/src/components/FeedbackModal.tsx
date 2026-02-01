import { useState, useEffect } from 'react';
import { X, ThumbsUp, MessageCircle, Trophy, TrendingUp, Target, Lock, Link, Copy, Clock, CheckCircle, AlertCircle } from 'lucide-react';
import * as apiClient from '../lib/apiClient';
import Select from 'react-select';
import { useAuthStore } from '../stores/authStore';
import PDIModal from './PDIModal';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';

interface FeedbackData {
  id: number;
  feedback_user_id: string;
  feedback_user_name: string;
  owner_user_id: string;
  owner_user_name: string;
  feedback_date: string;
  type: string;
  public_comment: string;
  private_comment?: string | null;
  type_id?: number | null;
  is_pdi?: boolean;
  is_closed?: boolean;
  closed_at?: string | null;
  accepted?: boolean;
  accepted_at?: string | null;
}

interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  preSelectedUser?: {
    user_id: string;
    name: string;
  } | null;
  feedbackToEdit?: FeedbackData | null;
}

interface UserOption {
  value: string;
  label: string;
}

interface FeedbackType {
  id: number;
  name: string;
  icon: React.ReactNode;
  color: string;
}

const feedbackTypes: FeedbackType[] = [
  { id: 1, name: 'Positivo', icon: <ThumbsUp className="w-6 h-6" />, color: 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-900/50' },
  { id: 2, name: 'Orientação', icon: <MessageCircle className="w-6 h-6" />, color: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 hover:bg-blue-200 dark:hover:bg-blue-900/50' },
  { id: 3, name: 'Elogio', icon: <Trophy className="w-6 h-6" />, color: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400 hover:bg-yellow-200 dark:hover:bg-yellow-900/50' },
  { id: 4, name: 'Melhoria', icon: <TrendingUp className="w-6 h-6" />, color: 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 hover:bg-purple-200 dark:hover:bg-purple-900/50' },
];

const FeedbackModal = ({ isOpen, onClose, onSuccess, preSelectedUser = null, feedbackToEdit = null }: FeedbackModalProps) => {
  const { user } = useAuthStore();
  const [users, setUsers] = useState<UserOption[]>([]);
  const [selectedFeedbackUser, setSelectedFeedbackUser] = useState<UserOption | null>(null);
  const [feedbackDate, setFeedbackDate] = useState('');
  const [selectedType, setSelectedType] = useState<number | null>(null);
  const [publicComment, setPublicComment] = useState('');
  const [privateComment, setPrivateComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  
  // Estados para PDI Modal
  const [isPDIModalOpen, setIsPDIModalOpen] = useState(false);
  const [hasLinkedPDI, setHasLinkedPDI] = useState(false);
  
  // Estados para aceite de feedback
  const [isClosed, setIsClosed] = useState(false);
  const [isAccepted, setIsAccepted] = useState(false);
  const [acceptedAt, setAcceptedAt] = useState<string | null>(null);
  const [isClosing, setIsClosing] = useState(false);
  const [isGeneratingLink, setIsGeneratingLink] = useState(false);
  const [showGenerateLinkModal, setShowGenerateLinkModal] = useState(false);
  const [showAcceptLinkModal, setShowAcceptLinkModal] = useState(false);
  const [generatedAcceptUrl, setGeneratedAcceptUrl] = useState('');
  const [acceptLinkInfo, setAcceptLinkInfo] = useState<{
    hasValidLink: boolean;
    linkExpiresAt: string | null;
  } | null>(null);
  const [maxAccess, setMaxAccess] = useState(1);
  const [expiresInHours, setExpiresInHours] = useState(24);

  // Carrega usuários e preenche o formulário
  useEffect(() => {
    if (isOpen) {
      void fetchUsers();
      
      if (feedbackToEdit) {
        const checkPDI = async () => {
          const result = await apiClient.get<{ has_pdi: boolean }>(`/api/feedbacks/${feedbackToEdit.id}/pdi`);

          if (!result.success) {
            setHasLinkedPDI(false);
          } else {
            setHasLinkedPDI(result.data?.has_pdi || false);
          }
        };
        void checkPDI();
        
        // Modo de edição
        setSelectedFeedbackUser({ value: feedbackToEdit.feedback_user_id, label: feedbackToEdit.feedback_user_name });
        setFeedbackDate(feedbackToEdit.feedback_date.split('T')[0]);
        const type = feedbackTypes.find(t => t.name === feedbackToEdit.type);
        setSelectedType(type ? type.id : null);
        setPublicComment(feedbackToEdit.public_comment || '');
        setPrivateComment(feedbackToEdit.private_comment || '');
        
        // Carregar status de fechamento do feedbackToEdit
        setIsClosed(feedbackToEdit.is_closed || false);
        setIsAccepted(feedbackToEdit.accepted || false);
        setAcceptedAt(feedbackToEdit.accepted_at || null);
        
        // Se o feedback está fechado, buscar status do link de aceite
        if (feedbackToEdit.is_closed && !feedbackToEdit.accepted) {
          const checkAcceptLink = async () => {
            const result = await apiClient.get<{
              isClosed: boolean;
              closedAt: string | null;
              accepted: boolean;
              acceptedAt: string | null;
              hasValidLink: boolean;
              linkExpiresAt: string | null;
            }>(`/api/feedback-accept/${feedbackToEdit.id}/link`);
            
            if (result.success && result.data) {
              setAcceptLinkInfo({
                hasValidLink: result.data.hasValidLink,
                linkExpiresAt: result.data.linkExpiresAt
              });
            }
          };
          void checkAcceptLink();
        }
      } else {
        // Modo de criação
        const today = new Date().toISOString().split('T')[0];
        setFeedbackDate(today);
        
        if (preSelectedUser) {
          setSelectedFeedbackUser({
            value: preSelectedUser.user_id,
            label: preSelectedUser.name,
          });
        }
        setHasLinkedPDI(false);
        setIsClosed(false);
        setIsAccepted(false);
        setAcceptedAt(null);
        setAcceptLinkInfo(null);
      }
    } else {
      // Reset form when closing
      resetForm();
    }
  }, [isOpen, preSelectedUser, feedbackToEdit]);

  const fetchUsers = async () => {
    try {
      // Busca todos os usuários ativos para "Feedback para"
      const result = await apiClient.get<{ user_id: string; name: string; position: string }[]>('/api/lookups/users');

      if (!result.success) {
        setError('Erro ao carregar lista de usuários');
        return;
      }

      const userOptions: UserOption[] = (result.data || []).map((user) => ({
        value: user.user_id,
        label: user.name,
      }));

      setUsers(userOptions);
    } catch (err) {
      setError('Erro ao carregar lista de usuários');
    }
  };

  const resetForm = () => {
    setSelectedFeedbackUser(null);
    setFeedbackDate('');
    setSelectedType(null);
    setPublicComment('');
    setPrivateComment('');
    setError('');
    setSuccessMessage('');
    setHasLinkedPDI(false);
    setIsClosed(false);
    setIsAccepted(false);
    setAcceptedAt(null);
    setAcceptLinkInfo(null);
    setGeneratedAcceptUrl('');
    setMaxAccess(1);
    setExpiresInHours(24);
  };

  // Verificar se usuário é o owner do feedback
  const isOwner = user?.runrun_user_id === feedbackToEdit?.owner_user_id;

  // Encerrar feedback
  const handleCloseFeedback = async () => {
    if (!feedbackToEdit || isClosing) return;

    setIsClosing(true);
    setError('');

    try {
      const result = await apiClient.patch<{ message: string; closedAt: string }>(`/api/feedbacks/${feedbackToEdit.id}/close`);

      if (result.success && result.data) {
        setIsClosed(true);
        setSuccessMessage('Feedback encerrado com sucesso!');
        onSuccess();
      } else {
        setError(result.error?.message || 'Erro ao encerrar feedback');
      }
    } catch (err) {
      setError('Erro ao encerrar feedback');
    } finally {
      setIsClosing(false);
    }
  };

  // Gerar link de aceite
  const handleGenerateLink = async () => {
    if (!feedbackToEdit || isGeneratingLink) return;

    setIsGeneratingLink(true);
    setError('');

    try {
      const result = await apiClient.post<{
        token: string;
        url: string;
        expiresAt: string;
        expiresInHours: number;
        maxAccess: number;
      }>(`/api/feedback-accept/${feedbackToEdit.id}/generate`, {
        maxAccess,
        expiresInHours
      });

      if (result.success && result.data) {
        setGeneratedAcceptUrl(result.data.url);
        setShowGenerateLinkModal(false);
        setShowAcceptLinkModal(true);
        setAcceptLinkInfo({
          hasValidLink: true,
          linkExpiresAt: result.data.expiresAt
        });

        // Copiar para clipboard
        try {
          await navigator.clipboard.writeText(result.data.url);
          setSuccessMessage('Link de aceite gerado e copiado para a área de transferência!');
        } catch {
          setSuccessMessage('Link de aceite gerado com sucesso!');
        }
      } else {
        setError(result.error?.message || 'Erro ao gerar link de aceite');
      }
    } catch (err) {
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validações
    if (!user) {
      setError('Usuário não autenticado');
      return;
    }

    if (!user.runrun_user_id) {
      setError('Usuário não possui ID configurado. Faça logout e login novamente.');
      return;
    }

    if (!selectedFeedbackUser) {
      setError('Selecione o consultor que receberá o feedback');
      return;
    }

    if (!feedbackDate) {
      setError('Selecione a data do feedback');
      return;
    }

    if (selectedType === null) {
      setError('Selecione o tipo de feedback');
      return;
    }

    if (!publicComment.trim()) {
      setError('Digite um comentário público');
      return;
    }

    setIsSubmitting(true);
    try {
      const feedbackTypeName = feedbackTypes.find(t => t.id === selectedType)?.name || '';

      const feedbackDataPayload = {
        feedback_user_id: selectedFeedbackUser.value,
        feedback_user_name: selectedFeedbackUser.label,
        owner_user_id: user.runrun_user_id,
        owner_user_name: user.name,
        feedback_date: feedbackDate,
        type_id: selectedType,
        type: feedbackTypeName,
        public_comment: publicComment.trim(),
        private_comment: privateComment.trim() || null,
      };

      let result;

      if (feedbackToEdit) {
        // Update
        result = await apiClient.patch(`/api/feedbacks/${feedbackToEdit.id}`, feedbackDataPayload);
      } else {
        // Insert
        result = await apiClient.post('/api/feedbacks', feedbackDataPayload);
      }

      if (!result.success) {
        setError(result.error?.message || 'Erro ao salvar feedback. Tente novamente.');
        return;
      }

      // Sucesso
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Erro ao salvar feedback. Tente novamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-2xl w-full">
        {/* Header */}
        <div className="p-5 bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-t-2xl flex items-center justify-between">
          <h2 className="text-xl font-bold">{feedbackToEdit ? 'Editar Feedback' : 'Novo Feedback'}</h2>
          <button
            onClick={onClose}
            className="text-white hover:bg-white/20 rounded-full p-1 transition-colors"
            disabled={isSubmitting}
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Closed Status Banner */}
          {feedbackToEdit && isClosed && (
            <div className="bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-lg p-4 flex items-center gap-3">
              <Lock className="w-5 h-5 text-gray-500 dark:text-gray-400" />
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Este feedback foi encerrado
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Não é possível editar um feedback encerrado. 
                </p>
              </div>
              {isAccepted ? (
                <span className="px-3 py-1 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300">
                  ✓ Aceito {acceptedAt && `em ${new Date(acceptedAt).toLocaleDateString('pt-BR')}`}
                </span>
              ) : (
                <span className="px-3 py-1 rounded-full text-xs font-medium bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300">
                  Pendente de aceite
                </span>
              )}
            </div>
          )}

          {/* Erro */}
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          {/* Success */}
          {successMessage && (
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-400 px-4 py-3 rounded-lg text-sm">
              {successMessage}
            </div>
          )}

          {/* Feedback Para e Data - Grid 2 colunas */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Feedback Para */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Feedback para: *
              </label>
              <Select
                options={users}
                value={selectedFeedbackUser}
                onChange={(option) => setSelectedFeedbackUser(option)}
                placeholder="Selecionar consultor..."
                className="react-select-container"
                classNamePrefix="react-select"
                isClearable
                isDisabled={!!preSelectedUser || isClosed}
              />
            </div>

            {/* Data do Feedback */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Data do feedback: *
              </label>
              <input
                type="date"
                value={feedbackDate}
                onChange={(e) => setFeedbackDate(e.target.value)}
                disabled={isClosed}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-orange-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
              />
            </div>
          </div>

          {/* Tipo de Feedback */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Tipo de feedback: *
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {feedbackTypes.map((type) => (
                <button
                  key={type.id}
                  type="button"
                  onClick={() => !isClosed && setSelectedType(type.id)}
                  disabled={isClosed}
                  className={`flex flex-col items-center justify-center p-4 rounded-lg border-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                    selectedType === type.id
                      ? 'border-orange-500 ' + type.color
                      : 'border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50 text-gray-600 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-500'
                  }`}
                >
                  {type.icon}
                  <span className="mt-2 text-sm font-medium">{type.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Comentário Público */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Comentário: *
            </label>
            {isClosed ? (
              <div 
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100 min-h-[100px] prose prose-sm dark:prose-invert max-w-none"
                dangerouslySetInnerHTML={{ __html: publicComment || '<p class="text-gray-400">Nenhum comentário</p>' }}
              />
            ) : (
              <div className="border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 overflow-hidden">
                <ReactQuill
                  theme="snow"
                  value={publicComment}
                  onChange={setPublicComment}
                  placeholder="Digite o feedback que será compartilhado com o consultor..."
                  className="feedback-wysiwyg"
                  modules={{
                    toolbar: [
                      [{ 'header': [1, 2, 3, false] }],
                      ['bold', 'italic', 'underline', 'strike'],
                      [{ 'list': 'ordered'}, { 'list': 'bullet' }],
                      [{ 'color': [] }, { 'background': [] }],
                      ['link'],
                      ['clean']
                    ],
                  }}
                />
              </div>
            )}
          </div>

          {/* Alerta de PDI vinculado */}
          {feedbackToEdit && hasLinkedPDI && (
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-400 px-4 py-3 rounded-lg text-sm flex items-center gap-3">
              <Target className="w-5 h-5" />
              <span>Existe PDI vinculado a este feedback.</span>
            </div>
          )}

          {/* Observações Internas
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Observações internas (visível somente ao Administrador):
            </label>
            <textarea
              value={privateComment}
              onChange={(e) => setPrivateComment(e.target.value)}
              rows={3}
              placeholder="Anotações privadas sobre o feedback..."
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent resize-none"
            />
          </div> */}

          {/* Acceptance Section - Only visible when closed and user is owner */}
          {feedbackToEdit && isClosed && isOwner && !isAccepted && (
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Link className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  <div>
                    <p className="text-sm font-medium text-blue-700 dark:text-blue-300">
                      Link de Aceite
                    </p>
                    {acceptLinkInfo?.hasValidLink && acceptLinkInfo.linkExpiresAt ? (
                      <p className="text-xs text-blue-600 dark:text-blue-400 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        Expira em {formatTimeRemaining(acceptLinkInfo.linkExpiresAt)}
                      </p>
                    ) : (
                      <p className="text-xs text-blue-600 dark:text-blue-400">
                        Gere um link para o colaborador aceitar o feedback
                      </p>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowGenerateLinkModal(true)}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-500 rounded-lg hover:bg-blue-600 transition-colors flex items-center gap-2"
                >
                  <Link className="w-4 h-4" />
                  {acceptLinkInfo?.hasValidLink ? 'Gerar Novo Link' : 'Gerar Link'}
                </button>
              </div>
            </div>
          )}

          {/* Footer Buttons */}
          <div className="flex justify-between items-center gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting || isClosing}
              className="px-6 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isClosed ? 'Fechar' : 'Cancelar'}
            </button>
            
            <div className="flex gap-3">
              {/* Botão Encerrar Feedback - só aparece para owner quando não está fechado */}
              {feedbackToEdit && isOwner && !isClosed && (
                <button
                  type="button"
                  onClick={handleCloseFeedback}
                  disabled={isClosing || isSubmitting}
                  className="px-6 py-2 text-sm font-medium text-white bg-red-500 rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {isClosing ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Encerrando...
                    </>
                  ) : (
                    <>
                      <Lock className="w-4 h-4" />
                      Encerrar
                    </>
                  )}
                </button>
              )}

              {/* Botão Adicionar PDI - só aparece no modo de edição */}
              {feedbackToEdit && !isClosed && (
                <button
                  type="button"
                  onClick={() => setIsPDIModalOpen(true)}
                  className="px-6 py-2 text-sm font-medium text-white bg-orange-500 rounded-lg hover:bg-orange-600 transition-colors flex items-center gap-2"
                >
                  <Target className="w-4 h-4" />
                  Exibir PDI
                </button>
              )}
              
              {/* Botão Salvar - só aparece quando não está fechado */}
              {!isClosed && (
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-6 py-2 text-sm font-medium text-white bg-green-500 rounded-lg hover:bg-green-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Salvando...
                    </>
                  ) : (
                    feedbackToEdit ? 'Salvar' : 'Salvar'
                  )}
                </button>
              )}
            </div>
          </div>
        </form>
      </div>
    </div>

    {/* Modal para Gerar Link de Aceite */}
    {showGenerateLinkModal && (
      <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-4">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full">
          <div className="p-5 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-t-2xl flex items-center justify-between">
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
              Configure as opções do link de aceite que será gerado para o colaborador.
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
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-transparent"
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
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-transparent"
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
                onClick={handleGenerateLink}
                disabled={isGeneratingLink}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-500 rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
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

    {/* Modal para Exibir Link Gerado */}
    {showAcceptLinkModal && generatedAcceptUrl && (
      <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-4">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full">
          <div className="p-5 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-t-2xl flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5" />
              <h3 className="text-lg font-bold">Link Gerado com Sucesso!</h3>
            </div>
            <button
              onClick={() => setShowAcceptLinkModal(false)}
              className="text-white hover:bg-white/20 rounded-full p-1 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="p-6 space-y-4">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Compartilhe este link com o colaborador para que ele possa aceitar o feedback.
            </p>
            
            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3 flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={generatedAcceptUrl}
                className="flex-1 bg-transparent text-sm text-gray-700 dark:text-gray-300 outline-none"
              />
              <button
                onClick={copyAcceptLink}
                className="px-3 py-1.5 text-sm font-medium text-white bg-blue-500 rounded-lg hover:bg-blue-600 transition-colors flex items-center gap-1"
              >
                <Copy className="w-4 h-4" />
                Copiar
              </button>
            </div>

            {acceptLinkInfo?.linkExpiresAt && (
              <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                <Clock className="w-4 h-4" />
                <span>Expira em {formatTimeRemaining(acceptLinkInfo.linkExpiresAt)}</span>
              </div>
            )}

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setShowAcceptLinkModal(false)}
                className="px-4 py-2 text-sm font-medium text-white bg-green-500 rounded-lg hover:bg-green-600 transition-colors"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      </div>
    )}
    
    {/* Modal de PDI - FORA do modal de feedback para evitar problemas de z-index */}
    {feedbackToEdit && isPDIModalOpen && (
      <PDIModal
        isOpen={isPDIModalOpen}
        onClose={() => setIsPDIModalOpen(false)}
        onSuccess={async () => {
          setHasLinkedPDI(true);
          
          // Atualiza o campo is_pdi na tabela feedbacks via API
          if (feedbackToEdit) {
            await apiClient.patch(`/api/feedbacks/${feedbackToEdit.id}/pdi`, { is_pdi: true });
          }
          
          setIsPDIModalOpen(false);
        }}
        feedbackId={feedbackToEdit.id}
        prefilledConsultant={{ value: feedbackToEdit.feedback_user_id, label: feedbackToEdit.feedback_user_name }}
        prefilledManager={{ value: feedbackToEdit.owner_user_id, label: feedbackToEdit.owner_user_name }}
        onError={(message) => setError(message)}
      />
    )}
    </>
  );
};

export default FeedbackModal;
