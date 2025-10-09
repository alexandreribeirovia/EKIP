import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import Select from 'react-select';
import { DbRisk, DbDomain } from '../types';

interface RiskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  projectId: number;
  riskData?: DbRisk | null;
}

interface SelectOption {
  value: string;
  label: string;
}

const RiskModal = ({ isOpen, onClose, onSuccess, projectId, riskData = null }: RiskModalProps) => {
  const [type, setType] = useState<SelectOption | null>(null);
  const [priority, setPriority] = useState<SelectOption | null>(null);
  const [description, setDescription] = useState('');
  const [actionPlan, setActionPlan] = useState('');
  const [startDate, setStartDate] = useState('');
  const [forecastDate, setForecastDate] = useState('');
  const [closeDate, setCloseDate] = useState('');
  const [status, setStatus] = useState<SelectOption | null>(null);
  const [owner, setOwner] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  
  // Estados para as opções carregadas do banco
  const [riskTypeOptions, setRiskTypeOptions] = useState<SelectOption[]>([]);
  const [riskPriorityOptions, setRiskPriorityOptions] = useState<SelectOption[]>([]);
  const [riskStatusOptions, setRiskStatusOptions] = useState<SelectOption[]>([]);
  const [domains, setDomains] = useState<DbDomain[]>([]);

  // Carregar domains ao abrir o modal
  useEffect(() => {
    if (isOpen) {
      void loadDomains();
    }
  }, [isOpen]);

  const loadDomains = async () => {
    try {
      const { data, error } = await supabase
        .from('domains')
        .select('*')
        .eq('is_active', true)
        .in('type', ['risk_type', 'risk_priority', 'risk_status'])
        .order('value');

      if (error) {
        console.error('Erro ao carregar domains:', error);
        return;
      }

      setDomains(data || []);

      // Criar opções para cada tipo
      const typeOptions = (data || [])
        .filter(d => d.type === 'risk_type')
        .map(d => ({ value: d.value, label: d.value }));
      
      const priorityOptions = (data || [])
        .filter(d => d.type === 'risk_priority')
        .map(d => ({ value: d.value, label: d.value }));
      
      const statusOptions = (data || [])
        .filter(d => d.type === 'risk_status')
        .map(d => ({ value: d.value, label: d.value }));

      setRiskTypeOptions(typeOptions);
      setRiskPriorityOptions(priorityOptions);
      setRiskStatusOptions(statusOptions);
    } catch (err) {
      console.error('Erro ao carregar domains:', err);
    }
  };

  // Preencher formulário quando for edição ou quando as opções forem carregadas
  useEffect(() => {
    if (isOpen && riskTypeOptions.length > 0 && riskPriorityOptions.length > 0 && riskStatusOptions.length > 0) {
      if (riskData) {
        // Modo edição
        setType(riskTypeOptions.find(opt => opt.value === riskData.type) || null);
        setPriority(riskPriorityOptions.find(opt => opt.value === riskData.priority) || null);
        setDescription(riskData.description || '');
        setActionPlan(riskData.action_plan || '');
        setStartDate(riskData.start_date || '');
        setForecastDate(riskData.forecast_date || '');
        setCloseDate(riskData.close_date || '');
        setStatus(riskStatusOptions.find(opt => opt.value === riskData.status) || null);
        setOwner(riskData.manual_owner || '');
      } else {
        // Modo criação - define data atual como padrão para start_date
        const today = new Date().toISOString().split('T')[0];
        setStartDate(today);
        // Define primeiro status como padrão (geralmente 'Identificado')
        if (riskStatusOptions.length > 0) {
          setStatus(riskStatusOptions[0]);
        }
      }
    } else if (!isOpen) {
      // Reset form when closing
      resetForm();
    }
  }, [isOpen, riskData, riskTypeOptions, riskPriorityOptions, riskStatusOptions]);

  const resetForm = () => {
    setType(null);
    setPriority(null);
    setDescription('');
    setActionPlan('');
    setStartDate('');
    setForecastDate('');
    setCloseDate('');
    setStatus(null);
    setOwner('');
    setError('');
  };

  const getDomainId = (domainType: string, value: string): number | null => {
    const domain = domains.find(d => d.type === domainType && d.value === value);
    return domain ? domain.id : null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validações
    if (!type) {
      setError('Selecione o tipo do risco');
      return;
    }

    if (!priority) {
      setError('Selecione a prioridade do risco');
      return;
    }

    if (!description.trim()) {
      setError('Digite a descrição do risco');
      return;
    }

    if (!actionPlan.trim()) {
      setError('Digite o plano de ação');
      return;
    }

    if (!status) {
      setError('Selecione o status do risco');
      return;
    }

    setIsSubmitting(true);
    try {
      const riskPayload = {
        project_id: projectId,
        type_id: getDomainId('risk_type', type.value),
        type: type.value,
        priority_id: getDomainId('risk_priority', priority.value),
        priority: priority.value,
        description: description.trim(),
        action_plan: actionPlan.trim(),
        start_date: startDate || null,
        forecast_date: forecastDate || null,
        close_date: closeDate || null,
        status_id: getDomainId('risk_status', status.value),
        status: status.value,
        manual_owner: owner.trim() || null,
      };

      if (riskData) {
        // Atualizar risco existente
        const { error: updateError } = await supabase
          .from('risks')
          .update(riskPayload)
          .eq('id', riskData.id);

        if (updateError) {
          setError(updateError.message || 'Erro ao atualizar risco. Tente novamente.');
          return;
        }
      } else {
        // Criar novo risco
        const { error: insertError } = await supabase
          .from('risks')
          .insert(riskPayload);

        if (insertError) {
          setError(insertError.message || 'Erro ao criar risco. Tente novamente.');
          return;
        }
      }

      // Sucesso
      onSuccess();
      onClose();
      resetForm();
    } catch (err: any) {
      console.error('Erro ao salvar risco:', err);
      setError(err.message || 'Erro ao salvar risco. Tente novamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="p-5 bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-t-2xl flex items-center justify-between sticky top-0 z-10">
          <h2 className="text-xl font-bold">
            {riskData ? 'Editar Risco' : 'Novo Risco'}
          </h2>
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

          {/* Tipo, Prioridade e Responsável - Grid 3 colunas */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Tipo */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Tipo: *
              </label>
              <Select
                options={riskTypeOptions}
                value={type}
                onChange={(option) => setType(option)}
                placeholder="Selecione o tipo"
                className="react-select-container"
                classNamePrefix="react-select"
                isClearable
              />
            </div>

            {/* Prioridade */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Prioridade: *
              </label>
              <Select
                options={riskPriorityOptions}
                value={priority}
                onChange={(option) => setPriority(option)}
                placeholder="Selecione a prioridade"
                className="react-select-container"
                classNamePrefix="react-select"
                isClearable
              />
            </div>

            {/* Responsável */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Responsável:
              </label>
              <input
                type="text"
                value={owner}
                onChange={(e) => setOwner(e.target.value)}
                placeholder="Nome do responsável"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-orange-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Datas e Status - Grid 4 colunas */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Data de Início */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Data de Início:
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-orange-500 focus:border-transparent"
              />
            </div>

            {/* Data de Previsão */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Data de Previsão:
              </label>
              <input
                type="date"
                value={forecastDate}
                onChange={(e) => setForecastDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-orange-500 focus:border-transparent"
              />
            </div>

            {/* Data de Fechamento */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Data de Fechamento:
              </label>
              <input
                type="date"
                value={closeDate}
                onChange={(e) => setCloseDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-orange-500 focus:border-transparent"
              />
            </div>

            {/* Status */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Status: *
              </label>
              <Select
                options={riskStatusOptions}
                value={status}
                onChange={(option) => setStatus(option)}
                placeholder="Status"
                className="react-select-container"
                classNamePrefix="react-select"
                isClearable
              />
            </div>
          </div>

          {/* Descrição */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Descrição: *
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Descreva o risco identificado..."
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-orange-500 focus:border-transparent resize-none"
            />
          </div>

          {/* Plano de Ação */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Plano de Ação: *
            </label>
            <textarea
              value={actionPlan}
              onChange={(e) => setActionPlan(e.target.value)}
              rows={3}
              placeholder="Descreva o plano de ação para mitigar o risco..."
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-orange-500 focus:border-transparent resize-none"
            />
          </div>

          {/* Footer Buttons */}
          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-6 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancelar
            </button>
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
                riskData ? 'Atualizar Risco' : 'Adicionar Risco'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default RiskModal;
