// ../components/EmployeeModal.tsx
import { Mail, Info, Clock, ClipboardList, Loader2, X, Award} from 'lucide-react';
import { useState, useEffect, useMemo, useRef } from 'react';
import { DbUser, DbTask } from '../types';
import { supabase } from '../lib/supabaseClient';
import Select, { StylesConfig } from 'react-select';
import { AgGridReact } from 'ag-grid-react';
import { ColDef } from 'ag-grid-community';



// --- Props ---
interface EmployeeModalProps {
  employee: DbUser | null;
  isOpen: boolean;
  onClose: () => void;
}

// --- Helpers ---
const getInitials = (name: string): string => {
  if (!name) return '?';
  const names = name.split(' ');
  const initials = names.map(n => n[0]).join('');
  return initials.slice(0, 2).toUpperCase();
};

const calculateAge = (birthdate: string | null): string => {
  if (!birthdate) return '';
  const date = new Date(birthdate);
  if (isNaN(date.getTime())) return '';
  const age = new Date().getFullYear() - date.getFullYear();
  const m = new Date().getMonth() - date.getMonth();
  if (m < 0 || (m === 0 && new Date().getDate() < date.getDate())) return `– ${age - 1} anos`;
  return `– ${age} anos`;
};

const calculateTenure = (startDate: string): string => {
  if (!startDate) return '';
  const start = new Date(startDate);
  if (isNaN(start.getTime())) return '';
  
  const now = new Date();
  let years = now.getFullYear() - start.getFullYear();
  let months = now.getMonth() - start.getMonth();
  
  // Ajusta os meses e anos se necessário
  if (now.getDate() < start.getDate()) {
    months--;
  }
  
  // Ajusta anos e meses se meses for negativo
  if (months < 0) {
    years--;
    months += 12;
  }
  
  // Retorna a string formatada
  if (years === 0) {
    return months === 1 ? `– ${months} mês` : `– ${months} meses`;
  } else {
    const yearText = years === 1 ? 'ano' : 'anos';
    const monthText = months === 1 ? 'mês' : 'meses';
    return `– ${years} ${yearText} e ${months} ${monthText}`;
  }
};

const formatSecondsToHours = (seconds: number | null): string => {
  if (seconds === null || seconds === undefined) return '–';
  if (seconds === 0) return '0h';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
};

const formatDateTime = (isoString: string | null): string => {
  if (!isoString) return '–';
  try {
    return new Date(isoString).toLocaleDateString('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  } catch {
    return 'Data inválida';
  }
};

const formatPhoneNumber = (phone: string | null): string => {
  if (!phone) return '–';
  // Remove todos os caracteres não numéricos
  const numbers = phone.replace(/\D/g, '');
  // Verifica se é um número de telefone válido (considerando 10 ou 11 dígitos)
  if (numbers.length !== 10 && numbers.length !== 11) return phone;
  // Formata o número
  const ddd = numbers.slice(0, 2);
  const prefix = numbers.slice(2, -4);
  const suffix = numbers.slice(-4);
  return `(${ddd}) ${prefix}-${suffix}`;
};

const formatMonthYear = (yearMonth: string): string => {
  const [year, month] = yearMonth.split('-');
  return `${month}/${year}`;
};

// Busca feriados do mês da tabela off_days
const getHolidaysInMonth = async (year: number, month: number): Promise<Set<string>> => {
  const { data, error } = await supabase
    .from('off_days')
    .select('day')
    .gte('day', `${year}-${month.toString().padStart(2, '0')}-01`)
    .lt('day', `${year}-${(month + 1).toString().padStart(2, '0')}-01`);

  if (error) {
    console.error("Erro ao buscar feriados:", error);
    return new Set();
  }

  return new Set(data.map(d => d.day));
};

// Calcula dias úteis no mês (exclui sábados, domingos e feriados)
const getWorkingDaysInMonth = async (year: number, month: number): Promise<number> => {
  // Cria data inicial (primeiro dia do mês)
  const startDate = new Date(Date.UTC(year, month - 1, 1));
  // Cria data final (último dia do mês)
  const endDate = new Date(Date.UTC(year, month, 0));
  
  let workingDays = 0;
  
  // Busca feriados do mês
  const holidays = await getHolidaysInMonth(year, month);

  // Cria uma nova data para iteração
  let currentDate = new Date(startDate);
  
  // Itera por cada dia do mês
  while (currentDate <= endDate) {
    const dayOfWeek = currentDate.getUTCDay();
    const dateString = currentDate.toISOString().split('T')[0];
    
    // Dia é útil se não for fim de semana e não for feriado
    if (dayOfWeek !== 0 && dayOfWeek !== 6 && !holidays.has(dateString)) {
      workingDays++;
    }
    
    // Avança para o próximo dia
    currentDate.setUTCDate(currentDate.getUTCDate() + 1);
  }
  
  return workingDays;
};

// Calcula horas úteis no mês (8 horas por dia útil)
const getWorkingHoursInMonth = async (year: number, month: number): Promise<number> => {
  const days = await getWorkingDaysInMonth(year, month);
  return days * 8;
};

// Calcula dias úteis até uma data específica
const getWorkingDaysUntil = async (year: number, month: number, day: number): Promise<number> => {
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month - 1, day);
  let workingDays = 0;

  // Busca feriados do mês
  const holidays = await getHolidaysInMonth(year, month);

  for (let date = startDate; date <= endDate; date.setDate(date.getDate() + 1)) {
    const dayOfWeek = date.getDay();
    const dateString = date.toISOString().split('T')[0];
    
    // Dia é útil se não for fim de semana e não for feriado
    if (dayOfWeek !== 0 && dayOfWeek !== 6 && !holidays.has(dateString)) {
      workingDays++;
    }
  }
  return workingDays;
};

// Calcula horas úteis que deveriam ter sido trabalhadas até agora
const getExpectedHoursUntilNow = async (year: number, month: number): Promise<number> => {
  const now = new Date();
  const targetMonth = new Date(year, month - 1, 1);
  
  // Se é um mês futuro, retorna 0
  if (targetMonth.getFullYear() > now.getFullYear() || 
      (targetMonth.getFullYear() === now.getFullYear() && targetMonth.getMonth() > now.getMonth())) {
    return 0;
  }
  
  // Se é um mês passado, retorna o total de horas do mês
  if (year < now.getFullYear() || (year === now.getFullYear() && month < now.getMonth() + 1)) {
    return await getWorkingHoursInMonth(year, month);
  }
  
  // Para o mês atual, calcula até agora
  const workingDaysUntilToday = await getWorkingDaysUntil(year, month, now.getDate());
  
  // Calcula horas do dia atual baseado na hora
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
  
  // Considera horário comercial (8h às 17h)
  let hoursToday = 0;
  if (currentHour >= 17) { // Após 17h, considera dia completo
    hoursToday = 8;
  } else if (currentHour >= 8) { // Entre 8h e 17h, calcula proporcionalmente
    hoursToday = (currentHour - 8) + (currentMinute / 60);
  }
  
  // Total de horas = (dias completos * 8) + horas do dia atual
  return (workingDaysUntilToday - 1) * 8 + hoursToday;
};

