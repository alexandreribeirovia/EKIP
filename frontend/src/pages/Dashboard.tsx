import { useState, useEffect, useRef } from 'react';
import { 
  Loader2,
  Calendar,
  MessageSquareDashed,
  ClipboardList,
  Users,
  Briefcase,
  Clock,
  TrendingUp
} from 'lucide-react';
import apiClient from '../lib/apiClient';
import { 
  ResponsiveContainer, 
  Tooltip as RechartsTooltip, 
  Legend,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts';
import AllocationFunnel from '../components/AllocationFunnel';
import type { 
  DashboardStats,
  WeeklyUtilization, 
  MonthlyAllocation,
  DashboardBenchConsultant,
  DashboardVacation,
  DashboardMonthlyHours,
} from '../types';

// --- Helpers ---

const getUtilizationStyle = (percentage: number) => {
  let backgroundColor: string;
  let textColor: string;

  if (percentage === 100) {
    backgroundColor = '#b6d7a8';
    textColor = '#000000';
  } else if (percentage >= 91) {
    backgroundColor = '#d8ffcc';
    textColor = '#000000';
  } else if (percentage >= 81) {
    backgroundColor = '#f5f095';
    textColor = '#000000';
  } else if (percentage >= 51) {
    backgroundColor = '#faf264';
    textColor = '#000000';
  } else if (percentage >= 21) {
    backgroundColor = '#f4cccc';
    textColor = '#000000';
  } else {
    backgroundColor = '#e06666';
    textColor = '#ffffff';
  }

  return { backgroundColor, textColor };
};

// Cores do gráfico de barras mensal por billing_type
const BILLING_COLORS: Record<string, string> = {
  faturavel: '#ea580c',    // orange-600
  nao_faturavel: '#fb923c', // orange-400
  investimento: '#ffc40b',  // amber-500
  sem_tipo: '#d1d5db',      // gray-300
};

const BILLING_LABELS: Record<string, string> = {
  faturavel: 'Faturável',
  nao_faturavel: 'Não Faturável',
  investimento: 'Investimento',
  sem_tipo: 'Sem Tipo',
};

// Custom tooltip para gráfico de barras mensal
const MonthlyBarTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  const total = payload.reduce((sum: number, entry: any) => sum + (entry.value || 0), 0);
  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-3 text-sm">
      <p className="font-semibold text-gray-900 dark:text-gray-100 mb-2">{label}</p>
      {[...payload].sort((a: any, b: any) => (b.value || 0) - (a.value || 0)).map((entry: any, idx: number) => {
        const pct = total > 0 ? ((entry.value || 0) / total * 100).toFixed(1) : '0.0';
        return (
          <div key={idx} className="flex items-center gap-2 py-0.5">
            <span className="w-3 h-3 rounded-sm flex-shrink-0" style={{ backgroundColor: entry.color }} />
            <span className="text-gray-600 dark:text-gray-400">{BILLING_LABELS[entry.dataKey] || entry.dataKey}:</span>
            <span className="font-medium text-gray-900 dark:text-gray-100 ml-auto">{pct}%</span>
          </div>
        );
      })}
      <div className="border-t border-gray-200 dark:border-gray-700 mt-1 pt-1 flex justify-between">
        <span className="text-gray-500 dark:text-gray-400">Total:</span>
        <span className="font-bold text-gray-900 dark:text-gray-100">{total}</span>
      </div>
    </div>
  );
};

