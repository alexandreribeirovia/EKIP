import { useState, useEffect, useRef, useMemo } from 'react';
import FullCalendar from '@fullcalendar/react';
import { EventInput, EventClickArg } from '@fullcalendar/core';
import resourceTimelinePlugin from '@fullcalendar/resource-timeline';
import interactionPlugin from '@fullcalendar/interaction';
import ptBrLocale from '@fullcalendar/core/locales/pt-br';
import Select from 'react-select';
import { supabase } from '../lib/supabaseClient';
import { DbUser } from '../types';
import EmployeeModal from '../components/EmployeeModal';
import tippy, { followCursor, Instance as TippyInstance } from 'tippy.js';
import 'tippy.js/dist/tippy.css';
import 'tippy.js/themes/light-border.css';



interface FullCalendarResource {
  id: string;
  title: string;
}

interface SelectOption {
  value: string;
  label: string;
}

const customPtBrLocale = {
  ...ptBrLocale,
  code: 'pt-br',
  firstDay: 1,
};

const secondsToHours = (sec: number | null | undefined) => {
  if (sec == null) return 'N/A';
  const h = sec / 3600;
  return `${h.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} h`;
};

const createTooltipContent = (props: any) => {
  const container = document.createElement('div');
  container.className = 'p-2 text-xs text-gray-600 leading-snug max-w-sm';
  const escapeHtml = (s: any) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

  if (props.isGroup && props.tasks && props.tasks.length > 0) {
    const projectHeader = `
      <div class="mb-2">
        <p><span class="text-gray-500">Projeto:</span> <span class="font-medium text-gray-800">${escapeHtml(props.projeto)}</span></p>
        <p><span class="text-gray-500">Cliente:</span> <span class="font-medium text-gray-800">${escapeHtml(props.cliente)}</span></p>
        <p><span class="text-gray-500">Total de Tarefas:</span> <span class="font-medium text-gray-800">${props.tasks.length}</span></p>
      </div>`;

    const tasksList = props.tasks.map((task: any) => `
      <li class="border-t border-gray-200 py-1.5">
        <p class="font-medium text-gray-800">${escapeHtml(task.tarefa)}</p>
        <div class="grid grid-cols-2 gap-x-4">
          <p><span class="text-gray-500">Início:</span> ${formatDateForTooltip(task.inicio)}</p>
          <p><span class="text-gray-500">Entrega:</span> ${formatDateForTooltip(task.entrega)}</p>
          <p><span class="text-gray-500">Hr Prev:</span> ${secondsToHours(task.hrPrevSeconds)}</p>
          <p><span class="text-gray-500">Hr Exec:</span> ${secondsToHours(task.hrExecSeconds)}</p>
        </div>
      </li>
    `).join('');
    
    container.innerHTML = `${projectHeader}<ul class="list-none p-0">${tasksList}</ul>`;
  } else {
    container.innerHTML = `
    <div class="grid grid-cols-2 gap-x-6 gap-y-1">
      <p class="col-span-2"><span class="text-gray-500">Tarefa:</span> <span class="font-medium text-gray-800">${escapeHtml(props.tarefa)}</span></p>
      <p class="col-span-2"><span class="text-gray-500">Projeto:</span> <span class="font-medium text-gray-800">${escapeHtml(props.projeto)}</span></p>
      <p class="col-span-2"><span class="text-gray-500">Cliente:</span> <span class="font-medium text-gray-800">${escapeHtml(props.cliente)}</span></p>
      <p><span class="text-gray-500">Status:</span> <span class="font-medium text-gray-800">${escapeHtml(props.status)}</span></p>
      <p><span class="text-gray-500">Fat:</span> <span class="font-medium text-gray-800">${escapeHtml(props.billing_type || 'N/A')}</span></p>
      <hr class="col-span-2 my-1 border-gray-200" />
      <div class="space-y-1">
        <p><span class="text-gray-500">Início:</span> <span class="font-medium text-gray-800">${formatDateForTooltip(props.inicio)}</span></p>
        <p><span class="text-gray-500">Hr Prev:</span> <span class="font-medium text-gray-800">${secondsToHours(props.hrPrevSeconds)}</span></p>
      </div>
      <div class="space-y-1">
        <p><span class="text-gray-500">Entrega:</span> <span class="font-medium text-gray-800">${formatDateForTooltip(props.entrega)}</span></p>
        <p><span class="text-gray-500">Hr Exec:</span> <span class="font-medium text-gray-800">${secondsToHours(props.hrExecSeconds)}</span></p>
      </div>
    </div>`;
  }
  return container;
};