// Interface para os dados de horas trabalhadas
interface MonthlyHours {
  mes: string;
  lancadas: number;
  esperadas: number;
  total: number;
  cor: string;
  alerta?: string;
  percentageCompleted: number;
}

// Interface para as habilidades
interface Skill {
  id: string;
  area: string | null;
  category: string | null;
  skill: string | null;
}

interface UserSkill {
  id: string;
  skill_id: string;
  skill: Skill;
}

const getMonthlyHoursData = async (userId: string, months: number = 3): Promise<MonthlyHours[]> => {
  const result: MonthlyHours[] = [];
  const today = new Date();

  for (let i = 0; i < months; i++) {
    const date = new Date(today.getFullYear(), today.getMonth() - i, 1);
    const year = date.getFullYear();
    const month = date.getMonth() + 1; 
    
    // Formato MM/YYYY para exibição
    const monthDisplay = `${month.toString().padStart(2, '0')}/${year}`;
    
    // Calcula total de horas úteis no mês
    const totalHours = await getWorkingHoursInMonth(year, month);

    // Busca horas trabalhadas no mês usando a tabela time_worked
    const { data, error } = await supabase
      .from('time_worked')
      .select('time')
      .eq('user_id', userId)
      .gte('time_worked_date', `${year}-${month.toString().padStart(2, '0')}-01`)
      .lt('time_worked_date', `${year}-${(month + 1).toString().padStart(2, '0')}-01`);

    if (error) {
      console.error("Erro ao buscar horas:", error);
      continue;
    }

    // Soma todas as horas trabalhadas (converte segundos para horas)
    const totalSeconds = data.reduce((acc, curr) => acc + (curr.time || 0), 0);
    const hoursWorked = Math.floor(totalSeconds / 3600); // Arredonda para baixo para ter horas completas

    // Calcula horas esperadas até o momento atual
    const expectedHoursUntilNow = await getExpectedHoursUntilNow(year, month);
    const expectedHours = Math.floor(expectedHoursUntilNow); // Arredonda para baixo para consistência

    // Define a cor e alerta baseado na comparação com as horas esperadas até agora
    const percentage = expectedHours > 0 ? (hoursWorked / expectedHours) * 100 : 0;
    let cor = 'bg-green-500';
    let alerta = undefined;

    // Só compara se houver horas esperadas
    if (expectedHours > 0) {
      // Calcula diferença em horas completas
      const hoursDiff = hoursWorked - expectedHours;
      
      if (hoursDiff >= 1) {
        alerta = `Extra ${hoursDiff}h`;
        cor = 'bg-blue-500';
      } else if (hoursDiff <= -1) {
        alerta = `Faltam ${Math.abs(hoursDiff)}h`;
        cor = 'bg-red-500';
      }
    }

    result.push({
      mes: monthDisplay,
      lancadas: hoursWorked,
      esperadas: expectedHours,
      total: totalHours,
      cor,
      alerta,
      percentageCompleted: Math.min(100, percentage)
    });
  }
  
  return result;
};

const CardHeader = ({ icon, title, children }: { icon: React.ReactNode, title: string, children?: React.ReactNode }) => (
  <div className="flex justify-between items-center mb-3">
    <h3 className="flex items-center space-x-2 font-bold text-gray-700 dark:text-gray-200 text-base">
      {icon}
      <span>{title}</span>
    </h3>
    {children}
  </div>
);

