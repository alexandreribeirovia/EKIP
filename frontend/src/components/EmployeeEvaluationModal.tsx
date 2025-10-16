import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
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
}

const EmployeeEvaluationModal = ({ isOpen, onClose, onSuccess }: EmployeeEvaluationModalProps) => {
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
  const [statusAbertoId, setStatusAbertoId] = useState<number | null>(null);

  // Buscar o ID do status "Aberto" da tabela domains
  const fetchStatusAberto = async () => {
    try {
      const { data, error } = await supabase
        .from('domains')
        .select('id')
        .eq('type', 'evaluation_status')
        .ilike('value', 'aberto')
        .single();

      if (error) {
        console.error('Erro ao buscar status Aberto:', error);
        return;
      }

      if (data) {
        setStatusAbertoId(data.id);
      }
    } catch (err) {
      console.error('Erro ao buscar status Aberto:', err);
    }
  };

  // Buscar modelos de avaliação ativos
  const fetchEvaluationModels = async () => {
    try {
      const { data, error } = await supabase
        .from('evaluations_model')
        .select('id, name')
        .eq('is_active', true)
        .order('name');

      if (error) {
        console.error('Erro ao buscar modelos de avaliação:', error);
        return;
      }

      const options: EvaluationModelOption[] = (data || []).map((model) => ({
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
      const { data, error } = await supabase
        .from('users')
        .select('user_id, name')
        .eq('is_active', true)
        .order('name');

      if (error) {
        console.error('Erro ao buscar consultores:', error);
        return;
      }

      const options: ConsultantOption[] = (data || []).map((user) => ({
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
      const { data, error } = await supabase
        .from('users')
        .select('user_id, name, position')
        .eq('is_active', true)
        .order('name');

      if (error) {
        console.error('Erro ao buscar gestores:', error);
        return;
      }

      // Filtrar gestores pela posição (deve conter "Gestor")
      const managersList = (data || []).filter((user) => {
        const position = (user.position || '').toLowerCase();
        return position.includes('gestor');
      });

      const options: ConsultantOption[] = managersList.map((user) => ({
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
      const { data, error } = await supabase
        .from('projects')
        .select('project_id, name')
        .eq('is_closed', false)
        .order('name');

      if (error) {
        console.error('Erro ao buscar projetos:', error);
        return;
      }

      const options: ProjectOption[] = (data || []).map((project) => ({
        value: project.project_id,
        label: project.name,
      }));

      setProjects(options);
    } catch (err) {
      console.error('Erro ao buscar projetos:', err);
    }
  };

  useEffect(() => {
    if (isOpen) {
      void fetchStatusAberto();
      void fetchEvaluationModels();
      void fetchConsultants();
      void fetchManagers();
      void fetchProjects();
    }
  }, [isOpen]);

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
        // 1. Criar o registro principal na tabela evaluations
        const { data: evaluationData, error: evaluationError } = await supabase
          .from('evaluations')
          .insert([{
            evaluation_model_id: selectedModel.value,
            name: `${selectedModel.label} - ${consultant.label}`,
            user_id: consultant.value,
            user_name: consultant.label,
            owner_id: selectedManager.value,
            owner_name: selectedManager.label,
            period_start: periodStart,
            period_end: periodEnd,
            status_id: statusAbertoId, // Define status padrão como "Aberto"
          }])
          .select();

        if (evaluationError) {
          console.error('Erro ao criar avaliação:', evaluationError);
          setError('Erro ao criar avaliação. Tente novamente.');
          return;
        }

        // 2. Se houver projetos selecionados, vincular na tabela evaluations_projects
        if (selectedProjects.length > 0 && evaluationData && evaluationData.length > 0) {
          const evaluationId = evaluationData[0].id;
          
          const projectLinks = selectedProjects.map((project) => ({
            evaluation_id: evaluationId,
            project_id: project.value,
          }));

          const { error: linkError } = await supabase
            .from('evaluations_projects')
            .insert(projectLinks);

          if (linkError) {
            console.error('Erro ao vincular projetos:', linkError);
            setError('Erro ao vincular projetos à avaliação. Tente novamente.');
            return;
          }
        }
      }

      // Limpa o formulário
      setSelectedModel(null);
      setSelectedConsultants([]);
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
      setSelectedConsultants([]);
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
