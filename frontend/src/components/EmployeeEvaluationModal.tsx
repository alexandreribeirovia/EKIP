import { useState, useEffect } from 'react';
import { apiClient } from '../lib/apiClient';
import Select from 'react-select';
import { X, FileCheck } from 'lucide-react';

interface ConsultantOption {
  value: string;
  label: string;
}

interface EvaluationModelOption {
  value: number;
  label: string;
}

interface ProjectOption {
  value: number;
  label: string;
}

interface EmployeeEvaluationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  preSelectedUser?: { user_id: string; name: string; } | null;
}

const EmployeeEvaluationModal = ({ isOpen, onClose, onSuccess, preSelectedUser }: EmployeeEvaluationModalProps) => {
  const [evaluationModels, setEvaluationModels] = useState<EvaluationModelOption[]>([]);
  const [consultants, setConsultants] = useState<ConsultantOption[]>([]);
  const [managers, setManagers] = useState<ConsultantOption[]>([]);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  
  const [selectedModel, setSelectedModel] = useState<EvaluationModelOption | null>(null);
  const [selectedConsultants, setSelectedConsultants] = useState<ConsultantOption[]>([]);
  const [selectedManager, setSelectedManager] = useState<ConsultantOption | null>(null);
  const [selectedProjects, setSelectedProjects] = useState<ProjectOption[]>([]);
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Buscar modelos de avaliação ativos
  const fetchEvaluationModels = async () => {
    try {
      const response = await apiClient.get<Array<{ id: number; name: string }>>(
        '/api/lookups/evaluation-models/active'
      );

      if (!response.success || !response.data) {
        console.error('Erro ao buscar modelos de avaliação:', response.error);
        return;
      }

      const options: EvaluationModelOption[] = response.data.map((model) => ({
        value: model.id,
        label: model.name,
      }));

      setEvaluationModels(options);
    } catch (err) {
      console.error('Erro ao buscar modelos de avaliação:', err);
    }
  };

  // Buscar consultores (todos usuários ativos)
  const fetchConsultants = async () => {
    try {
      const response = await apiClient.get<Array<{ user_id: string; name: string }>>(
        '/api/lookups/users'
      );

      if (!response.success || !response.data) {
        console.error('Erro ao buscar consultores:', response.error);
        return;
      }

      const options: ConsultantOption[] = response.data.map((user) => ({
        value: user.user_id,
        label: user.name,
      }));

      setConsultants(options);
    } catch (err) {
      console.error('Erro ao buscar consultores:', err);
    }
  };

  // Buscar gestores (usuários com posição contendo "Gestor")
  const fetchManagers = async () => {
    try {
      const response = await apiClient.get<Array<{ user_id: string; name: string }>>(
        '/api/lookups/managers'
      );

      if (!response.success || !response.data) {
        console.error('Erro ao buscar gestores:', response.error);
        return;
      }

      const options: ConsultantOption[] = response.data.map((user) => ({
        value: user.user_id,
        label: user.name,
      }));

      setManagers(options);
    } catch (err) {
      console.error('Erro ao buscar gestores:', err);
    }
  };

  // Buscar projetos ativos
  const fetchProjects = async () => {
    try {
      const response = await apiClient.get<Array<{ project_id: string; name: string }>>(
        '/api/lookups/projects/active'
      );

      if (!response.success || !response.data) {
        console.error('Erro ao buscar projetos:', response.error);
        return;
      }

      const options: ProjectOption[] = response.data.map((project) => ({
        value: parseInt(project.project_id) || 0,
        label: project.name,
      }));

      setProjects(options);
    } catch (err) {
      console.error('Erro ao buscar projetos:', err);
    }
  };

  useEffect(() => {
    if (isOpen) {
      void fetchEvaluationModels();
      void fetchConsultants();
      void fetchManagers();
      void fetchProjects();
      
      // Pre-select user if provided
      if (preSelectedUser) {
        setSelectedConsultants([{ value: preSelectedUser.user_id, label: preSelectedUser.name }]);
      }
    }
  }, [isOpen, preSelectedUser]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validações
    if (!selectedModel) {
      setError('Por favor, selecione um modelo de avaliação.');
      return;
    }

    if (selectedConsultants.length === 0) {
      setError('Por favor, selecione pelo menos um avaliado.');
      return;
    }

    if (!selectedManager) {
      setError('Por favor, selecione um avaliador.');
      return;
    }

    if (!periodStart || !periodEnd) {
      setError('Por favor, preencha o período (início e fim).');
      return;
    }

    if (new Date(periodStart) > new Date(periodEnd)) {
      setError('A data de início deve ser anterior à data de fim.');
      return;
    }

    setIsSubmitting(true);

    try {
      // Criar uma avaliação para cada consultor selecionado
      for (const consultant of selectedConsultants) {
        // Criar avaliação via API (backend cria e vincula projetos atomicamente)
        const result = await apiClient.post<{ id: number }>(
          '/api/employee-evaluations',
          {
            evaluation_model_id: selectedModel.value,
            user_id: consultant.value,
            user_name: consultant.label,
            owner_id: selectedManager.value,
            owner_name: selectedManager.label,
            period_start: periodStart,
            period_end: periodEnd,
            project_ids: selectedProjects.map((p) => p.value.toString()),
          }
        );

        if (!result.success) {
          console.error('Erro ao criar avaliação:', result.error);
          setError(result.error?.message || 'Erro ao criar avaliação. Tente novamente.');
          return;
        }
      }

      // Limpa o formulário
      setSelectedModel(null);
      // Reset to preselected user if provided, otherwise clear all
      if (preSelectedUser) {
        setSelectedConsultants([{ value: preSelectedUser.user_id, label: preSelectedUser.name }]);
      } else {
        setSelectedConsultants([]);
      }
      setSelectedManager(null);
      setSelectedProjects([]);
      setPeriodStart('');
      setPeriodEnd('');
      
      // Chama callback de sucesso e fecha modal
      onSuccess();
      onClose();
    } catch (err) {
      console.error('Erro ao criar avaliações:', err);
      setError('Erro ao criar avaliações. Tente novamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      setSelectedModel(null);
      // Only clear consultants if no preselection
      if (!preSelectedUser) {
        setSelectedConsultants([]);
      }
      setSelectedManager(null);
      setSelectedProjects([]);
      setPeriodStart('');
      setPeriodEnd('');
      setError('');
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="p-5 bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-t-2xl flex items-center justify-between sticky top-0 z-10">
          <h2 className="text-xl font-bold">
            Nova Avaliação
          </h2>
          <button
            onClick={handleClose}
            disabled={isSubmitting}
            className="text-white hover:bg-white/20 rounded-full p-1 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Error display */}
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          {/* Modelo de Avaliação */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Modelo de Avaliação: *
            </label>
            <Select
              value={selectedModel}
              onChange={(selected) => setSelectedModel(selected)}
              options={evaluationModels}
              placeholder="Selecione o modelo"
              className="react-select-container"
              classNamePrefix="react-select"
              isDisabled={isSubmitting}
              menuPlacement="auto"
              menuPosition="fixed"
              styles={{
                menuPortal: (base) => ({ ...base, zIndex: 9999 }),
                menu: (base) => ({ ...base, zIndex: 9999 })
              }}
              menuPortalTarget={document.body}
            />
          </div>

          {/* Período */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Período Início: *
              </label>
              <input
                type="date"
                value={periodStart}
                onChange={(e) => setPeriodStart(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-orange-500 focus:border-transparent"
                disabled={isSubmitting}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Período Fim: *
              </label>
              <input
                type="date"
                value={periodEnd}
                onChange={(e) => setPeriodEnd(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-orange-500 focus:border-transparent"
                disabled={isSubmitting}
              />
            </div>
          </div>

          {/* Avaliado(s) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Avaliado(s): *
            </label>
            <Select
              isMulti
              value={selectedConsultants}
              onChange={(selected) => setSelectedConsultants(selected as ConsultantOption[])}
              options={consultants}
              placeholder="Selecione os avaliados"
              className="react-select-container"
              classNamePrefix="react-select"
              isDisabled={isSubmitting}
              menuPlacement="auto"
              menuPosition="fixed"
              styles={{
                menuPortal: (base) => ({ ...base, zIndex: 9999 }),
                menu: (base) => ({ ...base, zIndex: 9999 })
              }}
              menuPortalTarget={document.body}
            />
          </div>

          {/* Avaliador */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Avaliador (Gestor): *
            </label>
            <Select
              value={selectedManager}
              onChange={(selected) => setSelectedManager(selected)}
              options={managers}
              placeholder="Selecione o avaliador"
              className="react-select-container"
              classNamePrefix="react-select"
              isDisabled={isSubmitting}
              menuPlacement="auto"
              menuPosition="fixed"
              styles={{
                menuPortal: (base) => ({ ...base, zIndex: 9999 }),
                menu: (base) => ({ ...base, zIndex: 9999 })
              }}
              menuPortalTarget={document.body}
            />
          </div>

          {/* Projeto(s) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Projeto(s): (Opcional)
            </label>
            <Select
              isMulti
              value={selectedProjects}
              onChange={(selected) => setSelectedProjects(selected as ProjectOption[])}
              options={projects}
              placeholder="Selecione os projetos (opcional)"
              className="react-select-container"
              classNamePrefix="react-select"
              isDisabled={isSubmitting}
              menuPlacement="auto"
              menuPosition="fixed"
              styles={{
                menuPortal: (base) => ({ ...base, zIndex: 9999 }),
                menu: (base) => ({ ...base, zIndex: 9999 })
              }}
              menuPortalTarget={document.body}
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Se nenhum projeto foi selecionado, será criada uma avaliação geral
            </p>
          </div>

          {/* Footer Buttons */}
          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={handleClose}
              disabled={isSubmitting}
              className="px-6 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2 text-sm font-medium text-white bg-green-500 rounded-lg hover:bg-green-600 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <FileCheck className="w-4 h-4" />
              {isSubmitting ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EmployeeEvaluationModal;
