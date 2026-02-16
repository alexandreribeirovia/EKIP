import { useState, useMemo, useEffect, useRef } from 'react';
import apiClient from '../lib/apiClient';
import Select from 'react-select';
import { ChevronDown, ChevronRight, ArrowUpDown, ArrowUp, ArrowDown, Clock, CheckCircle, Zap, TrendingUp, TrendingDown, Plus, Minus, Scale, Percent } from 'lucide-react';
import { TimeEntryData, DailyTimeEntry, ConsultantOption } from '../types';

const TimeEntries = () => {
  const [timeEntries, setTimeEntries] = useState<TimeEntryData[]>([]);
  const [consultants, setConsultants] = useState<ConsultantOption[]>([]);
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
  const [sortColumn, setSortColumn] = useState<'user_name' | 'expected_hours' | 'worked_hours' | 'overtime_hours_in_period' | 'positive_comp_hours_in_period' | 'negative_comp_hours_in_period' | 'total_positive_comp_hours' | 'total_negative_comp_hours' | 'time_balance' | 'percentage' | null>(null);
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

  // Função para alternar expansão do consultor (agora usa dados já carregados)
  const toggleConsultantExpansion = (userId: string) => {
    setExpandedConsultants(prev => {
      const newSet = new Set(prev);
      if (newSet.has(userId)) {
        newSet.delete(userId);
      } else {
        newSet.add(userId);
      }
      return newSet;
    });
  };

  // Buscar consultores uma única vez (para dropdown)
  const fetchConsultants = async () => {
    try {
      const response = await apiClient.get<any[]>('/api/time-entries/consultants');

      if (!response.success) {
        console.error('Erro ao buscar consultores:', response.error?.message);
        return;
      }

      const options = (response.data || []).map((user: any) => ({
        value: user.user_id,
        label: user.name
      }));

      setConsultants(options);
    } catch (err) {
      console.error('Erro ao buscar consultores:', err);
    }
  };

  // Buscar dados de lançamento de horas - via backend API (PostgreSQL function)
  const fetchTimeEntries = async () => {
    if (isLoading) return;
    setIsLoading(true);
    
    try {
      const dateRange = getDateRange();
      
      // Preparar IDs de usuários selecionados (comma-separated ou vazio)
      const userIds = selectedConsultants.length > 0 
        ? selectedConsultants.map(c => c.value).join(',') 
        : '';

      // Montar query string
      const params = new URLSearchParams({
        startDate: dateRange.start,
        endDate: dateRange.end,
        status: statusFilter
      });
      if (userIds) params.set('userIds', userIds);

      // UMA ÚNICA CHAMADA via apiClient → backend → PostgreSQL function
      const response = await apiClient.get<any[]>(`/api/time-entries/report?${params.toString()}`);

      if (!response.success) {
        console.error('Erro ao buscar relatório:', response.error?.message);
        setTimeEntries([]);
        setDailyTimeEntries(new Map());
        return;
      }

      const data = response.data || [];

      // Dados já vêm mapeados do backend (sem prefixo out_)
      const entriesData: TimeEntryData[] = data.map((row: any) => ({
        user_id: row.user_id,
        user_name: row.user_name,
        expected_hours: Number(row.expected_hours) || 0,
        worked_hours: Number(row.worked_hours) || 0,
        expected_hours_until_yesterday: Number(row.expected_hours_until_yesterday) || 0,
        overtime_hours_in_period: Number(row.overtime_hours_in_period) || 0,
        positive_comp_hours_in_period: Number(row.positive_comp_hours_in_period) || 0,
        negative_comp_hours_in_period: Number(row.negative_comp_hours_in_period) || 0,
        total_positive_comp_hours: Number(row.total_positive_comp_hours) || 0,
        total_negative_comp_hours: Number(row.total_negative_comp_hours) || 0,
        time_balance: Number(row.time_balance) || 0
      }));

      setTimeEntries(entriesData);

      // Armazenar detalhes diários em cache (já vem mapeado do backend)
      const newDailyEntries = new Map<string, DailyTimeEntry[]>();
      data.forEach((row: any) => {
        const dailyData: DailyTimeEntry[] = (row.daily_details || []).map((day: any) => ({
          date: day.date,
          dayOfWeek: day.dayOfWeek,
          expected_hours: Number(day.expected_hours) || 8,
          worked_hours: Number(day.worked_hours) || 0,
          comp_positive: Number(day.comp_positive) || 0,
          comp_negative: Number(day.comp_negative) || 0,
          isInsufficient: day.isInsufficient ?? (Number(day.worked_hours) || 0) < 8,
          isMoresufficient: day.isMoresufficient ?? (Number(day.worked_hours) || 0) > 8
        }));
        newDailyEntries.set(row.user_id, dailyData);
      });
      setDailyTimeEntries(newDailyEntries);

    } catch (err) {
      console.error('Erro ao buscar dados:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // UseEffect inicial - buscar consultores apenas uma vez
  useEffect(() => {
    if (!hasLoadedInitially.current) {
      hasLoadedInitially.current = true;
      void fetchConsultants();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // UseEffect para carregar/recarregar dados quando filtros mudam
  useEffect(() => {
    // Evitar chamada se já está carregando
    if (isLoading) return;
    
    // Para período customizado, só buscar quando ambas as datas estiverem preenchidas
    if (periodType === 'custom' && (!startDate || !endDate)) return;
    
    // Limpar expansões quando o período mudar
    setExpandedConsultants(new Set());
    
    void fetchTimeEntries();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodType, startDate, endDate, selectedConsultants, statusFilter]);

  // Função para alternar ordenação
  const handleSort = (column: 'user_name' | 'expected_hours' | 'worked_hours' | 'overtime_hours_in_period' | 'positive_comp_hours_in_period' | 'negative_comp_hours_in_period' | 'total_positive_comp_hours' | 'total_negative_comp_hours' | 'time_balance' | 'percentage') => {
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

    return [...timeEntries].sort((a, b) => {
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
        case 'overtime_hours_in_period':
          compareValue = a.overtime_hours_in_period - b.overtime_hours_in_period;
          break;
        case 'positive_comp_hours_in_period':
          compareValue = a.positive_comp_hours_in_period - b.positive_comp_hours_in_period;
          break;
        case 'negative_comp_hours_in_period':
          compareValue = a.negative_comp_hours_in_period - b.negative_comp_hours_in_period;
          break;
        case 'total_positive_comp_hours':
          compareValue = a.total_positive_comp_hours - b.total_positive_comp_hours;
          break;
        case 'total_negative_comp_hours':
          compareValue = a.total_negative_comp_hours - b.total_negative_comp_hours;
          break;
        case 'time_balance':
          compareValue = a.time_balance - b.time_balance;
          break;
        case 'percentage':
          const percentageA = a.expected_hours > 0 ? (a.worked_hours / a.expected_hours) * 100 : 0;
          const percentageB = b.expected_hours > 0 ? (b.worked_hours / b.expected_hours) * 100 : 0;
          compareValue = percentageA - percentageB;
          break;
      }

      return sortDirection === 'asc' ? compareValue : -compareValue;
    });
  }, [timeEntries, sortColumn, sortDirection]);

  // Cálculo dos totais
  const totals = useMemo(() => {
    const totalExpected = timeEntries.reduce((sum, entry) => sum + entry.expected_hours, 0);
    const totalWorked = timeEntries.reduce((sum, entry) => sum + entry.worked_hours, 0);
    const totalOvertime = timeEntries.reduce((sum, entry) => sum + entry.overtime_hours_in_period, 0);
    const totalPositiveComp = timeEntries.reduce((sum, entry) => sum + entry.positive_comp_hours_in_period, 0);
    const totalNegativeComp = timeEntries.reduce((sum, entry) => sum + entry.negative_comp_hours_in_period, 0);
    const totalPositiveCompTotal = timeEntries.reduce((sum, entry) => sum + entry.total_positive_comp_hours, 0);
    const totalNegativeCompTotal = timeEntries.reduce((sum, entry) => sum + entry.total_negative_comp_hours, 0);
    const totalBalance = timeEntries.reduce((sum, entry) => sum + entry.time_balance, 0);
    const utilizationRate = totalExpected > 0 ? (totalWorked / totalExpected) * 100 : 0;

    return {
      expected: totalExpected.toFixed(2),
      worked: totalWorked.toFixed(2),
      overtime: totalOvertime.toFixed(2),
      positiveComp: totalPositiveComp.toFixed(2),
      negativeComp: totalNegativeComp.toFixed(2),
      positiveCompTotal: totalPositiveCompTotal.toFixed(2),
      negativeCompTotal: totalNegativeCompTotal.toFixed(2),
      balance: totalBalance.toFixed(2),
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
        <div className="mt-3 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 xl:grid-cols-9 gap-3">
          {/* Hrs Esperadas */}
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-2 border border-blue-200 dark:border-blue-800">
            <div className="flex items-center justify-between mb-1">
              <div className="text-xs text-blue-600 dark:text-blue-400">Hrs Esperadas</div>
              <Clock className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="text-lg font-bold text-blue-700 dark:text-blue-300">{totals.expected}h</div>
          </div>

          {/* Hrs Lançadas */}
          <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-2 border border-green-200 dark:border-green-800">
            <div className="flex items-center justify-between mb-1">
              <div className="text-xs text-green-600 dark:text-green-400">Hrs Lançadas</div>
              <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400" />
            </div>
            <div className="text-lg font-bold text-green-700 dark:text-green-300">{totals.worked}h</div>
          </div>

          {/* Extra Período */}
          <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-2 border border-purple-200 dark:border-purple-800">
            <div className="flex items-center justify-between mb-1">
              <div className="text-xs text-purple-600 dark:text-purple-400">Extra Período</div>
              <Zap className="w-4 h-4 text-purple-600 dark:text-purple-400" />
            </div>
            <div className="text-lg font-bold text-purple-700 dark:text-purple-300">{totals.overtime}h</div>
          </div>

          {/* Comp. + Período */}
          <div className="bg-teal-50 dark:bg-teal-900/20 rounded-lg p-2 border border-teal-200 dark:border-teal-800">
            <div className="flex items-center justify-between mb-1">
              <div className="text-xs text-teal-600 dark:text-teal-400">Comp. + Período</div>
              <TrendingUp className="w-4 h-4 text-teal-600 dark:text-teal-400" />
            </div>
            <div className="text-lg font-bold text-teal-700 dark:text-teal-300">{totals.positiveComp}h</div>
          </div>

          {/* Comp. - Período */}
          <div className="bg-orange-50 dark:bg-orange-900/20 rounded-lg p-2 border border-orange-200 dark:border-orange-800">
            <div className="flex items-center justify-between mb-1">
              <div className="text-xs text-orange-600 dark:text-orange-400">Comp. - Período</div>
              <TrendingDown className="w-4 h-4 text-orange-600 dark:text-orange-400" />
            </div>
            <div className="text-lg font-bold text-orange-700 dark:text-orange-300">{totals.negativeComp}h</div>
          </div>

          {/* Comp. + Total */}
          <div className="bg-cyan-50 dark:bg-cyan-900/20 rounded-lg p-2 border border-cyan-200 dark:border-cyan-800">
            <div className="flex items-center justify-between mb-1">
              <div className="text-xs text-cyan-600 dark:text-cyan-400">Comp. + Total</div>
              <Plus className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
            </div>
            <div className="text-lg font-bold text-cyan-700 dark:text-cyan-300">{totals.positiveCompTotal}h</div>
          </div>

          {/* Comp. - Total */}
          <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-2 border border-red-200 dark:border-red-800">
            <div className="flex items-center justify-between mb-1">
              <div className="text-xs text-red-600 dark:text-red-400">Comp. - Total</div>
              <Minus className="w-4 h-4 text-red-600 dark:text-red-400" />
            </div>
            <div className="text-lg font-bold text-red-700 dark:text-red-300">{totals.negativeCompTotal}h</div>
          </div>

          {/* Saldo */}
          <div className={`rounded-lg p-2 border ${
            parseFloat(totals.balance) >= 0 
              ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800' 
              : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
          }`}>
            <div className="flex items-center justify-between mb-1">
              <div className={`text-xs ${
                parseFloat(totals.balance) >= 0 
                  ? 'text-green-600 dark:text-green-400' 
                  : 'text-red-600 dark:text-red-400'
              }`}>Saldo</div>
              <Scale className={`w-4 h-4 ${
                parseFloat(totals.balance) >= 0 
                  ? 'text-green-600 dark:text-green-400' 
                  : 'text-red-600 dark:text-red-400'
              }`} />
            </div>
            <div className={`text-lg font-bold ${
              parseFloat(totals.balance) >= 0 
                ? 'text-green-700 dark:text-green-300' 
                : 'text-red-700 dark:text-red-300'
            }`}>{totals.balance}h</div>
          </div>

          {/* % Lançamento */}
          <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-2 border border-yellow-200 dark:border-yellow-800">
            <div className="flex items-center justify-between mb-1">
              <div className="text-xs text-yellow-600 dark:text-yellow-400">% Lançamento</div>
              <Percent className="w-4 h-4 text-yellow-600 dark:text-yellow-400" />
            </div>
            <div className="text-lg font-bold text-yellow-700 dark:text-yellow-300">{totals.utilization}%</div>
          </div>
        </div>
      </div>

      {/* Card com Tabela */}
      <div className="card p-6 pt-3">
        <div className="overflow-x-auto">
          {/* Cabeçalho da tabela */}
          <div className="grid gap-2 pb-3 border-b border-gray-200 dark:border-gray-600 mb-1 min-w-[1400px]" style={{ gridTemplateColumns: '250px repeat(9, 1fr)' }}>
            <button
              onClick={() => handleSort('user_name')}
              className="flex items-center gap-1 text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide hover:text-orange-500 dark:hover:text-orange-400 transition-colors"
            >
              Consultor
              {sortColumn === 'user_name' && (
                sortDirection === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
              )}
              {sortColumn !== 'user_name' && <ArrowUpDown className="w-3 h-3 opacity-30" />}
            </button>
            <button
              onClick={() => handleSort('expected_hours')}
              className="flex items-center justify-center gap-1 text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide hover:text-orange-500 dark:hover:text-orange-400 transition-colors"
            >
              Hrs Esperadas
              {sortColumn === 'expected_hours' && (
                sortDirection === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
              )}
              {sortColumn !== 'expected_hours' && <ArrowUpDown className="w-3 h-3 opacity-30" />}
            </button>
            <button
              onClick={() => handleSort('worked_hours')}
              className="flex items-center justify-center gap-1 text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide hover:text-orange-500 dark:hover:text-orange-400 transition-colors"
            >
              Hrs Lançadas
              {sortColumn === 'worked_hours' && (
                sortDirection === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
              )}
              {sortColumn !== 'worked_hours' && <ArrowUpDown className="w-3 h-3 opacity-30" />}
            </button>
            <button
              onClick={() => handleSort('overtime_hours_in_period')}
              className="flex items-center justify-center gap-1 text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide hover:text-orange-500 dark:hover:text-orange-400 transition-colors"
            >
              Hora Extra Período
              {sortColumn === 'overtime_hours_in_period' && (
                sortDirection === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
              )}
              {sortColumn !== 'overtime_hours_in_period' && <ArrowUpDown className="w-3 h-3 opacity-30" />}
            </button>
            <button
              onClick={() => handleSort('positive_comp_hours_in_period')}
              className="flex items-center justify-center gap-1 text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide hover:text-orange-500 dark:hover:text-orange-400 transition-colors"
            >
              Comp. + Período
              {sortColumn === 'positive_comp_hours_in_period' && (
                sortDirection === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
              )}
              {sortColumn !== 'positive_comp_hours_in_period' && <ArrowUpDown className="w-3 h-3 opacity-30" />}
            </button>
            <button
              onClick={() => handleSort('negative_comp_hours_in_period')}
              className="flex items-center justify-center gap-1 text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide hover:text-orange-500 dark:hover:text-orange-400 transition-colors"
            >
              Comp. - Período
              {sortColumn === 'negative_comp_hours_in_period' && (
                sortDirection === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
              )}
              {sortColumn !== 'negative_comp_hours_in_period' && <ArrowUpDown className="w-3 h-3 opacity-30" />}
            </button>
            <button
              onClick={() => handleSort('total_positive_comp_hours')}
              className="flex items-center justify-center gap-1 text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide hover:text-orange-500 dark:hover:text-orange-400 transition-colors"
            >
              Comp. + Total
              {sortColumn === 'total_positive_comp_hours' && (
                sortDirection === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
              )}
              {sortColumn !== 'total_positive_comp_hours' && <ArrowUpDown className="w-3 h-3 opacity-30" />}
            </button>
            <button
              onClick={() => handleSort('total_negative_comp_hours')}
              className="flex items-center justify-center gap-1 text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide hover:text-orange-500 dark:hover:text-orange-400 transition-colors"
            >
              Comp. - Total
              {sortColumn === 'total_negative_comp_hours' && (
                sortDirection === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
              )}
              {sortColumn !== 'total_negative_comp_hours' && <ArrowUpDown className="w-3 h-3 opacity-30" />}
            </button>
            <button
              onClick={() => handleSort('time_balance')}
              className="flex items-center justify-center gap-1 text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide hover:text-orange-500 dark:hover:text-orange-400 transition-colors"
            >
              Saldo
              {sortColumn === 'time_balance' && (
                sortDirection === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
              )}
              {sortColumn !== 'time_balance' && <ArrowUpDown className="w-3 h-3 opacity-30" />}
            </button>
            <button
              onClick={() => handleSort('percentage')}
              className="flex items-center justify-center gap-1 text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide hover:text-orange-500 dark:hover:text-orange-400 transition-colors"
            >
              % Lançamento
              {sortColumn === 'percentage' && (
                sortDirection === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
              )}
              {sortColumn !== 'percentage' && <ArrowUpDown className="w-3 h-3 opacity-30" />}
            </button>
          </div>

          {/* Linhas da tabela */}
          {isLoading ? (
            <div className="text-center py-8">
              <p className="text-gray-500 dark:text-gray-400 text-sm">Carregando...</p>
            </div>
          ) : sortedTimeEntries.length > 0 ? (
            <div className="space-y-1">
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
                      className="grid gap-2 py-0 border-b border-gray-100 dark:border-gray-700 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors min-w-[1400px]"
                      style={{ gridTemplateColumns: '250px repeat(9, 1fr)' }}
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
                      <div className="text-sm font-semibold text-purple-600 dark:text-purple-400 text-center">
                        {entry.overtime_hours_in_period.toFixed(2)}h
                      </div>
                      <div className="text-sm font-semibold text-teal-600 dark:text-teal-400 text-center">
                        {entry.positive_comp_hours_in_period.toFixed(2)}h
                      </div>
                      <div className="text-sm font-semibold text-orange-600 dark:text-orange-400 text-center">
                        {entry.negative_comp_hours_in_period.toFixed(2)}h
                      </div>
                      <div className="text-sm font-semibold text-cyan-600 dark:text-cyan-400 text-center">
                        {entry.total_positive_comp_hours.toFixed(2)}h
                      </div>
                      <div className="text-sm font-semibold text-red-600 dark:text-red-400 text-center">
                        {entry.total_negative_comp_hours.toFixed(2)}h
                      </div>
                      <div className={`text-sm font-semibold text-center ${entry.time_balance >= 0 ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`}>
                        {entry.time_balance.toFixed(2)}h
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
                        <div className="grid grid-cols-6 gap-2 pb-2 border-b border-gray-300 dark:border-gray-600 mb-2">
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
                          <div className="text-xs font-semibold text-teal-600 dark:text-teal-400 text-center">
                            Comp +
                          </div>
                          <div className="text-xs font-semibold text-orange-600 dark:text-orange-400 text-center">
                            Comp -
                          </div>
                        </div>

                        {/* Linhas dos dias */}
                        <div className="space-y-1">
                          {dailyData.map((day, index) => (
                            <div 
                              key={`${entry.user_id}-${day.date}-${index}`}
                              className={`grid grid-cols-6 gap-2 py-1 px-2 rounded text-xs ${
                                day.isInsufficient 
                                  ? 'bg-red-100 dark:bg-red-900/30 text-red-900 dark:text-red-200' 
                                  : day.isMoresufficient
                                      ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-900 dark:text-blue-200' 
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
                              <div className="text-center font-medium text-teal-600 dark:text-teal-400">
                                {day.comp_positive > 0 ? `${day.comp_positive.toFixed(2)}h` : '-'}
                              </div>
                              <div className="text-center font-medium text-orange-600 dark:text-orange-400">
                                {day.comp_negative > 0 ? `${day.comp_negative.toFixed(2)}h` : '-'}
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
