import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import Select from 'react-select';
import { X, Plus, Trash2, Target, TrendingUp, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';

// Log para verificar se o módulo está sendo carregado
console.log('🔥 PDIModal.tsx - MÓDULO CARREGADO');

// Configuração do editor WYSIWYG
const quillModules = {
  toolbar: [
    [{ 'header': [1, 2, 3, false] }],
    ['bold', 'italic', 'underline', 'strike'],
    [{ 'list': 'ordered'}, { 'list': 'bullet' }],
    [{ 'indent': '-1'}, { 'indent': '+1' }],
    ['link'],
    ['clean']
  ],
};

const quillFormats = [
  'header',
  'bold', 'italic', 'underline', 'strike',
  'list', 'bullet', 'indent',
  'link'
];

interface PDIModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  pdiId?: number | null;
  onError?: (message: string) => void;
  onSuccessMessage?: (message: string) => void;
  evaluationId?: number | null;
  feedbackId?: number | null;
  prefilledConsultant?: { value: string; label: string } | null;
  prefilledManager?: { value: string; label: string } | null;
}

interface UserOption {
  value: string;
  label: string;
}

interface CompetencyOption {
  value: number;
  label: string;
}

interface CompetencyItem {
  id: string;
  competency_id: number | null;
  competency_name: string;
  level_current: number;
  level_target: number;
  goal_description: string;
  actions: string;
  due_date: string;
  progress: number;
  isExpanded: boolean;
}

