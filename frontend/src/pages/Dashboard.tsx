import { useState, useEffect, useRef } from 'react';
import { 
  Loader2,
  Calendar,
  AlertTriangle,
  ClipboardList,
  Users,
  Briefcase,
  CheckCircle2
} from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { 
  PieChart, 
  Pie, 
  Cell, 
  ResponsiveContainer, 
  Tooltip as RechartsTooltip, 
  Legend 
} from 'recharts';

// --- Interfaces ---

interface DashboardStats {
  activeProjects: number;
  activeConsultants: number;
  utilization: [number, number, number, number];
  criticalRisksCount: number;
  pendingEvaluationsCount: number;
}

interface UpcomingVacation {
  user_id: string;
  responsible_name: string;
  desired_start_date: string;
  desired_date: string;
}

interface CriticalRisk {
  id: number;
  description: string;
  project_id: number;
  priority: string; // From domain join or mapping
  status: string;
  owner_name: string | null;
  project?: { name: string };
}

interface BenchConsultant {
  user_id: string;
  name: string;
  position: string | null;
  avatar_url: string | null;
}

interface ProjectStatusData {
  name: string;
  value: number;
  color: string;
}

// --- Helpers ---

const getWeekDateRange = (weeksFromNow = 0) => {
  const today = new Date();
  const dayOfWeek = today.getDay();
  const diffToMonday = today.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
  const monday = new Date(today.setDate(diffToMonday));

  monday.setDate(monday.getDate() + weeksFromNow * 7);
  
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  const toISO = (date: Date) => date.toISOString().slice(0, 10);

  return { start: toISO(monday), end: toISO(sunday) };
};

const getUtilizationStyle = (percentage: number) => {
  let backgroundColor: string;
  let textColor: string;

  if (percentage === 100) {
    backgroundColor = '#b6d7a8'; // Verde
    textColor = '#000000';
  } else if (percentage >= 91) {
    backgroundColor = '#d8ffcc'; // Verde Claro
    textColor = '#000000';
  } else if (percentage >= 81) {
    backgroundColor = '#f5f095'; // Amarelo Claro
    textColor = '#000000';
  } else if (percentage >= 51) {
    backgroundColor = '#faf264'; // Amarelo Escuro
    textColor = '#000000';
  } else if (percentage >= 21) {
    backgroundColor = '#f4cccc'; // Vermelho Claro
    textColor = '#000000';
  } else {
    backgroundColor = '#e06666'; // Vermelho Escuro
    textColor = '#ffffff';
  }

  return { backgroundColor, textColor };
};

const STATUS_COLORS: Record<string, string> = {
  'Abertos': '#3b82f6', // Blue 500
  'Fechados': '#94a3b8', // Slate 400
  'Outros': '#cbd5e1'
};

