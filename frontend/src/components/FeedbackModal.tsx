import { useState, useEffect } from 'react';
import { X, ThumbsUp, MessageCircle, Trophy, TrendingUp, Target } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import Select from 'react-select';
import { useAuthStore } from '../stores/authStore';
import PDIModal from './PDIModal';

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
  
  // Estados para PDI Modal
  const [isPDIModalOpen, setIsPDIModalOpen] = useState(false);

  // Carrega usuários e preenche o formulário
  useEffect(() => {
    if (isOpen) {
      void fetchUsers();
      
      if (feedbackToEdit) {
        // Modo de edição
        setSelectedFeedbackUser({ value: feedbackToEdit.feedback_user_id, label: feedbackToEdit.feedback_user_name });
        setFeedbackDate(feedbackToEdit.feedback_date.split('T')[0]);
        const type = feedbackTypes.find(t => t.name === feedbackToEdit.type);
        setSelectedType(type ? type.id : null);
        setPublicComment(feedbackToEdit.public_comment || '');
        setPrivateComment(feedbackToEdit.private_comment || '');
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
      }
    } else {
      // Reset form when closing
      resetForm();
    }
  }, [isOpen, preSelectedUser, feedbackToEdit]);

  const fetchUsers = async () => {
    try {
      // Busca todos os usuários ativos para "Feedback para"
      const { data: allUsers, error: usersError } = await supabase
        .from('users')
        .select('user_id, name, position')
        .eq('is_active', true)
        .order('name');

      if (usersError) {
        console.error('Erro ao buscar usuários:', usersError);
        setError('Erro ao carregar lista de usuários');
        return;
      }

      const userOptions: UserOption[] = (allUsers || []).map((user) => ({
        value: user.user_id,
        label: user.name,
      }));

      setUsers(userOptions);
    } catch (err) {
      console.error('Erro ao buscar usuários:', err);
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
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validações
    if (!user) {
      setError('Usuário não autenticado');
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

      let rpcError;

      if (feedbackToEdit) {
        // Update
        const { error } = await supabase
          .from('feedbacks')
          .update(feedbackDataPayload)
          .eq('id', feedbackToEdit.id);
        rpcError = error;
      } else {
        // Insert
        const { error } = await supabase
          .from('feedbacks')
          .insert(feedbackDataPayload);
        rpcError = error;
      }


      if (rpcError) {
        setError(rpcError.message || 'Erro ao salvar feedback. Tente novamente.');
        return;
      }

      // Sucesso
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Erro ao salvar feedback:', err);
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
          {/* Erro */}
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-lg text-sm">
              {error}
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
                isDisabled={!!preSelectedUser}
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
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-orange-500 focus:border-transparent"
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
                  onClick={() => setSelectedType(type.id)}
                  className={`flex flex-col items-center justify-center p-4 rounded-lg border-2 transition-all ${
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
            <textarea
              value={publicComment}
              onChange={(e) => setPublicComment(e.target.value)}
              rows={4}
              placeholder="Digite o feedback que será compartilhado com o consultor..."
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-orange-500 focus:border-transparent resize-none"
            />
          </div>

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

          {/* Footer Buttons */}
          <div className="flex justify-between items-center gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-6 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancelar
            </button>
            
            <div className="flex gap-3">
              {/* Botão Adicionar PDI - só aparece no modo de edição */}
              {feedbackToEdit && (
                <button
                  type="button"
                  onClick={() => setIsPDIModalOpen(true)}
                  className="px-6 py-2 text-sm font-medium text-white bg-orange-500 rounded-lg hover:bg-orange-600 transition-colors flex items-center gap-2"
                >
                  <Target className="w-4 h-4" />
                  Adicionar PDI
                </button>
              )}
              
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
                  feedbackToEdit ? 'Salvar Alterações' : 'Salvar Feedback'
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
    
    {/* Modal de PDI - FORA do modal de feedback para evitar problemas de z-index */}
    {(() => {
      console.log('🔍 Verificando renderização do PDIModal:', {
        feedbackToEdit: !!feedbackToEdit,
        isPDIModalOpen,
        feedbackId: feedbackToEdit?.id
      });
      
      if (!feedbackToEdit || !isPDIModalOpen) {
        console.log('❌ PDIModal NÃO será renderizado');
        return null;
      }
      
      const consultant = { value: feedbackToEdit.feedback_user_id, label: feedbackToEdit.feedback_user_name };
      const manager = { value: feedbackToEdit.owner_user_id, label: feedbackToEdit.owner_user_name };
      
      console.log('✅ Renderizando PDIModal com:', {
        feedbackId: feedbackToEdit.id,
        consultant,
        manager,
        isPDIModalOpen
      });
      
      return (
        <PDIModal
          isOpen={isPDIModalOpen}
          onClose={() => {
            console.log('🔴 Fechando PDIModal');
            setIsPDIModalOpen(false);
          }}
          onSuccess={() => {
            console.log('🎉 PDI criado com sucesso');
            setIsPDIModalOpen(false);
          }}
          feedbackId={feedbackToEdit.id}
          prefilledConsultant={consultant}
          prefilledManager={manager}
          onError={(message) => {
            console.log('❌ Erro no PDI:', message);
            setError(message);
          }}
        />
      );
    })()}
    </>
  );
};

export default FeedbackModal;
