import { useState, useMemo, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabaseClient';
import Select from 'react-select';
import { ChevronDown, ChevronRight, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import '../styles/main.css';

interface TimeEntryData {
  user_id: string;
  user_name: string;
  expected_hours: number;
  worked_hours: number;
  expected_hours_until_yesterday?: number;
}

interface DailyTimeEntry {
  date: string;
  dayOfWeek: string;
  expected_hours: number;
  worked_hours: number;
  isInsufficient: boolean;
  isMoresufficient: boolean;
}

interface ConsultantOption {
  value: string;
  label: string;
}

const TimeEntries = () => {
  const [timeEntries, setTimeEntries] = useState<TimeEntryData[]>([]);
  const [consultants, setConsultants] = useState<ConsultantOption[]>([]);
  const [allUsers, setAllUsers] = useState<Array<{ user_id: string; name: string; is_active: boolean }>>([]);
  const [isLoading, setIsLoading] = useState(false);
  
  // useRef para controlar se já foi carregado (não causa re-render)
  const hasLoadedInitially = useRef(false);
  
  // Filtros
  const [periodType, setPeriodType] = useState<'current_month' | 'previous_month' | 'current_year' | 'custom'>('current_month');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedConsultants, setSelectedConsultants] = useState<ConsultantOption[]>([]);
  const [statusFilter, setStatusFilter] = useState<'active' | 'inactive' | 'all'>('active');
  
  // Controle de expansão de consultores
  const [expandedConsultants, setExpandedConsultants] = useState<Set<string>>(new Set());
  const [dailyTimeEntries, setDailyTimeEntries] = useState<Map<string, DailyTimeEntry[]>>(new Map());
  
  // Controle de ordenação
  const [sortColumn, setSortColumn] = useState<'user_name' | 'expected_hours' | 'worked_hours' | 'percentage' | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // Função para calcular o intervalo de datas baseado no tipo de período
  const getDateRange = () => {
    const now = new Date();
    let start: Date, end: Date;

    switch (periodType) {
      case 'current_month':
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        break;
      case 'previous_month':
        start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        end = new Date(now.getFullYear(), now.getMonth(), 0);
        break;
      case 'current_year':
        start = new Date(now.getFullYear(), 0, 1);
        end = new Date(now.getFullYear(), 11, 31);
        break;
      case 'custom':
        if (startDate && endDate) {
          start = new Date(startDate);
          end = new Date(endDate);
        } else {
          start = new Date(now.getFullYear(), now.getMonth(), 1);
          end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        }
        break;
      default:
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    }

    return {
      start: start.toISOString().split('T')[0],
      end: end.toISOString().split('T')[0]
    };
  };

  // Função para calcular dias úteis (excluindo sábados e domingos)
  const getBusinessDays = (startDate: string, endDate: string): number => {
    const start = new Date(`${startDate}T00:00:00`);
    const end = new Date(`${endDate}T23:59:59`);
    let count = 0;
    const current = new Date(start);

    while (current <= end) {
      const dayOfWeek = current.getDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6) { // 0 = Domingo, 6 = Sábado
        count++;
      }
      current.setDate(current.getDate() + 1);
    }

    return count;
  };

  // Função para obter lista de dias úteis no período
  const getBusinessDaysList = (startDate: string, endDate: string, holidays: string[]): Date[] => {
    const start = new Date(`${startDate}T00:00:00`);
    const end = new Date(`${endDate}T23:59:59`);
    const businessDays: Date[] = [];
    const current = new Date(start);

    while (current <= end) {
      const dayOfWeek = current.getDay();
      const dateStr = current.toISOString().split('T')[0];
      
      // Verificar se não é fim de semana e não é feriado
      if (dayOfWeek !== 0 && dayOfWeek !== 6 && !holidays.includes(dateStr)) {
        businessDays.push(new Date(current));
      }
      current.setDate(current.getDate() + 1);
    }

    return businessDays;
  };

  // State para armazenar todos os dados de time_worked do período
  const [allTimeWorkedData, setAllTimeWorkedData] = useState<Map<string, Map<string, number>>>(new Map());
  
  // Cache para feriados (off_days) para evitar múltiplas chamadas
  const [holidaysCache, setHolidaysCache] = useState<Map<string, string[]>>(new Map());

  // Função para buscar horas trabalhadas por dia de um consultor (agora usa cache)
  const fetchDailyTimeEntries = async (userId: string) => {
    // Verifica se já temos os dados em cache
    if (allTimeWorkedData.has(userId)) {
      return allTimeWorkedData.get(userId)!;
    }
    
    // Se não tiver, retorna um mapa vazio
    return new Map<string, number>();
  };

  // Função para alternar expansão do consultor
  const toggleConsultantExpansion = async (userId: string) => {
    setExpandedConsultants(prev => {
      const newSet = new Set(prev);
      if (newSet.has(userId)) {
        newSet.delete(userId);
      } else {
        newSet.add(userId);
        // Buscar dados diários quando expandir
        loadDailyDataForConsultant(userId);
      }
      return newSet;
    });
  };

  // Função para carregar dados diários de um consultor
  const loadDailyDataForConsultant = async (userId: string) => {
    const dateRange = getDateRange();
    let endDate = dateRange.end;
    
    // Se for mês atual, limitar até ontem
    if (periodType === 'current_month') {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];
      
      if (yesterdayStr < endDate) {
        endDate = yesterdayStr;
      }
    }

    const holidays = await getHolidays(dateRange.start, endDate);
    const businessDays = getBusinessDaysList(dateRange.start, endDate, holidays);
    const hoursMap = await fetchDailyTimeEntries(userId);

    const dailyData: DailyTimeEntry[] = businessDays.map(date => {
      const dateStr = date.toISOString().split('T')[0];
      const workedHours = hoursMap.get(dateStr) || 0;
      const expectedHours = 8; // 8 horas por dia útil
      
      // Dia é insuficiente se não tiver lançamento OU se lançou menos que o esperado
      const isInsufficient = workedHours === 0 || workedHours < expectedHours;

      const isMoresufficient = workedHours === 0 || workedHours > expectedHours;

      const dayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
      const dayOfWeek = dayNames[date.getDay()];

      return {
        date: dateStr,
        dayOfWeek,
        expected_hours: expectedHours,
        worked_hours: workedHours,
        isInsufficient,
        isMoresufficient
      };
    });

    setDailyTimeEntries(prev => {
      const newMap = new Map(prev);
      newMap.set(userId, dailyData);
      return newMap;
    });
  };

  // Função para buscar feriados do Supabase (se existir tabela off_days) com cache
  const getHolidays = async (startDate: string, endDate: string): Promise<string[]> => {
    const cacheKey = `${startDate}|${endDate}`;
    
    // Verificar se já temos no cache
    if (holidaysCache.has(cacheKey)) {
      return holidaysCache.get(cacheKey)!;
    }
    
    try {
      const { data, error } = await supabase
        .from('off_days')
        .select('day')
        .gte('day', startDate)
        .lte('day', endDate);

      if (error) {
        console.error('Erro ao buscar feriados:', error);
        return [];
      }

      const holidays = (data || []).map(d => d.day);
      
      // Armazenar no cache
      setHolidaysCache(prev => {
        const newCache = new Map(prev);
        newCache.set(cacheKey, holidays);
        return newCache;
      });
      
      return holidays;
    } catch (err) {
      console.error('Erro ao buscar feriados:', err);
      return [];
    }
  };

  // Buscar consultores uma única vez (para dropdown e dados)
  const fetchConsultants = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('user_id, name, is_active')
        .eq('log_hours', true)
        .order('name', { ascending: true });

      if (error) throw error;

      // Armazenar todos os usuários
      setAllUsers(data || []);

      const options = (data || []).map(user => ({
        value: user.user_id,
        label: user.name
      }));

      setConsultants(options);
    } catch (err) {
      console.error('Erro ao buscar consultores:', err);
    }
  };

  // Buscar dados de lançamento de horas
  const fetchTimeEntries = async () => {
    // Evitar múltiplas chamadas simultâneas
    if (isLoading) {
      return;
    }
    
    // Aguardar usuários serem carregados
    if (allUsers.length === 0) {
      return;
    }
    
    setIsLoading(true);
    
    try {
      const dateRange = getDateRange();
      
      // **OTIMIZAÇÃO: Usar usuários já carregados ao invés de buscar novamente**
      // Filtrar por status
      let filteredUsers = allUsers;
      
      if (statusFilter === 'active') {
        filteredUsers = filteredUsers.filter(u => u.is_active === true);
      } else if (statusFilter === 'inactive') {
        filteredUsers = filteredUsers.filter(u => u.is_active === false);
      }

      // Filtrar por consultores selecionados
      if (selectedConsultants.length > 0) {
        const selectedIds = selectedConsultants.map(c => c.value);
        filteredUsers = filteredUsers.filter(u => selectedIds.includes(u.user_id));
      }

      // **OTIMIZAÇÃO: Fazer UMA única chamada ao banco buscando todos os time_worked do período**
      const { data: allTimeWorked, error: timeError } = await supabase
        .from('time_worked')
        .select('user_id, time_worked_date, time')
        .gte('time_worked_date', dateRange.start)
        .lte('time_worked_date', dateRange.end);

      if (timeError) {
        console.error('Erro ao buscar horas trabalhadas:', timeError);
      }

      // Agrupar dados por usuário e por data no frontend
      const timeWorkedByUser = new Map<string, Map<string, number>>();
      const totalHoursByUser = new Map<string, number>();

      (allTimeWorked || []).forEach(record => {
        const { user_id, time_worked_date, time } = record;
        const hours = (time || 0) / 3600; // Converter segundos para horas

        // Atualizar total de horas por usuário
        const currentTotal = totalHoursByUser.get(user_id) || 0;
        totalHoursByUser.set(user_id, currentTotal + hours);

        // Atualizar mapa de horas por data por usuário
        if (!timeWorkedByUser.has(user_id)) {
          timeWorkedByUser.set(user_id, new Map<string, number>());
        }
        const userDateMap = timeWorkedByUser.get(user_id)!;
        const currentHours = userDateMap.get(time_worked_date) || 0;
        userDateMap.set(time_worked_date, currentHours + hours);
      });

      // Armazenar dados em cache para uso posterior (quando expandir)
      setAllTimeWorkedData(timeWorkedByUser);

      // **OTIMIZAÇÃO: Buscar feriados UMA única vez para reusar**
      const holidays = await getHolidays(dateRange.start, dateRange.end);
      
      // Calcular horas esperadas usando os feriados já buscados
      const businessDays = getBusinessDays(dateRange.start, dateRange.end);
      const holidaysInBusinessDays = holidays.filter(holiday => {
        const date = new Date(`${holiday}T00:00:00`);
        const dayOfWeek = date.getDay();
        return dayOfWeek !== 0 && dayOfWeek !== 6;
      }).length;
      const workingDays = businessDays - holidaysInBusinessDays;
      const expectedHours = workingDays * 8;

      let expectedHoursUntilYesterday = 0;
      if (periodType === 'current_month') {
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const yesterday = new Date();
        yesterday.setDate(now.getDate() - 1);

        if (now.getDate() > 1) {
          const startDate = startOfMonth.toISOString().split('T')[0];
          const endDate = yesterday.toISOString().split('T')[0];
          
          // Reusar os feriados já buscados (filtrando apenas os que estão no período "até ontem")
          const businessDaysUntilYesterday = getBusinessDays(startDate, endDate);
          const holidaysUntilYesterday = holidays.filter(holiday => {
            const holidayDate = new Date(`${holiday}T00:00:00`);
            const start = new Date(`${startDate}T00:00:00`);
            const end = new Date(`${endDate}T23:59:59`);
            const dayOfWeek = holidayDate.getDay();
            return holidayDate >= start && holidayDate <= end && dayOfWeek !== 0 && dayOfWeek !== 6;
          }).length;
          const workingDaysUntilYesterday = businessDaysUntilYesterday - holidaysUntilYesterday;
          expectedHoursUntilYesterday = workingDaysUntilYesterday * 8;
        }
      }
      
      // Montar dados de entrada usando os totais calculados
      const entriesData: TimeEntryData[] = filteredUsers.map((user) => {
        const totalHours = totalHoursByUser.get(user.user_id) || 0;

        return {
          user_id: user.user_id,
          user_name: user.name,
          expected_hours: expectedHours,
          worked_hours: parseFloat(totalHours.toFixed(2)),
          expected_hours_until_yesterday: expectedHoursUntilYesterday
        };
      });

      setTimeEntries(entriesData);
    } catch (err) {
      console.error('Erro ao buscar dados de lançamento:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // UseEffect inicial - buscar consultores apenas uma vez
  useEffect(() => {
    if (!hasLoadedInitially.current) {
      hasLoadedInitially.current = true;
      fetchConsultants();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // UseEffect unificado para carregar/recarregar dados
  useEffect(() => {
    // Aguardar usuários serem carregados primeiro
    if (allUsers.length === 0) {
      return;
    }
    
    // Evitar chamada se já está carregando
    if (isLoading) {
      return;
    }
    
    // Para período customizado, só buscar quando ambas as datas estiverem preenchidas
    if (periodType === 'custom' && (!startDate || !endDate)) {
      return;
    }
    
    // Limpar caches quando o período mudar
    setHolidaysCache(new Map());
    setAllTimeWorkedData(new Map());
    setDailyTimeEntries(new Map());
    
    fetchTimeEntries();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allUsers, periodType, startDate, endDate, selectedConsultants, statusFilter]);

  // Função para alternar ordenação
  const handleSort = (column: 'user_name' | 'expected_hours' | 'worked_hours' | 'percentage') => {
    if (sortColumn === column) {
      // Se já está ordenando por essa coluna, inverte a direção
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      // Nova coluna, ordena ascendente por padrão
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  // Dados ordenados
  const sortedTimeEntries = useMemo(() => {
    if (!sortColumn) return timeEntries;

    const sorted = [...timeEntries].sort((a, b) => {
      let compareValue = 0;

      switch (sortColumn) {
        case 'user_name':
          compareValue = a.user_name.localeCompare(b.user_name);
          break;
        case 'expected_hours':
          compareValue = a.expected_hours - b.expected_hours;
          break;
        case 'worked_hours':
          compareValue = a.worked_hours - b.worked_hours;
          break;
        case 'percentage':
          const percentageA = a.expected_hours > 0 ? (a.worked_hours / a.expected_hours) * 100 : 0;
          const percentageB = b.expected_hours > 0 ? (b.worked_hours / b.expected_hours) * 100 : 0;
          compareValue = percentageA - percentageB;
          break;
      }

      return sortDirection === 'asc' ? compareValue : -compareValue;
    });

    return sorted;
  }, [timeEntries, sortColumn, sortDirection]);

  // Cálculo dos totais
  const totals = useMemo(() => {
    const totalExpected = timeEntries.reduce((sum, entry) => sum + entry.expected_hours, 0);
    const totalWorked = timeEntries.reduce((sum, entry) => sum + entry.worked_hours, 0);
    const utilizationRate = totalExpected > 0 ? (totalWorked / totalExpected) * 100 : 0;

    return {
      expected: totalExpected.toFixed(2),
      worked: totalWorked.toFixed(2),
      utilization: utilizationRate.toFixed(0)
    };
  }, [timeEntries]);

  return (
    <div className="space-y-2">
     
      {/* Card de Filtros */}
      <div className="card p-6 pt-3 pb-3">
        <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center">
          {/* Filtro de Período */}
          <div className="w-full lg:w-48">
            <select
              value={periodType}
              onChange={(e) => setPeriodType(e.target.value as any)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-orange-500 focus:border-transparent"
            >
              <option value="current_month">Mês Atual</option>
              <option value="previous_month">Mês Anterior</option>
              <option value="current_year">Ano Atual</option>
              <option value="custom">Personalizar</option>
            </select>
          </div>

          {/* Campos de Data Personalizada */}
          {periodType === 'custom' && (
            <>
              <div className="w-full lg:w-48">
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  placeholder="Data Início"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-orange-500 focus:border-transparent"
                />
              </div>
              <div className="w-full lg:w-48">
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  placeholder="Data Fim"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-orange-500 focus:border-transparent"
                />
              </div>
            </>
          )}

          {/* Filtro de Consultor */}
          <div className="flex-1 min-w-0">
            <Select
              isMulti
              value={selectedConsultants}
              onChange={(selected) => setSelectedConsultants(selected as ConsultantOption[])}
              options={consultants}
              placeholder="Filtrar consultor"
              className="react-select-container"
              classNamePrefix="react-select"
            />
          </div>

          {/* Filtro de Status */}
          <div className="w-full lg:w-48">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-orange-500 focus:border-transparent"
            >
              <option value="active">Ativo</option>
              <option value="inactive">Inativo</option>
              <option value="all">Todos</option>
            </select>
          </div>
        </div>

        {/* Resumo dos Totais */}
        <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-blue-50 dark:bg-blue-900/20 p-2 rounded-lg">
              <p className="text-xs text-center text-gray-600 dark:text-gray-400">Total Hrs Esperadas</p>
              <p className="text-lg font-bold text-center text-gray-900 dark:text-gray-100">{totals.expected}h</p>
            </div>
            <div className="bg-green-50 dark:bg-green-900/20 p-2 rounded-lg">
              <p className="text-xs text-center text-gray-600 dark:text-gray-400">Total Hrs Lançadas</p>
              <p className="text-lg font-bold text-center text-gray-900 dark:text-gray-100">{totals.worked}h</p>
            </div>
            <div className="bg-orange-50 dark:bg-orange-900/20 p-2 rounded-lg">
              <p className="text-xs text-center text-gray-600 dark:text-gray-400">Taxa de Lançamento</p>
              <p className="text-lg font-bold text-center text-gray-900 dark:text-gray-100">{totals.utilization}%</p>
            </div>
          </div>
        </div>
      </div>

      {/* Card com Tabela */}
      <div className="card p-6 pt-3">
        <div className="overflow-hidden">
          {/* Cabeçalho da tabela */}
          <div className="grid grid-cols-4 gap-4 pb-3 border-b border-gray-200 dark:border-gray-600 mb-3">
            <button
              onClick={() => handleSort('user_name')}
              className="flex items-center gap-2 text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide hover:text-orange-500 dark:hover:text-orange-400 transition-colors"
            >
              Consultor
              {sortColumn === 'user_name' && (
                sortDirection === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
              )}
              {sortColumn !== 'user_name' && <ArrowUpDown className="w-3 h-3 opacity-30" />}
            </button>
            <button
              onClick={() => handleSort('expected_hours')}
              className="flex items-center justify-center gap-2 text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide hover:text-orange-500 dark:hover:text-orange-400 transition-colors"
            >
              Hrs Esperadas
              {sortColumn === 'expected_hours' && (
                sortDirection === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
              )}
              {sortColumn !== 'expected_hours' && <ArrowUpDown className="w-3 h-3 opacity-30" />}
            </button>
            <button
              onClick={() => handleSort('worked_hours')}
              className="flex items-center justify-center gap-2 text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide hover:text-orange-500 dark:hover:text-orange-400 transition-colors"
            >
              Hrs Lançadas
              {sortColumn === 'worked_hours' && (
                sortDirection === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
              )}
              {sortColumn !== 'worked_hours' && <ArrowUpDown className="w-3 h-3 opacity-30" />}
            </button>
            <button
              onClick={() => handleSort('percentage')}
              className="flex items-center justify-center gap-2 text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide hover:text-orange-500 dark:hover:text-orange-400 transition-colors"
            >
              % Lançamento
              {sortColumn === 'percentage' && (
                sortDirection === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
              )}
              {sortColumn !== 'percentage' && <ArrowUpDown className="w-3 h-3 opacity-30" />}
            </button>
          </div>

          {/* Linhas da tabela */}
          {sortedTimeEntries.length > 0 ? (
            <div className="space-y-1 max-h-[550px] overflow-y-auto">
              {sortedTimeEntries.map((entry) => {
                const percentage = entry.expected_hours > 0 
                  ? (entry.worked_hours / entry.expected_hours) * 100 
                  : 0;

                let percentageStyle = {};
                if (periodType === 'current_month' && entry.expected_hours_until_yesterday !== undefined) {
                  const { worked_hours, expected_hours_until_yesterday } = entry;

                  if (expected_hours_until_yesterday === 0) {
                    if (percentage > 99) {
                      percentageStyle = { backgroundColor: '#b6d7a8', fontWeight: 'bold' };
                    }
                  } else if (worked_hours >= expected_hours_until_yesterday) {
                    percentageStyle = { backgroundColor: '#b6d7a8', fontWeight: 'bold' };
                  } else {
                    const percentageOfExpected = (worked_hours / expected_hours_until_yesterday) * 100;
                    if (percentageOfExpected >= 90) {
                      percentageStyle = { backgroundColor: '#f5f095' };
                    } else if (percentageOfExpected >= 70) {
                      percentageStyle = { backgroundColor: '#ffd966' };
                    } else {
                      percentageStyle = { backgroundColor: '#f4cccc' };
                    }
                  }
                } else {
                  if (percentage > 99) {
                    percentageStyle = { backgroundColor: '#b6d7a8', fontWeight: 'bold' };
                  } else if (percentage >= 80) {
                    percentageStyle = { backgroundColor: '#f5f095' };
                  } else if (percentage >= 50) {
                    percentageStyle = { backgroundColor: '#ffd966' };
                  } else {
                    percentageStyle = { backgroundColor: '#f4cccc' };
                  }
                }

                const isExpanded = expandedConsultants.has(entry.user_id);
                const dailyData = dailyTimeEntries.get(entry.user_id) || [];

                return (
                  <div key={entry.user_id}>
                    {/* Linha principal do consultor */}
                    <div 
                      className="grid grid-cols-4 gap-4 py-0 border-b border-gray-100 dark:border-gray-700 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                      onClick={() => toggleConsultantExpansion(entry.user_id)}
                    >
                      <div className="flex items-center gap-2 text-sm font-medium text-gray-900 dark:text-gray-100">
                        {isExpanded ? (
                          <ChevronDown className="w-4 h-4 text-gray-500" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-gray-500" />
                        )}
                        <span className="truncate">{entry.user_name}</span>
                      </div>
                      <div className="text-sm font-semibold text-blue-600 dark:text-blue-400 text-center">
                        {entry.expected_hours.toFixed(2)}h
                      </div>
                      <div className="text-sm font-semibold text-green-600 dark:text-green-400 text-center">
                        {entry.worked_hours.toFixed(2)}h
                      </div>
                      <div 
                        className="text-sm font-semibold text-center dark:text-gray-950 rounded px-2 py-1"
                        style={percentageStyle}
                      >
                        {Math.round(percentage)}%
                      </div>
                    </div>

                    {/* Detalhamento diário expandido */}
                    {isExpanded && dailyData.length > 0 && (
                      <div className="ml-6 mt-1 mb-2 bg-gray-50 dark:bg-gray-800 rounded-md p-3">
                        {/* Cabeçalho do detalhamento */}
                        <div className="grid grid-cols-4 gap-2 pb-2 border-b border-gray-300 dark:border-gray-600 mb-2">
                          <div className="text-xs font-semibold text-gray-600 dark:text-gray-400">
                            Data
                          </div>
                          <div className="text-xs font-semibold text-gray-600 dark:text-gray-400 text-center">
                            Dia
                          </div>
                          <div className="text-xs font-semibold text-gray-600 dark:text-gray-400 text-center">
                            Hrs Esperadas
                          </div>
                          <div className="text-xs font-semibold text-gray-600 dark:text-gray-400 text-center">
                            Hrs Lançadas
                          </div>
                        </div>

                        {/* Linhas dos dias */}
                        <div className="space-y-1 max-h-[300px] overflow-y-auto">
                          {dailyData.map((day, index) => (
                            <div 
                              key={`${entry.user_id}-${day.date}-${index}`}
                              className={`grid grid-cols-4 gap-2 py-1 px-2 rounded text-xs ${
                                day.isInsufficient 
                                  ? 'bg-red-100 dark:bg-red-900/30 text-red-900 dark:text-red-200' 
                                  : day.isMoresufficient
                                      ? 'bg-blue-100 dark:bg-blue-900/30 dark:bg-blue-900 dark:dark:bg-blue-200' 
                                      : 'text-gray-700 dark:text-gray-300'
                              }`}
                            >
                              <div>
                                {new Date(day.date + 'T12:00:00').toLocaleDateString('pt-BR')}
                              </div>
                              <div className="text-center">
                                {day.dayOfWeek}
                              </div>
                              <div className="text-center font-medium">
                                {day.expected_hours.toFixed(2)}h
                              </div>
                              <div className="text-center font-medium">
                                {day.worked_hours.toFixed(2)}h
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-gray-500 dark:text-gray-400 text-sm">
                Nenhum dado encontrado para o período selecionado.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TimeEntries;
