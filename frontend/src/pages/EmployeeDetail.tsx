import { useState, useMemo, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { AgGridReact } from 'ag-grid-react'
import { ColDef } from 'ag-grid-community'
import { ArrowLeft, Phone, Mail, Calendar, Clock, Award, Plus, X, Loader2, ExternalLink, MessageSquare, Maximize, Edit, Trash2, ChevronDown, ChevronRight } from 'lucide-react'
import Select, { StylesConfig } from 'react-select'
import { RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Legend, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts'
import { DbUser, DbTask, SubcategoryEvaluationData, EvaluationMetadata } from '../types'
import { supabase } from '../lib/supabaseClient'
import FeedbackModal from '../components/FeedbackModal'
import EmployeeEvaluationModal from '../components/EmployeeEvaluationModal'
import EvaluationsOverallRating from '../components/EvaluationsOverallRating'
import PDIModal from '../components/PDIModal'
import HtmlCellRenderer from '../components/HtmlCellRenderer'
import '../styles/main.css'

const EmployeeDetail = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [employee, setEmployee] = useState<DbUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [tasks, setTasks] = useState<DbTask[]>([])
  const [isLoadingTasks, setIsLoadingTasks] = useState(true)
  const [activeTab, setActiveTab] = useState<'tarefas' | 'registro' | 'feedbacks' | 'avaliacoes' | 'pdi' | 'acompanhamento'>('tarefas')
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
  const [feedbackToEdit, setFeedbackToEdit] = useState<any | null>(null)
  const [feedbackToDelete, setFeedbackToDelete] = useState<any | null>(null)
  const [isDeleteFeedbackModalOpen, setIsDeleteFeedbackModalOpen] = useState(false)
  const [isFullScreen, setIsFullScreen] = useState(false);
  
  const [evaluationData, setEvaluationData] = useState<SubcategoryEvaluationData[]>([])
  const [evaluationMetadata, setEvaluationMetadata] = useState<EvaluationMetadata[]>([])
  const [isLoadingEvaluations, setIsLoadingEvaluations] = useState(false)
  
  const [evaluations, setEvaluations] = useState<any[]>([]);
  const [isLoadingEvaluationsList, setIsLoadingEvaluationsList] = useState(false);
  const [isEvaluationModalOpen, setIsEvaluationModalOpen] = useState(false);

  const [pdis, setPDIs] = useState<any[]>([]);
  const [isLoadingPDIs, setIsLoadingPDIs] = useState(false);
  const [isPDIModalOpen, setIsPDIModalOpen] = useState(false);
  const [editingPdiId, setEditingPdiId] = useState<number | null>(null);
  const [pdiToDelete, setPdiToDelete] = useState<any | null>(null);
  const [isDeletePdiModalOpen, setIsDeletePdiModalOpen] = useState(false);
  
  const [evaluationToDelete, setEvaluationToDelete] = useState<any | null>(null);
  const [isDeleteEvaluationModalOpen, setIsDeleteEvaluationModalOpen] = useState(false);
  
  const [userSkills, setUserSkills] = useState<UserSkill[]>([])
  const [isLoadingSkills, setIsLoadingSkills] = useState(true)
  const [allSkills, setAllSkills] = useState<Skill[]>([])
  const [isLoadingAllSkills, setIsLoadingAllSkills] = useState(false)
  const [showSkillSelector, setShowSkillSelector] = useState(false)
  
  // Estado para histórico de horas por cliente
  const [clientTimeHistory, setClientTimeHistory] = useState<Array<{
    client_name: string;
    total_hours: number;
    total_seconds: number;
    projects: Array<{
      project_name: string;
      total_hours: number;
      total_seconds: number;
    }>;
  }>>([])
  const [isLoadingClientHistory, setIsLoadingClientHistory] = useState(false)
  const [expandedClients, setExpandedClients] = useState<Set<string>>(new Set())

  const containerRef = useRef<HTMLDivElement>(null)
  const rightPanelRef = useRef<HTMLDivElement>(null);
  
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
      .lt('time_worked_date', endDate)
      .order('time_worked_date', { ascending: true });

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

  const feedbackByTypeData = useMemo(() => {
    if (!feedbacks || feedbacks.length === 0) return [];
    
    const counts = feedbacks.reduce((acc, feedback) => {
      const type = feedback.type || 'Não categorizado';
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    return Object.entries(counts).map(([name, count]) => ({ name, count }));
  }, [feedbacks]);

  const loadTimeRecords = async (userId: string, monthYear: string) => {
    setIsLoadingRecords(true);
    try {
      const [month, year] = monthYear.split('/');
      const startDate = `${year}-${month.padStart(2, '0')}-01`;
      const endDate = `${year}-${(Number(month) + 1).toString().padStart(2, '0')}-01`;

      const { data, error } = await supabase
        .from('time_worked')
        .select('*, task_title, project_name')
        .eq('user_id', userId)
        .gte('time_worked_date', startDate)
        .lt('time_worked_date', endDate)
        .gt('time', 0)
        .order('time_worked_date', { ascending: true });

      if (error) {
        console.error('Erro ao carregar registros:', error);
        setTimeRecords([]);
        return;
      }
      
      // Filtra novamente no frontend para garantir que apenas registros do mês correto sejam exibidos
      const filteredData = (data || []).filter(record => {
        const recordDate = record.time_worked_date.split('T')[0]; // Extrai apenas YYYY-MM-DD
        return recordDate >= startDate && recordDate < endDate;
      });
      
      setTimeRecords(filteredData);
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

      // Buscar PDIs vinculados aos feedbacks
      const feedbackIds = (data || []).map(f => f.id);
      let pdiMap = new Map();
      if (feedbackIds.length > 0) {
        const { data: pdiData, error: pdiError } = await supabase
          .from('pdi')
          .select('feedback_id')
          .in('feedback_id', feedbackIds)
          .not('feedback_id', 'is', null);
        
        if (!pdiError && pdiData) {
          pdiData.forEach((pdi) => {
            pdiMap.set(pdi.feedback_id, true);
          });
        }
      }

      const formattedData = (data || []).map(f => ({
        ...f,
        has_pdi: pdiMap.has(f.id)
      }));
      setFeedbacks(formattedData);
    } catch (error) {
      console.error('Erro ao carregar feedbacks:', error);
      setFeedbacks([]);
    } finally {
      setIsLoadingFeedbacks(false);
    }
  };

  // Função para carregar dados das avaliações do usuário
  const loadEvaluationData = async (userId: string) => {
    setIsLoadingEvaluations(true);
    try {
      // Busca dados das respostas do usuário com join na tabela evaluations
      const { data, error } = await supabase
        .from('evaluations_questions_reply')
        .select(`
          evaluation_id,
          subcategory,
          score,
          weight,
          evaluations!inner (
            id,
            name,
            updated_at
          )
        `)
        .eq('user_id', userId)
        .eq('reply_type', 'Escala (1-5)')
        .order('evaluations(updated_at)', { ascending: true });

      if (error) {
        console.error('Erro ao carregar dados das avaliações:', error);
        setEvaluationData([]);
        setEvaluationMetadata([]);
        return;
      }

      // Busca dados de TODOS os usuários para calcular média do time
      const { data: teamData, error: teamError } = await supabase
        .from('evaluations_questions_reply')
        .select('subcategory, score, weight')
        .eq('reply_type', 'Escala (1-5)');

      if (teamError) {
        console.error('Erro ao carregar dados do time:', teamError);
      }

      if (!data || data.length === 0) {
        setEvaluationData([]);
        setEvaluationMetadata([]);
        return;
      }

      // Agrupa por evaluation_id e subcategoria
      const evaluationMap = new Map<number, Map<string, { totalScore: number; totalWeight: number }>>();
      const evaluationsInfo = new Map<number, { name: string; updated_at: string }>();

      (data || []).forEach((item: any) => {
        if (!item.subcategory || item.score === null || item.weight === null || !item.evaluation_id) return;

        const evalId = item.evaluation_id;
        
        // Armazena informações da avaliação
        if (item.evaluations && !evaluationsInfo.has(evalId)) {
          evaluationsInfo.set(evalId, {
            name: item.evaluations.name,
            updated_at: item.evaluations.updated_at
          });
        }

        // Agrupa scores por avaliação e subcategoria
        if (!evaluationMap.has(evalId)) {
          evaluationMap.set(evalId, new Map());
        }

        const subcategoryMap = evaluationMap.get(evalId)!;
        const existing = subcategoryMap.get(item.subcategory) || { totalScore: 0, totalWeight: 0 };
        subcategoryMap.set(item.subcategory, {
          totalScore: existing.totalScore + (item.score * item.weight),
          totalWeight: existing.totalWeight + item.weight
        });
      });

      // Cria metadata das avaliações ordenadas por data
      const metadata: EvaluationMetadata[] = Array.from(evaluationsInfo.entries())
        .map(([id, info]) => ({
          id,
          name: info.name,
          updated_at: info.updated_at
        }))
        .sort((a, b) => new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime());

      // Calcula média do time por subcategoria
      const teamAverageMap = new Map<string, { totalScore: number; totalWeight: number }>();
      
      if (teamData && teamData.length > 0) {
        teamData.forEach((item: any) => {
          if (!item.subcategory || item.score === null || item.weight === null) return;

          const existing = teamAverageMap.get(item.subcategory) || { totalScore: 0, totalWeight: 0 };
          teamAverageMap.set(item.subcategory, {
            totalScore: existing.totalScore + (item.score * item.weight),
            totalWeight: existing.totalWeight + item.weight
          });
        });
      }

      // Coleta todas as subcategorias únicas
      const allSubcategories = new Set<string>();
      evaluationMap.forEach(subcategoryMap => {
        subcategoryMap.forEach((_, subcategory) => {
          allSubcategories.add(subcategory);
        });
      });
      // Adiciona subcategorias da média do time
      teamAverageMap.forEach((_, subcategory) => {
        allSubcategories.add(subcategory);
      });

      // Cria dados para o gráfico
      const chartData: SubcategoryEvaluationData[] = Array.from(allSubcategories).map(subcategory => {
        const dataPoint: SubcategoryEvaluationData = { subcategory };

        // Para cada avaliação, calcula a média ponderada para essa subcategoria
        metadata.forEach((evalMeta, index) => {
          const subcategoryMap = evaluationMap.get(evalMeta.id);
          if (subcategoryMap && subcategoryMap.has(subcategory)) {
            const values = subcategoryMap.get(subcategory)!;
            const avgScore = values.totalWeight > 0 ? values.totalScore / values.totalWeight : 0;
            
            // Usa uma chave simples para o dataKey para evitar problemas com o Recharts
            const dataKey = `evaluation_${index + 1}`;
            dataPoint[dataKey] = Number(avgScore.toFixed(2));
          }
        });

        // Adiciona média do time
        if (teamAverageMap.has(subcategory)) {
          const teamValues = teamAverageMap.get(subcategory)!;
          const teamAvgScore = teamValues.totalWeight > 0 ? teamValues.totalScore / teamValues.totalWeight : 0;
          dataPoint['Media do Time'] = Number(teamAvgScore.toFixed(2));
        }

        return dataPoint;
      });

      setEvaluationData(chartData);
      setEvaluationMetadata(metadata);
    } catch (error) {
      console.error('Erro ao carregar dados das avaliações:', error);
      setEvaluationData([]);
      setEvaluationMetadata([]);
    } finally {
      setIsLoadingEvaluations(false);
    }
  };

  // Função para carregar avaliações do usuário
  const loadEvaluations = async (userId: string) => {
    setIsLoadingEvaluationsList(true);
    try {
        const { data, error } = await supabase
            .from('evaluations')
            .select(`
              *,
              evaluations_questions_reply (
                score,
                weight
              )
            `)
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Erro ao carregar avaliações:', error);
            setEvaluations([]);
            return;
        }

        const statusIds = (data || []).map(e => e.status_id).filter(Boolean);
        let statusMap = new Map();
        if (statusIds.length > 0) {
            const { data: statuses, error: statusError } = await supabase
                .from('domains')
                .select('id, value')
                .in('id', statusIds)
                .eq('type', 'evaluation_status');
            if (!statusError) {
                statusMap = new Map(statuses.map(s => [s.id, s.value]));
            }
        }

        // Buscar PDIs vinculados às avaliações
        const evaluationIds = (data || []).map(e => e.id);
        let pdiMap = new Map();
        if (evaluationIds.length > 0) {
          const { data: pdiData, error: pdiError } = await supabase
            .from('pdi')
            .select('evaluation_id')
            .in('evaluation_id', evaluationIds)
            .not('evaluation_id', 'is', null);
          
          if (!pdiError && pdiData) {
            pdiData.forEach((pdi) => {
              pdiMap.set(pdi.evaluation_id, true);
            });
          }
        }

        const formattedData = (data || []).map(e => {
            // Calcular média ponderada dos scores
            let averageScore = null;
            const replies = e.evaluations_questions_reply || [];
            
            if (replies.length > 0) {
              const validReplies = replies.filter((r: any) => r.score !== null && r.weight !== null);
              
              if (validReplies.length > 0) {
                const totalWeightedScore = validReplies.reduce(
                  (sum: number, r: any) => sum + (r.score * r.weight),
                  0
                );
                const totalWeight = validReplies.reduce(
                  (sum: number, r: any) => sum + r.weight,
                  0
                );
                
                averageScore = totalWeight > 0 ? totalWeightedScore / totalWeight : null;
              }
            }

            return {
                ...e,
                status_name: statusMap.get(e.status_id) || 'N/A',
                has_pdi: pdiMap.has(e.id),
                average_score: averageScore
            };
        });
        setEvaluations(formattedData);
    } catch (error) {
        console.error('Erro ao carregar avaliações:', error);
        setEvaluations([]);
    } finally {
        setIsLoadingEvaluationsList(false);
    }
  };

  // Função para carregar histórico de horas por cliente
  const loadClientTimeHistory = async (userId: string) => {
    setIsLoadingClientHistory(true);
    try {
      const { data, error } = await supabase
        .from('time_worked')
        .select('client_name, project_name, time')
        .eq('user_id', userId);

      if (error) {
        console.error('Erro ao carregar histórico de horas por cliente:', error);
        setClientTimeHistory([]);
        return;
      }

      // Agrupa por client_name e depois por project_name
      const clientMap = new Map<string, { 
        total_seconds: number; 
        projects: Map<string, number> 
      }>();
      
      (data || []).forEach(record => {
        const clientName = record.client_name || 'Sem cliente';
        const projectName = record.project_name || 'Sem projeto';
        const time = record.time || 0;
        
        if (!clientMap.has(clientName)) {
          clientMap.set(clientName, { 
            total_seconds: 0, 
            projects: new Map() 
          });
        }
        
        const client = clientMap.get(clientName)!;
        client.total_seconds += time;
        
        const currentProjectTime = client.projects.get(projectName) || 0;
        client.projects.set(projectName, currentProjectTime + time);
      });

      // Converte para array e calcula horas
      const history = Array.from(clientMap.entries()).map(([client_name, data]) => {
        // Converte os projetos para array e ordena por horas
        const projects = Array.from(data.projects.entries())
          .map(([project_name, total_seconds]) => ({
            project_name,
            total_hours: total_seconds / 3600,
            total_seconds
          }))
          .sort((a, b) => b.total_hours - a.total_hours);

        return {
          client_name,
          total_hours: data.total_seconds / 3600,
          total_seconds: data.total_seconds,
          projects
        };
      });

      // Ordena por total de horas (decrescente)
      history.sort((a, b) => b.total_hours - a.total_hours);

      setClientTimeHistory(history);
    } catch (error) {
      console.error('Erro ao carregar histórico de horas por cliente:', error);
      setClientTimeHistory([]);
    } finally {
      setIsLoadingClientHistory(false);
    }
  };

  // Função para carregar PDIs do usuário
  const loadPDIs = async (userId: string) => {
      setIsLoadingPDIs(true);
      try {
          const { data: pdiData, error: pdiError } = await supabase
              .from('pdi')
              .select('*')
              .eq('user_id', userId)
              .order('created_at', { ascending: false });

          if (pdiError) {
              console.error('Erro ao carregar PDIs:', pdiError);
              setPDIs([]);
              setIsLoadingPDIs(false);
              return;
          }

          if (!pdiData || pdiData.length === 0) {
              setPDIs([]);
              setIsLoadingPDIs(false);
              return;
          }

          // Buscar todos os status da tabela domains
          const { data: statusData, error: statusError } = await supabase
              .from('domains')
              .select('id, value')
              .eq('type', 'pdi_status');

          if (statusError) {
              console.error('Erro ao buscar status:', statusError);
          }

          // Criar um mapa de status
          const statusMap = new Map();
          if (statusData) {
              statusData.forEach((status) => {
                  statusMap.set(status.id, status);
              });
          }

          // Buscar a quantidade de competências de cada PDI
          const pdiIds = pdiData.map(pdi => pdi.id);
          let competencyCounts = new Map();
          
          if (pdiIds.length > 0) {
              const { data: itemsData, error: itemsError } = await supabase
                  .from('pdi_items')
                  .select('pdi_id')
                  .in('pdi_id', pdiIds);
              
              if (!itemsError && itemsData) {
                  // Contar quantos itens cada PDI tem
                  itemsData.forEach((item) => {
                      const count = competencyCounts.get(item.pdi_id) || 0;
                      competencyCounts.set(item.pdi_id, count + 1);
                  });
              }
          }

          // Fazer o join manual entre pdi e domains, e adicionar a quantidade de competências
          const formattedData = pdiData.map(p => ({
              ...p,
              status: p.status_id ? statusMap.get(p.status_id) : null,
              competency_count: competencyCounts.get(p.id) || 0
          }));
          
          setPDIs(formattedData);
      } catch (error) {
          console.error('Erro ao carregar PDIs:', error);
          setPDIs([]);
      } finally {
          setIsLoadingPDIs(false);
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

  // Função para alternar expansão de cliente
  const toggleClientExpansion = (clientName: string) => {
    setExpandedClients(prev => {
      const newSet = new Set(prev);
      if (newSet.has(clientName)) {
        newSet.delete(clientName);
      } else {
        newSet.add(clientName);
      }
      return newSet;
    });
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

  // Funções para gerenciar Feedbacks
  const handleEditFeedback = (feedbackId: number) => {
    const feedback = feedbacks.find(f => f.id === feedbackId);
    if (feedback) {
      setFeedbackToEdit(feedback);
      setIsFeedbackModalOpen(true);
    }
  };

  const handleDeleteFeedback = (feedbackId: number) => {
    const feedback = feedbacks.find(f => f.id === feedbackId);
    if (feedback) {
      setFeedbackToDelete(feedback);
      setIsDeleteFeedbackModalOpen(true);
    }
  };

  const handleConfirmDeleteFeedback = async () => {
    if (!feedbackToDelete) return;

    try {
      const { error } = await supabase
        .from('feedbacks')
        .delete()
        .eq('id', feedbackToDelete.id);

      if (error) {
        console.error('Erro ao deletar feedback:', error);
        alert('Erro ao deletar feedback. Tente novamente.');
        return;
      }

      // Remove o feedback da lista local
      setFeedbacks(prev => prev.filter(f => f.id !== feedbackToDelete.id));
      
      // Fecha modal e limpa estado
      setIsDeleteFeedbackModalOpen(false);
      setFeedbackToDelete(null);
    } catch (err) {
      console.error('Erro ao deletar feedback:', err);
      alert('Erro ao deletar feedback. Tente novamente.');
    }
  };

  // Funções para gerenciar PDIs
  const handleEditPdi = (pdiId: number) => {
    setEditingPdiId(pdiId);
    setIsPDIModalOpen(true);
  };

  const handleDeletePdi = (pdiId: number) => {
    const pdi = pdis.find(p => p.id === pdiId);
    if (pdi) {
      setPdiToDelete(pdi);
      setIsDeletePdiModalOpen(true);
    }
  };

  const handleConfirmDeletePdi = async () => {
    if (!pdiToDelete) return;

    try {
      // 1. Deletar os itens na tabela pdi_items
      const { error: itemsError } = await supabase
        .from('pdi_items')
        .delete()
        .eq('pdi_id', pdiToDelete.id);

      if (itemsError) {
        console.error('Erro ao deletar itens do PDI:', itemsError);
        alert('Erro ao deletar itens do PDI. Tente novamente.');
        return;
      }

      // 2. Deletar o PDI principal
      const { error } = await supabase
        .from('pdi')
        .delete()
        .eq('id', pdiToDelete.id);

      if (error) {
        console.error('Erro ao deletar PDI:', error);
        alert('Erro ao deletar PDI. Tente novamente.');
        return;
      }

      // Remove o PDI da lista local
      setPDIs(prev => prev.filter(p => p.id !== pdiToDelete.id));
      
      // Fecha modal e limpa estado
      setIsDeletePdiModalOpen(false);
      setPdiToDelete(null);
    } catch (err) {
      console.error('Erro ao deletar PDI:', err);
      alert('Erro ao deletar PDI. Tente novamente.');
    }
  };

  // Funções para gerenciar Avaliações
  const handleDeleteEvaluation = (evaluationId: number) => {
    const evaluation = evaluations.find(e => e.id === evaluationId);
    if (evaluation) {
      setEvaluationToDelete(evaluation);
      setIsDeleteEvaluationModalOpen(true);
    }
  };

  const handleConfirmDeleteEvaluation = async () => {
    if (!evaluationToDelete) return;

    try {
      // 1. Deletar as respostas da avaliação
      const { error: repliesError } = await supabase
        .from('evaluations_questions_reply')
        .delete()
        .eq('evaluation_id', evaluationToDelete.id);

      if (repliesError) {
        console.error('Erro ao deletar respostas da avaliação:', repliesError);
        alert('Erro ao deletar respostas da avaliação. Tente novamente.');
        return;
      }

      // 2. Deletar os vínculos com projetos
      const { error: projectsError } = await supabase
        .from('evaluations_projects')
        .delete()
        .eq('evaluation_id', evaluationToDelete.id);

      if (projectsError) {
        console.error('Erro ao deletar vínculos de projetos:', projectsError);
        alert('Erro ao deletar vínculos de projetos. Tente novamente.');
        return;
      }

      // 3. Deletar a avaliação principal
      const { error } = await supabase
        .from('evaluations')
        .delete()
        .eq('id', evaluationToDelete.id);

      if (error) {
        console.error('Erro ao deletar avaliação:', error);
        alert('Erro ao deletar avaliação. Tente novamente.');
        return;
      }

      // Remove a avaliação da lista local
      setEvaluations(prev => prev.filter(e => e.id !== evaluationToDelete.id));
      
      // Fecha modal e limpa estado
      setIsDeleteEvaluationModalOpen(false);
      setEvaluationToDelete(null);
    } catch (err) {
      console.error('Erro ao deletar avaliação:', err);
      alert('Erro ao deletar avaliação. Tente novamente.');
    }
  };

  // Configuração das colunas do AG-Grid para registros de tempo
  const timeRecordsColumnDefs: ColDef[] = [
    {
      headerName: 'Data',
      field: 'time_worked_date',
      flex: 1,
      minWidth: 120,
      cellRenderer: (params: any) => {
        if (!params.value) return '-';
        // Extrai apenas a data (YYYY-MM-DD) para evitar problemas com timezone
        const dateStr = params.value.split('T')[0];
        const [year, month, day] = dateStr.split('-');
        return `${day}/${month}/${year}`;
      },
    },
    
    {
      headerName: 'Projeto',
      field: 'project_name',
      flex: 2,
      minWidth: 200,
      cellRenderer: (params: any) => params.value || '-',
    },
    {
      headerName: 'Tipo',
      field: 'type_name',
      flex: 1,
      minWidth: 150,
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
      cellRenderer: (params: any) => {
        const typeValue = params.value;
        
        let colorClass = 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300';
        let typeText = 'Não definido';
        
        if (typeValue) {
          typeText = typeValue;
          
          // Definir cores baseadas no tipo de feedback
          const typeLower = typeValue.toLowerCase();
          if (typeLower.includes('positivo') || typeLower.includes('elogio')) {
            colorClass = 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300';
          } else if (typeLower.includes('orientação') || typeLower.includes('orientacao')) {
            colorClass = 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300';
          } else if (typeLower.includes('melhoria') || typeLower.includes('desenvolvimento')) {
            colorClass = 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300';
          } else if (typeLower.includes('atenção') || typeLower.includes('atencao') || typeLower.includes('crítico') || typeLower.includes('critico')) {
            colorClass = 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300';
          } else if (typeLower.includes('reconhecimento')) {
            colorClass = 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300';
          }
        }
        
        return (
          <span className={`px-2 py-1 rounded-full text-xs font-medium ${colorClass}`}>
            {typeText}
          </span>
        );
      },
    },
    {
      headerName: 'PDI',
      field: 'has_pdi',
      flex: 0.7,
      minWidth: 100,
      cellRenderer: (params: any) => {
        const hasPDI = params.data.has_pdi || false;
        
        let text = 'Não';
        let colorClass = 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400';
        
        if (hasPDI) {
          text = 'Sim';
          colorClass = 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300';
        }
        
        return (
          <div className="flex items-center justify-left h-full">
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${colorClass}`}>
              {text}
            </span>
          </div>
        );
      },
    },
    {
      headerName: 'Comentário',
      field: 'public_comment',
      flex: 3,
      minWidth: 300,
      cellRenderer: HtmlCellRenderer,
    },
    {
      headerName: 'Ações',
      field: 'id',
      width: 100,
      cellRenderer: (params: any) => {
        return (
          <div className="flex items-center justify-center h-full gap-2">
            <button
              onClick={() => handleEditFeedback(params.value)}
              className="text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 p-1 rounded hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
              title="Editar feedback"
            >
              <Edit className="w-4 h-4" />
            </button>
            
            <button
              onClick={() => handleDeleteFeedback(params.value)}
              className="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
              title="Deletar feedback"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        );
      },
      sortable: false,
      filter: false,
    },
  ];

  // Configuração das colunas do AG-Grid para avaliações
  const evaluationsColumnDefs: ColDef[] = [
    
    { 
      headerName: 'Avaliação', 
      field: 'name', 
      flex: 2, 
      minWidth: 200 
    },
    { 
      headerName: 'Avaliador', 
      field: 'owner_name', 
      flex: 1.5, 
      minWidth: 150 
    },
    {
      headerName: 'Período',
      flex: 1.5,
      minWidth: 180,
      valueGetter: (params: any) => {
        if (!params.data.period_start || !params.data.period_end) return '-';
        const start = new Date(params.data.period_start).toLocaleDateString('pt-BR');
        const end = new Date(params.data.period_end).toLocaleDateString('pt-BR');
        return `${start} - ${end}`;
      }
    },
    {
      headerName: 'PDI',
      field: 'has_pdi',
      flex: 0.7,
      minWidth: 100,
      cellRenderer: (params: any) => {
        const hasPDI = params.data.has_pdi || false;
        
        let text = 'Não';
        let colorClass = 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400';
        
        if (hasPDI) {
          text = 'Sim';
          colorClass = 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300';
        }
        
        return (
          <div className="flex items-center justify-left h-full">
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${colorClass}`}>
              {text}
            </span>
          </div>
        );
      },
    },
    {
      headerName: 'Nota Geral',
      field: 'average_score',
      flex: 1,
      minWidth: 120,
      cellRenderer: (params: any) => <EvaluationsOverallRating score={params.value} />,
    },
    { 
      headerName: 'Status', 
      field: 'status_name', 
      flex: 1, 
      minWidth: 120,
      cellRenderer: (params: any) => {
        const statusValue = params.value;
        
        let colorClass = 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300';
        let statusText = 'Não definido';
        
        if (statusValue) {
          statusText = statusValue;
          
          // Definir cores baseadas no status
          const statusLower = statusValue.toLowerCase();
          if (statusLower.includes('aberto') || statusLower.includes('pendente')) {
            colorClass = 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300';
          } else if (statusLower.includes('em andamento') || statusLower.includes('progresso')) {
            colorClass = 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300';
          } else if (statusLower.includes('concluído') || statusLower.includes('finalizado') || statusLower.includes('fechado')) {
            colorClass = 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300';
          } else if (statusLower.includes('cancelado') || statusLower.includes('rejeitado')) {
            colorClass = 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300';
          }
        }
        
        return (
          <span className={`px-2 py-1 rounded-full text-xs font-medium ${colorClass}`}>
            {statusText}
          </span>
        );
      },
    },
    {
      headerName: 'Ações',
      field: 'id',
      width: 100,
      cellRenderer: (params: any) => {
        return (
          <div className="flex items-center justify-center h-full gap-2">
            <button
              onClick={() => navigate(`/employee-evaluations/${params.value}`)}
              className="text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 p-1 rounded hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
              title="Ver avaliação"
            >
              <ExternalLink className="w-4 h-4" />
            </button>
            
            <button
              onClick={() => handleDeleteEvaluation(params.value)}
              className="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
              title="Deletar avaliação"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        );
      },
      sortable: false,
      filter: false,
    },
  ];

  // Configuração das colunas do AG-Grid para PDIs
  const pdisColumnDefs: ColDef[] = [
    {
      headerName: 'Responsável',
      field: 'owner_name',
      flex: 1.5,
      minWidth: 180,
    },
    {
      headerName: 'Competências',
      field: 'competency_count',
      flex: 0.8,
      minWidth: 120,
      cellRenderer: (params: any) => {
        const count = params.value || 0;
        return (
          <div className="flex items-center justify-left h-full">
            <span className="px-2 py-1 rounded-full text-xs font-medium bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300">
              {count} {count === 1 ? 'competência' : 'competências'}
            </span>
          </div>
        );
      },
    },
    {
      headerName: 'Vínculo',
      field: 'link_type',
      flex: 0.8,
      minWidth: 110,
      cellRenderer: (params: any) => {
        const hasEvaluation = params.data.evaluation_id;
        const hasFeedback = params.data.feedback_id;
        
        let text = 'Não';
        let colorClass = 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400';
        
        if (hasEvaluation) {
          text = 'Avaliação';
          colorClass = 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300';
        } else if (hasFeedback) {
          text = 'Feedback';
          colorClass = 'bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300';
        }
        
        return (
          <div className="flex items-center justify-left h-full">
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${colorClass}`}>
              {text}
            </span>
          </div>
        );
      },
    },
    {
      headerName: 'Status',
      field: 'status',
      flex: 1,
      minWidth: 130,
      cellRenderer: (params: any) => {
        const status = params.value;
        const statusValue = status?.value;
        
        let colorClass = 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300';
        let statusText = 'Não definido';
        
        if (statusValue) {
          statusText = statusValue;
          
          // Definir cores baseadas no status
          const statusLower = statusValue.toLowerCase();
          if (statusLower.includes('aberto') || statusLower.includes('pendente')) {
            colorClass = 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300';
          } else if (statusLower.includes('em andamento') || statusLower.includes('progresso')) {
            colorClass = 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300';
          } else if (statusLower.includes('concluído') || statusLower.includes('finalizado')) {
            colorClass = 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300';
          } else if (statusLower.includes('cancelado') || statusLower.includes('rejeitado')) {
            colorClass = 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300';
          }
        }
        
        return (
          <span className={`px-2 py-1 rounded-full text-xs font-medium ${colorClass}`}>
            {statusText}
          </span>
        );
      },
    },
    {
      headerName: 'Ações',
      field: 'id',
      width: 100,
      cellRenderer: (params: any) => {
        const isClosed = params.data.is_closed;
        
        return (
          <div className="flex items-center justify-center h-full gap-2">
            <button
              onClick={() => handleEditPdi(params.value)}
              className="text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 p-1 rounded hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
              title={isClosed ? "Visualizar PDI" : "Editar PDI"}
            >
              <Edit className="w-4 h-4" />
            </button>
            
            {/* Botão deletar só aparece se o PDI não estiver encerrado */}
            {!isClosed && (
              <button
                onClick={() => handleDeletePdi(params.value)}
                className="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                title="Deletar PDI"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        );
      },
      sortable: false,
      filter: false,
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

  // Listener para mudanças no estado de full screen
  useEffect(() => {
    const handleFullScreenChange = () => {
      setIsFullScreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullScreenChange);
    
    return () => {
      document.removeEventListener('fullscreenchange', handleFullScreenChange);
    };
  }, []);

  const toggleFullScreen = async () => {
    try {
      if (!document.fullscreenElement) {
        if (rightPanelRef.current) {
          await rightPanelRef.current.requestFullscreen();
          setIsFullScreen(true);
        }
      } else {
        await document.exitFullscreen();
        setIsFullScreen(false);
      }
    } catch (error) {
      console.error('Erro ao alternar full screen:', error);
      setIsFullScreen(!isFullScreen);
    }
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

  // Carrega dados das abas quando selecionadas
  useEffect(() => {
    if (!employee?.user_id) return;

    switch (activeTab) {
      case 'feedbacks':
        if (feedbacks.length === 0) void loadFeedbacks(employee.user_id);
        break;
      case 'avaliacoes':
        if (evaluations.length === 0) void loadEvaluations(employee.user_id);
        break;
      case 'pdi':
        if (pdis.length === 0) void loadPDIs(employee.user_id);
        break;
      case 'acompanhamento':
        if (evaluationData.length === 0) void loadEvaluationData(employee.user_id);
        if (feedbacks.length === 0) void loadFeedbacks(employee.user_id);
        if (clientTimeHistory.length === 0) void loadClientTimeHistory(employee.user_id);
        break;
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
      {!isFullScreen && (
        <>
          {/* Header com botão voltar - fora do card */}
          <button
            onClick={() => navigate('/employees')}
            className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors pb-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar
          </button>

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
        </>
      )}

      {/* Conteúdo principal */}
      <div className="flex-1 overflow-hidden flex flex-col lg:flex-row gap-6">
          {!isFullScreen && (
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
          )}

          {/* Lado direito - Card com Abas Internas */}
          <div className="flex-1 overflow-hidden flex flex-col">
            <div ref={rightPanelRef} className={`card flex-1 flex flex-col overflow-hidden ${isFullScreen ? 'h-full' : ''}`}>
              {isFullScreen && (
                <div className="flex items-center justify-center p-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
                  <h1 className="text-xl font-bold text-gray-800 dark:text-gray-200 text-center">
                    {employee.name}
                  </h1>
                </div>
              )}
              {/* Abas internas seguindo o padrão do ProjectDetail */}
              <div className="border-b border-gray-200 dark:border-gray-700">
                <nav className="flex justify-between items-center -mb-px px-6">
                  <div className="flex">
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
                      Registro de Horas
                    </button>
                    <button
                      onClick={() => setActiveTab('feedbacks')}
                      className={`whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm mr-8 ${
                        activeTab === 'feedbacks'
                          ? 'border-primary-500 text-primary-600'
                          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                      }`}
                    >
                      Feedbacks
                    </button>
                    <button
                      onClick={() => setActiveTab('avaliacoes')}
                      className={`whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm mr-8 ${
                        activeTab === 'avaliacoes'
                          ? 'border-primary-500 text-primary-600'
                          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                      }`}
                    >
                      Avaliações
                    </button>
                    <button
                      onClick={() => setActiveTab('pdi')}
                      className={`whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm mr-8 ${
                        activeTab === 'pdi'
                          ? 'border-primary-500 text-primary-600'
                          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                      }`}
                    >
                      PDI
                    </button>
                    <button
                      onClick={() => setActiveTab('acompanhamento')}
                      className={`whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm ${
                        activeTab === 'acompanhamento'
                          ? 'border-primary-500 text-primary-600'
                          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                      }`}
                    >
                      Acompanhamento
                    </button>
                  </div>
                  <button
                    onClick={toggleFullScreen}
                    className="flex items-center gap-2 px-3 py-1 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    title={isFullScreen ? "Sair do modo tela cheia" : "Modo tela cheia"}
                  >
                    <Maximize className="w-4 h-4" />
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

              {activeTab === 'avaliacoes' && (
                <div className="flex-1 overflow-hidden flex flex-col p-6 pt-4">
                  <div className="flex justify-end mb-4">
                    <button
                      onClick={() => setIsEvaluationModalOpen(true)}
                      className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-orange-500 rounded-lg hover:bg-orange-600 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                      Nova Avaliação
                    </button>
                  </div>
                  <div className="ag-theme-alpine w-full flex-1">
                    {isLoadingEvaluationsList ? (
                      <div className="flex justify-center py-8">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
                      </div>
                    ) : (
                      <AgGridReact
                        columnDefs={evaluationsColumnDefs}
                        rowData={evaluations}
                        defaultColDef={{ sortable: true, filter: true, resizable: true }}
                        animateRows={true}
                        className="w-full"
                        rowHeight={40}
                        headerHeight={40}
                        overlayNoRowsTemplate={'<span class="text-gray-500 dark:text-gray-400">Nenhuma avaliação encontrada.</span>'}
                      />
                    )}
                  </div>
                </div>
              )}

              {activeTab === 'pdi' && (
                <div className="flex-1 overflow-hidden flex flex-col p-6 pt-4">
                  <div className="flex justify-end mb-4">
                    <button
                      onClick={() => setIsPDIModalOpen(true)}
                      className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-orange-500 rounded-lg hover:bg-orange-600 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                      Novo PDI
                    </button>
                  </div>
                  <div className="ag-theme-alpine w-full flex-1">
                    {isLoadingPDIs ? (
                      <div className="flex justify-center py-8">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
                      </div>
                    ) : (
                      <AgGridReact
                        columnDefs={pdisColumnDefs}
                        rowData={pdis}
                        defaultColDef={{ sortable: true, filter: true, resizable: true }}
                        animateRows={true}
                        className="w-full"
                        rowHeight={40}
                        headerHeight={40}
                        overlayNoRowsTemplate={'<span class="text-gray-500 dark:text-gray-400">Nenhum PDI encontrado.</span>'}
                      />
                    )}
                  </div>
                </div>
              )}

              {activeTab === 'acompanhamento' && (
                <div className="flex-1 overflow-auto p-6 pt-2">
                  {/* Grid de Cards */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    
 {/* Card 4: Histórico de Horas por Cliente */}
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md border border-gray-200 dark:border-gray-700 p-6 pt-2">
                      <div className="mb-4">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1 flex items-center gap-2">
                          <Clock className="w-5 h-5 text-purple-500" />
                          Histórico de Horas Lançadas
                        </h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          Total de horas lançadas por cliente e projeto
                        </p>
                      </div>
                      
                      {isLoadingClientHistory ? (
                        <div className="flex justify-center items-center h-80">
                          <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
                        </div>
                      ) : clientTimeHistory.length === 0 ? (
                        <div className="flex justify-center items-center h-80">
                          <div className="text-center text-gray-400 dark:text-gray-500">
                            <Clock className="w-16 h-16 mx-auto mb-3 opacity-30" />
                            <p className="text-sm">Nenhum lançamento de horas encontrado</p>
                          </div>
                        </div>
                      ) : (
                        <div className="h-80 overflow-y-auto">
                          {/* Lista de clientes com projetos */}
                          <div className="space-y-2">
                            {clientTimeHistory.map((client, index) => {
                              const isExpanded = expandedClients.has(client.client_name);
                              
                              return (
                                <div key={index}>
                                  {/* Linha do cliente */}
                                  <div 
                                    className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors cursor-pointer"
                                    onClick={() => toggleClientExpansion(client.client_name)}
                                  >
                                    <div className="flex items-center gap-2 flex-1 min-w-0">
                                      <button className="flex-shrink-0 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200">
                                        {isExpanded ? (
                                          <ChevronDown className="w-5 h-5" />
                                        ) : (
                                          <ChevronRight className="w-5 h-5" />
                                        )}
                                      </button>
                                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                                        {client.client_name}
                                      </p>
                                      <span className="text-xs text-gray-500 dark:text-gray-400 flex-shrink-0">
                                        ({client.projects.length} {client.projects.length === 1 ? 'projeto' : 'projetos'})
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-4 ml-4">
                                      <div className="text-right">
                                        <p className="text-lg font-semibold text-purple-600 dark:text-purple-400">
                                          {client.total_hours.toFixed(1)}h
                                        </p>
                                        
                                      </div>
                                    </div>
                                  </div>

                                  {/* Projetos (exibidos quando expandido) */}
                                  {isExpanded && (
                                    <div className="ml-8 mt-1 space-y-1">
                                      {client.projects.map((project, projectIndex) => (
                                        <div 
                                          key={projectIndex}
                                          className="flex items-center justify-between p-2 bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700"
                                        >
                                          <p className="text-xs text-gray-700 dark:text-gray-300 truncate flex-1 mr-4">
                                            {project.project_name}
                                          </p>
                                          <div className="text-right flex-shrink-0">
                                            <p className="text-sm font-medium text-purple-500 dark:text-purple-400">
                                              {project.total_hours.toFixed(1)}h
                                            </p>
                                           
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                          
                          {/* Total geral */}
                          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                            <div className="flex items-center justify-between p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                                Total Geral
                              </p>
                              <div className="text-right">
                                <p className="text-xl font-bold text-purple-600 dark:text-purple-400">
                                  {clientTimeHistory.reduce((sum, c) => sum + c.total_hours, 0).toFixed(1)}h
                                </p>
                               
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                    
                    
                    {/* Card 1: Gráfico Radar - Evolução por Subcategoria */}
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md border border-gray-200 dark:border-gray-700 p-6 pt-2">
                      <div className="mb-1">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1 flex items-center gap-2">
                          <Award className="w-5 h-5 text-orange-500" />
                          Avaliação do Desempenho
                        </h3>
                      
                        {evaluationMetadata.length > 0 && (
                          <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                            {evaluationMetadata.length} {evaluationMetadata.length === 1 ? 'avaliação encontrada' : 'avaliações encontradas'}
                            {' • Linha tracejada preta = média do time'}
                          </p>
                        )}
                      </div>

                      {isLoadingEvaluations ? (
                        <div className="flex justify-center items-center h-96">
                          <div className="text-center">
                            <Loader2 className="w-8 h-8 text-orange-500 animate-spin mx-auto mb-2" />
                            <p className="text-gray-600 dark:text-gray-400">Carregando dados das avaliações...</p>
                          </div>
                        </div>
                      ) : evaluationData.length === 0 ? (
                        <div className="flex justify-center items-center h-96">
                          <div className="text-center text-gray-500 dark:text-gray-400">
                            <Award className="w-12 h-12 mx-auto mb-2 opacity-50" />
                            <p>Nenhuma avaliação encontrada para este consultor</p>
                          </div>
                        </div>
                      ) : (
                        <div className="h-96">
                          <ResponsiveContainer width="100%" height="100%">
                            <RadarChart data={evaluationData}>
                              <PolarGrid stroke="#d1d5db" />
                              <PolarAngleAxis 
                                dataKey="subcategory" 
                                tick={{ fill: '#6b7280', fontSize: 11 }}
                                tickLine={{ stroke: '#9ca3af' }}
                              />
                              <PolarRadiusAxis 
                                angle={90} 
                                domain={[0, 5]} 
                                tick={{ fill: '#6b7280', fontSize: 11 }}
                                tickCount={6}
                              />
                              {/* Renderiza uma linha Radar para cada avaliação */}
                              {evaluationMetadata.map((evalMeta, index) => {
                                const date = new Date(evalMeta.updated_at);
                                const formattedDate = date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
                                const displayName = `Avaliação ${index + 1} (${formattedDate})`;
                                const dataKey = `evaluation_${index + 1}`;
                                
                                // Cores diferentes para cada avaliação
                                const colors = [
                                  { stroke: '#f97316', fill: '' }, // Laranja
                                  { stroke: '#3b82f6', fill: '' }, // Azul
                                  { stroke: '#10b981', fill: '' }, // Verde
                                  { stroke: '#8b5cf6', fill: '' }, // Roxo
                                  { stroke: '#ef4444', fill: '' }, // Vermelho
                                  { stroke: '#f59e0b', fill: '' }, // Amarelo
                                  { stroke: '#06b6d4', fill: '' }, // Cyan
                                  { stroke: '#ec4899', fill: '' }, // Rosa
                                ];
                                
                                const color = colors[index % colors.length];
                                
                                return (
                                  <Radar
                                    key={evalMeta.id}
                                    name={displayName}
                                    dataKey={dataKey}
                                    stroke={color.stroke}
                                    fill={color.fill}
                                    fillOpacity={0}
                                    strokeWidth={3}
                                    
                                  />
                                );
                              })}
                              <Radar
                                name="Média do Time"
                                dataKey="Media do Time"
                                stroke="#2b2b2b"
                                fill="#000000"
                                fillOpacity={0}
                                strokeWidth={3}
                                strokeDasharray="5 5"
                                dot={{ fill: '#2b2b2b', r: 1 }}
                              />
                              
                              <Legend 
                                wrapperStyle={{ paddingTop: '5px' }}
                                iconType="circle"
                              />
                            </RadarChart>
                          </ResponsiveContainer>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Segunda linha de cards (opcional) */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
                      {/* Card 2: Gráfico de Feedbacks por Tipo */}
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md border border-gray-200 dark:border-gray-700 p-6 pt-2">
                      <div className="mb-4">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1 flex items-center gap-2">
                          <MessageSquare className="w-5 h-5 text-blue-500" />
                          Feedbacks por Tipo
                        </h3>
                        <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                          Distribuição dos feedbacks recebidos.
                        </p>
                      </div>
                      {isLoadingFeedbacks ? (
                        <div className="flex justify-center items-center h-96">
                            <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
                        </div>
                      ) : feedbackByTypeData.length === 0 ? (
                        <div className="flex justify-center items-center h-96">
                          <div className="text-center text-gray-400 dark:text-gray-500">
                            <MessageSquare className="w-16 h-16 mx-auto mb-3 opacity-30" />
                            <p className="text-sm">Nenhum feedback para exibir</p>
                          </div>
                        </div>
                      ) : (
                        <div className="h-96">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={feedbackByTypeData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#d1d5db" />
                              <XAxis dataKey="name" tick={{ fill: '#6b7280', fontSize: 12 }} />
                              <YAxis allowDecimals={false} tick={{ fill: '#6b7280', fontSize: 12 }} />
                              <Tooltip
                                cursor={{ fill: 'rgba(249, 115, 22, 0.1)' }}
                                contentStyle={{
                                  backgroundColor: '#fff',
                                  border: '1px solid #e5e7eb',
                                  borderRadius: '0.5rem',
                                  fontSize: '12px'
                                }}
                              />
                              <Bar dataKey="count" name="Quantidade" fill="#3b82f6" />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      )}
                    </div>

                    {/* Card 3: Placeholder */}
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md border border-gray-200 dark:border-gray-700 p-6">
                      <div className="mb-4">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2 flex items-center gap-2">
                          <Award className="w-5 h-5 text-green-500" />
                          Análise Complementar
                        </h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          Espaço para métricas adicionais
                        </p>
                      </div>
                      <div className="flex justify-center items-center h-80">
                        <div className="text-center text-gray-400 dark:text-gray-500">
                          <Award className="w-16 h-16 mx-auto mb-3 opacity-30" />
                          <p className="text-sm">Aguardando implementação</p>
                        </div>
                      </div>
                    </div>

                    
                  </div>
                </div>
              )}
            </div>
          </div>
      </div>

      {/* Modal de Novo Feedback */}
      <FeedbackModal
        isOpen={isFeedbackModalOpen}
        onClose={() => {
          setIsFeedbackModalOpen(false);
          setFeedbackToEdit(null);
        }}
        onSuccess={() => {
          // Recarrega a lista de feedbacks após sucesso
          if (employee?.user_id) {
            void loadFeedbacks(employee.user_id);
          }
        }}
        preSelectedUser={employee?.user_id ? { user_id: employee.user_id as string, name: employee.name } : null}
        feedbackToEdit={feedbackToEdit}
      />

      {/* Modal de Confirmação de Exclusão de Feedback */}
      {isDeleteFeedbackModalOpen && feedbackToDelete && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl max-w-md w-full">
            {/* Header */}
            <div className="p-5 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-t-2xl flex items-center gap-3">
              <Trash2 className="w-6 h-6" />
              <h2 className="text-xl font-bold">Confirmar Exclusão</h2>
            </div>

            {/* Content */}
            <div className="p-6">
              <div className="text-center">
                <div className="mx-auto flex items-center justify-center w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/20 mb-4">
                  <Trash2 className="w-6 h-6 text-red-600 dark:text-red-400" />
                </div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
                  Deletar Feedback
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                  Tem certeza que deseja deletar este feedback?
                </p>
                <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg mb-4">
                  <p className="font-semibold text-gray-900 dark:text-gray-100 mb-2">
                    Tipo: {feedbackToDelete.type}
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                    Data: {new Date(feedbackToDelete.feedback_date).toLocaleDateString('pt-BR')}
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Responsável: {feedbackToDelete.owner_user_name}
                  </p>
                </div>
                <p className="text-sm text-red-600 dark:text-red-400 font-medium">
                  ⚠️ Esta ação não pode ser desfeita
                </p>
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 rounded-b-2xl flex justify-end gap-3">
              <button 
                onClick={() => {
                  setIsDeleteFeedbackModalOpen(false);
                  setFeedbackToDelete(null);
                }}
                className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 font-semibold bg-gray-200 dark:bg-gray-700 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
              >
                Cancelar
              </button>
              <button 
                onClick={handleConfirmDeleteFeedback}
                className="px-4 py-2 text-sm text-white font-semibold bg-red-500 rounded-lg hover:bg-red-600 transition-colors flex items-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                Deletar Feedback
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Nova Avaliação */}
      <EmployeeEvaluationModal
        isOpen={isEvaluationModalOpen}
        onClose={() => setIsEvaluationModalOpen(false)}
        onSuccess={() => {
          if (employee?.user_id) {
            void loadEvaluations(employee.user_id);
          }
        }}
        preSelectedUser={employee?.user_id ? { user_id: employee.user_id as string, name: employee.name } : null}
      />

      {/* Modal de Novo PDI */}
      <PDIModal
        isOpen={isPDIModalOpen}
        onClose={() => {
          setIsPDIModalOpen(false);
          setEditingPdiId(null);
        }}
        onSuccess={() => {
          if (employee?.user_id) {
            void loadPDIs(employee.user_id);
          }
        }}
        pdiId={editingPdiId}
        prefilledConsultant={employee?.user_id ? { value: employee.user_id as string, label: employee.name } : null}
      />

      {/* Modal de Confirmação de Exclusão de PDI */}
      {isDeletePdiModalOpen && pdiToDelete && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl max-w-md w-full">
            {/* Header */}
            <div className="p-5 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-t-2xl flex items-center gap-3">
              <Trash2 className="w-6 h-6" />
              <h2 className="text-xl font-bold">Confirmar Exclusão</h2>
            </div>

            {/* Content */}
            <div className="p-6">
              <div className="text-center">
                <div className="mx-auto flex items-center justify-center w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/20 mb-4">
                  <Trash2 className="w-6 h-6 text-red-600 dark:text-red-400" />
                </div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
                  Deletar PDI
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                  Tem certeza que deseja deletar este PDI?
                </p>
                <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg mb-4">
                  <p className="font-semibold text-gray-900 dark:text-gray-100 mb-2">
                    Consultor: {pdiToDelete.user_name}
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Responsável: {pdiToDelete.owner_name}
                  </p>
                </div>
                <p className="text-sm text-red-600 dark:text-red-400 font-medium">
                  ⚠️ Esta ação não pode ser desfeita
                </p>
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 rounded-b-2xl flex justify-end gap-3">
              <button 
                onClick={() => {
                  setIsDeletePdiModalOpen(false);
                  setPdiToDelete(null);
                }}
                className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 font-semibold bg-gray-200 dark:bg-gray-700 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
              >
                Cancelar
              </button>
              <button 
                onClick={handleConfirmDeletePdi}
                className="px-4 py-2 text-sm text-white font-semibold bg-red-500 rounded-lg hover:bg-red-600 transition-colors flex items-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                Deletar PDI
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Confirmação de Exclusão de Avaliação */}
      {isDeleteEvaluationModalOpen && evaluationToDelete && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl max-w-md w-full">
            {/* Header */}
            <div className="p-5 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-t-2xl flex items-center gap-3">
              <Trash2 className="w-6 h-6" />
              <h2 className="text-xl font-bold">Confirmar Exclusão</h2>
            </div>

            {/* Content */}
            <div className="p-6">
              <div className="text-center">
                <div className="mx-auto flex items-center justify-center w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/20 mb-4">
                  <Trash2 className="w-6 h-6 text-red-600 dark:text-red-400" />
                </div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
                  Deletar Avaliação
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                  Tem certeza que deseja deletar esta avaliação?
                </p>
                <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg mb-4">
                  <p className="font-semibold text-gray-900 dark:text-gray-100 mb-2">
                    {evaluationToDelete.name}
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Avaliador: {evaluationToDelete.owner_name}
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Status: {evaluationToDelete.status_name}
                  </p>
                </div>
                <p className="text-sm text-red-600 dark:text-red-400 font-medium">
                  ⚠️ Esta ação não pode ser desfeita e removerá todas as respostas associadas
                </p>
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 rounded-b-2xl flex justify-end gap-3">
              <button 
                onClick={() => {
                  setIsDeleteEvaluationModalOpen(false);
                  setEvaluationToDelete(null);
                }}
                className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 font-semibold bg-gray-200 dark:bg-gray-700 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
              >
                Cancelar
              </button>
              <button 
                onClick={handleConfirmDeleteEvaluation}
                className="px-4 py-2 text-sm text-white font-semibold bg-red-500 rounded-lg hover:bg-red-600 transition-colors flex items-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                Deletar Avaliação
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EmployeeDetail;