const PDIModal = ({ 
  isOpen, 
  onClose, 
  onSuccess, 
  pdiId, 
  onError, 
  onSuccessMessage,
  evaluationId,
  feedbackId,
  prefilledConsultant,
  prefilledManager
}: PDIModalProps) => {
  const [consultants, setConsultants] = useState<UserOption[]>([]);
  const [managers, setManagers] = useState<UserOption[]>([]);
  const [competencies, setCompetencies] = useState<CompetencyOption[]>([]);
  const [statusOptions, setStatusOptions] = useState<{ value: number; label: string }[]>([]);
  
  const [selectedConsultant, setSelectedConsultant] = useState<UserOption | null>(null);
  const [selectedManager, setSelectedManager] = useState<UserOption | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<{ value: number; label: string } | null>(null);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [comments, setComments] = useState('');
  
  const [competencyItems, setCompetencyItems] = useState<CompetencyItem[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [internalPdiId, setInternalPdiId] = useState<number | null>(null);
  
  // Estados para armazenar IDs de vinculação carregados do banco
  const [loadedEvaluationId, setLoadedEvaluationId] = useState<number | null>(null);
  const [loadedFeedbackId, setLoadedFeedbackId] = useState<number | null>(null);

  // Log inicial - executa sempre que o componente é renderizado
  useEffect(() => {
    console.log('📥 PDIModal - Componente renderizado/atualizado com props:', {
      isOpen,
      pdiId,
      evaluationId,
      feedbackId,
      prefilledConsultant,
      prefilledManager
    });
  });

  const showErrorNotification = useCallback((message: string) => {
    if (onError) {
      onError(message);
    }
  }, [onError]);

  const showSuccessNotification = useCallback((message: string) => {
    if (onSuccessMessage) {
      onSuccessMessage(message);
    }
  }, [onSuccessMessage]);

  const fetchConsultants = async () => {
    console.log('🔍 Buscando consultores...');
    try {
      const { data, error } = await supabase
        .from('users')
        .select('user_id, name')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;

      const options: UserOption[] = (data || []).map((user) => ({
        value: user.user_id,
        label: user.name,
      }));

      console.log('✅ Consultores carregados:', options.length, 'consultores');
      setConsultants(options);
    } catch (err) {
      console.error('❌ Erro ao buscar consultores:', err);
    }
  };

  const fetchManagers = async () => {
    console.log('🔍 Buscando gestores...');
    try {
      const { data, error } = await supabase
        .from('users')
        .select('user_id, name, position')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;

      const managersList = (data || []).filter((user) => {
        const position = (user.position || '').toLowerCase();
        return position.includes('gestor');
      });

      const options: UserOption[] = managersList.map((user) => ({
        value: user.user_id,
        label: user.name,
      }));

      console.log('✅ Gestores carregados:', options.length, 'gestores');
      setManagers(options);
    } catch (err) {
      console.error('❌ Erro ao buscar gestores:', err);
    }
  };

  const fetchCompetencies = async () => {
    try {
      const { data, error } = await supabase
        .from('domains')
        .select('id, value')
        .eq('type', 'pdi_competencies')
        .eq('is_active', true)
        .order('value');

      if (error) throw error;

      const options: CompetencyOption[] = (data || []).map((comp) => ({
        value: comp.id,
        label: comp.value,
      }));

      setCompetencies(options);
    } catch (err) {
      console.error('Erro ao buscar competências:', err);
    }
  };

  const fetchStatus = async () => {
    try {
      const { data, error } = await supabase
        .from('domains')
        .select('id, value')
        .eq('type', 'pdi_status')
        .eq('is_active', true)
        .order('value');

      if (error) throw error;

      const options = (data || []).map((status) => ({
        value: status.id,
        label: status.value,
      }));

      setStatusOptions(options);
      
      // Define "Não iniciado" como padrão apenas se não estiver editando
      if (!pdiId) {
        const naoIniciado = options.find((opt) => opt.label.toLowerCase().includes('não iniciado'));
        if (naoIniciado) {
          setSelectedStatus(naoIniciado);
        } else if (options.length > 0) {
          setSelectedStatus(options[0]);
        }
      }
    } catch (err) {
      console.error('Erro ao buscar status:', err);
    }
  };

  const fetchPDIData = async (id: number) => {
    setInternalPdiId(id);
    setIsLoading(true);
    try {
      // Buscar dados do PDI
      const { data: pdiData, error: pdiError } = await supabase
        .from('pdi')
        .select('*')
        .eq('id', id)
        .single();

      if (pdiError) throw pdiError;

      // Buscar itens do PDI
      const { data: itemsData, error: itemsError } = await supabase
        .from('pdi_items')
        .select('*')
        .eq('pdi_id', id)
        .order('created_at');

      if (itemsError) throw itemsError;

      // Preencher os dados do PDI
      setSelectedConsultant({
        value: pdiData.user_id,
        label: pdiData.user_name,
      });

      setSelectedManager({
        value: pdiData.owner_id,
        label: pdiData.owner_name,
      });

      setSelectedStatus({
        value: pdiData.status_id,
        label: pdiData.status,
      });

      setStartDate(pdiData.start_date || '');
      setEndDate(pdiData.end_date || '');
      setComments(pdiData.comments || '');
      
      // Armazenar IDs de vinculação (evaluation_id e feedback_id)
      setLoadedEvaluationId(pdiData.evaluation_id || null);
      setLoadedFeedbackId(pdiData.feedback_id || null);

      // Preencher os itens de competência
      if (itemsData && itemsData.length > 0) {
        const items: CompetencyItem[] = itemsData.map((item) => {
          // Buscar o nome da competência
          const comp = competencies.find((c) => c.value === item.competency_id);
          
          return {
            id: item.id.toString(),
            competency_id: item.competency_id,
            competency_name: comp?.label || '',
            level_current: item.level_current || 1,
            level_target: item.level_target || 5,
            goal_description: item.goal_description || '',
            actions: item.actions || '',
            due_date: item.due_date || '',
            progress: Number(item.progress) || 0,
            isExpanded: false, // Todos os collapses fechados por padrão
          };
        });
        setCompetencyItems(items);
      }
    } catch (err) {
      console.error('Erro ao buscar dados do PDI:', err);
      showErrorNotification('Erro ao carregar dados do PDI. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
  };

  // Função para buscar PDI por evaluation_id
  const fetchPDIByEvaluationId = async (evalId: number) => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('pdi')
        .select('id')
        .eq('evaluation_id', evalId)
        .maybeSingle();

      if (error) throw error;
      
      if (data) {
        // Se encontrou um PDI vinculado, carregar seus dados do banco
        await fetchPDIData(data.id);
      } else {
        // Se não encontrou PDI vinculado - campos já foram pré-preenchidos
        setInternalPdiId(null);
        setIsLoading(false);
      }
    } catch (err) {
      console.error('Erro ao buscar PDI por evaluation_id:', err);
      setInternalPdiId(null);
      setIsLoading(false);
      // Campos já foram pré-preenchidos pelo useEffect
    }
  };

  // Função para buscar PDI por feedback_id
  const fetchPDIByFeedbackId = async (fbId: number) => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('pdi')
        .select('id')
        .eq('feedback_id', fbId)
        .maybeSingle();

      if (error) throw error;
      
      if (data) {
        // Se encontrou um PDI vinculado, carregar seus dados do banco
        await fetchPDIData(data.id);
      } else {
        // Se não encontrou PDI vinculado - campos já foram pré-preenchidos
        setInternalPdiId(null);
        setIsLoading(false);
      }
    } catch (err) {
      console.error('Erro ao buscar PDI por feedback_id:', err);
      setInternalPdiId(null);
      setIsLoading(false);
      // Campos já foram pré-preenchidos pelo useEffect
    }
  };

  useEffect(() => {
    console.log('🔄 useEffect Principal executado:', {
      isOpen,
      evaluationId,
      feedbackId,
      prefilledConsultant,
      prefilledManager,
      pdiId
    });

    if (isOpen) {
      console.log('✅ Modal aberto - carregando listas...');
      void fetchConsultants();
      void fetchManagers();
      void fetchCompetencies();
      void fetchStatus();
    } else {
      console.log('❌ Modal fechado - limpando campos...');
      // Limpar campos quando fecha
      setSelectedConsultant(null);
      setSelectedManager(null);
      setSelectedStatus(null);
      setStartDate('');
      setEndDate('');
      setComments('');
      setCompetencyItems([]);
      setCompetencies([]);
      setInternalPdiId(null);
      setLoadedEvaluationId(null);
      setLoadedFeedbackId(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // Effect separado para pré-preencher quando vem de avaliação ou feedback
  // IMPORTANTE: Só preenche DEPOIS que as listas foram carregadas
  useEffect(() => {
    console.log('🎯 useEffect Preenchimento executado:', {
      isOpen,
      evaluationId,
      feedbackId,
      prefilledConsultant,
      prefilledManager,
      pdiId,
      consultantsLength: consultants.length,
      managersLength: managers.length
    });

    if (isOpen && (evaluationId || feedbackId) && prefilledConsultant && prefilledManager && !pdiId) {
      console.log('✅ Condições satisfeitas para preenchimento automático');
      
      // Verificar se as listas foram carregadas
      if (consultants.length > 0 && managers.length > 0) {
        console.log('🔄 Preenchendo campos automaticamente:', {
          consultor: prefilledConsultant,
          responsavel: prefilledManager,
          origem: feedbackId ? 'feedback' : 'avaliacao'
        });
        setSelectedConsultant(prefilledConsultant);
        setSelectedManager(prefilledManager);
      } else {
        console.log('⏳ Aguardando listas serem carregadas...', {
          consultantsCarregados: consultants.length > 0,
          managersCarregados: managers.length > 0
        });
      }
    } else {
      console.log('❌ Condições NÃO satisfeitas:', {
        isOpen,
        temEvaluationOuFeedback: !!(evaluationId || feedbackId),
        temPrefilledConsultant: !!prefilledConsultant,
        temPrefilledManager: !!prefilledManager,
        naoPdiId: !pdiId
      });
    }
  }, [isOpen, evaluationId, feedbackId, prefilledConsultant, prefilledManager, pdiId, consultants, managers]);

  useEffect(() => {
    if (isOpen && pdiId && competencies.length > 0) {
      void fetchPDIData(pdiId);
    } else if (isOpen && evaluationId && competencies.length > 0 && !pdiId) {
      void fetchPDIByEvaluationId(evaluationId);
    } else if (isOpen && feedbackId && competencies.length > 0 && !pdiId) {
      void fetchPDIByFeedbackId(feedbackId);
    }
  }, [isOpen, pdiId, evaluationId, feedbackId, competencies]);

  const handleAddCompetency = () => {
    const newItem: CompetencyItem = {
      id: Date.now().toString(),
      competency_id: null,
      competency_name: '',
      level_current: 1,
      level_target: 5,
      goal_description: '',
      actions: '',
      due_date: '',
      progress: 0,
      isExpanded: true,
    };
    setCompetencyItems([...competencyItems, newItem]);
  };

  const handleRemoveCompetency = (id: string) => {
    setCompetencyItems(competencyItems.filter((item) => item.id !== id));
  };

  const handleToggleCompetency = (id: string) => {
    setCompetencyItems(
      competencyItems.map((item) =>
        item.id === id ? { ...item, isExpanded: !item.isExpanded } : item
      )
    );
  };

  const handleUpdateCompetency = (id: string, field: keyof CompetencyItem, value: any) => {
    setCompetencyItems(
      competencyItems.map((item) => {
        if (item.id === id) {
          if (field === 'competency_id') {
            const comp = competencies.find((c) => c.value === value);
            return {
              ...item,
              competency_id: value,
              competency_name: comp?.label || '',
            };
          }
          return { ...item, [field]: value };
        }
        return item;
      })
    );
  };

  // Helper function para verificar se o conteúdo HTML está vazio
  const isHtmlEmpty = (html: string): boolean => {
    if (!html) return true;
    // Remove tags HTML e verifica se sobra algum texto
    const text = html.replace(/<[^>]*>/g, '').trim();
    return text.length === 0;
  };

  const validateForm = (): boolean => {
    if (!selectedConsultant) {
      showErrorNotification('Por favor, selecione um consultor.');
      return false;
    }
    if (!selectedManager) {
      showErrorNotification('Por favor, selecione um responsável.');
      return false;
    }
    if (!selectedStatus) {
      showErrorNotification('Por favor, selecione um status.');
      return false;
    }
  
    if (competencyItems.length === 0) {
      showErrorNotification('Adicione pelo menos uma competência ao PDI.');
      return false;
    }
    
    // Verificar competências duplicadas
    const competencyIds = competencyItems
      .map(item => item.competency_id)
      .filter(id => id !== null);
    const uniqueIds = new Set(competencyIds);
    if (competencyIds.length !== uniqueIds.size) {
      showErrorNotification('Não é permitido adicionar a mesma competência mais de uma vez no PDI.');
      return false;
    }
    
    for (const item of competencyItems) {
      if (!item.competency_id) {
        showErrorNotification('Por favor, selecione a competência em todos os itens.');
        return false;
      }
      if (isHtmlEmpty(item.goal_description)) {
        showErrorNotification('Por favor, preencha o objetivo em todas as competências.');
        return false;
      }
      if (isHtmlEmpty(item.actions)) {
        showErrorNotification('Por favor, preencha as ações em todas as competências.');
        return false;
      }
      if (!item.due_date) {
        showErrorNotification('Por favor, preencha o prazo em todas as competências.');
        return false;
      }
    }
    
    return true;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    setIsSubmitting(true);

    try {
      if (internalPdiId) {
        // Modo de edição - atualizar PDI existente
        const { error: pdiError } = await supabase
          .from('pdi')
          .update({
            user_id: selectedConsultant!.value,
            user_name: selectedConsultant!.label,
            owner_id: selectedManager!.value,
            owner_name: selectedManager!.label,
            status_id: selectedStatus!.value,
            status: selectedStatus!.label,
            name: `PDI - ${selectedConsultant!.label}`,
            start_date: startDate || null,
            end_date: endDate || null,
            comments: comments || null,
            evaluation_id: evaluationId || null,
            feedback_id: feedbackId || null,
          })
          .eq('id', internalPdiId);

        if (pdiError) throw pdiError;

        // Deletar todos os itens antigos
        const { error: deleteError } = await supabase
          .from('pdi_items')
          .delete()
          .eq('pdi_id', internalPdiId);

        if (deleteError) throw deleteError;

        // Inserir os novos itens
        const itemsToInsert = competencyItems.map((item) => ({
          pdi_id: internalPdiId,
          competency_id: item.competency_id,
          level_current: null,
          level_target: null,
          goal_description: item.goal_description,
          actions: item.actions,
          due_date: item.due_date,
          progress: item.progress,
        }));

        const { error: itemsError } = await supabase
          .from('pdi_items')
          .insert(itemsToInsert);

        if (itemsError) throw itemsError;

        // Atualizar is_pdi nas tabelas vinculadas (feedback ou avaliação)
        if (feedbackId) {
          const { error: updateFeedbackError } = await supabase
            .from('feedbacks')
            .update({ is_pdi: true })
            .eq('id', feedbackId);
          
          if (updateFeedbackError) {
            console.error('Erro ao atualizar is_pdi no feedback:', updateFeedbackError);
          } else {
            console.log('✅ Campo is_pdi atualizado no feedback', feedbackId);
          }
        }
        
        if (evaluationId) {
          const { error: updateEvaluationError } = await supabase
            .from('evaluations')
            .update({ is_pdi: true })
            .eq('id', evaluationId);
          
          if (updateEvaluationError) {
            console.error('Erro ao atualizar is_pdi na avaliação:', updateEvaluationError);
          } else {
            console.log('✅ Campo is_pdi atualizado na avaliação', evaluationId);
          }
        }

        showSuccessNotification('PDI atualizado com sucesso!');
      } else {
        // Modo de criação - inserir novo PDI
        const { data: pdiData, error: pdiError } = await supabase
          .from('pdi')
          .insert({
            user_id: selectedConsultant!.value,
            user_name: selectedConsultant!.label,
            owner_id: selectedManager!.value,
            owner_name: selectedManager!.label,
            status_id: selectedStatus!.value,
            status: selectedStatus!.label,
            name: `PDI - ${selectedConsultant!.label}`,
            start_date: startDate || null,
            end_date: endDate || null,
            comments: comments || null,
            evaluation_id: evaluationId || null,
            feedback_id: feedbackId || null,
          })
          .select()
          .single();

        if (pdiError) throw pdiError;

        const itemsToInsert = competencyItems.map((item) => ({
          pdi_id: pdiData.id,
          competency_id: item.competency_id,
          level_current: null,
          level_target: null,
          goal_description: item.goal_description,
          actions: item.actions,
          due_date: item.due_date,
          progress: item.progress,
        }));

        const { error: itemsError } = await supabase
          .from('pdi_items')
          .insert(itemsToInsert);

        if (itemsError) throw itemsError;

        // Atualizar is_pdi nas tabelas vinculadas (feedback ou avaliação)
        if (feedbackId) {
          const { error: updateFeedbackError } = await supabase
            .from('feedbacks')
            .update({ is_pdi: true })
            .eq('id', feedbackId);
          
          if (updateFeedbackError) {
            console.error('Erro ao atualizar is_pdi no feedback:', updateFeedbackError);
          } else {
            console.log('✅ Campo is_pdi atualizado no feedback', feedbackId);
          }
        }
        
        if (evaluationId) {
          const { error: updateEvaluationError } = await supabase
            .from('evaluations')
            .update({ is_pdi: true })
            .eq('id', evaluationId);
          
          if (updateEvaluationError) {
            console.error('Erro ao atualizar is_pdi na avaliação:', updateEvaluationError);
          } else {
            console.log('✅ Campo is_pdi atualizado na avaliação', evaluationId);
          }
        }

        showSuccessNotification('PDI criado com sucesso!');
      }
      
      handleClose();
      onSuccess();
    } catch (err) {
      console.error('Erro ao salvar PDI:', err);
      showErrorNotification(`Erro ao ${internalPdiId ? 'atualizar' : 'criar'} PDI. Tente novamente.`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setSelectedConsultant(null);
    setSelectedManager(null);
    setSelectedStatus(null);
    setStartDate('');
    setEndDate('');
    setComments('');
    setCompetencyItems([]);
    onClose();
  };

  console.log('🚪 PDIModal - Verificando isOpen:', isOpen);
  
  if (!isOpen) {
    console.log('❌ PDIModal - isOpen é false, não renderizando');
    return null;
  }

  console.log('✅ PDIModal - isOpen é true, renderizando modal');

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl max-w-5xl w-full my-8 max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-5 bg-gradient-to-r from-orange-500 to-orange-600 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Target className="w-6 h-6" />
            <h2 className="text-xl font-bold">
              {internalPdiId ? 'Editar PDI' : 'Novo PDI'} - Plano de Desenvolvimento Individual
            </h2>
          </div>
          <button onClick={handleClose} className="text-white hover:bg-white/20 rounded-lg p-1 transition-colors" disabled={isLoading}>
            <X className="w-6 h-6" />
          </button>
        </div>

        {isLoading ? (
          <div className="flex-1 flex items-center justify-center p-12">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-4 border-orange-500 border-t-transparent mx-auto mb-4" />
              <p className="text-gray-600 dark:text-gray-400">Carregando dados do PDI...</p>
            </div>
          </div>
        ) : (
        <div className="flex-1 overflow-y-auto p-6 pt-3">
          <div className="mb-3">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Consultor <span className="text-red-500">*</span>
                </label>
                <Select value={selectedConsultant} onChange={setSelectedConsultant} options={consultants} placeholder="Selecione o consultor" className="react-select-container" classNamePrefix="react-select" isClearable />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Responsável <span className="text-red-500">*</span>
                </label>
                <Select value={selectedManager} onChange={setSelectedManager} options={managers} placeholder="Selecione o responsável" className="react-select-container" classNamePrefix="react-select" isClearable />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Status <span className="text-red-500">*</span>
                </label>
                <Select value={selectedStatus} onChange={setSelectedStatus} options={statusOptions} placeholder="Selecione o status" className="react-select-container" classNamePrefix="react-select" />
              </div>
            </div>

            

            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Comentários / Observações</label>
              <textarea value={comments} onChange={(e) => setComments(e.target.value)} rows={2} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none" placeholder="Adicione observações gerais sobre este PDI..." />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center">
               
                Competências a Desenvolver
              </h3>
              <button onClick={handleAddCompetency} className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20 rounded-lg hover:bg-orange-100 dark:hover:bg-orange-900/30 transition-colors">
                <Plus className="w-4 h-4" />
                Adicionar Competência
              </button>
            </div>

            <div className="space-y-4">
              {competencyItems.length === 0 ? (
                <div className="text-center py-12 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg">
                  <TrendingUp className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                  <p className="text-gray-500 dark:text-gray-400 mb-4">Nenhuma competência adicionada ainda</p>
                  <button onClick={handleAddCompetency} className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-orange-500 rounded-lg hover:bg-orange-600 transition-colors">
                    <Plus className="w-4 h-4" />
                    Adicionar Primeira Competência
                  </button>
                </div>
              ) : (
                competencyItems.map((item, index) => (
                  <div key={item.id} className="border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800/50 relative">
                    <div className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors" onClick={() => handleToggleCompetency(item.id)}>
                      <h4 className="font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                        <span className="w-6 h-6 bg-orange-500 text-white rounded-full flex items-center justify-center text-xs">{index + 1}</span>
                        {item.competency_name || `Competência ${index + 1}`}
                      </h4>
                      <div className="flex items-center gap-2">
                        <button onClick={(e) => { e.stopPropagation(); handleRemoveCompetency(item.id); }} className="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors" title="Remover competência">
                          <Trash2 className="w-4 h-4" />
                        </button>
                        {item.isExpanded ? (
                          <ChevronUp className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                        ) : (
                          <ChevronDown className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                        )}
                      </div>
                    </div>

                    {item.isExpanded && (
                    <div className="px-4 pb-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Competência <span className="text-red-500">*</span>
                        </label>
                        <Select 
                          value={item.competency_id ? competencies.find((c) => c.value === item.competency_id) : null} 
                          onChange={(selected) => handleUpdateCompetency(item.id, 'competency_id', selected?.value || null)} 
                          options={competencies.filter((comp) => {
                            // Mostrar a competência atual (se já selecionada) ou competências ainda não selecionadas
                            const selectedIds = competencyItems
                              .filter(ci => ci.id !== item.id) // Excluir o item atual
                              .map(ci => ci.competency_id)
                              .filter(id => id !== null);
                            return !selectedIds.includes(comp.value);
                          })} 
                          placeholder="Selecione a competência" 
                          className="react-select-container" 
                          classNamePrefix="react-select" 
                          isClearable 
                        />
                      </div>

                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Objetivo <span className="text-red-500">*</span>
                        </label>
                        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-300 dark:border-gray-600">
                          <ReactQuill
                            theme="snow"
                            value={item.goal_description}
                            onChange={(value) => handleUpdateCompetency(item.id, 'goal_description', value)}
                            modules={quillModules}
                            formats={quillFormats}
                            placeholder="Descreva o objetivo de desenvolvimento para esta competência..."
                            className="quill-editor"
                          />
                        </div>
                      </div>

                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Ações / Plano de Ação <span className="text-red-500">*</span>
                        </label>
                        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-300 dark:border-gray-600">
                          <ReactQuill
                            theme="snow"
                            value={item.actions}
                            onChange={(value) => handleUpdateCompetency(item.id, 'actions', value)}
                            modules={quillModules}
                            formats={quillFormats}
                            placeholder="Liste as ações específicas que serão realizadas..."
                            className="quill-editor"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Prazo <span className="text-red-500">*</span>
                        </label>
                        <input type="date" value={item.due_date} onChange={(e) => handleUpdateCompetency(item.id, 'due_date', e.target.value)} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-orange-500" />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">% Progresso</label>
                        <div className="flex items-center gap-2">
                          <input type="range" min="0" max="100" step="5" value={item.progress} onChange={(e) => handleUpdateCompetency(item.id, 'progress', parseInt(e.target.value))} className="flex-1" />
                          <span className="text-sm font-semibold text-gray-700 dark:text-gray-300 min-w-[3rem]">{item.progress}%</span>
                        </div>
                      </div>
                    </div>
                    </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
        )}

        <div className="p-4 bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 flex justify-between items-center gap-3">
          <div className="flex items-center gap-2">
            {(evaluationId || loadedEvaluationId) && (
              <a
                href={`/employee-evaluations/${evaluationId || loadedEvaluationId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium transition-colors"
              >
                <ExternalLink className="w-4 h-4" />
                PDI vinculado a Avaliação
              </a>
            )}
            {(feedbackId || loadedFeedbackId) && (
              <a
                href={`/feedbacks`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium transition-colors"
              >
                <ExternalLink className="w-4 h-4" />
                PDI vinculado a Feedback
              </a>
            )}
          </div>
          <div className="flex gap-3">
            <button onClick={handleClose} disabled={isSubmitting || isLoading} className="px-6 py-2 text-sm text-gray-600 dark:text-gray-400 font-semibold bg-gray-200 dark:bg-gray-700 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
              Cancelar
            </button>
            <button onClick={handleSubmit} disabled={isSubmitting || isLoading} className="px-6 py-2 text-sm text-white font-semibold bg-orange-500 rounded-lg hover:bg-orange-600 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
              {isSubmitting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                  {internalPdiId ? 'Atualizando...' : 'Criando...'}
                </>
              ) : (
                <>
                  <Target className="w-4 h-4" />
                  {internalPdiId ? 'Atualizar PDI' : 'Criar PDI'}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PDIModal;