const ManagementDashboard = () => {
  // --- State ---
  const [stats, setStats] = useState<DashboardStats>({
    activeProjects: 0,
    activeConsultants: 0,
    utilization: [0, 0, 0, 0],
    criticalRisksCount: 0,
    pendingEvaluationsCount: 0
  });
  
  const [upcomingVacations, setUpcomingVacations] = useState<UpcomingVacation[]>([]);
  const [vacationFilter, setVacationFilter] = useState('');
  const [criticalRisks, setCriticalRisks] = useState<CriticalRisk[]>([]);
  const [benchConsultants, setBenchConsultants] = useState<BenchConsultant[]>([]);
  const [projectStatusData, setProjectStatusData] = useState<ProjectStatusData[]>([]);
  
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
      const today = new Date().toISOString().split('T')[0];
      // currentWeek is available if needed for future features

      // 0. Fetch Domains for filtering (Risks & Evaluations)
      const { data: domainsData, error: domainsError } = await supabase
        .from('domains')
        .select('id, type, value')
        .in('type', ['risk_status', 'risk_priority', 'evaluation_status'])
        .eq('is_active', true);

      if (domainsError) throw domainsError;

      const riskStatusDomains = domainsData?.filter(d => d.type === 'risk_status') || [];
      const riskPriorityDomains = domainsData?.filter(d => d.type === 'risk_priority') || [];
      const evalStatusDomains = domainsData?.filter(d => d.type === 'evaluation_status') || [];

      // Identify IDs for filtering
      const closedRiskStatusIds = riskStatusDomains
        .filter(d => ['fechado', 'concluído', 'concluido', 'cancelado'].includes(d.value.toLowerCase()))
        .map(d => d.id);
      
      const highPriorityRiskIds = riskPriorityDomains
        .filter(d => ['alto', 'alta', 'crítico', 'critico', 'bloqueante'].includes(d.value.toLowerCase()))
        .map(d => d.id);

      const closedEvalStatusIds = evalStatusDomains
        .filter(d => ['fechado', 'concluído', 'concluido', 'finalizado'].includes(d.value.toLowerCase()))
        .map(d => d.id);

      // 1. Fetch Basic Counts & Projects
      // Removed 'status' from selection as it doesn't exist
      const [projectsRes, usersRes, risksRes, evaluationsRes] = await Promise.all([
        supabase.from('projects').select('id, name, is_closed'),
        supabase.from('employees').select('user_id, name, position, avatar_large_url').eq('is_active', true).not('position', 'ilike', '%Gestor%'),
        // Fetch all open risks to count them
        supabase.from('risks').select('id, status_id'), 
        // Fetch all evaluations to filter in memory or by status_id
        supabase.from('evaluations').select('id, status_id')
      ]);

      if (projectsRes.error) throw projectsRes.error;
      if (usersRes.error) throw usersRes.error;
      if (risksRes.error) throw risksRes.error;
      if (evaluationsRes.error) throw evaluationsRes.error;

      const allProjects = projectsRes.data || [];
      const activeProjects = allProjects.filter(p => !p.is_closed);
      const activeConsultants = usersRes.data || [];

      // Filter Pending Evaluations
      const pendingEvaluationsCount = (evaluationsRes.data || []).filter(e => 
        !closedEvalStatusIds.includes(e.status_id)
      ).length;
      
      // 2. Process Project Status for Chart (Open vs Closed)
      const statusCounts = {
        'Abertos': activeProjects.length,
        'Fechados': allProjects.length - activeProjects.length
      };
      
      const chartData = Object.entries(statusCounts).map(([name, value]) => ({
        name,
        value,
        color: STATUS_COLORS[name] || STATUS_COLORS['Outros']
      }));
      setProjectStatusData(chartData);

      // 3. Calculate Utilization & Bench
      const weeks = [
        getWeekDateRange(0),
        getWeekDateRange(1),
        getWeekDateRange(2),
        getWeekDateRange(3),
      ];

      // Buscar tarefas planejadas para cada semana (usando gantt_bar_start_date e gantt_bar_end_date)
      const utilizationPromises = weeks.map(week => 
        supabase
          .from('tasks')
          .select('responsible_id')
          .eq('is_closed', false)
          .not('responsible_id', 'is', null)
          .or(`and(gantt_bar_start_date.lte.${week.end},gantt_bar_end_date.gte.${week.start}),and(desired_start_date.lte.${week.end},desired_date.gte.${week.start})`)
      );
      
      const weeklyResults = await Promise.all(utilizationPromises);
      
      const utilizationPercentages = weeklyResults.map(result => {
        if (result.error) return 0;
        const uniqueConsultants = new Set(result.data.map(t => t.responsible_id));
        return activeConsultants.length > 0 
          ? (uniqueConsultants.size / activeConsultants.length) * 100 
          : 0;
      });

      // Identify Bench (Consultants with NO tasks planned in current week)
      const currentWeekTasks = weeklyResults[0].data || [];
      const assignedUserIds = new Set(currentWeekTasks.map(t => t.responsible_id));
      const bench = activeConsultants
        .filter(u => !assignedUserIds.has(u.user_id))
        .map(u => ({
          user_id: u.user_id,
          name: u.name,
          position: u.position,
          avatar_url: u.avatar_large_url
        }));
      setBenchConsultants(bench);

      // 4. Fetch Critical Risks (High Priority & Open)
      // We need to fetch risks that match high priority IDs AND are not closed
      let criticalRisksQuery = supabase
        .from('risks')
        .select('*, project:projects(name)')
        .order('created_at', { ascending: false }); // Get most recent

      const { data: allRisksData, error: risksFetchError } = await criticalRisksQuery;
      
      if (risksFetchError) throw risksFetchError;

      // Filter in memory because we have complex logic with IDs
      const criticalRisksFiltered = (allRisksData || [])
        .filter(r => 
          !closedRiskStatusIds.includes(r.status_id) && // Must be open
          highPriorityRiskIds.includes(r.priority_id)   // Must be high priority
        )
        .slice(0, 5) // Limit to 5
        .map(r => ({
          ...r,
          // Map IDs to values for display
          priority: riskPriorityDomains.find(d => d.id === r.priority_id)?.value || 'Desconhecido',
          status: riskStatusDomains.find(d => d.id === r.status_id)?.value || 'Desconhecido'
        }));
      
      setCriticalRisks(criticalRisksFiltered as any || []);

      // 5. Fetch Vacations
      const { data: vacationData } = await supabase
        .from('tasks')
        .select('user_id, responsible_name, desired_start_date, desired_date')
        .eq('type_name', 'Férias')
        .eq('is_closed', false)
        .gte('desired_date', today) // Only future/current vacations
        .order('desired_start_date', { ascending: true })
        .limit(100);
        
      setUpcomingVacations(vacationData || []);

      // Update Stats State
      setStats({
        activeProjects: activeProjects.length,
        activeConsultants: activeConsultants.length,
        utilization: utilizationPercentages as [number, number, number, number],
        criticalRisksCount: criticalRisksFiltered.length,
        pendingEvaluationsCount: pendingEvaluationsCount
      });

    } catch (err: any) {
      console.error("❌ [Dashboard] Erro ao carregar dados:", err);
      setError("Não foi possível carregar as métricas do dashboard.");
    } finally {
      setIsLoading(false);
    }
  };

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
      {/* Header */}
      {/* <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          Visão Geral
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Monitoramento estratégico e operacional
        </p>
      </div> */}

      {/* KPI Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard 
          title="Projetos Ativos" 
          value={stats.activeProjects} 
          icon={Briefcase}
          colorClass="text-blue-500"
        />
        <StatCard 
          title="Consultores" 
          value={stats.activeConsultants} 
          icon={Users}
          colorClass="text-indigo-500"
        />
        <StatCard 
          title="Riscos Projeto" 
          value={stats.criticalRisksCount} 
          icon={AlertTriangle}
          colorClass="text-red-500"
          bgClass="bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/30"
        />
        <StatCard 
          title="Avaliações Pendentes" 
          value={stats.pendingEvaluationsCount} 
          icon={ClipboardList}
          colorClass="text-orange-500"
        />
        <StatCard 
          title="Utilização Atual" 
          value={`${stats.utilization[0].toFixed(0)}%`} 
          icon={CheckCircle2}
          customStyle={getUtilizationStyle(stats.utilization[0])}
        />
      </div>

      {/* Utilization Forecast Row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {stats.utilization.map((percentage, index) => {
          const style = getUtilizationStyle(percentage);
          const labels = ["Semana Atual", "+1 Semana", "+2 Semanas", "+3 Semanas"];
          return (
            <div 
              key={index} 
              className="card p-3 flex flex-col items-center justify-center text-center"
              style={{ backgroundColor: style.backgroundColor }}
            >
              <p className="text-xs font-semibold mb-1" style={{ color: style.textColor }}>{labels[index]}</p>
              <p className="text-xl font-bold" style={{ color: style.textColor }}>{percentage.toFixed(0)}%</p>
            </div>
          );
        })}
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: Project Status & Bench */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Project Status Chart */}
          <div className="card p-6">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-4">Status dos Projetos</h3>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={projectStatusData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {projectStatusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <RechartsTooltip />
                  <Legend verticalAlign="middle" align="right" layout="vertical" />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Available Bench */}
          <div className="card p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                Consultores Disponíveis
              </h3>
              <span className="bg-green-100 text-green-800 text-xs font-medium px-2.5 py-0.5 rounded dark:bg-green-900 dark:text-green-300">
                {benchConsultants.length} Disponíveis
              </span>
            </div>
            
            {benchConsultants.length === 0 ? (
              <p className="text-gray-500 text-sm text-center py-4">Todos os consultores estão alocados esta semana.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-60 overflow-y-auto">
                {benchConsultants.map((consultant) => (
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
          
          {/* Critical Risks */}
          <div className="card p-6 border-l-4 border-red-500">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-500" />
              Riscos Críticos
            </h3>
            {criticalRisks.length === 0 ? (
              <p className="text-gray-500 text-sm">Nenhum risco crítico aberto.</p>
            ) : (
              <div className="space-y-3">
                {criticalRisks.map((risk) => (
                  <div key={risk.id} className="p-3 bg-red-50 dark:bg-red-900/10 rounded-lg border border-red-100 dark:border-red-900/30">
                    <p className="text-xs font-bold text-red-700 dark:text-red-400 mb-1">
                      {risk.project?.name || 'Projeto Desconhecido'}
                    </p>
                    <div 
                      className="text-sm text-gray-800 dark:text-gray-200 line-clamp-2 mb-2"
                      dangerouslySetInnerHTML={{ __html: risk.description }}
                    />
                    <div className="flex justify-between items-center text-xs text-gray-500 dark:text-gray-400">
                      <span>{risk.priority}</span>
                      <span>{risk.owner_name || 'Sem dono'}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

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
            {/* Filtro por nome */}
            <div className="mb-3">
              <input
                type="text"
                placeholder="Filtrar por nome..."
                value={vacationFilter}
                onChange={(e) => setVacationFilter(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            {upcomingVacations.length === 0 ? (
              <p className="text-gray-500 dark:text-gray-400 text-sm text-center py-4">
                Nenhuma férias agendada
              </p>
            ) : (
              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {upcomingVacations.filter(v => 
                  !vacationFilter || 
                  (v.responsible_name || '').toLowerCase().includes(vacationFilter.toLowerCase())
                ).map((vacation, idx) => {
                  const today = new Date();
                  today.setHours(0, 0, 0, 0);
                  
                  // Extrai apenas a parte da data (YYYY-MM-DD) para evitar problemas com timezone
                  const startDateStr = vacation.desired_start_date.split('T')[0];
                  const endDateStr = vacation.desired_date.split('T')[0];
                  
                  const startDate = new Date(startDateStr + 'T00:00:00');
                  const endDate = new Date(endDateStr + 'T00:00:00');
                  
                  // Verifica se está de férias agora
                  const isOnVacation = today >= startDate && today <= endDate;
                  const daysUntil = Math.ceil((startDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                  
                  return (
                    <div 
                      key={idx}
                      className={`flex justify-between items-center p-2 rounded text-sm hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors ${
                        isOnVacation 
                          ? 'bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800' 
                          : 'bg-gray-50 dark:bg-gray-700'
                      }`}
                    >
                      <div className="flex-1">
                        <p className="font-medium text-gray-900 dark:text-gray-100">
                          {vacation.responsible_name || vacation.user_id}
                        </p>
                        <p className="text-gray-600 dark:text-gray-400 text-xs">
                          {startDate.toLocaleDateString('pt-BR')} - {endDate.toLocaleDateString('pt-BR')}
                        </p>
                      </div>
                      <div className="text-right">
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