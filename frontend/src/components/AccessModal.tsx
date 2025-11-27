import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import Select from 'react-select';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import { DbAccessPlatform, DbDomain } from '../types';

interface AccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  projectId: number;
  accessData?: DbAccessPlatform | null;
  isCloneMode?: boolean;
}

interface SelectOption {
  value: number | string;
  label: string;
}

const AccessModal = ({ isOpen, onClose, onSuccess, projectId, accessData = null, isCloneMode = false }: AccessModalProps) => {
  const [platform, setPlatform] = useState<SelectOption | null>(null);
  const [environment, setEnvironment] = useState<SelectOption | null>(null);
  const [role, setRole] = useState<SelectOption | null>(null);
  const [risk, setRisk] = useState<SelectOption | null>(null);
  const [description, setDescription] = useState('');
  const [expirationDate, setExpirationDate] = useState('');
  const [repositories, setRepositories] = useState<SelectOption[]>([]);
  const [employees, setEmployees] = useState<SelectOption[]>([]);
  const [accessPolicies, setAccessPolicies] = useState<SelectOption[]>([]);
  const [dataTypes, setDataTypes] = useState<SelectOption[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  
  // Estados para as opções carregadas do banco
  const [platformOptions, setPlatformOptions] = useState<SelectOption[]>([]);
  const [employeeOptions, setEmployeeOptions] = useState<SelectOption[]>([]);
  const [environmentOptions, setEnvironmentOptions] = useState<SelectOption[]>([]);
  const [roleOptions, setRoleOptions] = useState<SelectOption[]>([]);
  const [riskOptions, setRiskOptions] = useState<SelectOption[]>([]);
  const [repositoryOptions, setRepositoryOptions] = useState<SelectOption[]>([]);
  const [accessPolicyOptions, setAccessPolicyOptions] = useState<SelectOption[]>([]);
  const [dataTypeOptions, setDataTypeOptions] = useState<SelectOption[]>([]);
  const [domains, setDomains] = useState<DbDomain[]>([]);
  
  // Cliente fixo do projeto
  const [clientId, setClientId] = useState<number | null>(null);
  const [clientName, setClientName] = useState<string>('');

  // Carregar dados do projeto para obter client_id
  useEffect(() => {
    if (isOpen && projectId) {
      void loadProjectData();
    }
  }, [isOpen, projectId]);

  const loadProjectData = async () => {
    try {
      const { data, error } = await supabase
        .from('projects')
        .select('client_name, client_id')
        .eq('project_id', projectId)
        .single();

      if (error) {
        console.error('Erro ao carregar dados do projeto:', error);
        return;
      }

      if (data) {
        setClientName(data.client_name);
        // Buscar client_id da tabela clients baseado no client_name
        const { data: clientData, error: clientError } = await supabase
          .from('clients')
          .select('client_id')
          .eq('name', data.client_name)
          .single();

        if (clientError) {
          console.error('Erro ao buscar client_id:', clientError);
          return;
        }

        if (clientData) {
          setClientId(clientData.client_id);
        }
      }
    } catch (err) {
      console.error('Erro ao carregar dados do projeto:', err);
    }
  };

  // Carregar domains, repositórios e funcionários ao abrir o modal
  useEffect(() => {
    if (isOpen && clientId) {
      void loadDomains();
      void loadRepositories();
      void loadEmployees();
    }
  }, [isOpen, clientId]);

  const loadDomains = async () => {
    try {
      const { data, error } = await supabase
        .from('domains')
        .select('*')
        .eq('is_active', true)
        .in('type', ['access_platform_name', 'access_env', 'access_role', 'access_risk', 'access_policy', 'access_data_type'])
        .order('value');

      if (error) {
        console.error('Erro ao carregar domains:', error);
        return;
      }

      setDomains(data || []);

      // Criar opções para cada tipo
      const platformOpts = (data || [])
        .filter(d => d.type === 'access_platform_name')
        .map(d => ({ value: d.id, label: d.value }));
      
      const environmentOpts = (data || [])
        .filter(d => d.type === 'access_env')
        .map(d => ({ value: d.id, label: d.value }));
      
      const roleOpts = (data || [])
        .filter(d => d.type === 'access_role')
        .map(d => ({ value: d.id, label: d.value }));
      
      const riskOpts = (data || [])
        .filter(d => d.type === 'access_risk')
        .map(d => ({ value: d.id, label: d.value }));

      const policyOpts = (data || [])
        .filter(d => d.type === 'access_policy')
        .map(d => ({ value: d.id, label: d.value }));

      const dataTypeOpts = (data || [])
        .filter(d => d.type === 'access_data_type')
        .map(d => ({ value: d.id, label: d.value }));

      setPlatformOptions(platformOpts);
      setEnvironmentOptions(environmentOpts);
      setRoleOptions(roleOpts);
      setRiskOptions(riskOpts);
      setAccessPolicyOptions(policyOpts);
      setDataTypeOptions(dataTypeOpts);
    } catch (err) {
      console.error('Erro ao carregar domains:', err);
    }
  };

  const loadRepositories = async () => {
    try {
      const { data, error } = await supabase
        .from('access_repository')
        .select('*')
        .eq('client_id', clientId!)
        .eq('is_active', true)
        .order('name');

      if (error) {
        console.error('Erro ao carregar repositórios:', error);
        return;
      }

      const repoOpts = (data || []).map(r => ({ value: r.id, label: r.name }));
      setRepositoryOptions(repoOpts);
    } catch (err) {
      console.error('Erro ao carregar repositórios:', err);
    }
  };

  const loadEmployees = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('user_id, name')
        .eq('is_active', true)
        .order('name');

      if (error) {
        console.error('Erro ao carregar funcionários:', error);
        return;
      }

      const empOpts = (data || []).map(u => ({ value: u.user_id, label: u.name }));
      setEmployeeOptions(empOpts);
    } catch (err) {
      console.error('Erro ao carregar funcionários:', err);
    }
  };

  // Preencher formulário quando for edição ou clonagem
  useEffect(() => {
    if (isOpen && platformOptions.length > 0 && employeeOptions.length > 0 && accessData) {
      setPlatform(platformOptions.find(opt => opt.value === accessData.platform_id) || null);
      setEnvironment(environmentOptions.find(opt => opt.value === accessData.environment_id) || null);
      setRole(roleOptions.find(opt => opt.value === accessData.role_id) || null);
      setRisk(riskOptions.find(opt => opt.value === accessData.risk_id) || null);
      setDescription(accessData.description || '');
      setExpirationDate(accessData.expiration_date || '');

      // Preencher funcionário apenas em modo de edição (não em modo clone)
      if (accessData.user_id && !isCloneMode) {
        const emp = employeeOptions.find(opt => opt.value === accessData.user_id);
        if (emp) {
          setEmployees([emp]);
        }
      } else if (isCloneMode) {
        // Em modo clone, limpar funcionários para permitir seleção de novos
        setEmployees([]);
      }

      // Carregar repositórios associados se for edição ou clonagem
      if (accessData.id) {
        void loadAccessRepositories(accessData.id);
        void loadAccessPlatformDetails(accessData.id);
      }
    } else if (!isOpen) {
      resetForm();
    }
  }, [isOpen, accessData, platformOptions, environmentOptions, roleOptions, riskOptions, employeeOptions, accessPolicyOptions, dataTypeOptions, isCloneMode]);

  const loadAccessRepositories = async (accessId: number) => {
    try {
      const { data, error } = await supabase
        .from('access_repository_plataform')
        .select('repository_id')
        .eq('plataform_id', accessId);

      if (error) {
        console.error('Erro ao carregar repositórios do acesso:', error);
        return;
      }

      const repoIds = (data || []).map(r => r.repository_id).filter(Boolean) as number[];
      const selectedRepos = repositoryOptions.filter(opt => {
        const optValue = typeof opt.value === 'string' ? parseInt(opt.value) : opt.value;
        return repoIds.includes(optValue);
      });
      setRepositories(selectedRepos);
    } catch (err) {
      console.error('Erro ao carregar repositórios do acesso:', err);
    }
  };

  const loadAccessPlatformDetails = async (accessId: number) => {
    try {
      console.log('Carregando detalhes do acesso ID:', accessId);
      const { data, error } = await supabase
        .from('access_platforms_details')
        .select('*')
        .eq('access_platform_id', accessId);

      console.log('Detalhes carregados:', data);
      console.log('Erro:', error);

      if (error) {
        console.error('Erro ao carregar detalhes do acesso:', error);
        return;
      }

      // Separar por tipo
      const policyDetails = (data || []).filter(d => d.domain_type === 'access_policy');
      const dataTypeDetails = (data || []).filter(d => d.domain_type === 'access_data_type');

      console.log('Políticas encontradas:', policyDetails);
      console.log('Tipos de dados encontrados:', dataTypeDetails);
      console.log('Opções de políticas disponíveis:', accessPolicyOptions);
      console.log('Opções de tipos de dados disponíveis:', dataTypeOptions);

      // Mapear para opções selecionadas
      const selectedPolicies = policyDetails.map(d => {
        const opt = accessPolicyOptions.find(o => o.value === d.domain_id);
        return opt || { value: d.domain_id, label: d.domain_value };
      });

      const selectedDataTypes = dataTypeDetails.map(d => {
        const opt = dataTypeOptions.find(o => o.value === d.domain_id);
        return opt || { value: d.domain_id, label: d.domain_value };
      });

      console.log('Políticas selecionadas:', selectedPolicies);
      console.log('Tipos de dados selecionados:', selectedDataTypes);

      setAccessPolicies(selectedPolicies);
      setDataTypes(selectedDataTypes);
    } catch (err) {
      console.error('Erro ao carregar detalhes do acesso:', err);
    }
  };

  const resetForm = () => {
    setPlatform(null);
    setEnvironment(null);
    setRole(null);
    setRisk(null);
    setDescription('');
    setExpirationDate('');
    setRepositories([]);
    setEmployees([]);
    setAccessPolicies([]);
    setDataTypes([]);
    setError('');
  };

  const getDomainValue = (domainId: number | string): string => {
    const id = typeof domainId === 'string' ? parseInt(domainId) : domainId;
    const domain = domains.find(d => d.id === id);
    return domain ? domain.value : '';
  };

  const getDomainTag = (domainId: number | string): string | null => {
    const id = typeof domainId === 'string' ? parseInt(domainId) : domainId;
    const domain = domains.find(d => d.id === id);
    return domain ? domain.tag : null;
  };

  // Função auxiliar para salvar detalhes de acesso
  const saveAccessPlatformDetails = async (accessId: number) => {
    const details: Array<{
      access_platform_id: number;
      domain_id: number;
      domain_value: string;
      domain_tag: string | null;
      domain_type: string;
    }> = [];

    // Adicionar políticas de acesso
    accessPolicies.forEach(policy => {
      const domainId = typeof policy.value === 'string' ? parseInt(policy.value) : policy.value;
      details.push({
        access_platform_id: accessId,
        domain_id: domainId,
        domain_value: getDomainValue(domainId),
        domain_tag: getDomainTag(domainId),
        domain_type: 'access_policy',
      });
    });

    // Adicionar tipos de dados
    dataTypes.forEach(dataType => {
      const domainId = typeof dataType.value === 'string' ? parseInt(dataType.value) : dataType.value;
      details.push({
        access_platform_id: accessId,
        domain_id: domainId,
        domain_value: getDomainValue(domainId),
        domain_tag: getDomainTag(domainId),
        domain_type: 'access_data_type',
      });
    });

    if (details.length > 0) {
      const { error } = await supabase
        .from('access_platforms_details')
        .insert(details);

      if (error) {
        console.error('Erro ao salvar detalhes do acesso:', error);
        throw error;
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validações
    if (!platform) {
      setError('Selecione a plataforma');
      return;
    }

    if (!environment) {
      setError('Selecione o ambiente');
      return;
    }

    if (!role) {
      setError('Selecione a função');
      return;
    }

    if (!risk) {
      setError('Selecione o nível de risco');
      return;
    }

    if (!clientId) {
      setError('Cliente não identificado. Recarregue a página.');
      return;
    }

    if (employees.length === 0) {
      setError('Selecione pelo menos um funcionário');
      return;
    }

    // Validar se é GitHub e se há repositórios selecionados
    const platformName = getDomainValue(platform.value);
    if (platformName.toLowerCase() === 'github' && repositories.length === 0) {
      setError('Para a plataforma GitHub, selecione pelo menos um repositório');
      return;
    }

    setIsSubmitting(true);
    try {
      if (accessData && !isCloneMode) {
        // Modo de edição: atualizar registro único
        const accessPayload = {
          client_id: clientId,
          client_name: clientName,
          user_id: employees[0].value,
          platform_id: platform.value,
          platform_name: getDomainValue(platform.value),
          environment_id: environment.value,
          environment_name: getDomainValue(environment.value),
          role_id: role.value,
          role_name: getDomainValue(role.value),
          risk_id: risk.value,
          risk_name: getDomainValue(risk.value),
          description: description.trim() || null,
          expiration_date: expirationDate || null,
          is_active: true,
        };

        const { error: updateError } = await supabase
          .from('access_platforms')
          .update(accessPayload)
          .eq('id', accessData.id);

        if (updateError) {
          setError(updateError.message || 'Erro ao atualizar acesso. Tente novamente.');
          return;
        }

        // Deletar repositórios antigos se for GitHub
        if (platformName.toLowerCase() === 'github') {
          await supabase
            .from('access_repository_plataform')
            .delete()
            .eq('plataform_id', accessData.id);

          // Inserir novos repositórios
          if (repositories.length > 0) {
            const repositoryLinks = repositories.map(repo => ({
              plataform_id: accessData.id,
              repository_id: repo.value,
            }));

            const { error: repoError } = await supabase
              .from('access_repository_plataform')
              .insert(repositoryLinks);

            if (repoError) {
              console.error('Erro ao associar repositórios:', repoError);
              setError('Acesso salvo, mas erro ao associar repositórios.');
              return;
            }
          }
        }

        // Deletar detalhes antigos e inserir novos
        await supabase
          .from('access_platforms_details')
          .delete()
          .eq('access_platform_id', accessData.id);

        // Salvar novos detalhes (políticas e tipos de dados)
        await saveAccessPlatformDetails(accessData.id);
      } else {
        // Modo de criação/clone: usar upsert para evitar conflitos
        // Verificar quais funcionários já têm acesso cadastrado para esta combinação
        const userIds = employees.map(e => e.value);
        
        const { data: existingAccesses, error: checkError } = await supabase
          .from('access_platforms')
          .select('id, user_id')
          .eq('client_id', clientId)
          .eq('platform_id', platform.value)
          .eq('environment_id', environment.value)
          .eq('is_active', true)
          .in('user_id', userIds);

        if (checkError) {
          console.error('Erro ao verificar acessos existentes:', checkError);
          setError('Erro ao verificar acessos existentes. Tente novamente.');
          return;
        }

        // Separar funcionários em existentes (update) e novos (insert)
        const existingUserIds = new Set((existingAccesses || []).map(a => a.user_id));
        const existingAccessMap = new Map((existingAccesses || []).map(a => [a.user_id, a.id]));
        
        const employeesToInsert = employees.filter(e => !existingUserIds.has(e.value));
        const employeesToUpdate = employees.filter(e => existingUserIds.has(e.value));

        const createdAccessIds: number[] = [];
        const updatedAccessIds: number[] = [];

        // Atualizar acessos existentes
        for (const employee of employeesToUpdate) {
          const accessId = existingAccessMap.get(employee.value);
          if (!accessId) continue;

          const updatePayload = {
            role_id: role.value,
            role_name: getDomainValue(role.value),
            risk_id: risk.value,
            risk_name: getDomainValue(risk.value),
            description: description.trim() || null,
            expiration_date: expirationDate || null,
          };

          const { error: updateError } = await supabase
            .from('access_platforms')
            .update(updatePayload)
            .eq('id', accessId);

          if (updateError) {
            console.error('Erro ao atualizar acesso:', updateError);
          } else {
            updatedAccessIds.push(accessId);
          }
        }

        // Inserir novos acessos
        if (employeesToInsert.length > 0) {
          const accessPayloads = employeesToInsert.map(employee => ({
            client_id: clientId,
            client_name: clientName,
            user_id: employee.value,
            platform_id: platform.value,
            platform_name: getDomainValue(platform.value),
            environment_id: environment.value,
            environment_name: getDomainValue(environment.value),
            role_id: role.value,
            role_name: getDomainValue(role.value),
            risk_id: risk.value,
            risk_name: getDomainValue(risk.value),
            description: description.trim() || null,
            expiration_date: expirationDate || null,
            is_active: true,
          }));

          const { data: insertData, error: insertError } = await supabase
            .from('access_platforms')
            .insert(accessPayloads)
            .select('id');

          if (insertError) {
            setError(insertError.message || 'Erro ao criar acesso. Tente novamente.');
            return;
          }

          if (insertData) {
            createdAccessIds.push(...insertData.map(a => a.id));
          }
        }

        const allAccessIds = [...createdAccessIds, ...updatedAccessIds];

        if (allAccessIds.length === 0) {
          setError('Nenhum acesso foi criado ou atualizado.');
          return;
        }

        // Inserir repositórios se for GitHub (para todos os registros)
        if (platformName.toLowerCase() === 'github' && repositories.length > 0) {
          // Deletar repositórios antigos dos acessos atualizados
          for (const accessId of updatedAccessIds) {
            await supabase
              .from('access_repository_plataform')
              .delete()
              .eq('plataform_id', accessId);
          }

          const repositoryLinks: any[] = [];
          allAccessIds.forEach(accessId => {
            repositories.forEach(repo => {
              repositoryLinks.push({
                plataform_id: accessId,
                repository_id: repo.value,
              });
            });
          });

          const { error: repoError } = await supabase
            .from('access_repository_plataform')
            .insert(repositoryLinks);

          if (repoError) {
            console.error('Erro ao associar repositórios:', repoError);
            setError('Acessos salvos, mas erro ao associar repositórios.');
            return;
          }
        }

        // Deletar detalhes antigos dos acessos atualizados
        for (const accessId of updatedAccessIds) {
          await supabase
            .from('access_platforms_details')
            .delete()
            .eq('access_platform_id', accessId);
        }

        // Salvar detalhes (políticas e tipos de dados) para cada acesso
        for (const accessId of allAccessIds) {
          await saveAccessPlatformDetails(accessId);
        }
      }

      // Sucesso
      onSuccess();
      onClose();
      resetForm();
    } catch (err: any) {
      console.error('Erro ao salvar acesso:', err);
      setError(err.message || 'Erro ao salvar acesso. Tente novamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  // Determinar se deve mostrar campo de repositórios
  const showRepositories = platform && getDomainValue(platform.value).toLowerCase() === 'github';

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="p-5 bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-t-2xl flex items-center justify-between sticky top-0 z-10">
          <h2 className="text-xl font-bold">
            {isCloneMode ? 'Clonar Acesso' : accessData ? 'Editar Acesso' : 'Novo Acesso'}
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

          {/* Cliente (read-only) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Cliente:
            </label>
            <input
              type="text"
              value={clientName}
              disabled
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed"
            />
          </div>

          {/* Funcionários */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Funcionários: *
            </label>
            <Select
              isMulti={!accessData || isCloneMode}
              isDisabled={!!accessData && !isCloneMode}
              options={employeeOptions}
              value={employees}
              onChange={(options) => setEmployees(Array.isArray(options) ? options as SelectOption[] : options ? [options as SelectOption] : [])}
              placeholder="Selecione os funcionários"
              className="react-select-container"
              classNamePrefix="react-select"
            />
            {accessData && !isCloneMode && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Não é possível alterar o funcionário em modo de edição.
              </p>
            )}
            {isCloneMode && (
              <p className="text-xs text-blue-500 dark:text-blue-400 mt-1">
                Selecione os funcionários que receberão o acesso clonado.
              </p>
            )}
          </div>

          {/* Plataforma, Ambiente, Função e Risco - Grid 2x2 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Plataforma */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Plataforma: *
              </label>
              <Select
                options={platformOptions}
                value={platform}
                onChange={(option) => setPlatform(option)}
                placeholder="Selecione a plataforma"
                className="react-select-container"
                classNamePrefix="react-select"
                isClearable
              />
            </div>

            {/* Ambiente */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Ambiente: *
              </label>
              <Select
                options={environmentOptions}
                value={environment}
                onChange={(option) => setEnvironment(option)}
                placeholder="Selecione o ambiente"
                className="react-select-container"
                classNamePrefix="react-select"
                isClearable
              />
            </div>

            {/* Função */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Função: *
              </label>
              <Select
                options={roleOptions}
                value={role}
                onChange={(option) => setRole(option)}
                placeholder="Selecione a função"
                className="react-select-container"
                classNamePrefix="react-select"
                isClearable
              />
            </div>

            {/* Risco */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Nível de Risco: *
              </label>
              <Select
                options={riskOptions}
                value={risk}
                onChange={(option) => setRisk(option)}
                placeholder="Selecione o nível de risco"
                className="react-select-container"
                classNamePrefix="react-select"
                isClearable
              />
            </div>
          </div>

          {/* Repositórios (condicional para GitHub) */}
          {showRepositories && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Repositórios: *
              </label>
              <Select
                isMulti
                options={repositoryOptions}
                value={repositories}
                onChange={(options) => setRepositories(options as SelectOption[])}
                placeholder="Selecione os repositórios"
                className="react-select-container"
                classNamePrefix="react-select"
              />
            </div>
          )}

          {/* Política de Acesso e Tipo de Dados - Grid 2 colunas */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Política de Acesso */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Política de Acesso:
              </label>
              <Select
                isMulti
                options={accessPolicyOptions}
                value={accessPolicies}
                onChange={(options) => setAccessPolicies(options as SelectOption[])}
                placeholder="Selecione as políticas"
                className="react-select-container"
                classNamePrefix="react-select"
              />
            </div>

            {/* Tipo de Dados */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Tipo de Dados:
              </label>
              <Select
                isMulti
                options={dataTypeOptions}
                value={dataTypes}
                onChange={(options) => setDataTypes(options as SelectOption[])}
                placeholder="Selecione os tipos de dados"
                className="react-select-container"
                classNamePrefix="react-select"
              />
            </div>
          </div>

          {/* Data de Expiração */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Data de Expiração:
            </label>
            <input
              type="date"
              value={expirationDate}
              onChange={(e) => setExpirationDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-orange-500 focus:border-transparent"
            />
          </div>

          {/* Descrição */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Descrição:
            </label>
            <div className="border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 overflow-hidden">
              <ReactQuill
                theme="snow"
                value={description}
                onChange={setDescription}
                placeholder="Descreva detalhes adicionais sobre o acesso..."
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
                isCloneMode ? 'Clonar Acesso' : accessData ? 'Atualizar Acesso' : 'Adicionar Acesso'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AccessModal;