// --- Component ---
const EmployeeModal = ({ employee, isOpen, onClose }: EmployeeModalProps) => {
  const [tasks, setTasks] = useState<DbTask[]>([]);
  const [isLoadingTasks, setIsLoadingTasks] = useState(true);
  const [activeTab, setActiveTab] = useState<'tarefas' | 'registro'>('tarefas');
  const [selectedProjectsFilter, setSelectedProjectsFilter] = useState<string[]>([]);
  const [selectedClientsFilter, setSelectedClientsFilter] = useState<string[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<string>("");
  const [availableMonths, setAvailableMonths] = useState<string[]>([]);
  const [monthlyHours, setMonthlyHours] = useState<MonthlyHours[]>([]);
  const [isLoadingHours, setIsLoadingHours] = useState(true);
  const [timeRecords, setTimeRecords] = useState<any[]>([]);
  const [isLoadingRecords, setIsLoadingRecords] = useState(false);
  
  // Estados para habilidades
  const [userSkills, setUserSkills] = useState<UserSkill[]>([]);
  const [isLoadingSkills, setIsLoadingSkills] = useState(true);
  const [allSkills, setAllSkills] = useState<Skill[]>([]);
  const [isLoadingAllSkills, setIsLoadingAllSkills] = useState(false);
  const [showSkillSelector, setShowSkillSelector] = useState(false);

  const dialogRef = useRef<HTMLDivElement>(null);

  const projectOptions = useMemo(
  () =>
    Array.from(new Set((tasks || []).map(t => t.project_name).filter(Boolean)))
      .sort()
      .map(v => ({ value: v as string, label: v as string })),
  [tasks]
  );

  const clientOptions = useMemo(
    () =>
      Array.from(new Set((tasks || []).map(t => t.client_name).filter(Boolean)))
        .sort()
        .map(v => ({ value: v as string, label: v as string })),
    [tasks]
  );

  // Tarefas filtradas
  const filteredTasks = useMemo(
    () =>
      (tasks || []).filter(t =>
        (selectedProjectsFilter.length === 0 || (t.project_name && selectedProjectsFilter.includes(t.project_name))) &&
        (selectedClientsFilter.length === 0 || (t.client_name && selectedClientsFilter.includes(t.client_name)))
      ),
    [tasks, selectedProjectsFilter, selectedClientsFilter]
  );

  // React-Select: z-index alto dentro do modal
  const loadTimeRecords = async (userId: string, monthYear: string) => {
    setIsLoadingRecords(true);
    try {
      const [month, year] = monthYear.split('/');
      const startDate = `${year}-${month}-01`;
      const endDate = `${year}-${Number(month) + 1}-01`;

      const { data, error } = await supabase
        .from('time_worked')
        .select('*, task_title, project_name')
        .eq('user_id', userId)
        .gte('time_worked_date', startDate)
        .lt('time_worked_date', endDate)
        .gt('time', 0) // Filtra apenas registros com tempo maior que zero
        .order('time_worked_date', { ascending: false });

      if (error) {
        console.error('Erro ao carregar registros:', error);
        setTimeRecords([]);
        return;
      }
      setTimeRecords(data || []);
    } catch (error) {
      console.error('Erro ao carregar registros:', error);
      setTimeRecords([]);
    } finally {
      setIsLoadingRecords(false);
    }
  };

  // Função para carregar habilidades do usuário
  const loadUserSkills = async (userId: string) => {
    setIsLoadingSkills(true);
    try {
      const { data, error } = await supabase
        .from('users_skill')
        .select(`
          id,
          skill_id,
          skills!inner (
            id,
            area,
            category,
            skill
          )
        `)
        .eq('user_id', userId);

      if (error) {
        console.error('Erro ao carregar habilidades do usuário:', error);
        setUserSkills([]);
        return;
      }
      
      const formattedSkills = (data || []).map((item: any) => ({
        id: item.id,
        skill_id: item.skill_id,
        skill: {
          id: item.skills.id,
          area: item.skills.area,
          category: item.skills.category,
          skill: item.skills.skill
        }
      }));
      
      setUserSkills(formattedSkills);
    } catch (error) {
      console.error('Erro ao carregar habilidades do usuário:', error);
      setUserSkills([]);
    } finally {
      setIsLoadingSkills(false);
    }
  };

  // Função para carregar todas as habilidades disponíveis
  const loadAllSkills = async () => {
    setIsLoadingAllSkills(true);
    try {
      const { data, error } = await supabase
        .from('skills')
        .select('*')
        .order('area')
        .order('category')
        .order('skill');

      if (error) {
        console.error('Erro ao carregar habilidades:', error);
        setAllSkills([]);
        return;
      }
      setAllSkills(data || []);
    } catch (error) {
      console.error('Erro ao carregar habilidades:', error);
      setAllSkills([]);
    } finally {
      setIsLoadingAllSkills(false);
    }
  };

  // Função para adicionar habilidade ao usuário
  const addSkillToUser = async (skillId: string) => {
    if (!employee?.user_id) return;
    
    try {
      const { error } = await supabase
        .from('users_skill')
        .insert({
          user_id: employee.user_id,
          skill_id: skillId
        });

      if (error) {
        console.error('Erro ao adicionar habilidade:', error);
        return;
      }
      
      // Recarrega as habilidades do usuário
      await loadUserSkills(employee.user_id);
    } catch (error) {
      console.error('Erro ao adicionar habilidade:', error);
    }
  };

  // Função para remover habilidade do usuário
  const removeSkillFromUser = async (userSkillId: string) => {
    try {
      const { error } = await supabase
        .from('users_skill')
        .delete()
        .eq('id', userSkillId);

      if (error) {
        console.error('Erro ao remover habilidade:', error);
        return;
      }
      
      // Remove da lista local
      setUserSkills(prev => prev.filter(skill => skill.id !== userSkillId));
    } catch (error) {
      console.error('Erro ao remover habilidade:', error);
    }
  };

  // Função para formatar o nome da habilidade
  const formatSkillName = (skill: Skill): string => {
    const parts = [];
    if (skill.area) parts.push(skill.area);
    if (skill.category) parts.push(skill.category);
    if (skill.skill) parts.push(skill.skill);
    return parts.join(' > ');
  };

  // Função para organizar habilidades em hierarquia
  const organizeSkillsHierarchy = (skills: Skill[]) => {
    const hierarchy: any = {};
    
    skills.forEach(skill => {
      // Só processa habilidades com área válida
      if (!skill.area || skill.area.trim() === '') return;
      
      if (!hierarchy[skill.area]) {
        hierarchy[skill.area] = {
          categories: {},
          directSkills: []
        };
      }
      
      if (!skill.category && skill.skill && skill.skill.trim() !== '') {
        // Área > Skill (sem categoria) - só adiciona se skill for válido
        hierarchy[skill.area].directSkills.push(skill);
      } else if (!skill.category && !skill.skill) {
        // Caso especial: área sem categoria e sem skill (ex: ZENDESK)
        // Neste caso, a própria área é a habilidade
        const areaAsSkill = {
          ...skill,
          skill: skill.area // Usa o nome da área como skill
        };
        hierarchy[skill.area].directSkills.push(areaAsSkill);
      } else if (skill.category && skill.category.trim() !== '') {
        // Área > Categoria > Skill - só adiciona se categoria for válida
        if (!hierarchy[skill.area].categories[skill.category]) {
          hierarchy[skill.area].categories[skill.category] = [];
        }
        
        if (skill.skill && skill.skill.trim() !== '') {
          // Caso normal: categoria e skill válidos
          hierarchy[skill.area].categories[skill.category].push(skill);
        } else {
          // Caso especial: skill é null, mas category tem o nome da habilidade
          // Neste caso, a category é na verdade a habilidade final
          const finalSkill = {
            ...skill,
            skill: skill.category // Usa a category como skill
          };
          hierarchy[skill.area].categories[skill.category].push(finalSkill);
        }
      }
    });
    
    return hierarchy;
  };

  // Componente Select hierárquico para habilidades
  const SkillSelect = () => {
    const [currentLevel, setCurrentLevel] = useState<'areas' | 'categories' | 'skills'>('areas');
    const [selectedArea, setSelectedArea] = useState<string>('');
    const [selectedCategory, setSelectedCategory] = useState<string>('');
    const [selectOptions, setSelectOptions] = useState<Array<{value: string, label: string, type: string}>>([]);
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [inputValue, setInputValue] = useState('');
    
    const userSkillIds = new Set(userSkills.map(us => us.skill_id));
    const skillsHierarchy = organizeSkillsHierarchy(allSkills);
    
    // Função para preparar opções do select baseado no nível atual
    const prepareSelectOptions = () => {
      let options: Array<{value: string, label: string, type: string, hasNext?: boolean}> = [];
      
      if (currentLevel === 'areas') {
        // No nível de áreas, só mostra as áreas disponíveis
        options = Object.keys(skillsHierarchy).map(area => {
          const areaData = skillsHierarchy[area];
          const hasCategories = Object.keys(areaData.categories || {}).length > 0;
          const directSkills = (areaData.directSkills || []).filter((skill: Skill) => {
            return !userSkillIds.has(skill.id) && (
              (skill.skill && skill.skill.trim() !== '') || // Skill normal
              (!skill.skill && !skill.category) // Área como skill (ZENDESK)
            );
          });
          
          // Se há categorias com habilidades disponíveis, tem próximo nível
          let hasCategoriesWithSkills = false;
          if (hasCategories) {
            hasCategoriesWithSkills = Object.keys(areaData.categories).some(category => {
              const categorySkills = areaData.categories[category] || [];
              return categorySkills.some((skill: Skill) => {
                return !userSkillIds.has(skill.id) && (
                  (skill.skill && skill.skill.trim() !== '') || // Skill normal
                  (!skill.skill && skill.category && skill.category.trim() !== '') // Category como skill
                );
              });
            });
          }
          
          // Tem próximo nível se:
          // - Há categorias com habilidades disponíveis, OU
          // - Há múltiplas habilidades diretas disponíveis
          const hasNext = hasCategoriesWithSkills || directSkills.length > 1;
          
          return {
            value: area,
            label: area,
            type: 'area',
            hasNext: hasNext
          };
        }).filter(option => {
          // Só mostra áreas que têm pelo menos uma habilidade disponível
          const areaData = skillsHierarchy[option.value];
          
          // Verifica habilidades diretas válidas (que têm skill não nulo ou área como skill)
          const hasDirectSkills = (areaData.directSkills || []).some((skill: Skill) => {
            return !userSkillIds.has(skill.id) && (
              (skill.skill && skill.skill.trim() !== '') || // Skill normal
              (!skill.skill && !skill.category) // Área como skill (ZENDESK)
            );
          });
          
          // Verifica habilidades em categorias válidas (que têm skill não nulo OU category como skill)
          const hasCategorySkills = Object.keys(areaData.categories || {}).some(category => {
            const categorySkills = areaData.categories[category] || [];
            return categorySkills.some((skill: Skill) => {
              return !userSkillIds.has(skill.id) && (
                (skill.skill && skill.skill.trim() !== '') || // Skill normal
                (!skill.skill && skill.category && skill.category.trim() !== '') // Category como skill
              );
            });
          });
          
          return hasDirectSkills || hasCategorySkills;
        });
      } else if (currentLevel === 'categories' && selectedArea) {
        const areaData = skillsHierarchy[selectedArea];
        
        // Adiciona opção de voltar
        options.push({
          value: '__back__',
          label: '← Voltar para áreas',
          type: 'back',
          hasNext: false
        });
        
        // Habilidades diretas da área (só se existirem e forem válidas)
        if (areaData.directSkills && areaData.directSkills.length > 0) {
          const availableDirectSkills = areaData.directSkills.filter((skill: Skill) => {
            return !userSkillIds.has(skill.id) && (
              (skill.skill && skill.skill.trim() !== '') || // Skill normal
              (!skill.skill && !skill.category) // Área como skill (ZENDESK)
            );
          });
          
          if (availableDirectSkills.length > 0) {
            // Se há apenas uma habilidade direta disponível, é um item final
            const isFinalLevel = availableDirectSkills.length === 1;
            
            if (isFinalLevel) {
              // Adiciona a habilidade direta como item final
              const directSkill = availableDirectSkills[0];
              const skillName = directSkill.skill || directSkill.area || '';
              options.push({
                value: directSkill.id,
                label: skillName,
                type: 'skill',
                hasNext: false
              });
            } else {
              // Múltiplas habilidades diretas, vai para próximo nível
              options.push({
                value: '__direct__',
                label: 'Habilidades Gerais',
                type: 'category',
                hasNext: true
              });
            }
          }
        }
        
        // Categorias
        Object.keys(areaData.categories || {}).forEach(category => {
          const categorySkills = areaData.categories[category] || [];
          const availableSkills = categorySkills.filter((skill: Skill) => {
            return !userSkillIds.has(skill.id) && (
              (skill.skill && skill.skill.trim() !== '') || // Skill normal
              (!skill.skill && skill.category && skill.category.trim() !== '') // Category como skill
            );
          });
          
          if (availableSkills.length > 0) {
            // Se há apenas uma habilidade disponível na categoria, é um item final
            const isFinalLevel = availableSkills.length === 1;
            
            if (isFinalLevel) {
              // Adiciona a habilidade diretamente como item final
              const skillToAdd = availableSkills[0];
              const skillName = skillToAdd.skill || skillToAdd.category || '';
              // Para DADOS, só mostra o nome da categoria, não duplica
              const displayName = skillToAdd.skill === skillToAdd.category ? skillName : skillName;
              options.push({
                value: skillToAdd.id,
                label: displayName,
                type: 'skill',
                hasNext: false
              });
            } else {
              // Múltiplas habilidades, vai para próximo nível
              options.push({
                value: category,
                label: category,
                type: 'category',
                hasNext: true
              });
            }
          }
        });
      } else if (currentLevel === 'skills' && selectedArea) {
        const areaData = skillsHierarchy[selectedArea];
        let skills: Skill[];
        
        // Adiciona opção de voltar
        options.push({
          value: '__back__',
          label: `← Voltar para ${selectedArea}`,
          type: 'back',
          hasNext: false
        });
        
        if (selectedCategory) {
          // Habilidades de categoria específica
          skills = areaData.categories[selectedCategory] || [];
        } else {
          // Habilidades diretas da área
          skills = areaData.directSkills || [];
        }
        
        // Adiciona habilidades disponíveis (apenas válidas)
        skills
          .filter(skill => {
            return !userSkillIds.has(skill.id) && (
              (skill.skill && skill.skill.trim() !== '') || // Skill normal
              (!skill.skill && skill.category && skill.category.trim() !== '') || // Category como skill
              (!skill.skill && !skill.category) // Área como skill (ZENDESK)
            );
          })
          .forEach(skill => {
            const skillName = skill.skill || skill.category || skill.area || '';
            options.push({
              value: skill.id,
              label: skillName,
              type: 'skill',
              hasNext: false
            });
          });
      }
      
      setSelectOptions(options);
    };
    
    // Função para lidar com seleção
    const handleSelection = (selectedOption: any) => {
      if (!selectedOption) return;
      
      const { value, type, hasNext } = selectedOption;
      
      if (type === 'back') {
        if (currentLevel === 'categories') {
          setCurrentLevel('areas');
          setSelectedArea('');
          setSelectedCategory(''); // Limpa categoria também
        } else if (currentLevel === 'skills') {
          setCurrentLevel('categories');
          setSelectedCategory('');
        }
        // Mantém o menu aberto para navegação
        setIsMenuOpen(true);
      } else if (type === 'area') {
        setSelectedArea(value);
        setSelectedCategory(''); // Limpa categoria quando seleciona nova área
        const areaData = skillsHierarchy[value];
        
        // Se não há próximo nível (hasNext = false), é um item final
        if (!hasNext) {
          // Esta área tem apenas uma habilidade direta, vamos encontrá-la e adicioná-la
          const directSkills = areaData.directSkills || [];
          const availableSkills = directSkills.filter((skill: Skill) => {
            return !userSkillIds.has(skill.id) && (
              (skill.skill && skill.skill.trim() !== '') || // Skill normal
              (!skill.skill && !skill.category) // Área como skill (ZENDESK)
            );
          });
          
          if (availableSkills.length === 1) {
            // Adiciona a única habilidade disponível
            void addSkillToUser(availableSkills[0].id);
            // Reseta para o início e fecha o menu
            setCurrentLevel('areas');
            setSelectedArea('');
            setSelectedCategory('');
            setIsMenuOpen(false);
            setInputValue('');
            // Fecha o seletor de habilidades
            setShowSkillSelector(false);
            return;
          }
        }
        
        // Se há próximo nível, continua navegação
        if (Object.keys(areaData.categories).length === 0 && (areaData.directSkills || []).length > 0) {
          setCurrentLevel('skills');
        } else {
          setCurrentLevel('categories');
        }
        // Mantém o menu aberto para navegação
        setIsMenuOpen(true);
      } else if (type === 'category') {
        if (value === '__direct__') {
          setSelectedCategory('');
        } else {
          setSelectedCategory(value);
        }
        setCurrentLevel('skills');
        // Mantém o menu aberto para navegação
        setIsMenuOpen(true);
      } else if (type === 'skill') {
        // Adiciona a habilidade
        void addSkillToUser(value);
        // Reseta para o início e fecha o menu
        setCurrentLevel('areas');
        setSelectedArea('');
        setSelectedCategory('');
        setIsMenuOpen(false);
        setInputValue('');
        // Fecha o seletor de habilidades
        setShowSkillSelector(false);
      }
    };
    
    // Função para controlar quando o menu abre/fecha
    const handleMenuOpen = () => {
      setIsMenuOpen(true);
      if (allSkills.length === 0) {
        void loadAllSkills();
      }
    };
    
    const handleMenuClose = () => {
      // Só permite fechar se não estiver navegando
      if (currentLevel === 'areas') {
        setIsMenuOpen(false);
        setInputValue('');
      }
    };
    
    // Atualiza opções quando o nível muda
    useEffect(() => {
      if (allSkills.length > 0) {
        prepareSelectOptions();
      }
    }, [currentLevel, selectedArea, selectedCategory, allSkills, userSkills]);
    
    // Carrega habilidades quando o componente monta
    useEffect(() => {
      if (allSkills.length === 0) {
        void loadAllSkills();
      }
    }, []);
    
    // Placeholder dinâmico
    const getPlaceholder = () => {
      if (isLoadingAllSkills) return 'Carregando...';
      if (currentLevel === 'areas') return 'Selecionar área...';
      if (currentLevel === 'categories') return `Categorias de ${selectedArea}...`;
      if (currentLevel === 'skills') {
        return selectedCategory ? 
          `Habilidades de ${selectedCategory}...` : 
          `Habilidades de ${selectedArea}...`;
      }
      return 'Selecionar...';
    };
    
    return (
      <Select
        options={selectOptions}
        placeholder={getPlaceholder()}
        isDisabled={isLoadingAllSkills}
        isLoading={isLoadingAllSkills}
        value={null} // Sempre limpa após seleção
        inputValue={inputValue}
        onInputChange={(newValue) => setInputValue(newValue)}
        onChange={handleSelection}
        onMenuOpen={handleMenuOpen}
        onMenuClose={handleMenuClose}
        menuIsOpen={isMenuOpen}
        className="text-sm"
        classNamePrefix="react-select"
        menuPortalTarget={menuPortalTarget}
        menuPosition="fixed"
        formatOptionLabel={(option: any) => (
          <div className="flex items-center justify-between w-full">
            <span>{option.label}</span>
            {option.hasNext && <span className="text-gray-400">›</span>}
          </div>
        )}
        styles={{
          ...customSelectStyles,
          control: (base, state) => ({
            ...customSelectStyles.control?.(base, state),
            minHeight: '38px',
          }),
          option: (base, state) => ({
            ...base,
            fontSize: '14px',
            padding: '8px 12px',
            backgroundColor: state.data?.type === 'back' ? '#f3f4f6' : 
                           state.isFocused ? '#f0f9ff' : 'white',
            color: state.data?.type === 'back' ? '#6b7280' : 
                   state.data?.type === 'skill' ? '#1f2937' : '#374151',
            fontWeight: state.data?.type === 'area' ? '500' : 'normal',
            cursor: 'pointer',
            '&:hover': {
              backgroundColor: state.data?.type === 'back' ? '#e5e7eb' : '#dbeafe',
            }
          })
        }}
        noOptionsMessage={() => currentLevel === 'skills' ? 
          'Todas as habilidades já foram adicionadas' : 
          'Nenhuma opção disponível'
        }
        blurInputOnSelect={false}
        closeMenuOnSelect={false}
      />
    );
  };  // Configuração das colunas do AG-Grid para registros de tempo
  const timeRecordsColumnDefs: ColDef[] = [
    {
      headerName: 'Data',
      field: 'time_worked_date',
      flex: 1,
      minWidth: 120,
      cellRenderer: (params: any) => (
        new Date(params.value).toLocaleDateString('pt-BR')
      ),
    },
    {
      headerName: 'Projeto',
      field: 'project_name',
      flex: 2,
      minWidth: 200,
      cellRenderer: (params: any) => params.value || '-',
    },
    {
      headerName: 'Tarefa',
      field: 'task_title',
      flex: 2,
      minWidth: 200,
      cellRenderer: (params: any) => params.value || '-',
    },
    {
      headerName: 'Tempo',
      field: 'time',
      flex: 1,
      minWidth: 100,
      cellRenderer: (params: any) => formatSecondsToHours(params.value),
      type: 'numericColumn',
      headerClass: 'ag-right-aligned-header',
      cellClass: 'ag-right-aligned-cell',
    },
  ];

  const menuPortalTarget = (dialogRef.current ?? document.body) as HTMLElement;
  
  const customSelectStyles: StylesConfig<any, true> = {
    control: (base, state) => {
      const isFocused = state.isFocused || state.menuIsOpen;
      return {
        ...base,
        minHeight: '42px',
        backgroundColor: 'var(--ag-background-color, #fff)',
        borderColor: isFocused ? 'var(--color-primary-500, #F97316)' : 'rgb(209 213 219)',
        boxShadow: isFocused ? '0 0 0 1px var(--color-primary-500, #F97316)' : 'none',
        borderRadius: '0.5rem',
        '&:hover': {
          borderColor: isFocused ? 'var(--color-primary-500, #F97316)' : 'rgb(156 163 175)',
        },
      };
    },
    menuPortal: base => ({ ...base, zIndex: 10000 }),
  };
  

  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [isOpen]);

  // Limpa o estado quando o modal fecha ou quando o funcionário muda
  useEffect(() => {
    if (!isOpen || !employee) {
      // Reseta todos os estados quando o modal fecha
      setTasks([]);
      setIsLoadingTasks(true);
      setActiveTab('tarefas');
      setSelectedProjectsFilter([]);
      setSelectedClientsFilter([]);
      setSelectedMonth("");
      setAvailableMonths([]);
      setMonthlyHours([]);
      setIsLoadingHours(true);
      setTimeRecords([]);
      setIsLoadingRecords(false);
      setUserSkills([]);
      setIsLoadingSkills(true);
      setShowSkillSelector(false); // Reset do seletor de habilidades
    }
  }, [isOpen, employee?.user_id]);

  // Função para buscar meses com registros
  const fetchAvailableMonths = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('time_worked')
        .select('time_worked_date')
        .eq('user_id', userId)
        .gt('time', 0)
        .order('time_worked_date', { ascending: false });

      if (error) {
        console.error('Erro ao buscar meses disponíveis:', error);
        setAvailableMonths([]);
        return;
      }

      // Extrai meses únicos dos registros
      const months = new Set(
        (data || []).map(record => {
          const date = new Date(record.time_worked_date);
          return formatMonthYear(date.toISOString().slice(0, 7));
        })
      );

      const monthsArray = Array.from(months);
      setAvailableMonths(monthsArray);
      
      // Define o mês mais recente como selecionado
      if (monthsArray.length > 0) {
        setSelectedMonth(monthsArray[0]);
      }
    } catch (error) {
      console.error('Erro ao buscar meses disponíveis:', error);
      setAvailableMonths([]);
    }
  };

  // Efeito para carregar dados iniciais quando o modal abre
  useEffect(() => {
    if (isOpen && employee?.user_id) {
      // Reseta estados de loading antes de carregar novos dados
      setIsLoadingTasks(true);
      setIsLoadingHours(true);
      setIsLoadingSkills(true);
      setTimeRecords([]);
      setSelectedMonth("");
      setAvailableMonths([]);
      
      // Carrega tarefas
      (async () => {
        const { data, error } = await supabase
          .from('tasks')
          .select('*')
          .eq('responsible_id', employee.user_id)
          .eq('is_closed', false)
          .order('created_at', { ascending: false });

        if (error) {
          console.error("Erro ao buscar tarefas:", error);
          setTasks([]);
        } else {
          setTasks(data || []);
        }
        setIsLoadingTasks(false);
      })();

      // Carrega dados de horas
      (async () => {
        if (!employee.user_id) return;
        
        try {
          const hoursData = await getMonthlyHoursData(employee.user_id);
          setMonthlyHours(hoursData);
        } catch (error) {
          console.error("Erro ao buscar horas:", error);
          setMonthlyHours([]);
        }
        setIsLoadingHours(false);
      })();

      // Carrega meses disponíveis
      void fetchAvailableMonths(employee.user_id);
      
      // Carrega habilidades do usuário
      void loadUserSkills(employee.user_id);
    }
  }, [isOpen, employee?.user_id]);

  // Efeito separado para atualizar apenas o grid quando o mês muda
  useEffect(() => {
    if (employee?.user_id && selectedMonth) {
      void loadTimeRecords(employee.user_id, selectedMonth);
    }
  }, [selectedMonth, employee?.user_id]);

  if (!isOpen || !employee) return null;

 

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-100 dark:bg-gray-900 rounded-2xl shadow-2xl max-w-6xl w-full flex flex-col" style={{ maxHeight: '90vh' }}>
        {/* Header */}
        <div className="p-5 bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-t-2xl flex items-center space-x-4">
          {employee.avatar_large_url ? (
            <img src={employee.avatar_large_url} alt={employee.name} className="w-16 h-16 rounded-full border-4 border-white/50 object-cover" />
          ) : (
            <div className="w-16 h-16 rounded-full border-4 border-white/50 bg-blue-600 flex items-center justify-center text-2xl font-bold">
              {getInitials(employee.name)}
            </div>
          )}
          <div className="min-w-0">
            <h2 className="text-xl font-bold truncate">{employee.name}</h2>
            <p className="text-orange-100 text-sm">{employee.position || 'Cargo não definido'}</p>
            <div className="flex items-center space-x-2 mt-1 text-xs text-orange-100">
              <Mail className="w-4 h-4" />
              <span className="truncate">{employee.email}</span>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* ESQUERDA */}
            <div className="lg:col-span-1 space-y-6">
              {/* Informações pessoais */}
              <div className="bg-white dark:bg-gray-800 p-4 pt-3 rounded-lg shadow-sm">
                <CardHeader icon={<Info className="w-5 h-5 text-blue-500" />} title="Informações Pessoais" />
                <div className="space-y-1">
                  {[
                    { label: "Data de Nascimento", value: employee.birthday ? `${new Date(employee.birthday).toLocaleDateString('pt-BR')} ${calculateAge(employee.birthday)}` : '–' },
                    { label: "Telefone", value: formatPhoneNumber(employee.phone) },
                    { label: "Data de Admissão", value: employee.in_company_since ? `${new Date(employee.in_company_since).toLocaleDateString('pt-BR')} ${calculateTenure(employee.in_company_since)}` : '–' },
                  ].map((info) => (
                    <div key={info.label}>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{info.label}:</p>
                      <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">{info.value}</p>
                    </div>
                  ))}
                </div>
              </div>
              

              {/* Habilidades */}
              <div className="bg-white dark:bg-gray-800 p-4 pt-3 rounded-lg shadow-sm relative">
                <CardHeader
                  icon={<Award className="w-5 h-5 text-green-500" />}
                  title="Habilidades"
                >
                  <button
                    onClick={() => setShowSkillSelector(!showSkillSelector)}
                    className="flex items-center justify-center w-8 h-8 rounded-full bg-green-500 hover:bg-green-600 text-white transition-colors"
                    title={showSkillSelector ? "Fechar seletor" : "Adicionar habilidade"}
                  >
                    {showSkillSelector ? (
                      <X className="w-4 h-4" />
                    ) : (
                      <span className="text-lg font-bold">+</span>
                    )}
                  </button>
                </CardHeader>
                
                {/* Select hierárquico para adicionar habilidades - só aparece quando showSkillSelector é true */}
                {showSkillSelector && (
                  <div className="mb-4">
                    <SkillSelect />
                  </div>
                )}
                
                {isLoadingSkills ? (
                  <div className="flex justify-center items-center h-24">
                    <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
                  </div>
                ) : userSkills.length === 0 ? (
                  <p className="text-sm text-gray-500">Nenhuma habilidade cadastrada.</p>
                ) : (
                  <div className="space-y-1">
                    {userSkills.map(userSkill => (
                      <div 
                        key={userSkill.id} 
                        className="group flex items-center justify-between p-1 pt-0 pb-0 bg-gray-50 dark:bg-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                      >
                        <span className="text-xs text-gray-800 dark:text-gray-200">
                          {formatSkillName(userSkill.skill)}
                        </span>
                        <button
                          onClick={() => removeSkillFromUser(userSkill.id)}
                          className="opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-700 p-1 transition-opacity"
                          title="Remover habilidade"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>





              {/* Horas lançadas */}
              <div className="bg-white dark:bg-gray-800 p-4 pt-3  rounded-lg shadow-sm">
                <CardHeader icon={<Clock className="w-5 h-5 text-purple-500" />} title="Horas lançadas" />
                <div className="space-y-3">
                  {isLoadingHours ? (
                    <div className="flex justify-center items-center h-24">
                      <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
                    </div>
                  ) : monthlyHours.length === 0 ? (
                    <p className="text-sm text-gray-500">Nenhum registro de horas encontrado.</p>
                  ) : (
                    monthlyHours.map(h => (
                      <div key={h.mes}>
                        <div className="flex justify-between items-center text-xs mb-1">
                          <span className="font-bold text-gray-700 dark:text-gray-200">{h.mes}</span>
                          {h.alerta && (
                            <span className={`font-bold ${h.cor === 'bg-blue-500' ? 'text-blue-500' : 'text-red-500'}`}>
                              {h.alerta}
                            </span>
                          )}
                          <span className="text-gray-500">{h.lancadas}h / {h.total}h</span>
                        </div>
                        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden flex">
                          {/* Horas lançadas (verde) */}
                          {h.lancadas > 0 && (
                            <div className="bg-green-500 h-2" style={{ width: `${(h.lancadas / h.total) * 100}%` }} />
                          )}
                          {/* Horas que faltam até d-1 (vermelho) */}
                          {h.alerta && (
                            <div className="bg-red-500 h-2" style={{ width: `${((h.esperadas - h.lancadas) / h.total) * 100}%` }} />
                          )}
                          {/* Horas futuras do mês (cinza claro) */}
                          <div className="bg-gray-200 dark:bg-gray-700 h-2" style={{ width: `${((h.total - h.esperadas) / h.total) * 100}%` }} />
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Projetos Ativos (AGORA no lado ESQUERDO acima de Equipe) */}
              <div className="bg-white dark:bg-gray-800 p-4 pt-3  rounded-lg shadow-sm">
                <CardHeader icon={<ClipboardList className="w-5 h-5 text-indigo-500" />} title="Projetos Ativos" />
                {isLoadingTasks ? (
                  <div className="flex justify-center items-center h-24">
                    <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
                  </div>
                ) : tasks.length === 0 ? (
                  <p className="text-sm text-gray-500">Sem projetos ativos.</p>
                ) : (
                  <ul className="divide-y divide-gray-200 dark:divide-gray-800">
                    {Array.from(new Set(tasks.map(t => `${t.project_name}|${t.client_name}`)))
                      .map(combined => {
                        const [project_name, client_name] = combined.split('|');
                        return { project_name, client_name };
                      })
                      .filter(p => p.project_name && p.client_name) // Remove projetos ou clientes vazios
                      .sort((a, b) => a.project_name.localeCompare(b.project_name)) // Ordena por nome do projeto
                      .map((p, index) => (
                        <li key={index} className="py-2">
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate">
                              {p.project_name}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                              {p.client_name}
                            </p>
                          </div>
                        </li>
                      ))
                    }
                  </ul>
                )}
              </div>

              

           
            </div>

            {/* DIREITA (Card com ABAS) */}
            <div className="lg:col-span-2">
              <div className="bg-white dark:bg-gray-800 p-4 pt-1  rounded-lg shadow-sm">
                {/* Abas */}
                <div className="mb-3">
                  {/* Abas com padrão laranja */}
                  <div className="border-b border-gray-200 dark:border-gray-700">
                  <nav className="flex -mb-px px-0">
                    <button
                      onClick={() => setActiveTab('tarefas')}
                      className={`whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm ${
                        activeTab === 'tarefas'
                          ? 'border-primary-500 text-primary-600'
                          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                      }`}
                    >
                      Tarefas atuais
                    </button>

                    <button
                      onClick={() => setActiveTab('registro')}
                      className={`ml-6 whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm ${
                        activeTab === 'registro'
                          ? 'border-primary-500 text-primary-600'
                          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                      }`}
                    >
                      Registro de Tempo
                    </button>
                  </nav>
                </div>

          

                  {activeTab === 'tarefas' && (
                  <div className="px-0 pt-4 pb-2 flex flex-col md:flex-row gap-2 items-stretch">
                    <div className="w-full md:w-64">
                      <Select
                        isMulti
                        options={projectOptions}
                        placeholder="Projeto(s)"
                        className="text-sm w-full"
                        classNamePrefix="react-select"
                        onChange={(opts) => setSelectedProjectsFilter(opts.map((o: any) => o.value))}
                        menuPortalTarget={menuPortalTarget}
                        menuPosition="fixed"
                        styles={customSelectStyles}
                      />
                    </div>

                    <div className="w-full md:w-64">
                      <Select
                        isMulti
                        options={clientOptions}
                        placeholder="Cliente(s)"
                        className="text-sm w-full"
                        classNamePrefix="react-select"
                        onChange={(opts) => setSelectedClientsFilter(opts.map((o: any) => o.value))}
                        menuPortalTarget={menuPortalTarget}
                        menuPosition="fixed"
                        styles={customSelectStyles}
                      />
                    </div>

                    {/* Contagem de tarefas – mesma linha dos filtros */}
                    <div className="ml-auto self-center text-sm text-gray-600 dark:text-gray-300">
                      {filteredTasks.length} {filteredTasks.length === 1 ? 'tarefa' : 'tarefas'}
                    </div>
                  </div>
                )}
                </div>

                {/* Conteúdo das abas */}
                {activeTab === 'tarefas' ? (
                  <div className="space-y-3">
                    {isLoadingTasks ? (
                      <div className="flex justify-center items-center h-24">
                        <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
                        <span className="ml-2 text-gray-500">Carregando tarefas...</span>
                      </div>
                    ) : filteredTasks.length === 0 ? (
                      <p className="text-center text-gray-500 text-sm py-8">Nenhuma tarefa em andamento.</p>
                    ) : (
                      filteredTasks.map((tarefa) => (
                        <div key={tarefa.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-3 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                          <div className="flex justify-between items-start mb-2">
                            <div>
                              <p className="text-xs text-gray-400 dark:text-gray-500">#{tarefa.task_id}</p>
                              <h4 className="text-sm font-semibold text-indigo-600 dark:text-indigo-400">{tarefa.title}</h4>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                            <p><span className="text-gray-500">Projeto:</span> <span className="font-medium text-gray-800">{tarefa.project_name || '–'}</span></p>
                            <p><span className="text-gray-500">Cliente:</span> <span className="font-medium text-gray-800">{tarefa.client_name || '–'}</span></p>
                            <p><span className="text-gray-500">Criação:</span> <span className="font-medium text-gray-800">{formatDateTime(tarefa.created_at)}</span></p>
                            <p><span className="text-gray-500">Últ. atividade:</span> <span className="font-medium text-gray-800">{formatDateTime(tarefa.updated_at)}</span></p>
                            <p><span className="text-gray-500">Início:</span> <span className="font-medium text-gray-800">{formatDateTime(tarefa.desired_start_date)}</span></p>
                            <p><span className="text-gray-500">Entrega:</span> <span className="font-medium text-gray-800">{formatDateTime(tarefa.desired_date_with_time)}</span></p>
                            <p><span className="text-gray-500">Quadro:</span> <span className="font-medium text-gray-800">{tarefa.board_name || '–'}</span></p>
                            <p><span className="text-gray-500">Etapa:</span> <span className="font-medium text-gray-800">{tarefa.board_stage_name || '–'}</span></p>
                            <p><span className="text-gray-500">Faturamento:</span> <span className="font-medium text-gray-800">{tarefa.billing_type  || '–'}</span></p>
                            <p><span className="text-gray-500">Tecnologia:</span> <span className="font-medium text-gray-800">{tarefa.technology || '–'}</span></p>
                            <p><span className="text-gray-500">Hr Prev:</span> <span className="font-medium text-gray-800">{formatSecondsToHours(tarefa.current_estimate_seconds)}</span></p>
                            <p><span className="text-gray-500">Hr Exec:</span> <span className="font-medium text-gray-800">{formatSecondsToHours(tarefa.time_worked)}</span></p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col space-y-4">
                    {/* Filtros */}
                    <div className="flex justify-between items-center">
                      {isLoadingRecords ? (
                        <div className="flex items-center">
                          <Loader2 className="w-4 h-4 text-gray-400 animate-spin mr-2" />
                          <span className="text-sm text-gray-500">Carregando...</span>
                        </div>
                      ) : (
                        <select 
                          value={selectedMonth}
                          onChange={(e) => setSelectedMonth(e.target.value)}
                          className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-orange-500 focus:border-transparent"
                        >
                          {availableMonths.length === 0 ? (
                            <option value="">–</option>
                          ) : (
                            availableMonths.map(month => (
                              <option key={month} value={month}>{month}</option>
                            ))
                          )}
                        </select>
                      )}

                      <div className="text-right text-sm">
                        <span className="text-gray-600 dark:text-gray-400">Total de horas no mês: </span>
                        <span className="font-semibold">
                          {formatSecondsToHours(timeRecords.reduce((acc, curr) => acc + (curr.time || 0), 0))}
                        </span>
                      </div>
                    </div>

                    {/* Tabela */}
                    <div 
                      className="ag-theme-alpine w-full ag-no-scroll" 
                      style={{ 
                        height: `${Math.max(100, (timeRecords.length * 40) + 60)}px`,
                        overflow: 'hidden',
                        '--ag-scrollbar-size': '0px'
                      } as React.CSSProperties}
                    >
                      <style>{`
                        .ag-no-scroll .ag-body-viewport {
                          overflow: hidden !important;
                        }
                        .ag-no-scroll .ag-body-vertical-scroll {
                          display: none !important;
                        }
                        .ag-no-scroll .ag-scrollbar-vertical {
                          display: none !important;
                        }
                      `}</style>
                      {isLoadingRecords ? (
                        <div className="h-24 flex items-center justify-center">
                          <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
                          <span className="ml-2 text-gray-500">Carregando registros...</span>
                        </div>
                      ) : (
                        <AgGridReact
                          columnDefs={timeRecordsColumnDefs}
                          rowData={timeRecords}
                          defaultColDef={{
                            sortable: true,
                            filter: true,
                            resizable: true,
                          }}
                          suppressRowClickSelection={true}
                          animateRows={true}
                          rowHeight={40}
                          headerHeight={40}
                          suppressHorizontalScroll={false}
                          suppressScrollOnNewData={true}
                          alwaysShowVerticalScroll={false}
                          suppressRowVirtualisation={true}
                          onFirstDataRendered={(params) => {
                            params.api.sizeColumnsToFit();
                          }}
                          overlayNoRowsTemplate={
                            '<span class="text-gray-500">Nenhum registro encontrado</span>'
                          }
                        />
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 rounded-b-2xl flex justify-end">
          <button onClick={onClose} className="px-6 py-2 text-sm text-white font-semibold bg-green-500 rounded-lg hover:bg-green-600 transition-colors">
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};

export default EmployeeModal;
