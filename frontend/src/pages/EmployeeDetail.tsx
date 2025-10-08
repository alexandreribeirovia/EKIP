import { useState, useMemo, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { AgGridReact } from 'ag-grid-react'
import { ColDef } from 'ag-grid-community'
import { ArrowLeft, Phone, Mail, Calendar, Clock, Award, Plus, X, Loader2, ExternalLink } from 'lucide-react'
import Select, { StylesConfig } from 'react-select'
import { DbUser, DbTask } from '../types'
import { supabase } from '../lib/supabaseClient'
import FeedbackModal from '../components/FeedbackModal'
import '../styles/main.css'

const EmployeeDetail = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [employee, setEmployee] = useState<DbUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [tasks, setTasks] = useState<DbTask[]>([])
  const [isLoadingTasks, setIsLoadingTasks] = useState(true)
  const [activeTab, setActiveTab] = useState<'tarefas' | 'registro' | 'feedbacks'>('tarefas')
  const [selectedProjectsFilter, setSelectedProjectsFilter] = useState<string[]>([])
  const [selectedClientsFilter, setSelectedClientsFilter] = useState<string[]>([])
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('abertos')
  const [selectedMonth, setSelectedMonth] = useState<string>("")
  const [availableMonths, setAvailableMonths] = useState<string[]>([])
  const [monthlyHours, setMonthlyHours] = useState<MonthlyHours[]>([])
  const [isLoadingHours, setIsLoadingHours] = useState(true)
  const [timeRecords, setTimeRecords] = useState<any[]>([])
  const [isLoadingRecords, setIsLoadingRecords] = useState(false)
  const [feedbacks, setFeedbacks] = useState<any[]>([])
  const [isLoadingFeedbacks, setIsLoadingFeedbacks] = useState(false)
  const [isFeedbackModalOpen, setIsFeedbackModalOpen] = useState(false)
  
  const [userSkills, setUserSkills] = useState<UserSkill[]>([])
  const [isLoadingSkills, setIsLoadingSkills] = useState(true)
  const [allSkills, setAllSkills] = useState<Skill[]>([])
  const [isLoadingAllSkills, setIsLoadingAllSkills] = useState(false)
  const [showSkillSelector, setShowSkillSelector] = useState(false)

  const containerRef = useRef<HTMLDivElement>(null)
  
  // Refs para prevenir chamadas duplicadas
  const hasLoadedEmployee = useRef(false)
  const hasLoadedEmployeeData = useRef(false)
  const loadedTimeRecordsKeys = useRef<Set<string>>(new Set())
  
  // Caches para evitar chamadas duplicadas ao banco
  const offDaysCache = useRef<Map<string, Set<string>>>(new Map())
  const timeWorkedCache = useRef<Map<string, any[]>>(new Map())

  // Funções auxiliares (copiadas do EmployeeModal)
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
    return ` – ${age} anos`;
  };

  const calculateTenure = (startDate: string): string => {
    if (!startDate) return '';
    const start = new Date(startDate);
    if (isNaN(start.getTime())) return '';
    
    const now = new Date();
    let years = now.getFullYear() - start.getFullYear();
    let months = now.getMonth() - start.getMonth();
    
    if (now.getDate() < start.getDate()) {
      months--;
    }
    
    if (months < 0) {
      years--;
      months += 12;
    }
    
    if (years === 0) {
      return months === 1 ? `– ${months} mês` : `– ${months} meses`;
    } else {
      const yearText = years === 1 ? 'ano' : 'anos';
      const monthText = months === 1 ? 'mês' : 'meses';
      return ` – ${years} ${yearText} e ${months} ${monthText}`;
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
    const numbers = phone.replace(/\D/g, '');
    if (numbers.length !== 10 && numbers.length !== 11) return phone;
    const ddd = numbers.slice(0, 2);
    const prefix = numbers.slice(2, -4);
    const suffix = numbers.slice(-4);
    return `(${ddd}) ${prefix}-${suffix}`;
  };

  // Função para determinar a cor do card da tarefa baseada na data de entrega
  const getTaskCardColor = (task: DbTask): string => {
    // Se for Happy day ou Férias, sempre amarelo (verificação case-insensitive e flexível)
    const typeName = (task.type_name || '').toLowerCase().trim();
    if (typeName.includes('happy') || typeName.includes('férias') || typeName.includes('ferias')) {
      return 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800 hover:bg-yellow-100 dark:hover:bg-yellow-900/30';
    }
    
    const now = new Date();
    const deliveryDate = task.desired_date_with_time ? new Date(task.desired_date_with_time) : null;
    
    // Se não tem data de entrega ou se a data atual é maior que a data de entrega
    if (!deliveryDate || now > deliveryDate) {
      return 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 hover:bg-red-100 dark:hover:bg-red-900/30';
    }
    
    // Cor padrão para tarefas dentro do prazo
    return 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50';
  };

  // Busca todos os feriados de um período e armazena no cache
  const preloadHolidays = async (startYear: number, startMonth: number, endYear: number, endMonth: number): Promise<void> => {
    const startDate = `${startYear}-${startMonth.toString().padStart(2, '0')}-01`;
    const endDate = `${endYear}-${(endMonth + 1).toString().padStart(2, '0')}-01`;
    
    const { data, error } = await supabase
      .from('off_days')
      .select('day')
      .gte('day', startDate)
      .lt('day', endDate);

    if (error) {
      console.error("Erro ao buscar feriados:", error);
      return;
    }
    
    // Agrupa os feriados por mês e armazena no cache
    data.forEach(record => {
      const date = new Date(record.day);
      const year = date.getFullYear();
      const month = date.getMonth() + 1;
      const cacheKey = `${year}-${month}`;
      
      if (!offDaysCache.current.has(cacheKey)) {
        offDaysCache.current.set(cacheKey, new Set());
      }
      offDaysCache.current.get(cacheKey)!.add(record.day);
    });
    
    // Para meses sem feriados, cria Set vazio no cache
    let currentDate = new Date(startYear, startMonth - 1, 1);
    const end = new Date(endYear, endMonth, 1);
    while (currentDate < end) {
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth() + 1;
      const cacheKey = `${year}-${month}`;
      if (!offDaysCache.current.has(cacheKey)) {
        offDaysCache.current.set(cacheKey, new Set());
      }
      currentDate.setMonth(currentDate.getMonth() + 1);
    }
  };

  // Busca feriados do mês da tabela off_days (usa cache)
  const getHolidaysInMonth = async (year: number, month: number): Promise<Set<string>> => {
    const cacheKey = `${year}-${month}`;
    
    // Verifica se já está no cache
    if (offDaysCache.current.has(cacheKey)) {
      return offDaysCache.current.get(cacheKey)!;
    }
    
    // Se não está no cache, busca individualmente (fallback)
    const { data, error } = await supabase
      .from('off_days')
      .select('day')
      .gte('day', `${year}-${month.toString().padStart(2, '0')}-01`)
      .lt('day', `${year}-${(month + 1).toString().padStart(2, '0')}-01`);

    if (error) {
      console.error("Erro ao buscar feriados:", error);
      return new Set();
    }
    const holidays = new Set(data.map(d => d.day));
    
    // Armazena no cache
    offDaysCache.current.set(cacheKey, holidays);
    
    return holidays;
  };

  // Calcula dias úteis no mês (exclui sábados, domingos e feriados)
  const getWorkingDaysInMonth = async (year: number, month: number): Promise<number> => {
    const startDate = new Date(Date.UTC(year, month - 1, 1));
    const endDate = new Date(Date.UTC(year, month, 0));
    
    let workingDays = 0;
    const holidays = await getHolidaysInMonth(year, month);
    let currentDate = new Date(startDate);
    
    while (currentDate <= endDate) {
      const dayOfWeek = currentDate.getUTCDay();
      const dateString = currentDate.toISOString().split('T')[0];
      
      if (dayOfWeek !== 0 && dayOfWeek !== 6 && !holidays.has(dateString)) {
        workingDays++;
      }
      
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

    const holidays = await getHolidaysInMonth(year, month);

    for (let date = startDate; date <= endDate; date.setDate(date.getDate() + 1)) {
      const dayOfWeek = date.getDay();
      const dateString = date.toISOString().split('T')[0];
      
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
    
    if (targetMonth.getFullYear() > now.getFullYear() || 
        (targetMonth.getFullYear() === now.getFullYear() && targetMonth.getMonth() > now.getMonth())) {
      return 0;
    }
    
    if (year < now.getFullYear() || (year === now.getFullYear() && month < now.getMonth() + 1)) {
      return await getWorkingHoursInMonth(year, month);
    }
    
    const workingDaysUntilToday = await getWorkingDaysUntil(year, month, now.getDate());
    
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    
    let hoursToday = 0;
    if (currentHour >= 17) {
      hoursToday = 8;
    } else if (currentHour >= 8) {
      hoursToday = (currentHour - 8) + (currentMinute / 60);
    }
    
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

    // Calcula o range de datas para buscar todos os meses de uma vez
    const startMonth = new Date(today.getFullYear(), today.getMonth() - (months - 1), 1);
    const endMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);
    
    const startDate = `${startMonth.getFullYear()}-${(startMonth.getMonth() + 1).toString().padStart(2, '0')}-01`;
    const endDate = `${endMonth.getFullYear()}-${(endMonth.getMonth() + 1).toString().padStart(2, '0')}-01`;

    // Pré-carrega todos os feriados do período de uma vez
    await preloadHolidays(
      startMonth.getFullYear(), 
      startMonth.getMonth() + 1,
      endMonth.getFullYear(), 
      endMonth.getMonth()
    );

    // Busca todos os registros de time_worked de uma vez
    const { data: allTimeWorked, error } = await supabase
      .from('time_worked')
      .select('time, time_worked_date')
      .eq('user_id', userId)
      .gte('time_worked_date', startDate)
      .lt('time_worked_date', endDate);

    if (error) {
      console.error("Erro ao buscar horas:", error);
      return result;
    }

    // Agrupa os dados por mês
    const timeByMonth = new Map<string, number>();
    allTimeWorked.forEach(record => {
      const date = new Date(record.time_worked_date);
      const monthKey = `${date.getFullYear()}-${date.getMonth() + 1}`;
      const currentTotal = timeByMonth.get(monthKey) || 0;
      timeByMonth.set(monthKey, currentTotal + (record.time || 0));
    });

    // Processa cada mês
    for (let i = 0; i < months; i++) {
      const date = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const year = date.getFullYear();
      const month = date.getMonth() + 1; 
      
      const monthDisplay = `${month.toString().padStart(2, '0')}/${year}`;
      const monthKey = `${year}-${month}`;
      const totalHours = await getWorkingHoursInMonth(year, month);

      const totalSeconds = timeByMonth.get(monthKey) || 0;
      const hoursWorked = Math.floor(totalSeconds / 3600);

      const expectedHoursUntilNow = await getExpectedHoursUntilNow(year, month);
      const expectedHours = Math.floor(expectedHoursUntilNow);

      const percentage = expectedHours > 0 ? (hoursWorked / expectedHours) * 100 : 0;
      let cor = 'bg-green-500';
      let alerta = undefined;

      if (expectedHours > 0) {
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

  // Carrega dados do funcionário
  const fetchEmployee = async () => {
    if (!id) return;
    
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('users')
        .select(`
          *,
          users_skill (
            id,
            skills (
              id,
              area,
              category,
              skill
            )
          )
        `)
        .eq('user_id', id)
        .single();

      if (error) {
        console.error('Erro ao buscar funcionário:', error);
        navigate('/employees');
        return;
      }

      setEmployee(data);
    } catch (error) {
      console.error('Erro ao carregar funcionário:', error);
      navigate('/employees');
    } finally {
      setIsLoading(false);
    }
  };

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

  const statusOptions = [
    { value: 'todos', label: 'Todos' },
    { value: 'abertos', label: 'Abertos' },
    { value: 'fechados', label: 'Fechados' }
  ];

  // Tarefas filtradas
  const filteredTasks = useMemo(
    () =>
      (tasks || []).filter(t => {
        // Filtro por projeto
        const projectMatch = selectedProjectsFilter.length === 0 || (t.project_name && selectedProjectsFilter.includes(t.project_name));
        
        // Filtro por cliente
        const clientMatch = selectedClientsFilter.length === 0 || (t.client_name && selectedClientsFilter.includes(t.client_name));
        
        // Filtro por status
        let statusMatch = true;
        if (selectedStatusFilter === 'abertos') {
          statusMatch = !t.is_closed;
        } else if (selectedStatusFilter === 'fechados') {
          statusMatch = t.is_closed;
        }
        // Para 'todos', statusMatch permanece true
        
        return projectMatch && clientMatch && statusMatch;
      }),
    [tasks, selectedProjectsFilter, selectedClientsFilter, selectedStatusFilter]
  );

  const summaryCounts = useMemo(() => {
    const total = tasks.length;
    const active = tasks.filter(task => !task.is_closed).length;
    const delivered = total - active;

    return { total, active, delivered };
  }, [tasks]);

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
        .gt('time', 0)
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

  // Função para carregar feedbacks do usuário
  const loadFeedbacks = async (userId: string) => {
    setIsLoadingFeedbacks(true);
    try {
      const { data, error } = await supabase
        .from('feedbacks')
        .select('id, feedback_user_id, feedback_user_name, owner_user_id, owner_user_name, feedback_date, type, public_comment')
        .eq('feedback_user_id', userId)
        .order('feedback_date', { ascending: false });

      if (error) {
        console.error('Erro ao carregar feedbacks:', error);
        setFeedbacks([]);
        return;
      }
      setFeedbacks(data || []);
    } catch (error) {
      console.error('Erro ao carregar feedbacks:', error);
      setFeedbacks([]);
    } finally {
      setIsLoadingFeedbacks(false);
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

      const months = new Set(
        (data || []).map(record => {
          const date = new Date(record.time_worked_date);
          return `${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getFullYear()}`;
        })
      );

      const monthsArray = Array.from(months);
      setAvailableMonths(monthsArray);
      
      if (monthsArray.length > 0) {
        setSelectedMonth(monthsArray[0]);
      }
    } catch (error) {
      console.error('Erro ao buscar meses disponíveis:', error);
      setAvailableMonths([]);
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
      
      await loadUserSkills(employee.user_id);
    } catch (error) {
      console.error('Erro ao adicionar habilidade:', error);
    }
  };

  // Função para ativar/desativar funcionário
  const toggleEmployeeStatus = async () => {
    if (!employee?.user_id) return;

    try {
      const newStatus = !employee.is_active;
      
      // Primeiro, vamos tentar com user_id
      let { data, error } = await supabase
        .from('users')
        .update({ is_active: newStatus })
        .eq('user_id', employee.user_id)
        .select();

      // Se não encontrou nenhum registro, tenta com id (caso o schema seja diferente)
      if (!error && (!data || data.length === 0)) {
        const response = await supabase
          .from('users')
          .update({ is_active: newStatus })
          .eq('id', employee.user_id)
          .select();
        data = response.data;
        error = response.error;
      }

      if (error) {
        console.error('Erro ao atualizar status do funcionário:', error);
        return;
      }
      
      // Atualiza o estado local apenas se a atualização foi bem-sucedida
      if (data && data.length > 0) {
        setEmployee(prev => prev ? { ...prev, is_active: newStatus } : null);
      }
    } catch (error) {
      console.error('Erro ao atualizar status do funcionário:', error);
    }
  };

  // Função para ativar/desativar funcionário
  const toggleEmployeeLogHours = async () => {
    if (!employee?.user_id) return;

    try {
      const newLogHours = !employee.log_hours;
      
      // Primeiro, vamos tentar com user_id
      let { data, error } = await supabase
        .from('users')
        .update({ log_hours: newLogHours })
        .eq('user_id', employee.user_id)
        .select();

      // Se não encontrou nenhum registro, tenta com id (caso o schema seja diferente)
      if (!error && (!data || data.length === 0)) {
        const response = await supabase
          .from('users')
          .update({ log_hours: newLogHours })
          .eq('id', employee.user_id)
          .select();
        data = response.data;
        error = response.error;
      }

      if (error) {
        console.error('Erro ao atualizar lança Horas do funcionário:', error);
        return;
      }
      
      // Atualiza o estado local apenas se a atualização foi bem-sucedida
      if (data && data.length > 0) {
        setEmployee(prev => prev ? { ...prev, log_hours: newLogHours } : null);
      }
    } catch (error) {
      console.error('Erro ao atualizar lança Horas do funcionário:', error);
    }
  };

  // Função para organizar habilidades em hierarquia
  const organizeSkillsHierarchy = (skills: Skill[]) => {
    const hierarchy: any = {};
    
    skills.forEach(skill => {
      if (!skill.area || skill.area.trim() === '') return;
      
      if (!hierarchy[skill.area]) {
        hierarchy[skill.area] = {
          categories: {},
          directSkills: []
        };
      }
      
      if (!skill.category && skill.skill && skill.skill.trim() !== '') {
        hierarchy[skill.area].directSkills.push(skill);
      } else if (!skill.category && !skill.skill) {
        const areaAsSkill = {
          ...skill,
          skill: skill.area
        };
        hierarchy[skill.area].directSkills.push(areaAsSkill);
      } else if (skill.category && skill.category.trim() !== '') {
        if (!hierarchy[skill.area].categories[skill.category]) {
          hierarchy[skill.area].categories[skill.category] = [];
        }
        
        if (skill.skill && skill.skill.trim() !== '') {
          hierarchy[skill.area].categories[skill.category].push(skill);
        } else {
          const categoryAsSkill = {
            ...skill,
            skill: skill.category
          };
          hierarchy[skill.area].categories[skill.category].push(categoryAsSkill);
        }
      }
    });
    
    return hierarchy;
  };

  // Configuração das colunas do AG-Grid para registros de tempo
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

  // Configuração das colunas do AG-Grid para feedbacks
  const feedbacksColumnDefs: ColDef[] = [
    {
      headerName: 'Data',
      field: 'feedback_date',
      flex: 1,
      minWidth: 120,
      cellRenderer: (params: any) => {
        if (!params.value) return '-';
        try {
          const date = new Date(params.value);
          if (isNaN(date.getTime())) {
            const dateWithTime = new Date(params.value + 'T12:00:00');
            if (isNaN(dateWithTime.getTime())) {
              return params.value;
            }
            return dateWithTime.toLocaleDateString('pt-BR');
          }
          return date.toLocaleDateString('pt-BR');
        } catch (error) {
          return params.value;
        }
      },
    },
    {
      headerName: 'Responsável',
      field: 'owner_user_name',
      flex: 1.5,
      minWidth: 200,
      cellRenderer: (params: any) => params.value || '-',
    },
    {
      headerName: 'Tipo',
      field: 'type',
      flex: 1,
      minWidth: 150,
      cellRenderer: (params: any) => params.value || '-',
    },
    {
      headerName: 'Comentário',
      field: 'public_comment',
      flex: 3,
      minWidth: 300,
      cellRenderer: (params: any) => params.value || '-',
    },
  ];

  const menuPortalTarget = (containerRef.current ?? document.body) as HTMLElement;

  // Componente Select hierárquico para habilidades
  const SkillSelect = () => {
    const [currentLevel, setCurrentLevel] = useState<'areas' | 'categories' | 'skills'>('areas');
    const [selectedArea, setSelectedArea] = useState<string>('');
    const [selectedCategory, setSelectedCategory] = useState<string>('');
    const [selectOptions, setSelectOptions] = useState<Array<{value: string, label: string, type: string}>>([]);
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [inputValue, setInputValue] = useState<string>('');
    
    const userSkillIds = new Set(userSkills.map(us => us.skill_id));
    const skillsHierarchy = organizeSkillsHierarchy(allSkills);
    
    // Função para preparar opções do select baseado no nível atual
    const prepareSelectOptions = () => {
      let options: Array<{value: string, label: string, type: string, hasNext?: boolean}> = [];
      
      if (currentLevel === 'areas') {
        // No nível de áreas, só mostra as áreas disponíveis
        options = Object.keys(skillsHierarchy).map(area => {
          const areaData = skillsHierarchy[area];
          const hasDirectSkills = areaData.directSkills && areaData.directSkills.length > 0;
          const hasCategories = Object.keys(areaData.categories || {}).length > 0;
          const hasNext = hasDirectSkills || hasCategories;
          
          return {
            value: area,
            label: area,
            type: 'area',
            hasNext
          };
        }).filter(option => {
          const areaData = skillsHierarchy[option.value];
          // Verifica se há habilidades disponíveis (não adicionadas pelo usuário)
          const availableDirectSkills = (areaData.directSkills || []).filter((skill: any) => 
            !userSkillIds.has(skill.id)
          );
          const availableInCategories = Object.values(areaData.categories || {}).flat().filter((skill: any) => 
            !userSkillIds.has(skill.id)
          );
          return availableDirectSkills.length > 0 || availableInCategories.length > 0;
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
          const availableSkills = areaData.directSkills.filter((skill: any) => !userSkillIds.has(skill.id));
          if (availableSkills.length > 0) {
            options.push({
              value: '__direct__',
              label: `${selectedArea} (habilidades diretas)`,
              type: 'category',
              hasNext: true
            });
          }
        }
        
        // Categorias
        Object.keys(areaData.categories || {}).forEach(category => {
          const categorySkills = areaData.categories[category].filter((skill: any) => !userSkillIds.has(skill.id));
          if (categorySkills.length > 0) {
            options.push({
              value: category,
              label: category,
              type: 'category',
              hasNext: true
            });
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
          if (selectedCategory === '__direct__') {
            skills = areaData.directSkills || [];
          } else {
            skills = areaData.categories[selectedCategory] || [];
          }
        } else {
          skills = areaData.directSkills || [];
        }
        
        // Adiciona habilidades disponíveis (apenas válidas)
        skills
          .filter(skill => {
            return !userSkillIds.has(skill.id) && 
                   (skill.skill && skill.skill.trim() !== '') || 
                   (skill.area && skill.area.trim() !== '');
          })
          .forEach(skill => {
            options.push({
              value: skill.id,
              label: skill.skill || skill.area || 'Habilidade indefinida',
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
          setSelectedCategory('');
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
          // Encontra a habilidade da área e adiciona
          const areaSkill = areaData.directSkills?.find((skill: any) => skill.area === value);
          if (areaSkill) {
            void addSkillToUser(areaSkill.id);
            setCurrentLevel('areas');
            setSelectedArea('');
            setIsMenuOpen(false);
            setInputValue('');
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
          setSelectedCategory('__direct__');
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
  };
  
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

  // Efeito para resetar refs quando o ID muda (navegação entre funcionários)
  const previousIdRef = useRef<string | undefined>(undefined);
  
  useEffect(() => {
    // Se o ID mudou (não é a primeira montagem), reseta tudo
    if (previousIdRef.current !== undefined && previousIdRef.current !== id) {
      hasLoadedEmployee.current = false;
      hasLoadedEmployeeData.current = false;
      loadedTimeRecordsKeys.current.clear();
      offDaysCache.current.clear();
      timeWorkedCache.current.clear();
    }
    previousIdRef.current = id;
  }, [id]);

  // Efeito para carregar dados iniciais
  useEffect(() => {
    if (!hasLoadedEmployee.current) {
      hasLoadedEmployee.current = true;
      void fetchEmployee();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    if (employee?.user_id && !hasLoadedEmployeeData.current) {
      hasLoadedEmployeeData.current = true;
      
      setIsLoadingTasks(true);
      setIsLoadingHours(true);
      setIsLoadingSkills(true);
      
      // Carrega tarefas
      (async () => {
        try {
          const { data, error } = await supabase
            .from('tasks')
            .select('*')
            .eq('responsible_id', employee.user_id)
            .order('created_at', { ascending: false });

          if (error) {
            console.error('Erro ao carregar tarefas:', error);
            setTasks([]);
            return;
          }
          setTasks(data || []);
        } catch (error) {
          console.error('Erro ao carregar tarefas:', error);
          setTasks([]);
        } finally {
          setIsLoadingTasks(false);
        }
      })();

      // Carrega dados de horas
      (async () => {
        try {
          if (employee.user_id) {
            const hoursData = await getMonthlyHoursData(employee.user_id);
            setMonthlyHours(hoursData);
          }
        } catch (error) {
          console.error('Erro ao carregar dados de horas:', error);
          setMonthlyHours([]);
        } finally {
          setIsLoadingHours(false);
        }
      })();

      void fetchAvailableMonths(employee.user_id);
      void loadUserSkills(employee.user_id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employee?.user_id]);

  useEffect(() => {
    if (employee?.user_id && selectedMonth) {
      const currentKey = `${employee.user_id}-${selectedMonth}`;
      
      if (!loadedTimeRecordsKeys.current.has(currentKey)) {
        loadedTimeRecordsKeys.current.add(currentKey);
        void loadTimeRecords(employee.user_id, selectedMonth);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMonth, employee?.user_id]);

  // Carrega feedbacks quando a aba é selecionada
  useEffect(() => {
    if (employee?.user_id && activeTab === 'feedbacks' && feedbacks.length === 0) {
      void loadFeedbacks(employee.user_id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, employee?.user_id]);

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Carregando dados do funcionário...</p>
        </div>
      </div>
    );
  }

  if (!employee) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 dark:text-gray-400 mb-4">Funcionário não encontrado</p>
          <button
            onClick={() => navigate('/employees')}
            className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors"
          >
            Voltar para Funcionários
          </button>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="h-full flex flex-col overflow-hidden">
      {/* Header com botão voltar - fora do card */}
      <div className="flex items-center gap-4 mb-2 mt-0">
        <button
          onClick={() => navigate('/employees')}
          className="flex items-center gap-2 px-4 py-0 text-gray-600 dark:text-gray-300 hover:text-orange-500 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          Voltar
        </button>
        {/* <div className="h-6 border-l border-gray-300 dark:border-gray-600"></div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          Detalhes do Funcionário
        </h1> */}
      </div>

      {/* Card com informações básicas do funcionário */}
      <div className="card p-2 pl-6 mb-4">
        {/* Informações básicas do funcionário */}
        <div className="flex  items-start gap-6">
          <div className="flex-shrink-0">
            {employee.avatar_large_url ? (
              <img
                src={employee.avatar_large_url}
                alt={employee.name}
                className="w-24 h-24 rounded-full object-cover border-4 border-white shadow-lg"
              />
            ) : (
              <div className="w-24 h-24 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-white text-2xl font-bold shadow-lg">
                {getInitials(employee.name)}
              </div>
            )}
          </div>
          
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {employee.name}
              </h2>
              <div className="flex items-center gap-3">
                {/* Indicador de status */}
                <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                  employee.is_active 
                    ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400' 
                    : 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
                }`}>
                  {employee.is_active ? 'Ativo' : 'Inativo'}
                </span>
                
                {/* Botão toggle Status */}
                <button
                  onClick={toggleEmployeeStatus}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 ${
                    employee.is_active 
                      ? 'bg-green-500 hover:bg-green-600' 
                      : 'bg-gray-300 hover:bg-gray-400 dark:bg-gray-600 dark:hover:bg-gray-500'
                  }`}
                  title={employee.is_active ? 'Desativar funcionário' : 'Ativar funcionário'}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      employee.is_active ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <p className="text-lg text-gray-600 dark:text-gray-300">
                {employee.position || 'Cargo não informado'}
              </p>
              <div className="flex items-center gap-3">
                {/* Indicador de Log Hours */}
                <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                  employee.log_hours 
                    ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400' 
                    : 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
                }`}>
                  {employee.log_hours ? 'Lança Horas' : 'Não Lança Horas'}
                </span>

                {/* Botão toggle Log Hours */}
                <button
                  onClick={toggleEmployeeLogHours}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 ${
                    employee.log_hours 
                      ? 'bg-green-500 hover:bg-green-600' 
                      : 'bg-gray-300 hover:bg-gray-400 dark:bg-gray-600 dark:hover:bg-gray-500'
                  }`}
                  title={employee.log_hours ? 'Desativar Horas' : 'Ativar Horas'}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      employee.log_hours ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-1 text-sm">
              <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                <Mail className="w-4 h-4" />
                <span>{employee.email}</span>
              </div>
              {employee.phone && (
                <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                  <Calendar className="w-4 h-4" />
                  <span>
                    {employee.birthday ? new Date(employee.birthday).toLocaleDateString('pt-BR') : '–'} 
                    {calculateAge(employee.birthday)}
                  </span>
                </div>
              )}
              {employee.birthday && (
                <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                  <Phone className="w-4 h-4" />
                  <span>{formatPhoneNumber(employee.phone)}</span>
                </div>
                                  
              )}
              {employee.in_company_since && (
                <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                  <Clock className="w-4 h-4" />
                  <span>
                    Desde {new Date(employee.in_company_since).toLocaleDateString('pt-BR')} 
                    {calculateTenure(employee.in_company_since)}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Conteúdo principal */}
      <div className="flex-1 overflow-hidden flex flex-col lg:flex-row gap-6">
          {/* Lado esquerdo - Habilidades e Horas */}
          <div className="w-full lg:w-80 space-y-6">
            {/* Card de Habilidades */}
            <div className="card p-6">
              <CardHeader icon={<Award className="w-5 h-5" />} title="Habilidades">
                <button
                  onClick={() => setShowSkillSelector(!showSkillSelector)}
                  className="text-orange-500 hover:text-orange-600 transition-colors"
                  title="Adicionar habilidade"
                >
                  <Plus className="w-5 h-5" />
                </button>
              </CardHeader>

              {showSkillSelector && (
                <div className="mb-4">
                  <SkillSelect />
                </div>
              )}

              <div className="space-y-2">
                {isLoadingSkills ? (
                  <div className="flex justify-center py-4">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-orange-500"></div>
                  </div>
                ) : userSkills.length === 0 ? (
                  <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
                    Nenhuma habilidade cadastrada
                  </p>
                ) : (
                  userSkills.map((userSkill) => (
                    <div
                      key={userSkill.id}
                      className="flex items-center justify-between bg-gray-50 dark:bg-gray-800 px-3 py-2 rounded-lg"
                    >
                      <span className="text-sm text-gray-700 dark:text-gray-300">
                        {formatSkillName(userSkill.skill)}
                      </span>
                      <button
                        onClick={() => removeSkillFromUser(userSkill.id)}
                        className="text-red-500 hover:text-red-600 transition-colors ml-2"
                        title="Remover habilidade"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Horas lançadas */}
            <div className="card p-6">
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
          </div>

          {/* Lado direito - Card com Abas Internas */}
          <div className="flex-1 overflow-hidden flex flex-col">
            <div className="card flex-1 flex flex-col overflow-hidden">
              {/* Abas internas seguindo o padrão do ProjectDetail */}
              <div className="border-b border-gray-200 dark:border-gray-700">
                <nav className="flex -mb-px px-6">
                  <button
                    onClick={() => setActiveTab('tarefas')}
                    className={`whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm mr-8 ${
                      activeTab === 'tarefas'
                        ? 'border-primary-500 text-primary-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    Tarefas Atribuídas
                  </button>
                  <button
                    onClick={() => setActiveTab('registro')}
                    className={`whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm mr-8 ${
                      activeTab === 'registro'
                        ? 'border-primary-500 text-primary-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    Registro de Tempo
                  </button>
                  <button
                    onClick={() => setActiveTab('feedbacks')}
                    className={`whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm ${
                      activeTab === 'feedbacks'
                        ? 'border-primary-500 text-primary-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    Feedbacks
                  </button>
                </nav>
              </div>

              {/* Conteúdo das abas */}
              {activeTab === 'tarefas' && (
                <div className="flex-1 overflow-hidden flex flex-col p-6 pt-0 min-h-0">
                  {/* Filtros */}
                  <div className="px-0 pt-4 pb-2 flex flex-col md:flex-row gap-2 items-stretch flex-shrink-0">
                    <div className="w-full md:w-100">
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

                    <div className="w-full md:w-100">
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

                    <div className="w-full md:w-80">
                      <Select
                        options={statusOptions}
                        value={statusOptions.find(opt => opt.value === selectedStatusFilter)}
                        placeholder="Status"
                        className="text-sm w-full"
                        classNamePrefix="react-select"
                        onChange={(opt: any) => setSelectedStatusFilter(opt?.value || 'abertos')}
                        menuPortalTarget={menuPortalTarget}
                        menuPosition="fixed"
                        styles={customSelectStyles}
                      />
                    </div>
                  </div>

                  <div className="flex flex-col flex-1 min-h-0">
                    <div className="px-0 pt-1 pb-3 flex items-center gap-6 text-sm text-gray-600 flex-shrink-0">
                      <span>Total: <span className="font-bold text-gray-800 dark:text-gray-200">{summaryCounts.total} Tarefas</span></span>
                      <span className="border-l border-gray-300 dark:border-gray-600 pl-6">Ativos: <span className="font-bold text-green-600 dark:text-green-400">{summaryCounts.active}</span></span>
                      <span>Entregue: <span className="font-bold text-blue-600 dark:text-blue-400">{summaryCounts.delivered}</span></span>
                      <span className="border-l border-gray-300 dark:border-gray-600 pl-6">Filtrados: <span className="font-bold text-orange-600 dark:text-orange-400">{filteredTasks.length}</span></span>
                    </div>

                    {/* Lista de tarefas */}
                    <div className="flex-1 overflow-y-auto min-h-0">
                    {isLoadingTasks ? (
                      <div className="flex justify-center items-center h-24">
                        <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
                        <span className="ml-2 text-gray-500">Carregando tarefas...</span>
                      </div>
                    ) : filteredTasks.length === 0 ? (
                      <p className="text-center text-gray-500 text-sm py-8">Nenhuma tarefa em andamento.</p>
                    ) : (
                      <div className="space-y-3 pb-4">
                        {filteredTasks.map((tarefa) => (
                          <div key={tarefa.id} className={`border rounded-lg p-3 transition-colors ${getTaskCardColor(tarefa)}`}>
                            <div className="flex justify-between items-start mb-2">
                              <div className="flex-1">
                                <div className="flex items-center justify-between">
                                  <p className="text-xs text-gray-400 dark:text-gray-500">#{tarefa.task_id}</p>
                                  <button
                                    onClick={() => window.open(`https://secure.runrun.it/pt-BR/tasks/${tarefa.task_id}`, '_blank')}
                                    className="text-gray-400 hover:text-gray-600 transition-colors ml-2"
                                    title="Abrir no RunRun.it"
                                  >
                                    <ExternalLink className="w-4 h-4" />
                                  </button>
                                </div>
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
                        ))}
                      </div>
                    )}
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'registro' && (
                <div className="flex-1 overflow-hidden flex flex-col p-6 pt-0">
                  {/* Filtros */}
                  <div className="px-0 pt-4 pb-2 flex flex-col md:flex-row gap-2 items-stretch">
                    {availableMonths.length > 0 && (
                      <div className="w-full md:w-40">
                        <Select
                          options={availableMonths.map(month => ({ value: month, label: month }))}
                          value={availableMonths.map(month => ({ value: month, label: month })).find(opt => opt.value === selectedMonth)}
                          placeholder="Selecionar mês"
                          className="text-sm w-full"
                          classNamePrefix="react-select"
                          onChange={(opt: any) => setSelectedMonth(opt?.value || '')}
                          menuPortalTarget={menuPortalTarget}
                          menuPosition="fixed"
                          styles={customSelectStyles}
                        />
                      </div>
                    )}
                  </div>

                  <div className="ag-theme-alpine w-full flex-1">
                    {isLoadingRecords ? (
                      <div className="flex justify-center py-8">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
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
                        animateRows={true}
                        className="w-full"
                        rowHeight={40}
                        headerHeight={40}
                        noRowsOverlayComponent={() => (
                          <div className="flex flex-col items-center justify-center h-full text-gray-500 dark:text-gray-400">
                            <Clock className="w-12 h-12 mb-2 opacity-50" />
                            <p>Nenhum registro de tempo encontrado</p>
                            {selectedMonth && (
                              <p className="text-sm">para o mês de {selectedMonth}</p>
                            )}
                          </div>
                        )}
                      />
                    )}
                  </div>
                </div>
              )}

              {activeTab === 'feedbacks' && (
                <div className="flex-1 overflow-hidden flex flex-col p-6 pt-4">
                  {/* Botão Novo Feedback */}
                  <div className="flex justify-end mb-4">
                    <button
                      onClick={() => setIsFeedbackModalOpen(true)}
                      className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-orange-500 rounded-lg hover:bg-orange-600 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                      Novo Feedback
                    </button>
                  </div>

                  <div className="ag-theme-alpine w-full flex-1">
                    {isLoadingFeedbacks ? (
                      <div className="flex justify-center py-8">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
                      </div>
                    ) : (
                      <AgGridReact
                        columnDefs={feedbacksColumnDefs}
                        rowData={feedbacks}
                        defaultColDef={{
                          sortable: true,
                          filter: true,
                          resizable: true,
                        }}
                        animateRows={true}
                        className="w-full"
                        rowHeight={40}
                        headerHeight={40}
                        overlayNoRowsTemplate={
                          '<span class="text-gray-500 dark:text-gray-400">Nenhum feedback encontrado para este consultor.</span>'
                        }
                      />
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
      </div>

      {/* Modal de Novo Feedback */}
      <FeedbackModal
        isOpen={isFeedbackModalOpen}
        onClose={() => setIsFeedbackModalOpen(false)}
        onSuccess={() => {
          // Recarrega a lista de feedbacks após sucesso
          if (employee?.user_id) {
            void loadFeedbacks(employee.user_id);
          }
        }}
        preSelectedUser={employee?.user_id ? { user_id: employee.user_id as string, name: employee.name } : null}
      />
    </div>
  );
};

export default EmployeeDetail;