const ManagementDashboard = () => {
  // --- State ---
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [weeklyUtilization, setWeeklyUtilization] = useState<WeeklyUtilization[]>([]);
  const [monthlyAllocation, setMonthlyAllocation] = useState<MonthlyAllocation[]>([]);
  const [monthlyHours, setMonthlyHours] = useState<DashboardMonthlyHours[]>([]);
  const [vacationFilter, setVacationFilter] = useState('');
  const [benchFilter, setBenchFilter] = useState('');
  
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const hasLoaded = useRef(false);

  useEffect(() => {
    if (!hasLoaded.current) {
      hasLoaded.current = true;
      void loadDashboardData();
    }
  }, []);

  const loadDashboardData = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // 3 chamadas paralelas ao backend (via apiClient)
      const [statsRes, weeklyRes, monthlyRes, hoursRes] = await Promise.all([
        apiClient.get<DashboardStats>('/api/dashboard/stats'),
        apiClient.get<WeeklyUtilization[]>('/api/dashboard/weekly-utilization'),
        apiClient.get<MonthlyAllocation[]>('/api/dashboard/monthly-allocation'),
        apiClient.get<DashboardMonthlyHours[]>('/api/dashboard/monthly-hours'),
      ]);

      if (!statsRes.success) throw new Error(statsRes.error?.message || 'Erro ao buscar stats');
      if (!weeklyRes.success) throw new Error(weeklyRes.error?.message || 'Erro ao buscar utilização semanal');
      if (!monthlyRes.success) throw new Error(monthlyRes.error?.message || 'Erro ao buscar alocação mensal');
      if (!hoursRes.success) throw new Error(hoursRes.error?.message || 'Erro ao buscar horas mensais');

      setStats(statsRes.data!);
      setWeeklyUtilization(weeklyRes.data!);
      setMonthlyAllocation(monthlyRes.data!);
      setMonthlyHours(hoursRes.data!);

    } catch (err: any) {
      console.error("❌ [Dashboard] Erro ao carregar dados:", err);
      setError("Não foi possível carregar as métricas do dashboard.");
    } finally {
      setIsLoading(false);
    }
  };

  // --- Computed values from stats ---
  const benchConsultants: DashboardBenchConsultant[] = stats?.benchConsultants || [];
  const upcomingVacations: DashboardVacation[] = stats?.upcomingVacations || [];

  // --- Components ---

  const StatCard = ({ 
    title, 
    value, 
    icon: Icon,
    colorClass = "text-gray-900 dark:text-gray-100",
    bgClass = "bg-white dark:bg-gray-800",
    customStyle
  }: any) => (
    <div 
      className={`card p-4 flex flex-col justify-between text-center ${bgClass}`}
      style={customStyle}
    >
      <div className="flex items-center justify-between mb-2">
        <p className={`text-sm font-medium ${customStyle ? '' : 'text-gray-500 dark:text-gray-400'}`} style={customStyle ? { color: customStyle.textColor } : {}}>
          {title}
        </p>
        {Icon && <Icon className={`w-5 h-5 ${colorClass}`} />}
      </div>
      <p className={`text-3xl font-bold ${customStyle ? '' : 'text-gray-900 dark:text-gray-100'}`} style={customStyle ? { color: customStyle.textColor } : {}}>
        {value}
      </p>
    </div>
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-12 h-12 animate-spin text-orange-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative">
        <strong className="font-bold">Erro: </strong>
        <span className="block sm:inline">{error}</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-10">
      {/* KPI Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard 
          title="Projetos Ativos" 
          value={stats?.activeProjects ?? 0} 
          icon={Briefcase}
          colorClass="text-blue-500"
        />
        <StatCard 
          title="Consultores" 
          value={stats?.activeConsultants ?? 0} 
          icon={Users}
          colorClass="text-indigo-500"
        />
        <StatCard 
          title="Feedbacks Pendentes" 
          value={stats?.pendingFeedbacksCount ?? 0} 
          icon={MessageSquareDashed}
          colorClass="text-yellow-500"
          bgClass="bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-100 dark:border-yellow-900/30"
        />
        <StatCard 
          title="Avaliações Pendentes" 
          value={stats?.pendingEvaluationsCount ?? 0} 
          icon={ClipboardList}
          colorClass="text-orange-500"
        />
        {/* Card Lançamento de Horas (mês anterior + atual) */}
        <div className="card p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Lançamento de Horas</p>
            <Clock className="w-5 h-5 text-orange-500" />
          </div>
          <div className="space-y-1.5">
            {monthlyHours.length === 0 ? (
              <p className="text-xs text-gray-400">Sem dados</p>
            ) : (
              monthlyHours.map((m) => {
                const style = getUtilizationStyle(m.percentage);
                const fmtHours = (h: number) =>
                  h >= 1000 ? `${(h / 1000).toFixed(1).replace('.', ',')}k` : Math.round(h).toString();
                return (
                  <div key={m.month_start} className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-gray-700 dark:text-gray-300 w-7">
                      {m.month_label}
                    </span>
                    <span className="text-xs text-gray-500 dark:text-gray-400 flex-1 truncate">
                      {fmtHours(m.worked_hours)}/{fmtHours(m.expected_hours)}h
                    </span>
                    <span
                      className="text-xs font-bold px-1.5 py-0.5 rounded"
                      style={{ backgroundColor: style.backgroundColor, color: style.textColor }}
                    >
                      {m.percentage.toFixed(0)}%
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Charts Row: Funnel + Monthly Bar */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Funnel: Alocação Semanal */}
        <div className="card p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-5 h-5 text-orange-500" />
            <h3 className="font-semibold text-gray-900 dark:text-gray-100">
              Alocação Semanal
            </h3>
          </div>
          <AllocationFunnel data={weeklyUtilization} />
        </div>

        {/* Bar Chart: Alocação Mensal por Tipo de Faturamento */}
        <div className="card p-4 pb-0">
          <div className="flex items-center gap-2 mb-2">
            <Briefcase className="w-5 h-5 text-orange-500" />
            <h3 className="font-semibold text-gray-900 dark:text-gray-100">
              Alocação Mensal por Faturamento
            </h3>
          </div>
          <div className="h-48 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyAllocation} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" />
                <XAxis 
                  dataKey="month_label" 
                  tick={{ fontSize: 12 }}
                  className="fill-gray-500 dark:fill-gray-400"
                />
                <YAxis 
                  allowDecimals={false}
                  tick={{ fontSize: 12 }}
                  className="fill-gray-500 dark:fill-gray-400"
                />
                <RechartsTooltip content={<MonthlyBarTooltip />} />
                <Legend 
                  formatter={(value: string) => BILLING_LABELS[value] || value}
                  wrapperStyle={{ fontSize: '12px' }}
                />
                <Bar dataKey="faturavel" stackId="allocation" fill={BILLING_COLORS.faturavel} radius={[0, 0, 0, 0]} name="faturavel" />
                <Bar dataKey="nao_faturavel" stackId="allocation" fill={BILLING_COLORS.nao_faturavel} name="nao_faturavel" />
                <Bar dataKey="investimento" stackId="allocation" fill={BILLING_COLORS.investimento} name="investimento" />
                <Bar dataKey="sem_tipo" stackId="allocation" fill={BILLING_COLORS.sem_tipo} radius={[4, 4, 0, 0]} name="sem_tipo" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: Project Status & Bench */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Available Bench */}
          <div className="card p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-orange-500" />
                <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                  Consultores Disponíveis
                </h3>
              </div>
              <span className="bg-green-100 text-green-800 text-xs font-medium px-2.5 py-0.5 rounded dark:bg-green-900 dark:text-green-300">
                {benchConsultants.length} Disponíveis
              </span>
            </div>
            {/* Filtro por nome ou função */}
            <div className="mb-3">
              <input
                type="text"
                placeholder="Filtrar por nome ou função..."
                value={benchFilter}
                onChange={(e) => setBenchFilter(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-orange-500 focus:border-transparent"
              />
            </div>
            
            {benchConsultants.length === 0 ? (
              <p className="text-gray-500 text-sm text-center py-4">Todos os consultores estão alocados esta semana.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[300px] overflow-y-auto">
                {benchConsultants.filter((c) => {
                  if (!benchFilter) return true;
                  const filter = benchFilter.toLowerCase();
                  return (c.name || '').toLowerCase().includes(filter) || (c.position || '').toLowerCase().includes(filter);
                }).map((consultant) => (
                  <div key={consultant.user_id} className="flex items-center gap-3 p-2 rounded-lg border border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center overflow-hidden">
                      {consultant.avatar_url ? (
                        <img src={consultant.avatar_url} alt={consultant.name} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-xs font-bold text-gray-500 dark:text-gray-300">
                          {consultant.name.charAt(0)}
                        </span>
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{consultant.name}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{consultant.position || 'Consultor'}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Risks & Vacations */}
        <div className="space-y-6">
          
          {/* Upcoming Vacations */}
          <div className="card p-6">
            <div className="flex items-center gap-2 mb-4">
              <Calendar className="w-5 h-5 text-blue-500 dark:text-blue-400" />
              <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                Férias
              </h3>
              {upcomingVacations.length > 0 && (
                <span className="ml-auto text-xs bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 px-2 py-1 rounded-full font-medium">
                  {upcomingVacations.length}
                </span>
              )}
            </div>
            {/* Filtro por nome, projeto ou gestor */}
            <div className="mb-3">
              <input
                type="text"
                placeholder="Filtrar por nome, projeto ou gestor..."
                value={vacationFilter}
                onChange={(e) => setVacationFilter(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-orange-500 focus:border-transparent"
              />
            </div>
            {upcomingVacations.length === 0 ? (
              <p className="text-gray-500 dark:text-gray-400 text-sm text-center py-4">
                Nenhuma férias agendada
              </p>
            ) : (
              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {upcomingVacations.filter(v => {
                  if (!vacationFilter) return true;
                  const filter = vacationFilter.toLowerCase();
                  const nameMatch = (v.responsible_name || '').toLowerCase().includes(filter);
                  const projectMatch = (v.projects || []).some(p =>
                    (p.project_name || '').toLowerCase().includes(filter) ||
                    (p.manager_name || '').toLowerCase().includes(filter)
                  );
                  return nameMatch || projectMatch;
                }).map((vacation, idx) => {
                  const today = new Date();
                  today.setHours(0, 0, 0, 0);
                  
                  const startDateStr = vacation.desired_start_date.split('T')[0];
                  const endDateStr = vacation.desired_date.split('T')[0];
                  
                  const startDate = new Date(startDateStr + 'T00:00:00');
                  const endDate = new Date(endDateStr + 'T00:00:00');
                  
                  const isOnVacation = today >= startDate && today <= endDate;
                  const daysUntil = Math.ceil((startDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                  
                  return (
                    <div 
                      key={idx}
                      className={`flex items-start gap-3 p-2 rounded text-sm hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors ${
                        isOnVacation 
                          ? 'bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800' 
                          : 'bg-gray-50 dark:bg-gray-700'
                      }`}
                    >
                      {/* Avatar */}
                      <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-600 flex-shrink-0 flex items-center justify-center overflow-hidden mt-0.5">
                        {vacation.avatar_url ? (
                          <img src={vacation.avatar_url} alt={vacation.responsible_name} className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-xs font-bold text-gray-500 dark:text-gray-300">
                            {(vacation.responsible_name || vacation.user_id || '?').charAt(0).toUpperCase()}
                          </span>
                        )}
                      </div>
                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 dark:text-gray-100">
                          {vacation.responsible_name || vacation.user_id}
                        </p>
                        <p className="text-gray-600 dark:text-gray-400 text-xs">
                          {startDate.toLocaleDateString('pt-BR')} - {endDate.toLocaleDateString('pt-BR')}
                        </p>
                        {/* Projetos com gestor */}
                        {vacation.projects && vacation.projects.length > 0 && (
                          <div className="mt-1 space-y-0.5">
                            {vacation.projects.map((proj, pIdx) => (
                              <div key={pIdx} className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                                <Briefcase className="w-3 h-3 flex-shrink-0" />
                                <span className="truncate">
                                  {proj.project_name}
                                  {proj.manager_name && (
                                    <span className="text-gray-400 dark:text-gray-500"> — {proj.manager_name}</span>
                                  )}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      {/* Status */}
                      <div className="text-right flex-shrink-0">
                        {isOnVacation ? (
                          <div className="flex flex-col items-end gap-1">
                            <span className="flex items-center gap-1 text-yellow-700 dark:text-yellow-400 font-medium">
                              <span className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse"></span>
                              Férias
                            </span>
                            <span className="text-xs text-gray-600 dark:text-gray-400">
                              {(() => {
                                const daysUntilReturn = Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)) + 1;
                                return daysUntilReturn === 1 ? 'Volta amanhã' : `Volta em ${daysUntilReturn} dias`;
                              })()}
                            </span>
                          </div>
                        ) : (
                          <p className="text-gray-700 dark:text-gray-300 font-medium">
                            {daysUntil === 0 ? 'Hoje' : daysUntil === 1 ? 'Amanhã' : `${daysUntil} dias`}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
};

export default ManagementDashboard;