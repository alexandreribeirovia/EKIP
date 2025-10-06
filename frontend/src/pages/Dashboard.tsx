// --- START OF FILE Dashboard.tsx ---

import { useState, useEffect, useRef } from 'react';
import { 
  Loader2,
  Calendar
} from 'lucide-react';
import { supabase } from '../lib/supabaseClient';

// Interface para o estado das estatísticas
interface DashboardStats {
  activeProjects: number;
  activeConsultants: number;
  utilization: [number, number, number, number];
}

// Interface para férias dos consultores
interface UpcomingVacation {
  user_id: string;
  responsible_name: string;
  desired_start_date: string;
  desired_date: string;
}

// Função auxiliar para obter o intervalo de datas de uma semana
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

// =====================================================================
// == NOVA FUNÇÃO PARA DETERMINAR AS CORES DO CARD DE UTILIZAÇÃO      ==
// =====================================================================
const getUtilizationStyle = (percentage: number) => {
  let backgroundColor: string;
  let textColor: string; // Cor de texto padrão (preto/branco dependendo do tema)

  if (percentage === 100) {
    backgroundColor = '#b6d7a8'; // Verde
    textColor = '';
  } else if (percentage >= 91) {
    backgroundColor = '#d8ffcc'; // Verde Claro 
    textColor = '';
  } else if (percentage >= 81) {
    backgroundColor = '#f5f095'; // Amarelo Claro
    textColor = '';
  } else if (percentage >= 51) {
    backgroundColor = '#faf264'; // Amarelo Escuro
    textColor = '';
  } else if (percentage >= 21) {
    backgroundColor = '#f4cccc'; // Vermelho Claro
    textColor = '';
  } else {
    backgroundColor = '#e06666'; // Vermelho Escuro
    textColor = '#ffffff';       // Texto branco para melhor contraste
  }

  return { backgroundColor, textColor };
};