const formatDateForTooltip = (dateString: string | null) => {
  if (!dateString) return 'N/A';
  const datePart = dateString.substring(0, 10);
  const [year, month, day] = datePart.split('-');
  return `${day}/${month}/${year}`;
};

// Função para formatar as habilidades do usuário (similar à da tela de funcionários)
const formatUserSkills = (userSkills: any[]): string => {
  if (!userSkills || userSkills.length === 0) {
    return '';
  }

  return userSkills
    .map(userSkill => {
      const skill = userSkill.skills;
      if (!skill) return '';
      
      if (skill.area === 'ZENDESK' && !skill.category && !skill.skill) {
        return 'ZENDESK';
      }
      
      if (skill.area === 'DADOS' && skill.category && !skill.skill) {
        return skill.category;
      }
      
      if (skill.area === 'DEV' && skill.category && skill.skill) {
        return `${skill.category} - ${skill.skill}`;
      }
      
      // Fallback para outros casos
      const parts = [];
      if (skill.area) parts.push(skill.area);
      if (skill.category && skill.category !== skill.area) parts.push(skill.category);
      if (skill.skill && skill.skill !== skill.category) parts.push(skill.skill);
      
      return parts.join(' - ') || '';
    })
    .filter(skill => skill.length > 0)
    .join(', ');
};


