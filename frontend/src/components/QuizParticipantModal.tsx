/**
 * QuizParticipantModal - Modal para adicionar participantes ao quiz
 * 
 * Permite selecionar múltiplos usuários usando react-select
 * Similar ao padrão de avaliações
 */

import { useState, useEffect, useMemo } from 'react';
import Select, { StylesConfig, MultiValue } from 'react-select';
import { X, Users, UserPlus } from 'lucide-react';
import apiClient from '../lib/apiClient';

interface UserOption {
  value: string;
  label: string;
  email?: string;
}

interface QuizParticipantModalProps {
  isOpen: boolean;
  onClose: () => void;
  quizId: number;
  onSuccess: () => void;
  existingParticipantIds: string[];
}

const QuizParticipantModal = ({
  isOpen,
  onClose,
  quizId,
  onSuccess,
  existingParticipantIds,
}: QuizParticipantModalProps) => {
  const [selectedUsers, setSelectedUsers] = useState<MultiValue<UserOption>>([]);
  const [allUsers, setAllUsers] = useState<UserOption[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Buscar lista de usuários
  useEffect(() => {
    if (!isOpen) return;

    const fetchUsers = async () => {
      setIsLoadingUsers(true);
      try {
        const response = await apiClient.get<Array<{ user_id: string; name: string; email: string }>>('/api/lookups/users');
        
        if (response.success && response.data) {
          const options = response.data.map(user => ({
            value: user.user_id,
            label: user.name,
            email: user.email,
          }));
          setAllUsers(options);
        }
      } catch (err) {
        console.error('Erro ao buscar usuários:', err);
      } finally {
        setIsLoadingUsers(false);
      }
    };

    void fetchUsers();
  }, [isOpen]);

  // Filtrar usuários já adicionados
  const availableUsers = useMemo(() => {
    return allUsers.filter(user => !existingParticipantIds.includes(user.value));
  }, [allUsers, existingParticipantIds]);

  const handleSubmit = async () => {
    if (selectedUsers.length === 0) {
      setError('Selecione pelo menos um usuário');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const userIds = selectedUsers.map(u => u.value);
      const response = await apiClient.post(`/api/quiz-participants/${quizId}`, {
        user_ids: userIds,
      });

      if (response.success) {
        setSelectedUsers([]);
        onSuccess();
        onClose();
      } else {
        setError('Erro ao adicionar participantes');
      }
    } catch (err) {
      console.error('Erro ao adicionar participantes:', err);
      setError('Erro ao adicionar participantes');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      setSelectedUsers([]);
      setError(null);
      onClose();
    }
  };

  // Custom styles para react-select (dark mode)
  const customSelectStyles: StylesConfig<UserOption, true> = {
    control: (base, state) => ({
      ...base,
      minHeight: '42px',
      backgroundColor: 'var(--select-bg, #fff)',
      borderColor: state.isFocused ? '#F97316' : '#D1D5DB',
      boxShadow: state.isFocused ? '0 0 0 1px #F97316' : 'none',
      borderRadius: '0.5rem',
      '&:hover': {
        borderColor: state.isFocused ? '#F97316' : '#9CA3AF',
      },
    }),
    menu: (base) => ({
      ...base,
      backgroundColor: 'var(--select-bg, #fff)',
      borderRadius: '0.5rem',
      boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
      zIndex: 9999,
    }),
    menuPortal: (base) => ({
      ...base,
      zIndex: 9999,
    }),
    option: (base, state) => ({
      ...base,
      backgroundColor: state.isSelected
        ? '#F97316'
        : state.isFocused
        ? '#FED7AA'
        : 'transparent',
      color: state.isSelected ? '#fff' : 'inherit',
      cursor: 'pointer',
      '&:active': {
        backgroundColor: '#FB923C',
      },
    }),
    multiValue: (base) => ({
      ...base,
      backgroundColor: '#FED7AA',
      borderRadius: '0.375rem',
    }),
    multiValueLabel: (base) => ({
      ...base,
      color: '#C2410C',
      fontWeight: 500,
    }),
    multiValueRemove: (base) => ({
      ...base,
      color: '#EA580C',
      '&:hover': {
        backgroundColor: '#FB923C',
        color: '#fff',
      },
    }),
    placeholder: (base) => ({
      ...base,
      color: '#9CA3AF',
    }),
    input: (base) => ({
      ...base,
      color: 'inherit',
    }),
    singleValue: (base) => ({
      ...base,
      color: 'inherit',
    }),
  };

  // Custom format para opções (mostrar email)
  const formatOptionLabel = (option: UserOption) => (
    <div className="flex flex-col">
      <span className="font-medium">{option.label}</span>
      {option.email && (
        <span className="text-xs text-gray-500">{option.email}</span>
      )}
    </div>
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-xl w-full max-h-[90vh] overflow-visible">
        {/* Header */}
        <div className="p-5 bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-t-2xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Users className="w-6 h-6" />
            <h2 className="text-xl font-bold">Adicionar Participantes</h2>
          </div>
          <button
            onClick={handleClose}
            disabled={isSubmitting}
            className="text-white hover:bg-white/20 rounded-full p-1 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Selecione os Participantes
            </label>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
              Você pode selecionar múltiplos usuários de uma vez
            </p>
            
            <Select<UserOption, true>
              isMulti
              options={availableUsers}
              value={selectedUsers}
              onChange={setSelectedUsers}
              placeholder={isLoadingUsers ? 'Carregando usuários...' : 'Buscar e selecionar usuários...'}
              isLoading={isLoadingUsers}
              isDisabled={isSubmitting}
              noOptionsMessage={() => 
                availableUsers.length === 0 
                  ? 'Todos os usuários já foram adicionados' 
                  : 'Nenhum usuário encontrado'
              }
              formatOptionLabel={formatOptionLabel}
              styles={customSelectStyles}
              className="react-select-container"
              classNamePrefix="react-select"
              closeMenuOnSelect={false}
              hideSelectedOptions={true}
              isClearable
              menuPortalTarget={document.body}
              menuPosition="fixed"
            />
          </div>

          {selectedUsers.length > 0 && (
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {selectedUsers.length} usuário{selectedUsers.length !== 1 ? 's' : ''} selecionado{selectedUsers.length !== 1 ? 's' : ''}:
              </p>
              <div className="flex flex-wrap gap-2">
                {selectedUsers.map(user => (
                  <span
                    key={user.value}
                    className="px-2 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-full text-xs font-medium"
                  >
                    {user.label}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Footer Buttons */}
          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={handleClose}
              disabled={isSubmitting}
              className="px-6 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting || selectedUsers.length === 0}
              className="flex items-center gap-2 px-6 py-2 text-sm font-medium text-white bg-green-500 rounded-lg hover:bg-green-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <UserPlus className="w-4 h-4" />
              {isSubmitting ? 'Adicionando...' : 'Adicionar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default QuizParticipantModal;