const Dashboard = () => {
  const [stats, setStats] = useState<DashboardStats>({
    activeProjects: 0,
    activeConsultants: 0,
    utilization: [0, 0, 0, 0],
  });
  const [upcomingVacations, setUpcomingVacations] = useState<UpcomingVacation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingVacations, setIsLoadingVacations] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // useRef para controlar se já foi carregado (não causa re-render)
  const hasLoadedInitially = useRef(false);

  useEffect(() => {
    if (!hasLoadedInitially.current) {
      hasLoadedInitially.current = true;
      
      const fetchDashboardData = async () => {
        setIsLoading(true);
        setError(null);

        try {
          const [projectsPromise, usersPromise] = await Promise.all([
            supabase.from('projects').select('id', { count: 'exact' }).eq('is_closed', false),
            supabase.from('users').select('user_id', { count: 'exact' }).eq('is_active', true).not('position', 'ilike', '%Gestor%')
          ]);
        
        if (projectsPromise.error) {
          console.error("Erro ao buscar projetos:", projectsPromise.error);
          setError("Não foi possível carregar os projetos.");
          return;
        }
        if (usersPromise.error) {
          console.error("Erro ao buscar consultores:", usersPromise.error);
          setError("Não foi possível carregar os consultores.");
          return;
        }

        const activeProjectsCount = projectsPromise.count ?? 0;
        const activeConsultantsCount = usersPromise.count ?? 0;

        if (activeConsultantsCount === 0) {
          setStats({
            activeProjects: activeProjectsCount,
            activeConsultants: activeConsultantsCount,
            utilization: [0, 0, 0, 0],
          });
          return;
        }

        const weeks = [
          getWeekDateRange(0),
          getWeekDateRange(1),
          getWeekDateRange(2),
          getWeekDateRange(3),
        ];

        const utilizationPromises = weeks.map(week => 
          supabase
            .from('assignments')
            .select('assignee_id')
            .eq('is_closed', false)
            .gte('close_date', week.start)
            .lte('start_date', week.end)
        );
        
        const weeklyResults = await Promise.all(utilizationPromises);
        
        const utilizationPercentages = weeklyResults.map(result => {
          if (result.error) {
            console.error('Erro ao buscar utilização semanal:', result.error);
            return 0;
          }
          const uniqueConsultants = new Set(result.data.map(a => a.assignee_id));
          return (uniqueConsultants.size / activeConsultantsCount) * 100;
        });

        setStats({
          activeProjects: activeProjectsCount,
          activeConsultants: activeConsultantsCount,
          utilization: utilizationPercentages as [number, number, number, number],
        });

      } catch (err: any) {
        console.error("❌ [Dashboard] Erro ao carregar dados do dashboard:", err);
        setError("Não foi possível carregar as métricas do dashboard.");
      } finally {
        setIsLoading(false);
      }
    };

      void fetchDashboardData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Carregar férias próximas e em andamento
  useEffect(() => {
    const fetchUpcomingVacations = async () => {
      setIsLoadingVacations(true);
      try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        // Buscar todas as férias e filtrar no frontend para garantir comparação correta
        const { data, error } = await supabase
          .from('tasks')
          .select('user_id, responsible_name, desired_start_date, desired_date')
          .eq('type_name', 'Férias')
          .order('desired_start_date', { ascending: true });

        if (error) {
          console.error('Erro ao buscar férias:', error);
        } else {
          // Filtrar apenas férias que ainda não terminaram (data fim >= hoje)
          const filteredVacations = (data || []).filter(vacation => {
            const endDate = new Date(vacation.desired_date);
            endDate.setHours(0, 0, 0, 0);
            return endDate >= today;
          });
          setUpcomingVacations(filteredVacations);
        }
      } catch (err) {
        console.error('Erro ao carregar férias:', err);
      } finally {
        setIsLoadingVacations(false);
      }
    };

    void fetchUpcomingVacations();
  }, []);

  // =====================================================================
  // ==  StatCard MODIFICADO PARA ACEITAR CORES DINÂMICAS               ==
  // =====================================================================
  const StatCard = ({ 
    title, 
    value, 
    backgroundColor, 
    textColor 
  }: { 
    title: string; 
    value: string; 
    backgroundColor?: string;
    textColor?: string;
  }) => (
    <div 
      className="card p-4 flex flex-col items-center justify-center text-center"
      style={{ backgroundColor }}
    >
      <p 
        className="text-gray-500 dark:text-gray-400 text-sm font-medium"
        style={textColor ? { color: textColor } : {}}
      >
        {title}
      </p>
      <p 
        className="text-3xl font-bold mt-2"
        style={textColor ? { color: textColor } : {}}
      >
        {value}
      </p>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Dashboard
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Visão geral das alocações e métricas
          </p>
        </div>
      </div>

      {/* Seção de Métricas Principais (Cards) */}
      {isLoading ? (
        <div className="flex items-center justify-center h-24">
          <Loader2 className="w-8 h-8 animate-spin text-gray-500" />
        </div>
      ) : error ? (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative" role="alert">
          <strong className="font-bold">Erro: </strong>
          <span className="block sm:inline">{error}</span>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6">
            <StatCard 
              title="Projetos Ativos" 
              value={stats.activeProjects.toString()} 
            />
            <StatCard 
              title="Consultores Ativos" 
              value={stats.activeConsultants.toString()} 
            />
            {/* ===================================================================== */}
            {/* ==     CARDS DE ALOCAÇÃO RENDERIZADOS DINAMICAMENTE COM CORES      == */}
            {/* ===================================================================== */}
            {stats.utilization.map((percentage, index) => {
              const style = getUtilizationStyle(percentage);
              const titles = [
                "Alocação (Semana Atual)", 
                "Alocação (+1 sem)", 
                "Alocação (+2 sem)", 
                "Alocação (+3 sem)"
              ];
              
              return (
                <StatCard 
                  key={index}
                  title={titles[index]} 
                  value={`${percentage.toFixed(0)}%`} 
                  backgroundColor={style.backgroundColor}
                  textColor={style.textColor}
                />
              );
            })}
          </div>
          
          {/* Card de Férias Próximas */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6">
            <div className="card p-4 xl:col-span-2 md:col-span-2">
              <div className="flex items-center gap-2 mb-3">
                <Calendar className="w-5 h-5 text-blue-500 dark:text-blue-400" />
                <h3 className="text-gray-700 dark:text-gray-300 text-sm font-semibold">
                  Férias
                </h3>
                {!isLoadingVacations && upcomingVacations.length > 0 && (
                  <span className="ml-auto text-xs bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 px-2 py-1 rounded-full font-medium">
                    {upcomingVacations.length}
                  </span>
                )}
              </div>
              {isLoadingVacations ? (
                <div className="flex items-center justify-center h-24">
                  <Loader2 className="w-6 h-6 animate-spin text-gray-500" />
                </div>
              ) : upcomingVacations.length === 0 ? (
                <p className="text-gray-500 dark:text-gray-400 text-sm text-center py-4">
                  Nenhuma férias agendada
                </p>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {upcomingVacations.map((vacation, index) => {
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    const startDate = new Date(vacation.desired_start_date);
                    startDate.setHours(0, 0, 0, 0);
                    const endDate = new Date(vacation.desired_date);
                    endDate.setHours(0, 0, 0, 0);
                    
                    // Verifica se está de férias agora
                    const isOnVacation = today >= startDate && today <= endDate;
                    const daysUntil = Math.ceil((startDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                    
                    return (
                      <div 
                        key={index}
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
        </>
      )}

      {/* Gráficos e Alocações Recentes (inalterados)
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card p-6">
          <h3 className="font-medium text-gray-900 dark:text-gray-100">Horas Planejadas vs Executadas</h3>
          <div className="h-64 bg-gray-100 dark:bg-gray-700 rounded flex items-center justify-center mt-4">
            <p className="text-gray-500 dark:text-gray-400">Gráfico de horas (Recharts)</p>
          </div>
        </div>
        <div className="card p-6">
          <h3 className="font-medium text-gray-900 dark:text-gray-100">Orçamento vs Real</h3>
          <div className="h-64 bg-gray-100 dark:bg-gray-700 rounded flex items-center justify-center mt-4">
            <p className="text-gray-500 dark:text-gray-400">Gráfico de orçamento (Recharts)</p>
          </div>
        </div>
      </div>
      <div className="card">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="font-medium text-gray-900 dark:text-gray-100">Alocações Recentes</h3>
        </div>
        <div className="p-6">
          <div className="bg-gray-100 dark:bg-gray-700 rounded h-32 flex items-center justify-center">
            <p className="text-gray-500 dark:text-gray-400">Tabela de alocações (AG-Grid)</p>
          </div>
        </div>
      </div> */}
    </div>
  )
}

export default Dashboard;