import { useState, useEffect } from 'react';
import apiClient from '../lib/apiClient';
import { X, ClipboardCheck } from 'lucide-react';
import { QuizData } from '../types';

interface QuizModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  quizToEdit?: QuizData | null;
}

const QuizModal = ({ isOpen, onClose, onSuccess, quizToEdit }: QuizModalProps) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isActive, setIsActive] = useState(false);
  const [shuffleQuestions, setShuffleQuestions] = useState(true);
  const [shuffleOptions, setShuffleOptions] = useState(true);
  const [attemptLimit, setAttemptLimit] = useState<number | ''>('');
  const [passScore, setPassScore] = useState<number | ''>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Preencher formulário quando estiver editando
  useEffect(() => {
    if (quizToEdit) {
      setTitle(quizToEdit.title);
      setDescription(quizToEdit.description || '');
      setIsActive(quizToEdit.is_active);
      setShuffleQuestions(quizToEdit.shuffle_questions);
      setShuffleOptions(quizToEdit.shuffle_options);
      setAttemptLimit(quizToEdit.attempt_limit || '');
      setPassScore(quizToEdit.pass_score || '');
    } else {
      setTitle('');
      setDescription('');
      setIsActive(false);
      setShuffleQuestions(true);
      setShuffleOptions(true);
      setAttemptLimit('');
      setPassScore('');
    }
  }, [quizToEdit, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!title.trim()) {
      alert('Por favor, preencha o título do quiz.');
      return;
    }

    setIsSubmitting(true);

    try {
      const payload = {
        title: title.trim(),
        description: description.trim() || null,
        is_active: isActive,
        shuffle_questions: shuffleQuestions,
        shuffle_options: shuffleOptions,
        attempt_limit: attemptLimit || null,
        pass_score: passScore || null,
      };

      if (quizToEdit) {
        // Atualizar quiz existente
        const response = await apiClient.put(`/api/quiz/${quizToEdit.id}`, payload);

        if (!response.success) {
          console.error('Erro ao atualizar quiz:', response.error);
          alert('Erro ao atualizar quiz. Tente novamente.');
          return;
        }
      } else {
        // Criar novo quiz
        const response = await apiClient.post('/api/quiz', payload);

        if (!response.success) {
          console.error('Erro ao criar quiz:', response.error);
          alert('Erro ao criar quiz. Tente novamente.');
          return;
        }
      }

      // Limpa o formulário
      resetForm();
      
      // Chama callback de sucesso e fecha modal
      onSuccess();
      onClose();
    } catch (err) {
      console.error('Erro ao salvar quiz:', err);
      alert('Erro ao salvar quiz. Tente novamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setIsActive(false);
    setShuffleQuestions(true);
    setShuffleOptions(true);
    setAttemptLimit('');
    setPassScore('');
  };

  const handleClose = () => {
    if (!isSubmitting) {
      resetForm();
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="p-5 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-t-2xl flex items-center justify-between sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <ClipboardCheck className="w-6 h-6" />
            <h2 className="text-xl font-bold">{quizToEdit ? 'Editar Quiz' : 'Novo Quiz'}</h2>
          </div>
          <button
            onClick={handleClose}
            disabled={isSubmitting}
            className="text-white hover:bg-white/20 rounded-lg p-1 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6">
          <div className="space-y-4">
            {/* Título */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Título do Quiz <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex: Quiz de Segurança da Informação"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                disabled={isSubmitting}
                required
              />
            </div>

            {/* Descrição */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Descrição
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Descreva o objetivo deste quiz..."
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent resize-none"
                disabled={isSubmitting}
              />
            </div>

            {/* Configurações em Grid */}
            <div className="grid grid-cols-2 gap-4">
              {/* Nota Mínima para Aprovação */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Nota Mínima (%)
                </label>
                <input
                  type="number"
                  value={passScore}
                  onChange={(e) => setPassScore(e.target.value ? parseInt(e.target.value) : '')}
                  placeholder="Ex: 70"
                  min={0}
                  max={100}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  disabled={isSubmitting}
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Deixe vazio para não exigir nota mínima
                </p>
              </div>

              {/* Limite de Tentativas */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Limite de Tentativas
                </label>
                <input
                  type="number"
                  value={attemptLimit}
                  onChange={(e) => setAttemptLimit(e.target.value ? parseInt(e.target.value) : '')}
                  placeholder="Ex: 3"
                  min={1}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  disabled={isSubmitting}
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Deixe vazio para tentativas ilimitadas
                </p>
              </div>
            </div>

            {/* Opções de Embaralhamento */}
            <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg space-y-3">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                Opções de Embaralhamento
              </h3>
              
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="shuffleQuestions"
                  checked={shuffleQuestions}
                  onChange={(e) => setShuffleQuestions(e.target.checked)}
                  className="w-4 h-4 text-orange-500 bg-gray-100 border-gray-300 rounded focus:ring-orange-500 dark:focus:ring-orange-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                  disabled={isSubmitting}
                />
                <label htmlFor="shuffleQuestions" className="ml-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                  Embaralhar ordem das perguntas
                </label>
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="shuffleOptions"
                  checked={shuffleOptions}
                  onChange={(e) => setShuffleOptions(e.target.checked)}
                  className="w-4 h-4 text-orange-500 bg-gray-100 border-gray-300 rounded focus:ring-orange-500 dark:focus:ring-orange-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                  disabled={isSubmitting}
                />
                <label htmlFor="shuffleOptions" className="ml-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                  Embaralhar ordem das opções de resposta
                </label>
              </div>
            </div>

            {/* Status Ativo */}
            <div className="flex items-center p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
              <input
                type="checkbox"
                id="isActive"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="w-4 h-4 text-orange-500 bg-gray-100 border-gray-300 rounded focus:ring-orange-500 dark:focus:ring-orange-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                disabled={isSubmitting}
              />
              <div className="ml-2">
                <label htmlFor="isActive" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Quiz ativo
                </label>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Apenas quizzes ativos podem ter links gerados para participantes
                </p>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="mt-6 flex justify-end gap-3">
            <button
              type="button"
              onClick={handleClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 font-semibold bg-gray-200 dark:bg-gray-700 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 text-sm text-white font-semibold bg-orange-500 rounded-lg hover:bg-orange-600 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ClipboardCheck className="w-4 h-4" />
              {isSubmitting ? 'Salvando...' : (quizToEdit ? 'Salvar Alterações' : 'Criar Quiz')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default QuizModal;
