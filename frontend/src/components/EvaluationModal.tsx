import { useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { X, FileText } from 'lucide-react';

interface EvaluationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const EvaluationModal = ({ isOpen, onClose, onSuccess }: EvaluationModalProps) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim()) {
      alert('Por favor, preencha o nome da avaliação.');
      return;
    }

    setIsSubmitting(true);

    try {
      const { error } = await supabase
        .from('evaluations_model')
        .insert([
          {
            name: name.trim(),
            description: description.trim() || null,
            is_active: isActive,
          }
        ]);

      if (error) {
        console.error('Erro ao criar avaliação:', error);
        alert('Erro ao criar avaliação. Tente novamente.');
        return;
      }

      // Limpa o formulário
      setName('');
      setDescription('');
      setIsActive(true);
      
      // Chama callback de sucesso e fecha modal
      onSuccess();
      onClose();
    } catch (err) {
      console.error('Erro ao criar avaliação:', err);
      alert('Erro ao criar avaliação. Tente novamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      setName('');
      setDescription('');
      setIsActive(true);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl max-w-2xl w-full">
        {/* Header */}
        <div className="p-5 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-t-2xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FileText className="w-6 h-6" />
            <h2 className="text-xl font-bold">Nova Avaliação</h2>
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
            {/* Nome */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Nome da Avaliação <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Avaliação Trimestral 2025"
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
                placeholder="Descreva o objetivo desta avaliação..."
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent resize-none"
                disabled={isSubmitting}
              />
            </div>

            {/* Status Ativo */}
            <div className="flex items-center">
              <input
                type="checkbox"
                id="isActive"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="w-4 h-4 text-orange-500 bg-gray-100 border-gray-300 rounded focus:ring-orange-500 dark:focus:ring-orange-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                disabled={isSubmitting}
              />
              <label htmlFor="isActive" className="ml-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                Avaliação ativa
              </label>
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
              <FileText className="w-4 h-4" />
              {isSubmitting ? 'Criando...' : 'Criar Avaliação'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EvaluationModal;