const Allocations = () => {
  const calendarRef = useRef<FullCalendar>(null);
  const initialLoadRef = useRef(true);
  const cardRef = useRef<HTMLDivElement>(null);
  const hasLoadedUsers = useRef(false);
  const hasLoadedProjects = useRef(false);
  const loadedAssignmentsKeys = useRef<Set<string>>(new Set());
  const skillsFilterCache = useRef<Map<string, any>>(new Map());
  
  const [resources, setResources] = useState<FullCalendarResource[]>([]);
  const [allEvents, setAllEvents] = useState<EventInput[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPresentationMode, setIsPresentationMode] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'Aberto' | 'Fechado' | 'Todos'>('Aberto');
  const [selectedConsultants, setSelectedConsultants] = useState<string[]>([]);
  const [availableProjects, setAvailableProjects] = useState<SelectOption[]>([]);
  const [selectedProjects, setSelectedProjects] = useState<string[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<DbUser | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isGrouped, setIsGrouped] = useState(false);
  const [skillFilter, setSkillFilter] = useState<string>('');
  const [filteredResourcesBySkills, setFilteredResourcesBySkills] = useState<FullCalendarResource[]>([]);

  const menuPortalTarget = (isPresentationMode && cardRef.current) ? cardRef.current : document.body


  // ... (useMemo e funções de manipulação de eventos inalteradas) ...
  const filteredResources = useMemo(() => {
    const hasOtherFilters = selectedConsultants.length > 0 || selectedProjects.length > 0;
    
    // Começa com os recursos filtrados por skills
    let baseResources = skillFilter.length > 0 ? filteredResourcesBySkills : resources;
    
    if (!hasOtherFilters) {
      return baseResources;
    }
    
    // Aplica filtros adicionais baseados em eventos visíveis
    const visibleConsultantIds = new Set(allEvents.map(event => event.resourceId));
    return baseResources.filter(resource => visibleConsultantIds.has(resource.id));
  }, [resources, filteredResourcesBySkills, allEvents, selectedConsultants, selectedProjects, skillFilter]);


  const handleResourceClick = async (userId: string) => {
    try {
      const { data, error } = await supabase.from('users').select('*').eq('user_id', userId).single();
      if (error) {
        console.error("Erro ao buscar detalhes do funcionário:", error);
        return;
      }
      if (data) {
        setSelectedEmployee(data);
        setIsModalOpen(true);
      }
    } catch (err: any) {
      console.error("Erro ao buscar detalhes do funcionário:", err);
    }
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedEmployee(null);
  };

  const togglePresentationMode = () => {
    const cardElement = cardRef.current;
    if (!cardElement) return;
    if (!document.fullscreenElement) {
      cardElement.requestFullscreen().catch(err => console.error(err));
    } else {
      void document.exitFullscreen();
    }
  };
  
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsPresentationMode(!!document.fullscreenElement);
      setTimeout(() => calendarRef.current?.getApi().updateSize(), 100);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const getCurrentDateInSaoPaulo = () => new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
  
  const getInitialCalendarDate = () => {
    const date = getCurrentDateInSaoPaulo();
    date.setMonth(date.getMonth() - 8);
    return date;
  };

const OFFSET_DIAS = 10; // Distancia da linha vermelha até a borda esquerda quando clica em "Hoje"
const LEAD_FRACTION = 0.35;

const scrollToNow = () => {
  try {
    const api = calendarRef.current?.getApi();
    if (!api) {
      return;
    }

    const view = api.view;
    const now = getCurrentDateInSaoPaulo();
    const start = new Date(view.activeStart);
    const diffMs = now.getTime() - start.getTime();

    if (diffMs >= 0) {
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      const adjustedHours = Math.max(0, diffHours - (OFFSET_DIAS * 24)); 
      const durationStr = `${adjustedHours}:00:00`;
      
      api.scrollToTime(durationStr);

      setTimeout(() => {
        const moved = verifyHorizontalScrollMoved();
        if (!moved) {
          scrollToNowFallbackDOM();
        }
      }, 60);
      return;
    } else {
      scrollToNowFallbackDOM();
    }
  } catch (e) {
    console.error('[Hoje] erro inesperado na API; fallback DOM', e);
    scrollToNowFallbackDOM();
  }
};

/** Verifica se o scroller andou (debug) */
const verifyHorizontalScrollMoved = () => {
  const root = document.getElementById('calendar-container');
  const scroller =
    root?.querySelector<HTMLElement>('.fc-scrollgrid-section-body .fc-scroller') ||
    root?.querySelector<HTMLElement>('.fc-timeline-body .fc-scroller');
  if (!scroller) return false;
  return scroller.scrollLeft > 0;
};

const scrollToNowFallbackDOM = () => {
  const root = document.getElementById('calendar-container');
  if (!root) return;

  const timeScroller =
    root.querySelector<HTMLElement>('.fc-scrollgrid-section-body .fc-scroller') ||
    root.querySelector<HTMLElement>('.fc-timeline-body .fc-scroller');
  const headerScroller =
    root.querySelector<HTMLElement>('.fc-scrollgrid-section-header .fc-scroller') ||
    root.querySelector<HTMLElement>('.fc-timeline-header .fc-scroller');
  if (!timeScroller) return;

  const getLeftInsideScroller = (el: HTMLElement) => {
    const elRect = el.getBoundingClientRect();
    const scRect = timeScroller.getBoundingClientRect();
    return timeScroller.scrollLeft + (elRect.left - scRect.left);
  };

  let target: HTMLElement | null =
    root.querySelector<HTMLElement>('.fc-timeline-body .fc-now-indicator');

  if (!target) {
    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    target =
      root.querySelector<HTMLElement>(`.fc-timeline-body [data-date^="${today}"]`) ||
      root.querySelector<HTMLElement>(`.fc-timeline-header [data-date^="${today}"]`);
  }
  if (!target) return;

  const targetDateStr = target.getAttribute('data-date')?.slice(0, 10);
  let dayWidth: number | null = null;
  if (targetDateStr) {
    const d = new Date(targetDateStr + 'T00:00:00');
    const next = new Date(d); next.setDate(d.getDate() + 1);
    const nextSel = `[data-date^="${next.toISOString().slice(0,10)}"]`;
    const nextEl =
      root.querySelector<HTMLElement>('.fc-timeline-body ' + nextSel) ||
      root.querySelector<HTMLElement>('.fc-timeline-header ' + nextSel);
    if (nextEl) {
      const left1 = getLeftInsideScroller(target as HTMLElement);
      const left2 = getLeftInsideScroller(nextEl);
      dayWidth = Math.max(0, left2 - left1);
    }
  }

  const targetLeft = getLeftInsideScroller(target);
  let desiredLeft: number;

  if (dayWidth && dayWidth > 0) {
    const offsetPx = OFFSET_DIAS * dayWidth;
    desiredLeft = Math.max(0, targetLeft - offsetPx);
  } else {
    desiredLeft = Math.max(0, targetLeft - (timeScroller.clientWidth * LEAD_FRACTION));
  }

  timeScroller.scrollTo({ left: desiredLeft, behavior: 'smooth' });
  if (headerScroller) headerScroller.scrollLeft = desiredLeft;
};


  const handleEventClick = (clickInfo: EventClickArg) => {
    clickInfo.jsEvent.preventDefault(); 
    if (clickInfo.event.extendedProps.isGroup) {
      return;
    }
    const runrunTaskId = clickInfo.event.extendedProps.runrunTaskId;
    if (runrunTaskId) {
      window.open(`https://secure.runrun.it/pt-BR/tasks/${runrunTaskId}`, '_blank');
    }
  };
  
  useEffect(() => {
    if (!hasLoadedUsers.current) {
      hasLoadedUsers.current = true;
      
      const fetchUsers = async () => {
        try {
          const { data, error } = await supabase.from('users').select('*').eq('is_active', true).order('name');
          if (error) {
            console.error("Erro ao buscar consultores:", error);
            setError("Não foi possível carregar os consultores.");
            return;
          }
          const calendarResources = (data as DbUser[]).map(user => ({
            id: user.user_id!.trim(),
            title: user.name || 'Usuário sem nome'
          }));
          setResources(calendarResources);
        } catch (err: any) {
          console.error("Erro ao buscar consultores:", err);
          setError("Não foi possível carregar os consultores.");
        }
      };
      void fetchUsers();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!hasLoadedProjects.current) {
      hasLoadedProjects.current = true;
      
      const fetchProjects = async () => {
        try {
          const { data, error } = await supabase.rpc('get_distinct_projects');
          if (error) {
            console.error("Erro ao buscar lista de projetos:", error);
            return;
          }
          const projectOptions = data.map((p: { project_name: string }) => ({
            value: p.project_name,
            label: p.project_name,
          }));
          setAvailableProjects(projectOptions);
        } catch (err: any) {
          console.error("Erro ao buscar lista de projetos:", err);
        }
      };
      void fetchProjects();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Effect para filtrar recursos por skills
  useEffect(() => {
    const filterResourcesBySkills = async () => {
      if (skillFilter.length === 0) {
        setFilteredResourcesBySkills(resources);
        return;
      }

      // Verifica cache
      const cacheKey = `skills-${skillFilter}`;
      if (skillsFilterCache.current.has(cacheKey)) {
        const cachedData = skillsFilterCache.current.get(cacheKey);
        const filtered = resources.filter(resource => 
          cachedData.userIds.includes(resource.id)
        );
        setFilteredResourcesBySkills(filtered);
        return;
      }

      try {
        // Busca todos os usuários com suas skills
        const { data, error } = await supabase
          .from('users')
          .select(`
            user_id,
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
          .eq('is_active', true);

        if (error) {
          console.error("Erro ao filtrar recursos por skills:", error);
          setFilteredResourcesBySkills(resources);
          return;
        }

        // Filtra usuários que possuem a skill pesquisada
        const filtered = resources.filter(resource => {
          const user = (data || []).find(u => u.user_id === resource.id);
          if (!user || !user.users_skill) return false;
          
          const userSkillsText = formatUserSkills(user.users_skill);
          return userSkillsText.toLowerCase().includes(skillFilter.toLowerCase());
        });

        // Armazena no cache
        skillsFilterCache.current.set(cacheKey, {
          userIds: filtered.map(r => r.id)
        });

        setFilteredResourcesBySkills(filtered);
      } catch (err: any) {
        console.error("❌ Erro ao filtrar recursos por skills:", err);
        setFilteredResourcesBySkills(resources);
      }
    };

    void filterResourcesBySkills();
  }, [skillFilter, resources]);

  useEffect(() => {
    // Cria uma chave única baseada nos filtros atuais
    const filterKey = `${statusFilter}-${selectedConsultants.sort().join(',')}-${selectedProjects.sort().join(',')}-${isGrouped}`;
    
    // Se já carregou com esses filtros, pula
    if (loadedAssignmentsKeys.current.has(filterKey)) {
      return;
    }

    // Marca como carregado
    loadedAssignmentsKeys.current.add(filterKey);

    const fetchAssignments = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const startDate = new Date();
        startDate.setMonth(startDate.getMonth() - 18);

        const params = {
          _consultant_ids: selectedConsultants,
          _project_names: selectedProjects,
          _status: statusFilter === 'Todos' ? null : (statusFilter === 'Fechado'),
          _start_date: startDate.toISOString()
        };

        const { data: assignmentsData, error: assignmentsError } = await supabase
          .rpc('get_filtered_assignments', params)
          .select('*, tasks(*)'); 

        if (assignmentsError) {
          console.error("Erro ao buscar alocações:", assignmentsError);
          setError("Não foi possível carregar as alocações.");
          return;
        }

        let finalEvents: EventInput[] = [];

        if (isGrouped) {
          const groupedAssignments: { [key: string]: any } = {};
          const individualEvents: EventInput[] = [];

          for (const assignment of (assignmentsData || [])) {
            const task = assignment.tasks;
            if (!task) continue;
            
            let start: string | null = null, end: string | null = null;
            const hasPlanStart = !!task.gantt_bar_start_date;
            const hasPlanEnd   = !!task.gantt_bar_end_date;

            if (!assignment.is_closed) {
              if (!hasPlanStart && !hasPlanEnd) continue;
              else if (hasPlanStart && hasPlanEnd) { start = task.gantt_bar_start_date!; end = task.gantt_bar_end_date!; }
              else if (!hasPlanStart && hasPlanEnd) { start = assignment.created_at!; end = task.gantt_bar_end_date!; }
              else continue;
            } else {
              if (!assignment.close_date) continue;
              if (!hasPlanStart) { start = assignment.created_at!; end = assignment.close_date!; }
              else { start = task.gantt_bar_start_date!; end = assignment.close_date!; }
            }
            if (!assignment.assignee_id || !start || !end || end < start) continue;
            
            const taskDetails = { tarefa: task.title || 'N/A', inicio: start, entrega: end, hrPrevSeconds: assignment.current_estimate_seconds ?? null, hrExecSeconds: assignment.time_worked ?? null, runrunTaskId: task.task_id };
            
            const isHoliday = task.type_name === 'Férias' || task.type_name === 'Happy day';
            const shouldGroup = !isHoliday && (
              (statusFilter === 'Aberto' && !assignment.is_closed) ||
              (statusFilter === 'Fechado' && assignment.is_closed) ||
              (statusFilter === 'Todos')
            );

            if (shouldGroup) {
              const groupKey = `${assignment.assignee_id}-${task.client_name}-${task.project_name}`;
              if (!groupedAssignments[groupKey]) {
                groupedAssignments[groupKey] = { minStartDate: new Date(start), maxEndDate: new Date(end), assignee_id: assignment.assignee_id, client_name: task.client_name || 'SC', project_name: task.project_name || 'SP', tasks: [taskDetails], is_closed: assignment.is_closed };
              } else {
                const group = groupedAssignments[groupKey];
                group.minStartDate = new Date(start) < group.minStartDate ? new Date(start) : group.minStartDate;
                group.maxEndDate = new Date(end) > group.maxEndDate ? new Date(end) : group.maxEndDate;
                group.tasks.push(taskDetails);
              }
            } else {
              let backgroundColor = '#3b82f6', borderColor = '#2563eb';
              if (isHoliday) { backgroundColor = '#facc15'; borderColor = '#eab308'; }
              else if (assignment.is_closed) { backgroundColor = '#6b7280'; borderColor = '#4b5563'; }
              
              individualEvents.push({ id: String(assignment.id), resourceId: assignment.assignee_id.trim(), title: `[${task.client_name || 'SC'}] ${task.project_name || 'SP'} - ${task.title}`, start, end, backgroundColor, borderColor, classNames: assignment.is_closed ? ['opacity-70'] : [], extendedProps: { ...taskDetails, projeto: task.project_name || 'N/A', cliente: task.client_name || 'N/A', status: assignment.is_closed ? 'Fechado' : 'Aberto', billing_type: task.billing_type || 'N/A', isGroup: false } });
            }
          }

          const groupedEvents: EventInput[] = [];
          Object.values(groupedAssignments).forEach((group, groupIndex) => {
            if (group.tasks.length === 0) return;

            // Ordena as tarefas pela data de início
            group.tasks.sort((a: any, b: any) => new Date(a.inicio).getTime() - new Date(b.inicio).getTime());

            let currentSegment: { minStartDate: Date; maxEndDate: Date; tasks: any[] } | null = null;

            for (const task of group.tasks) {
              const taskStart = new Date(task.inicio);
              const taskEnd = new Date(task.entrega);

              if (currentSegment === null) {
                // Inicia o primeiro segmento
                currentSegment = { minStartDate: taskStart, maxEndDate: taskEnd, tasks: [task] };
              } else {
                // Verifica o intervalo entre o fim do segmento atual e o início da nova tarefa
                const segmentEnd = new Date(currentSegment.maxEndDate);
                let nextWorkDay = new Date(segmentEnd);
                
                // Pula para o próximo dia útil
                do {
                  nextWorkDay.setDate(nextWorkDay.getDate() + 1);
                } while (nextWorkDay.getDay() === 0 || nextWorkDay.getDay() === 6); // Pula Sábado (6) e Domingo (0)

                if (taskStart <= nextWorkDay) {
                  // A tarefa é contígua ou se sobrepõe, então extende o segmento
                  if (taskEnd > currentSegment.maxEndDate) {
                    currentSegment.maxEndDate = taskEnd;
                  }
                  currentSegment.tasks.push(task);
                } else {
                  // Há um gap, então finaliza o segmento atual e começa um novo
                  const endDate = new Date(currentSegment.maxEndDate);
                  endDate.setDate(endDate.getDate() + 1);
                  
                  let backgroundColor = '#3b82f6', borderColor = '#2563eb';
                  if (group.is_closed) { backgroundColor = '#6b7280'; borderColor = '#4b5563'; }

                  groupedEvents.push({
                    id: `group-${group.assignee_id}-${groupIndex}-${groupedEvents.length}`,
                    resourceId: group.assignee_id.trim(),
                    title: `[${group.client_name}] ${group.project_name} (${currentSegment.tasks.length} tarefas)`,
                    start: currentSegment.minStartDate.toISOString().slice(0, 10),
                    end: endDate.toISOString().slice(0, 10),
                    backgroundColor,
                    borderColor,
                    classNames: group.is_closed ? ['opacity-70'] : [],
                    extendedProps: { isGroup: true, tasks: currentSegment.tasks, projeto: group.project_name, cliente: group.client_name }
                  });

                  // Inicia novo segmento
                  currentSegment = { minStartDate: taskStart, maxEndDate: taskEnd, tasks: [task] };
                }
              }
            }

            // Adiciona o último segmento
            if (currentSegment) {
              const endDate = new Date(currentSegment.maxEndDate);
              endDate.setDate(endDate.getDate() + 1);
              
              let backgroundColor = '#3b82f6', borderColor = '#2563eb';
              if (group.is_closed) { backgroundColor = '#6b7280'; borderColor = '#4b5563'; }

              groupedEvents.push({
                id: `group-${group.assignee_id}-${groupIndex}-${groupedEvents.length}`,
                resourceId: group.assignee_id.trim(),
                title: `[${group.client_name}] ${group.project_name} (${currentSegment.tasks.length} tarefas)`,
                start: currentSegment.minStartDate.toISOString().slice(0, 10),
                end: endDate.toISOString().slice(0, 10),
                backgroundColor,
                borderColor,
                classNames: group.is_closed ? ['opacity-70'] : [],
                extendedProps: { isGroup: true, tasks: currentSegment.tasks, projeto: group.project_name, cliente: group.client_name }
              });
            }
          });
          
          finalEvents = [...groupedEvents, ...individualEvents];
        
        } else {
          for (const assignment of (assignmentsData || [])) {
            const task = assignment.tasks;
            if (!task) continue;
            let start: string | null = null, end: string | null = null;
            const hasPlanStart = !!task.gantt_bar_start_date;
            const hasPlanEnd   = !!task.gantt_bar_end_date;

            if (!assignment.is_closed) {
              if (!hasPlanStart && !hasPlanEnd) continue;
              else if (hasPlanStart && hasPlanEnd) { start = task.gantt_bar_start_date!; end = task.gantt_bar_end_date!; }
              else if (!hasPlanStart && hasPlanEnd) { start = assignment.created_at!; end = task.gantt_bar_end_date!; }
              else continue;
            } else {
              if (!assignment.close_date) continue;
              if (!hasPlanStart) { start = assignment.created_at!; end = assignment.close_date!; }
              else { start = task.gantt_bar_start_date!; end = assignment.close_date!; }
            }
            if (!assignment.assignee_id || !start || !end || end < start) continue;
            
            let backgroundColor = '#3b82f6', borderColor = '#2563eb';
            if (task.type_name === 'Férias' || task.type_name === 'Happy day') { backgroundColor = '#facc15'; borderColor = '#eab308'; }
            else if (assignment.is_closed) { backgroundColor = '#6b7280'; borderColor = '#4b5563'; }
            
            const newEvent: EventInput = {
              id: String(assignment.id), 
              resourceId: assignment.assignee_id.trim(),
              title: `[${task.client_name || 'SC'}] ${task.project_name || 'SP'} - ${task.title}`,
              start, end, backgroundColor, borderColor,
              classNames: assignment.is_closed ? ['opacity-70'] : [],
              extendedProps: { runrunTaskId: task.task_id, tarefa: task.title || 'N/A', projeto: task.project_name || 'N/A', cliente: task.client_name || 'N/A', status: assignment.is_closed ? 'Fechado' : 'Aberto', inicio: start, entrega: end, hrPrevSeconds: assignment.current_estimate_seconds ?? null, hrExecSeconds: assignment.time_worked ?? null, billing_type: task.billing_type || 'N/A', isGroup: false }
            };
            finalEvents.push(newEvent);
          }
        }
        
        setAllEvents(finalEvents);
        

      } catch (err: any) {
        console.error("Erro ao buscar alocações:", err);
        setError("Não foi possível carregar as alocações.");
      } finally {
        setIsLoading(false);
        requestAnimationFrame(() => scrollToNow());
      }
    };
    void fetchAssignments();
  }, [statusFilter, selectedConsultants, selectedProjects, isGrouped]);

  

const handleDatesSet = () => {
  if (initialLoadRef.current) {
    requestAnimationFrame(() => scrollToNow());
    initialLoadRef.current = false;
  }
};

  const handleTodayButtonClick = () => {
    requestAnimationFrame(() => scrollToNow());
  };
  
  const consultantOptions = useMemo(() => 
    resources.map(r => ({ value: r.id, label: r.title })),
    [resources]
  );

  if (isLoading && initialLoadRef.current) {
    return <div className="flex justify-center items-center h-full"><p>Carregando alocações...</p></div>;
  }
  if (error) {
    return <div className="flex justify-center items-center h-full"><p className="text-red-500">{error}</p></div>;
  }

  return (
    <div className="space-y-6 h-full flex flex-col">
      <div ref={cardRef} className="card p-4 flex-1 flex flex-col fullscreen-card overflow-visible">
        
        <div className="flex justify-between items-center mb-4">
          <div>
            <button
              onClick={handleTodayButtonClick}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 focus:outline-none focus:ring-1 focus:ring-orange-500 focus:border-transparent transition-colors"
            >
              Hoje
            </button>
          </div>

          <div className="flex items-center gap-4">
             <div className="flex items-center gap-2">
              {/* <label className="text-sm text-gray-700 dark:text-gray-300 whitespace-nowrap">Consultor:</label> */}
              <div className="w-96">
                <Select
                  key={isPresentationMode ? 'select-fs' : 'select-nf'}
                  isMulti
                  options={consultantOptions}
                  onChange={(options) => setSelectedConsultants(options.map(o => o.value))}
                  placeholder="Filtrar consultor"
                  className="text-sm w-full react-select-container"
                  classNamePrefix="react-select"
                  menuPortalTarget={menuPortalTarget}
                  menuPosition={'fixed'}
                />
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              {/* <label className="text-sm text-gray-700 dark:text-gray-300">Projeto:</label> */}
              <div className="w-96">
                <Select
                  key={isPresentationMode ? 'select-fs' : 'select-nf'}
                  isMulti
                  options={availableProjects}
                  onChange={(options) => setSelectedProjects(options.map(o => o.value))}
                  placeholder="Filtrar projeto"
                  className="text-sm w-full react-select-container"
                  classNamePrefix="react-select"
                  menuPortalTarget={menuPortalTarget}
                  menuPosition={'fixed'}
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* <label className="text-sm text-gray-700 dark:text-gray-300">Habilidade:</label> */}
              <div className="w-96">
                <input
                  type="text"
                  placeholder="Filtrar habilidade"
                  value={skillFilter}
                  onChange={(e) => setSkillFilter(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-orange-500 focus:border-transparent"
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
               {/* <label htmlFor="statusFilter" className="text-sm text-gray-700 dark:text-gray-300">Status:</label> */}

              <select 
                id="statusFilter" 
                value={statusFilter} 
                onChange={(e) => setStatusFilter(e.target.value as 'Aberto' | 'Fechado' | 'Todos')} 
                className="w-full lg:w-auto px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-orange-500 focus:border-transparent"
              >
                <option value="Aberto">Aberto</option>
                <option value="Fechado">Fechado</option>
                <option value="Todos">Todos</option>
              </select>
            </div>

            <div className="flex items-center gap-2 pl-2">
              <input 
                type="checkbox"
                id="groupingCheckbox"
                checked={isGrouped}
                onChange={(e) => setIsGrouped(e.target.checked)}

                className="h-4 w-4 rounded border-gray-300 text-orange-600 focus:ring-orange-500"
              />
              <label 
                htmlFor="groupingCheckbox" 
                className="text-sm text-gray-700 dark:text-gray-300"
              >
                Agrupado
              </label>
            </div>
          </div>

          <div>
            <button 
              onClick={togglePresentationMode} 
              className="p-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 focus:outline-none focus:ring-1 focus:ring-orange-500 focus:border-transparent transition-colors"
              title={isPresentationMode ? "Sair do modo apresentação" : "Modo apresentação"}
            >
              {isPresentationMode ? (
                <svg width="20" height="20" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"></path></svg>
              ) : (
                <svg width="20" height="20" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"></path></svg>
              )}
            </button>
          </div>
        </div>
        
        <div className="w-full flex-1" id="calendar-container">
          <FullCalendar
            ref={calendarRef}
            plugins={[resourceTimelinePlugin, interactionPlugin]}
            initialView="resourceTimelineDay"
            initialDate={getInitialCalendarDate()}
            headerToolbar={false}
            timeZone="America/Sao_Paulo"
            locales={[customPtBrLocale]}
            locale="pt-br"
            nowIndicator={true}
            nowIndicatorClassNames="fc-now-indicator"
            datesSet={handleDatesSet}
            stickyHeaderDates={true}
            stickyFooterScrollbar={true}
            views={{
              resourceTimelineDay: {
                type: 'resourceTimeline',
                duration: { weeks: 57 },
                slotDuration: { days: 1 },
                hiddenDays: [ 0, 6 ], 
                slotLabelFormat: [ { week: 'long' }, { day: 'numeric' } ],
                slotLabelContent: (arg) => {
                  if (arg.level === 0) {
                    const startDate = new Date(arg.date);
                    const dayOfWeek = startDate.getDay()+1;
                    const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
                    startDate.setDate((startDate.getDate()+1) + diffToMonday);
                    const endDate = new Date(startDate);
                    endDate.setDate(startDate.getDate() + 4);
                    const fmt = (dt: Date) => `${String(dt.getDate()).padStart(2, '0')}/${String(dt.getMonth() + 1).padStart(2, '0')}`;
                    return `${fmt(startDate)} - ${fmt(endDate)}`;
                  }
                  return arg.text;
                }
              }
            }}
            businessHours={{ daysOfWeek: [1, 2, 3, 4, 5] }}
            contentHeight="auto"
            slotMinWidth={30}
            resources={filteredResources}
            events={allEvents}
            resourceAreaWidth="18%"
            resourceAreaHeaderContent="Consultores"
            resourceLabelContent={(arg) => {
              return (
                <div 
                  className="w-full h-full flex items-center cursor-pointer hover:bg-gray-100 px-2 -mx-2"
                  onClick={() => handleResourceClick(arg.resource.id)}
                >
                  {arg.resource.title}
                </div>
              )
            }}
            displayEventTime={false}
            buttonText={{ today: 'Hoje' }}
            height="100%"
            eventDidMount={(info) => {
              const { extendedProps } = info.event;
              tippy(info.el, {
                content: createTooltipContent(extendedProps),
                allowHTML: true,
                theme: 'light-border',
                appendTo: () => (document.fullscreenElement ?? document.body),     
                placement: 'top',             
                followCursor: true,           
                plugins: [followCursor],      
                offset: [0, 8],               
                delay: [400, 0],
                trigger: 'mouseenter focus',
              });
            }}
            eventWillUnmount={(info) => {
              const tippyInstance = (info.el as any)._tippy as TippyInstance;
              if (tippyInstance) {
                  tippyInstance.destroy();
              }
            }}
            eventClick={handleEventClick}
          />
        </div>
      </div>
      
      <EmployeeModal
        employee={selectedEmployee}
        isOpen={isModalOpen}
        onClose={closeModal}
      />
    </div>
  );
};

export default Allocations;