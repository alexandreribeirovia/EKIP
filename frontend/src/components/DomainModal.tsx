import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import Select from 'react-select';
import { DbDomain } from '../types';

interface DomainModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  domainData?: DbDomain | null;
}

interface SelectOption {
  value: number;
  label: string;
}

const DomainModal = ({ isOpen, onClose, onSuccess, domainData = null }: DomainModalProps) => {
  const [type, setType] = useState('');
  const [value, setValue] = useState('');
  const [tag, setTag] = useState('');
  const [description, setDescription] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [parentId, setParentId] = useState<SelectOption | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [tagManuallyEdited, setTagManuallyEdited] = useState(false);
  
  // Estados para as opções de domínios pais
  const [parentDomainOptions, setParentDomainOptions] = useState<SelectOption[]>([]);

  // Carregar domínios pais ao abrir o modal
  useEffect(() => {
    if (isOpen) {
      void loadParentDomains();
    }
  }, [isOpen]);

  const loadParentDomains = async () => {
    try {
      const { data, error } = await supabase
        .from('domains')
        .select('id, type, value')
        .eq('is_active', true)
        .order('type')
        .order('value');

      if (error) {
        console.error('Erro ao carregar domínios pais:', error);
        return;
      }

      const options = (data || []).map(d => ({
        value: d.id,
        label: `${d.type} - ${d.value}`
      }));

      setParentDomainOptions(options);
    } catch (err) {
      console.error('Erro ao carregar domínios pais:', err);
    }
  };

  // Preencher formulário quando for edição
  useEffect(() => {
    if (isOpen) {
      if (domainData) {
        const isEditMode = domainData.id > 0;
        
        // Preencher campos
        setType(domainData.type || '');
        setValue(domainData.value || '');
        setDescription(domainData.description || '');
        setIsActive(domainData.is_active);
        
        if (isEditMode) {
          // Modo edição: mantém a tag existente e marca como editada manualmente
          setTag(domainData.tag || '');
          setTagManuallyEdited(true);
        } else {
          // Modo clonagem: não preenche tag e permite preenchimento automático
          setTag('');
          setTagManuallyEdited(false);
        }
        
        // Definir parent_id se existir
        if (domainData.parent_id && parentDomainOptions.length > 0) {
          const selectedParent = parentDomainOptions.find(opt => opt.value === domainData.parent_id);
          setParentId(selectedParent || null);
        }
      } else {
        // Modo criação - valores padrão
        setIsActive(true);
        setTagManuallyEdited(false);
      }
    } else {
      // Reset form when closing
      resetForm();
    }
  }, [isOpen, domainData, parentDomainOptions]);

  const resetForm = () => {
    setType('');
    setValue('');
    setTag('');
    setDescription('');
    setIsActive(true);
    setParentId(null);
    setError('');
    setTagManuallyEdited(false);
  };

  // Função para gerar tag automaticamente a partir do valor
  const generateTagFromValue = (val: string): string => {
    return val
      .toLowerCase()
      .trim()
      .replace(/\s+/g, '_'); // Substitui espaços por underscore
  };

  // Handler para mudanças no campo valor (atualiza tag automaticamente)
  const handleValueChange = (newValue: string) => {
    setValue(newValue);
    
    // Só atualiza tag automaticamente se não foi editada manualmente
    if (!tagManuallyEdited) {
      setTag(generateTagFromValue(newValue));
    }
  };

  // Handler para mudanças no campo tag (impede espaços e marca como editado manualmente)
  const handleTagChange = (newTag: string) => {
    // Remove espaços do input
    const sanitizedTag = newTag.replace(/\s+/g, '_').toLowerCase();
    setTag(sanitizedTag);
    setTagManuallyEdited(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validações
    if (!type.trim()) {
      setError('Digite o tipo do domínio');
      return;
    }

    if (!value.trim()) {
      setError('Digite o valor do domínio');
      return;
    }

    if (!tag.trim()) {
      setError('Digite a tag do domínio');
      return;
    }

    // Validar se tag contém espaços
    if (tag.includes(' ')) {
      setError('A tag não pode conter espaços. Use underscore (_) no lugar.');
      return;
    }

    setIsSubmitting(true);
    try {
      // Verificar se já existe um domínio com o mesmo type e tag
      const { data: existingDomain, error: checkError } = await supabase
        .from('domains')
        .select('id, type, tag')
        .eq('type', type.trim())
        .eq('tag', tag.trim())
        .maybeSingle();

      if (checkError) {
        console.error('Erro ao verificar domínio existente:', checkError);
        setError('Erro ao verificar domínio existente. Tente novamente.');
        return;
      }

      // Se encontrou um domínio e não está editando o mesmo
      if (existingDomain && existingDomain.id !== domainData?.id) {
        setError(`Já existe um domínio com tipo "${type}" e tag "${tag}". Por favor, use uma tag diferente.`);
        return;
      }

      const domainPayload = {
        type: type.trim(),
        value: value.trim(),
        tag: tag.trim(),
        description: description.trim() || null,
        is_active: isActive,
        parent_id: parentId?.value || null,
      };

      if (domainData && domainData.id > 0) {
        // Atualizar domínio existente
        const { error: updateError } = await supabase
          .from('domains')
          .update(domainPayload)
          .eq('id', domainData.id);

        if (updateError) {
          setError(updateError.message || 'Erro ao atualizar domínio. Tente novamente.');
          return;
        }
      } else {
        // Criar novo domínio
        const { error: insertError } = await supabase
          .from('domains')
          .insert(domainPayload);

        if (insertError) {
          setError(insertError.message || 'Erro ao criar domínio. Tente novamente.');
          return;
        }
      }

      // Sucesso
      onSuccess();
      onClose();
      resetForm();
    } catch (err: any) {
      console.error('Erro ao salvar domínio:', err);
      setError(err.message || 'Erro ao salvar domínio. Tente novamente.');
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
            {domainData && domainData.id > 0 ? 'Editar Domínio' : domainData ? 'Clonar Domínio' : 'Novo Domínio'}
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

          {/* Tipo e Valor - Grid 2 colunas */}
          <div className="grid grid-cols-2 md:grid-cols-2 gap-4">
            {/* Tipo */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Tipo: *
              </label>
              <input
                type="text"
                value={type}
                onChange={(e) => setType(e.target.value)}
                placeholder="Ex: risk_type, project_phase"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-orange-500 focus:border-transparent"
              />
            </div>

            {/* Domínio Pai - 2/3 da linha */}
            <div>

              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Domínio Pai (opcional):
              </label>
              <Select
                options={parentDomainOptions}
                value={parentId}
                onChange={(option) => setParentId(option)}
                placeholder="Selecione um domínio pai"
                className="react-select-container"
                classNamePrefix="react-select"
                isClearable
                menuPosition="fixed"
                menuPlacement="auto"
              />
            </div>
          </div>

          {/*  Grid 3 colunas (2/3 + 1/3) */}
          <div className="grid grid-cols-1 md:grid-cols-7 gap-4">
            {/* Valor */}
            <div className="md:col-span-3">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Valor: *
              </label>
              <input
                type="text"
                value={value}
                onChange={(e) => handleValueChange(e.target.value)}
                placeholder="Ex: Técnico, Planejamento"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-orange-500 focus:border-transparent"
              />
            </div>

             {/* tag */}
            <div className="md:col-span-3">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Tag: *
              </label>
              <input
                type="text"
                value={tag}
                onChange={(e) => handleTagChange(e.target.value)}
                placeholder="Ex: técnico, planejamento"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-orange-500 focus:border-transparent"
              />
          
            </div>

            {/* Status Ativo - 1/3 da linha */}
            <div className="md:col-span-1">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Status:
              </label>
              <div className="flex items-center h-10">
                <label className="inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="relative w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-orange-300 dark:peer-focus:ring-orange-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-green-500"></div>
                  <span className="ms-3 text-sm font-medium text-gray-900 dark:text-gray-300">
                    {isActive ? 'Ativo' : 'Inativo'}
                  </span>
                </label>
              </div>
            </div>
          </div>

          {/* Descrição */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Descrição (opcional):
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Descreva o domínio ou forneça informações adicionais..."
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
                domainData && domainData.id > 0 ? 'Atualizar Domínio' : 'Adicionar Domínio'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default DomainModal;
