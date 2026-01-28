// src/pages/ProjectDetail.tsx

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { AgGridReact } from 'ag-grid-react';
import { ColDef, RowClickedEvent } from 'ag-grid-community';
import { ArrowLeft, Loader2, Search, Plus, CheckCircle, XCircle, X, Trash2, Clock, BarChart3, ChevronDown, ChevronRight, PieChart, Edit, Maximize, Copy, List, Columns, User } from 'lucide-react';
import Select from 'react-select';
import { PieChart as RechartsPieChart, Pie, Cell, ResponsiveContainer, Tooltip, LineChart, Line, XAxis, YAxis, CartesianGrid, Legend, ReferenceLine, ReferenceArea, BarChart, Bar, LabelList } from 'recharts';
import * as apiClient from '../lib/apiClient';
import { DbProject, DbTask, DbRisk, DbDomain, DbProjectOwner, DbUser, DbProjectPhase, DbAccessPlatform, DbAccessPlatformGrouped, TimeEntryGrouped } from '../types';
import AssigneeCellRenderer from '../components/AssigneeCellRenderer.tsx';
import ProjectOwnerRenderer from '../components/ProjectOwnerRenderer.tsx';
import ProjectProgressModal from '../components/ProjectProgressModal.tsx';
import RiskModal from '../components/RiskModal.tsx';
import AccessModal from '../components/AccessModal.tsx';
import HtmlCellRenderer from '../components/HtmlCellRenderer.tsx';

interface SelectOption {
  value: string;
  label: string;
}

const NotificationToast = ({ type, message, onClose }: { 
  type: 'success' | 'error', 
  message: string, 
  onClose: () => void 
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [progress, setProgress] = useState(100);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Função para limpar todos os timers
  const clearTimers = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
  }, []);

  // Função para iniciar os timers
  const startTimers = useCallback(() => {
    clearTimers();
    
    // Criar timeout baseado no progresso atual
    const remainingTime = (progress / 100) * 10000;
    
    timeoutRef.current = setTimeout(() => {
      onClose();
    }, remainingTime);
    
    // Criar interval para atualizar barra de progresso
    progressIntervalRef.current = setInterval(() => {
      setProgress(prev => {
        const newProgress = prev - 1; // Diminui 1% a cada 100ms
        if (newProgress <= 0) {
          return 0;
        }
        return newProgress;
      });
    }, 100);
  }, [progress, onClose, clearTimers]);

  // Effect para controlar os timers baseado no hover
  useEffect(() => {
    if (!isHovered) {
      startTimers();
    } else {
      clearTimers();
    }

    // Cleanup ao desmontar
    return () => {
      clearTimers();
    };
  }, [isHovered, startTimers, clearTimers]);

  // Effect inicial para começar os timers
  useEffect(() => {
    startTimers();
    return () => {
      clearTimers();
    };
  }, []);

  const handleMouseEnter = useCallback(() => {
    setIsHovered(true);
  }, []);

  const handleMouseLeave = useCallback(() => {
    setIsHovered(false);
  }, []);

  const toastContent = (
    <div 
      className={`fixed top-4 right-4 z-[9999] rounded-xl shadow-2xl animate-slide-in-from-top border ${
        type === 'success' 
          ? 'bg-gradient-to-r from-green-50 to-green-100 border-green-200 text-green-800' 
          : 'bg-gradient-to-r from-red-50 to-red-100 border-red-200 text-red-800'
      } transform transition-all duration-300 ease-out max-w-md cursor-pointer overflow-hidden`}
      style={{ 
        position: 'fixed',
        top: '4rem',
        right: '1rem',
        zIndex: 9999,
        pointerEvents: 'auto'
      }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Barra de progresso */}
      <div className={`h-1 transition-all duration-100 ease-linear ${
        type === 'success' ? 'bg-green-500' : 'bg-red-500'
      }`} style={{ width: `${progress}%` }} />
      
      {/* Conteúdo do toast */}
      <div className="flex items-center gap-3 px-5 py-4">
        <div className={`flex items-center justify-center w-8 h-8 rounded-full ${
          type === 'success' ? 'bg-green-500' : 'bg-red-500'
        }`}>
          {type === 'success' ? (
            <CheckCircle className="w-5 h-5 text-white" />
          ) : (
            <XCircle className="w-5 h-5 text-white" />
          )}
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold">{type === 'success' ? 'Sucesso!' : 'Erro!'}</p>
          <p className="text-xs opacity-90 whitespace-pre-line">{message}</p>
        </div>
        <button 
          onClick={onClose}
          className={`ml-2 p-1 rounded-full transition-colors ${
            type === 'success' 
              ? 'text-green-400 hover:text-green-600 hover:bg-green-200' 
              : 'text-red-400 hover:text-red-600 hover:bg-red-200'
          }`}
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );

  return createPortal(toastContent, document.body);
};

const ProgressBarRenderer = (params: { value: number }) => {
  const percentage = params.value ? params.value * 100 : 0;
  const isOverBudget = percentage > 100;

  const barWidth = Math.min(percentage, 100);
  const barColorClass = isOverBudget ? 'bg-red-500' : 'bg-blue-500';
  const percentageText = percentage.toFixed(0);

  return (
    <div className="flex items-center h-full gap-2">
      <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-4">
        <div
          className={`${barColorClass} h-4 rounded-full`}
          style={{ width: `${barWidth}%` }}
        ></div>
      </div>
      <span className="text-xs font-medium text-gray-700 dark:text-gray-300 w-10 text-right">{percentageText}%</span>
    </div>
  );
};

// Componente para renderizar badges de Tipo com cores
const RiskTypeBadge = ({ value }: { value: string }) => {
  const getTypeColor = (type: string) => {
    switch (type.toLowerCase()) {
      case 'tarefa':
        return 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300';
      case 'informação':
        return 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300';
      case 'problema':
        return 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300';
      case 'risco':
        return 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300';
      default:
        return 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300';
    }
  };

  return (
    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getTypeColor(value)}`}>
      {value}
    </span>
  );
};

// Componente para renderizar badges de Prioridade com cores
const RiskPriorityBadge = ({ value }: { value: string }) => {
  const getPriorityColor = (priority: string) => {
    switch (priority.toLowerCase()) {
      case 'baixa':
        return 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300';
      case 'média':
        return 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300';
      case 'alta':
        return 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300';
      case 'bloqueante':
        return 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300';
      default:
        return 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300';
    }
  };

  return (
    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getPriorityColor(value)}`}>
      {value}
    </span>
  );
};

// Componente para renderizar badges de Status com cores
// Componente para renderizar cards de tarefas no Kanban
const KanbanCard = ({ 
  task, 
  onClick 
}: { 
  task: DbTask; 
  onClick: (task: DbTask) => void;
}) => {
  // Determinar cor do card baseado no status
  const getCardStyle = () => {
    // Verde para tarefas entregues
    if (task.is_closed) {
      return 'border-l-4 border-l-green-500 bg-green-50 dark:bg-green-900/20';
    }
    // Vermelho para tarefas atrasadas
    if (task.gantt_bar_end_date) {
      const endDate = new Date(task.gantt_bar_end_date);
      const currentDate = new Date();
      endDate.setHours(0, 0, 0, 0);
      currentDate.setHours(0, 0, 0, 0);
      if (currentDate > endDate) {
        return 'border-l-4 border-l-red-500 bg-red-50 dark:bg-red-900/20';
      }
    }
    // Amarelo para tarefas não planejadas
    if (!task.gantt_bar_end_date) {
      return 'border-l-4 border-l-yellow-500 bg-yellow-50 dark:bg-yellow-900/20';
    }
    // Default
    return 'border-l-4 border-l-gray-300 bg-white dark:bg-gray-800';
  };

  const formatCardDate = (dateString: string | null) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('pt-BR');
  };

  const formatCardHours = (seconds: number | null) => {
    if (seconds === null || seconds === 0) return '00h00';
    const roundedMinutes = Math.round(seconds / 60);
    const hours = Math.floor(roundedMinutes / 60);
    const minutes = roundedMinutes % 60;
    return `${hours.toString().padStart(2, '0')}h${minutes.toString().padStart(2, '0')}`;
  };

  return (
    <div
      onClick={() => onClick(task)}
      className={`${getCardStyle()} rounded-lg shadow-sm hover:shadow-md transition-shadow cursor-pointer p-3 mb-2 pt-1 pb-0.5`} 
    >
      {/* Título */}
      <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-2 line-clamp-2">
        {task.title}
      </h4>
      
      {/* Tipo */}
      {task.type_name && (
        <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 mb-2">
          {task.type_name}
        </span>
      )}
      
      {/* Datas */}
      <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 mb-2">
        <Clock className="w-3 h-3" />
        <span>{formatCardDate(task.gantt_bar_start_date)} - {formatCardDate(task.gantt_bar_end_date)}</span>
      </div>
      
      {/* Horas */}
      <div className="flex items-center justify-between text-xs mb-3">
        <span className="text-gray-500 dark:text-gray-400">
          Prev: <span className="font-medium text-gray-700 dark:text-gray-300">{formatCardHours(task.current_estimate_seconds)}</span>
        </span>
        <span className="text-gray-500 dark:text-gray-400">
          Trab: <span className="font-medium text-gray-700 dark:text-gray-300">{formatCardHours(task.time_worked)}</span>
        </span>
      {/* </div> */}
      
      {/* Atribuídos */}
      {task.assignments && task.assignments.length > 0 && (
        <div className="flex items-center gap-1 flex-wrap">
          {task.assignments.slice(0, 3).map((assignment, idx) => (
            <div
              key={idx}
              className="flex items-center gap-1 bg-gray-100 dark:bg-gray-700 rounded-full px-2 py-0.5"
              title={assignment.users?.name || 'Não atribuído'}
            >
              {assignment.users?.avatar_large_url ? (
                <img
                  src={assignment.users.avatar_large_url}
                  alt={assignment.users.name}
                  className="w-4 h-4 rounded-full"
                />
              ) : (
                <User className="w-3 h-3 text-gray-500" />
              )}
              {/* <span className="text-xs text-gray-600 dark:text-gray-300 max-w-[60px] truncate">
                {assignment.users?.name?.split(' ')[0] || '-'}
              </span> */}
            </div>
          ))}
          {task.assignments.length > 3 && (
            <span className="text-xs text-gray-500 dark:text-gray-400">+{task.assignments.length - 3}</span>
          )}
        </div>
      )}
      </div>
    </div>
  );
};

// Componente para visualização Kanban de tarefas
const TaskKanbanView = ({ 
  tasks, 
  onTaskClick,
  isFullScreen = false
}: { 
  tasks: DbTask[]; 
  onTaskClick: (task: DbTask) => void;
  isFullScreen?: boolean;
}) => {
  // Interface para armazenar informações da coluna do Kanban
  interface KanbanColumn {
    stageName: string;
    stageGroup: string | null;
    position: number | null;
    tasks: DbTask[];
  }

  // Agrupar tarefas por status (board_stage_name) e ordenar por stage_group e position
  const groupedTasks = useMemo(() => {
    const columnsMap = new Map<string, KanbanColumn>();
    
    tasks.forEach(task => {
      const stageName = task.board_stage_name || 'Sem Status';
      
      if (!columnsMap.has(stageName)) {
        columnsMap.set(stageName, {
          stageName,
          stageGroup: task.stage_group || null,
          position: task.stage_position ?? null,
          tasks: []
        });
      } else {
        // Sempre atualizar com valores não-nulos se a coluna ainda não tem valores reais
        const existingColumn = columnsMap.get(stageName)!;
        if (task.stage_group !== null && existingColumn.stageGroup === null) {
          existingColumn.stageGroup = task.stage_group;
        }
        if (task.stage_position !== null && existingColumn.position === null) {
          existingColumn.position = task.stage_position;
        }
      }
      columnsMap.get(stageName)!.tasks.push(task);
    });
    
    // Ordenar colunas: primeiro por stage_group (opened antes de closed), depois por position
    const sortedColumns = Array.from(columnsMap.values()).sort((a, b) => {
      const groupA = a.stageGroup || 'opened';
      const groupB = b.stageGroup || 'opened';
      const posA = a.position ?? 999;
      const posB = b.position ?? 999;
      
      // stage_group: 'opened' vem antes de 'closed'
      if (groupA !== groupB) {
        if (groupA === 'opened') return -1;
        if (groupB === 'opened') return 1;
        return groupA.localeCompare(groupB);
      }
      // Dentro do mesmo grupo, ordenar por position
      return posA - posB;
    });
    
    // Retornar no formato [stageName, tasks][]
    return sortedColumns.map(col => [col.stageName, col.tasks] as [string, DbTask[]]);
  }, [tasks]);

  if (tasks.length === 0) {
    return (
      <div className="flex items-center justify-center h-full p-6">
        <span className="text-gray-500 dark:text-gray-400">Nenhuma tarefa encontrada para os filtros selecionados.</span>
      </div>
    );
  }

  return (
    <div className="flex gap-4 pt-0 p-6 pb-8 h-full" style={{ minWidth: 'max-content' }}>
      {groupedTasks.map(([status, statusTasks]) => (
        <div
          key={status}
          className="flex-shrink-0 w-72 bg-gray-100 dark:bg-gray-800 rounded-lg flex flex-col" style={{ height: isFullScreen ? 'calc(100vh - 180px)' : 'calc(100vh - 320px)' }}
        >
          {/* Cabeçalho da coluna */}
          <div className="p-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between flex-shrink-0">
            <h3 className="font-medium text-gray-900 dark:text-gray-100 text-sm">{status}</h3>
            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300">
              {statusTasks.length}
            </span>
          </div>
          
          {/* Cards da coluna */}
          <div className="flex-1 overflow-y-auto p-2">
            {statusTasks.map(task => (
              <KanbanCard
                key={task.id}
                task={task}
                onClick={onTaskClick}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

const RiskStatusBadge = ({ value }: { value: string }) => {
  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'aberto':
        return 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300';
      case 'em andamento':
        return 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300';
      case 'concluído':
        return 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300';
      case 'pendente':
        return 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300';
      default:
        return 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300';
    }
  };

  return (
    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(value)}`}>
      {value}
    </span>
  );
};

const RiskActionsRenderer = ({ 
  data, 
  onDelete, 
  onEdit
}: { 
  data: any, 
  onDelete: (riskId: number) => void,
  onEdit: (riskId: number) => void
}) => {
  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (data.id) {
      onDelete(data.id);
    }
  };

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (data.id) {
      onEdit(data.id);
    }
  };

  return (
    <div className="flex items-center justify-center gap-1 h-full">
      <button
        onClick={handleEdit}
        className="p-1 rounded-md hover:bg-blue-100 dark:hover:bg-blue-900 text-blue-600 dark:text-blue-400 transition-colors"
        title="Editar risco"
      >
        <Edit className="w-4 h-4" />
      </button>
      <button
        onClick={handleDelete}
        className="p-1 rounded-md hover:bg-red-100 dark:hover:bg-red-900 text-red-600 dark:text-red-400 transition-colors"
        title="Excluir risco"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  );
};

const formatDate = (dateString: string | null) => {
  if (!dateString) return '-';
  return new Date(dateString).toLocaleDateString('pt-BR');
};



const formatSecondsToHM = (seconds: number | null) => {
  if (seconds === null || seconds === 0) return '00h00';
  
  // Arredondar para o minuto mais próximo
  const roundedMinutes = Math.round(seconds / 60);
  
  const hours = Math.floor(roundedMinutes / 60);
  const minutes = roundedMinutes % 60;
  
  return `${hours.toString().padStart(2, '0')}h${minutes.toString().padStart(2, '0')}`;
};

interface ProjectDetailProps {
  project: DbProject;
  onBack: () => void;
}

interface ConsultorHours {
  user_id: number;
  name: string;
  total_hours: number;
}

interface TaskTypeHours {
  type_name: string;
  estimated_hours: number;
  worked_hours: number;
  consultors?: ConsultorTypeHours[];
}

interface ConsultorTypeHours {
  user_id: number;
  name: string;
  worked_seconds: number; // Mudou de worked_hours para worked_seconds
}

interface TaskStatusCount {
  status: string;
  count: number;
}

const ProjectDetail = ({ project, onBack }: ProjectDetailProps) => {
  const [tasks, setTasks] = useState<DbTask[]>([]);
  const [isLoadingTasks, setIsLoadingTasks] = useState(true);
  const [risks, setRisks] = useState<DbRisk[]>([]);
  const [isLoadingRisks, setIsLoadingRisks] = useState(true);
  const [accesses, setAccesses] = useState<DbAccessPlatform[]>([]);
  const [isLoadingAccesses, setIsLoadingAccesses] = useState(true);
  const [expandedPlatforms, setExpandedPlatforms] = useState<Set<string>>(new Set());
  const [domains, setDomains] = useState<DbDomain[]>([]);
  const [projectOwners, setProjectOwners] = useState<DbProjectOwner[]>([]);
  const [isLoadingProjectOwners, setIsLoadingProjectOwners] = useState(true);
  const [projectPhases, setProjectPhases] = useState<DbProjectPhase[]>([]);
  const [isLoadingPhases, setIsLoadingPhases] = useState(true);
  const [expandedTypes, setExpandedTypes] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState('tracking');
  const [isFullScreen, setIsFullScreen] = useState(false);
  const statusReportRef = useRef<HTMLDivElement>(null);
  
  // useRefs para controlar se já foi carregado (evita chamadas duplicadas)
  const hasLoadedTasks = useRef(false);
  const hasLoadedTimeWorked = useRef(false);
  const hasLoadedTimeEntriesGrouped = useRef(false);
  const hasLoadedPhases = useRef(false);
  const hasLoadedRisks = useRef(false);
  const hasLoadedAccesses = useRef(false);
  const hasLoadedDomains = useRef(false);
  const hasLoadedOwners = useRef(false);
  const [taskSearchTerm, setTaskSearchTerm] = useState('');
  const [selectedTypes, setSelectedTypes] = useState<SelectOption[]>([]);
  const [statusFilter, setStatusFilter] = useState<'Aberto' | 'Fechado' | 'Todos'>('Aberto');
  const [taskViewMode, setTaskViewMode] = useState<'list' | 'kanban'>('list');
  const [riskSearchTerm, setRiskSearchTerm] = useState('');
  const [selectedRiskStatuses, setSelectedRiskStatuses] = useState<SelectOption[]>([]);
  const [errorNotification, setErrorNotification] = useState<string | null>(null);
  const [successNotification, setSuccessNotification] = useState<string | null>(null);
  const [, setTimeWorkedData] = useState<ConsultorHours[]>([]);
  const [timeEntriesGrouped, setTimeEntriesGrouped] = useState<TimeEntryGrouped[]>([]);
  
  // Estados para o modal de risco
  const [isRiskModalOpen, setIsRiskModalOpen] = useState(false);
  const [selectedRisk, setSelectedRisk] = useState<DbRisk | null>(null);
  
  // Estados para o modal de acesso
  const [isAccessModalOpen, setIsAccessModalOpen] = useState(false);
  const [selectedAccess, setSelectedAccess] = useState<DbAccessPlatform | null>(null);
  const [isCloneMode, setIsCloneMode] = useState(false);
  
  // Estados para filtros da aba acompanhamento
  const [trackingPeriodFilter, setTrackingPeriodFilter] = useState<'all' | 'current_week' | 'current_month' | 'last_month' | 'last_3_months' | 'current_year'>('all');
  const [trackingStatusFilter, setTrackingStatusFilter] = useState<'open' | 'closed' | 'all'>('all');
  
  // Estado para o componente ProjectProgressModal
  const [isProgressModalOpen, setIsProgressModalOpen] = useState(false);
  const [selectedWeek, setSelectedWeek] = useState<number>(1);
  const [projectWeeks, setProjectWeeks] = useState<{ value: number; label: string }[]>([]);
  
  // Estados para modal de confirmação de exclusão de riscos
  const [isDeleteRiskConfirmModalOpen, setIsDeleteRiskConfirmModalOpen] = useState(false);
  const [riskToDelete, setRiskToDelete] = useState<DbRisk | null>(null);
  
  // Estados para modal de confirmação de exclusão de acessos
  const [isDeleteAccessConfirmModalOpen, setIsDeleteAccessConfirmModalOpen] = useState(false);
  const [accessToDelete, setAccessToDelete] = useState<DbAccessPlatform | null>(null);

  // Função para calcular datas baseado no período selecionado
  const getDateRange = useCallback((period: typeof trackingPeriodFilter) => {
    const now = new Date();
    let startDate: Date;
    let endDate: Date = new Date(); // Por padrão, até agora
    
    switch (period) {
      case 'all':
        // Retornar uma data muito antiga para incluir todas as tarefas
        startDate = new Date(2020, 0, 1);
        break;
      case 'current_week':
        // Começar na segunda-feira da semana atual
        const dayOfWeek = now.getDay();
        const diff = now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
        startDate = new Date(now.setDate(diff));
        startDate.setHours(0, 0, 0, 0);
        break;
      case 'current_month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'last_month':
        startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        // endDate é o último dia do mês anterior (dia 0 do mês atual)
        endDate = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
        break;
      case 'last_3_months':
        startDate = new Date(now.getFullYear(), now.getMonth() - 3, 1);
        break;
      case 'current_year':
        startDate = new Date(now.getFullYear(), 0, 1);
        break;
      default:
        startDate = new Date(2020, 0, 1);
    }
    
    return { startDate, endDate };
  }, []);

  // Função para filtrar tarefas baseado nos filtros ativos
  const getFilteredTasks = useCallback((tasks: DbTask[]) => {
    let filtered = [...tasks];
    
    // Filtro por período (baseado em created_at)
    const { startDate, endDate } = getDateRange(trackingPeriodFilter);
    filtered = filtered.filter(task => {
      if (!task.created_at) return true;
      const taskDate = new Date(task.created_at);
      return taskDate >= startDate && taskDate <= endDate;
    });
    
    // Filtro por status (baseado em is_closed)
    if (trackingStatusFilter !== 'all') {
      filtered = filtered.filter(task => {
        if (trackingStatusFilter === 'open') {
          return !task.is_closed;
        } else if (trackingStatusFilter === 'closed') {
          return task.is_closed;
        }
        return true;
      });
    }
    
    return filtered;
  }, [trackingPeriodFilter, trackingStatusFilter, getDateRange]);

  useEffect(() => {
    if (!hasLoadedTasks.current) {
      hasLoadedTasks.current = true;
      
      void (async () => {
        if (!project.project_id) return;
        setIsLoadingTasks(true);

        try {
          const result = await apiClient.get<DbTask[]>(`/api/projects/${project.project_id}/tasks`);

          if (!result.success) {
            console.error('Erro ao buscar tarefas do projeto:', result.error);
            setTasks([]);
          } else {
            setTasks(result.data || []);
          }
        } catch (error) {
          console.error('Erro na requisição de tarefas:', error);
          setTasks([]);
        }
        setIsLoadingTasks(false);
      })();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.project_id]);

  // Buscar dados de time_worked via Backend API
  useEffect(() => {
    if (!hasLoadedTimeWorked.current) {
      hasLoadedTimeWorked.current = true;
      
      void (async () => {
        if (!project.project_id) return;

        try {
          const result = await apiClient.get<ConsultorHours[]>(`/api/projects/${project.project_id}/time-worked`);

          if (!result.success) {
            console.error('Erro ao buscar time_worked:', result.error);
            setTimeWorkedData([]);
          } else {
            setTimeWorkedData(result.data || []);
          }
        } catch (error) {
          console.error('Erro na requisição de time_worked:', error);
          setTimeWorkedData([]);
        }
      })();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.project_id]);

  // Buscar dados de time_entries agrupados por usuário e tarefa
  useEffect(() => {
    if (!hasLoadedTimeEntriesGrouped.current) {
      hasLoadedTimeEntriesGrouped.current = true;
      
      void (async () => {
        if (!project.project_id) return;

        try {
          const result = await apiClient.get<TimeEntryGrouped[]>(`/api/projects/${project.project_id}/time-entries-grouped`);

          if (!result.success) {
            console.error('Erro ao buscar time-entries-grouped:', result.error);
            setTimeEntriesGrouped([]);
          } else {
            setTimeEntriesGrouped(result.data || []);
          }
        } catch (error) {
          console.error('Erro na requisição de time-entries-grouped:', error);
          setTimeEntriesGrouped([]);
        }
      })();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.project_id]);

  // Buscar fases do projeto via Backend API
  useEffect(() => {
    if (!hasLoadedPhases.current) {
      hasLoadedPhases.current = true;
      
      void (async () => {
        if (!project.project_id) return;
        setIsLoadingPhases(true);

        try {
          const result = await apiClient.get<DbProjectPhase[]>(`/api/projects/${project.project_id}/phases`);

          if (!result.success) {
            console.error('Erro ao buscar fases do projeto:', result.error);
            setProjectPhases([]);
          } else {
            setProjectPhases(result.data || []);
          }
        } catch (error) {
          console.error('Erro na requisição de fases:', error);
          setProjectPhases([]);
        }
        setIsLoadingPhases(false);
      })();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.project_id]);


  // Recalcular dados filtrados quando filtros mudarem
  const filteredTrackingData = useMemo(() => {
    const filteredTasks = getFilteredTasks(tasks);
    
    // Criar Set de task_ids filtrados para filtrar timeEntriesGrouped
    const filteredTaskIds = new Set(filteredTasks.map(t => t.task_id));
    
    // Filtrar timeEntriesGrouped pelos task_ids das tarefas filtradas
    const filteredTimeEntries = timeEntriesGrouped.filter(entry => filteredTaskIds.has(entry.task_id));
    
    // Criar mapa de task_id -> type_name para lookup rápido
    const taskTypeMap = new Map<number, string>();
    filteredTasks.forEach(task => {
      if (task.task_id) {
        taskTypeMap.set(task.task_id, task.type_name || 'Sem tipo');
      }
    });
    
    // Calcular horas por tipo de tarefa com detalhamento por consultor (baseado em quem lançou horas)
    const typeHoursMap = new Map<string, { estimated: number; worked: number; consultors: Map<string, { name: string; worked: number }> }>();
    
    // Primeiro, calcular totais por tipo (estimado e trabalhado total da tarefa)
    filteredTasks.forEach(task => {
      const typeName = task.type_name || 'Sem tipo';
      const estimatedHours = (task.current_estimate_seconds || 0) / 3600;
      const workedHours = (task.time_worked || 0) / 3600;
      
      const current = typeHoursMap.get(typeName) || { estimated: 0, worked: 0, consultors: new Map() };
      current.estimated += estimatedHours;
      current.worked += workedHours;
      
      typeHoursMap.set(typeName, current);
    });
    
    // Adicionar consultores por tipo baseado em quem efetivamente lançou horas
    filteredTimeEntries.forEach(entry => {
      const typeName = taskTypeMap.get(entry.task_id) || 'Sem tipo';
      const current = typeHoursMap.get(typeName);
      if (current) {
        const userId = entry.user_id;
        const userName = entry.user_name;
        const hoursWorked = entry.time_seconds / 3600;
        
        const consultorInType = current.consultors.get(userId) || { name: userName, worked: 0 };
        consultorInType.worked += hoursWorked;
        current.consultors.set(userId, consultorInType);
      }
    });

    // Converter para array e ordenar por tipo
    const typeHoursList: TaskTypeHours[] = Array.from(typeHoursMap.entries())
      .map(([type_name, hours]) => ({
        type_name,
        estimated_hours: hours.estimated,
        worked_hours: hours.worked,
        consultors: Array.from(hours.consultors.entries())
          .map(([user_id, data]) => ({
            user_id: parseInt(user_id),
            name: data.name,
            worked_seconds: data.worked * 3600 // Converter para segundos
          }))
          .filter(consultor => consultor.worked_seconds > 0)
          .sort((a, b) => a.name.localeCompare(b.name))
      }))
      .sort((a, b) => a.type_name.localeCompare(b.type_name));
    
    // Calcular contagem de tarefas por status (dados filtrados)
    const statusCountMap = new Map<string, number>();
    
    filteredTasks.forEach(task => {
      const status = task.board_stage_name || 'Sem status';
      const currentCount = statusCountMap.get(status) || 0;
      statusCountMap.set(status, currentCount + 1);
    });
    
    // Converter para array e ordenar alfabeticamente
    const statusCountsList: TaskStatusCount[] = Array.from(statusCountMap.entries())
      .map(([status, count]) => ({
        status,
        count
      }))
      .sort((a, b) => a.status.localeCompare(b.status));

    // Calcular horas lançadas por consultor (baseado em quem efetivamente lançou horas)
    const consultorHoursMap = new Map<string, { name: string; total_hours: number }>();
    
    filteredTimeEntries.forEach(entry => {
      const userId = entry.user_id;
      const userName = entry.user_name;
      const currentHours = consultorHoursMap.get(userId)?.total_hours || 0;
      const entryHours = entry.time_seconds / 3600;
      
      consultorHoursMap.set(userId, {
        name: userName,
        total_hours: currentHours + entryHours
      });
    });
    
    // Converter o map para array e ordenar alfabeticamente
    const consultorsList: ConsultorHours[] = Array.from(consultorHoursMap.entries())
      .map(([user_id, data]) => ({
        user_id: parseInt(user_id),
        name: data.name,
        total_hours: data.total_hours
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    // Calcular contagem de tarefas por consultor (baseado em quem lançou horas na tarefa)
    const consultorTaskCountMap = new Map<string, { name: string; task_count: number; taskIds: Set<number> }>();
    
    // Contar tarefas por usuário que lançou horas
    filteredTimeEntries.forEach(entry => {
      const userId = entry.user_id;
      const userName = entry.user_name;
      const taskId = entry.task_id;
      
      const current = consultorTaskCountMap.get(userId) || { name: userName, task_count: 0, taskIds: new Set() };
      if (!current.taskIds.has(taskId)) {
        current.taskIds.add(taskId);
        current.task_count += 1;
      }
      consultorTaskCountMap.set(userId, current);
    });
    
    // Contar tarefas sem lançamento de horas (Sem responsável)
    const taskIdsWithTimeEntries = new Set(filteredTimeEntries.map(e => e.task_id));
    const tasksWithoutResponsible = filteredTasks.filter(t => t.task_id && !taskIdsWithTimeEntries.has(t.task_id));
    
    if (tasksWithoutResponsible.length > 0) {
      consultorTaskCountMap.set('_unassigned', {
        name: 'Sem responsável',
        task_count: tasksWithoutResponsible.length,
        taskIds: new Set(tasksWithoutResponsible.map(t => t.task_id!))
      });
    }
    
    // Converter para array
    const consultorTaskCountList = Array.from(consultorTaskCountMap.entries())
      .map(([user_id, data]) => ({
        user_id: user_id === '_unassigned' ? -1 : parseInt(user_id),
        name: data.name,
        task_count: data.task_count
      }))
      .sort((a, b) => {
        // "Sem responsável" sempre por último
        if (a.user_id === -1) return 1;
        if (b.user_id === -1) return -1;
        return a.name.localeCompare(b.name);
      });

    return {
      taskTypeHours: typeHoursList,
      taskStatusCounts: statusCountsList,
      consultors: consultorsList,
      consultorTaskCounts: consultorTaskCountList
    };
  }, [tasks, getFilteredTasks, timeEntriesGrouped]);

  useEffect(() => {
    if (!hasLoadedRisks.current) {
      hasLoadedRisks.current = true;
      
      void (async () => {
        if (!project.project_id) return;
        setIsLoadingRisks(true);

        try {
          const result = await apiClient.get<DbRisk[]>(`/api/projects/${project.project_id}/risks`);

          if (!result.success) {
            console.error('Erro ao buscar riscos do projeto:', result.error);
            setRisks([]);
          } else {
            console.log('Risks loaded with values:', result.data); // Debug
            setRisks(result.data || []);
          }
        } catch (error) {
          console.error('Erro na requisição de riscos:', error);
          setRisks([]);
        }
        setIsLoadingRisks(false);
      })();
    }
    // eslint-disable-next-line react-hooks-off-deps
  }, [project.project_id]);

  useEffect(() => {
    if (!hasLoadedDomains.current) {
      hasLoadedDomains.current = true;
      
      void (async () => {
        try {
          const result = await apiClient.get<DbDomain[]>('/api/projects/domains');

          if (!result.success) {
            console.error('Erro ao buscar domínios:', result.error);
            setDomains([]);
          } else {
            setDomains(result.data || []);
          }
        } catch (error) {
          console.error('Erro na requisição de domínios:', error);
          setDomains([]);
        }
      })();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  useEffect(() => {
    if (!hasLoadedOwners.current) {
      hasLoadedOwners.current = true;
      
      void (async () => {
        if (!project.project_id) return;
        setIsLoadingProjectOwners(true);

        try {
          const result = await apiClient.get<DbProjectOwner[]>(`/api/projects/${project.project_id}/owners`);

          if (!result.success) {
            console.error('Erro ao buscar responsáveis do projeto:', result.error);
            setProjectOwners([]);
          } else {
            setProjectOwners(result.data || []);
          }
        } catch (error) {
          console.error('Erro na requisição de owners:', error);
          setProjectOwners([]);
        }
        setIsLoadingProjectOwners(false);
      })();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.project_id]);

  // Carregar acessos do projeto via Backend API
  useEffect(() => {
    if (!hasLoadedAccesses.current) {
      hasLoadedAccesses.current = true;
      
      void (async () => {
        if (!project.project_id) return;
        setIsLoadingAccesses(true);

        try {
          const result = await apiClient.get<DbAccessPlatform[]>(`/api/projects/${project.project_id}/accesses`);

          if (!result.success) {
            console.error('Erro ao buscar acessos:', result.error);
            setAccesses([]);
          } else {
            setAccesses(result.data || []);
          }
        } catch (error) {
          console.error('Erro na requisição de acessos:', error);
          setAccesses([]);
        }
        setIsLoadingAccesses(false);
      })();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.project_id]);

  const typeOptions = useMemo(() => {
    if (!tasks) return [];
    const types = new Set(tasks.map(task => task.type_name).filter(Boolean));
    return Array.from(types).map(type => ({ value: type!, label: type! })).sort((a,b) => a.label.localeCompare(b.label));
  }, [tasks]);
  
  const filteredTasks = useMemo(() => {
    let filtered = [...tasks];

    if (statusFilter === 'Aberto') {
      filtered = filtered.filter(task => !task.is_closed);
    } else if (statusFilter === 'Fechado') {
      filtered = filtered.filter(task => task.is_closed);
    }
    
    if (taskSearchTerm) {
      filtered = filtered.filter(task =>
        task.title && task.title.toLowerCase().includes(taskSearchTerm.toLowerCase())
      );
    }

    if (selectedTypes.length > 0) {
      const typeValues = selectedTypes.map(t => t.value);
      filtered = filtered.filter(task => task.type_name && typeValues.includes(task.type_name));
    }

    return filtered;
  }, [tasks, statusFilter, taskSearchTerm, selectedTypes]);

  const summaryCounts = useMemo(() => {
    const total = tasks.length;
    const active = tasks.filter(task => !task.is_closed).length;
    const delivered = total - active;

    return { total, active, delivered };
  }, [tasks]);

  const taskHoursSummary = useMemo(() => {
    return tasks.reduce(
      (acc, task) => {
        acc.planned += task.current_estimate_seconds || 0;
        acc.worked += task.time_worked || 0;
        return acc;
      },
      { planned: 0, worked: 0 }
    );
  }, [tasks]);

  const riskStatusOptions = useMemo(() => {
    if (!domains || domains.length === 0) return [];
    const statusDomains = domains.filter(domain => domain.type === 'risk_status' && domain.is_active);
    return statusDomains.map(domain => ({ value: domain.value, label: domain.value }));
  }, [domains]);

  const showErrorNotification = useCallback((message: string) => {
    setErrorNotification(message);
  }, []);

  const showSuccessNotification = useCallback((message: string) => {
    setSuccessNotification(message);
  }, []);

  // Função para agrupar acessos por plataforma
  const groupedAccesses = useMemo(() => {
    const grouped = new Map<string, DbAccessPlatform[]>();
    
    accesses.forEach(access => {
      const platform = access.platform_name;
      if (!grouped.has(platform)) {
        grouped.set(platform, []);
      }
      grouped.get(platform)!.push(access);
    });

    return Array.from(grouped.entries())
      .map(([platform_name, accessList]) => ({
        platform_name,
        platform_id: accessList[0].platform_id,
        accesses: accessList,
      } as DbAccessPlatformGrouped))
      .sort((a, b) => a.platform_name.localeCompare(b.platform_name));
  }, [accesses]);

  useEffect(() => {
    console.log('Grouped Accesses:', groupedAccesses);
  }, [groupedAccesses]);

  const togglePlatformExpansion = useCallback((platformName: string) => {
    setExpandedPlatforms(prev => {
      const newSet = new Set(prev);
      if (newSet.has(platformName)) {
        newSet.delete(platformName);
      } else {
        newSet.add(platformName);
      }
      return newSet;
    });
  }, []);

  // Função para abrir modal de adição de risco
  const openAddRiskModal = useCallback(() => {
    setSelectedRisk(null);
    setIsRiskModalOpen(true);
  }, []);

  // Função para abrir modal de edição de risco
  const openEditRiskModal = useCallback((riskId: number) => {
    const risk = risks.find(r => r.id === riskId);
    if (risk) {
      setSelectedRisk(risk);
      setIsRiskModalOpen(true);
    }
  }, [risks]);

  // Função para recarregar riscos após salvamento via Backend API
  const reloadRisks = useCallback(async () => {
    try {
      const result = await apiClient.get<DbRisk[]>(`/api/projects/${project.project_id}/risks`);

      if (result.success) {
        setRisks(result.data || []);
        showSuccessNotification('Risco salvo com sucesso!');
      } else {
        console.error('Erro ao recarregar riscos:', result.error);
      }
    } catch (error) {
      console.error('Erro na requisição de riscos:', error);
    }
  }, [project.project_id, showSuccessNotification]);

  // Função para abrir modal de confirmação de exclusão de risco
  const deleteRisk = useCallback((riskId: number) => {
    const risk = risks.find(r => r.id === riskId);
    if (risk) {
      setRiskToDelete(risk);
      setIsDeleteRiskConfirmModalOpen(true);
    }
  }, [risks]);

  // Função para confirmar a exclusão do risco via Backend API
  const handleConfirmDeleteRisk = useCallback(async () => {
    if (!riskToDelete) return;

    try {
      const result = await apiClient.del(`/api/projects/${project.project_id}/risks/${riskToDelete.id}`);

      if (!result.success) {
        console.error('Erro ao deletar risco:', result.error);
        showErrorNotification('Erro ao excluir risco. Tente novamente.');
        setIsDeleteRiskConfirmModalOpen(false);
        setRiskToDelete(null);
        return;
      }

      // Atualizar o estado local removendo o risco deletado
      setRisks(prev => prev.filter(risk => risk.id !== riskToDelete.id));
      
      showSuccessNotification('Risco excluído com sucesso!');
      
      // Fechar modal de confirmação
      setIsDeleteRiskConfirmModalOpen(false);
      setRiskToDelete(null);
      
    } catch (error) {
      console.error('Erro ao deletar risco:', error);
      showErrorNotification('Erro ao excluir risco. Tente novamente.');
      setIsDeleteRiskConfirmModalOpen(false);
      setRiskToDelete(null);
    }
  }, [project.project_id, riskToDelete, showErrorNotification, showSuccessNotification]);

  // Funções para modal de acesso
  const openAddAccessModal = useCallback(() => {
    setSelectedAccess(null);
    setIsCloneMode(false);
    setIsAccessModalOpen(true);
  }, []);

  const openEditAccessModal = useCallback((accessId: number) => {
    const access = accesses.find(a => a.id === accessId);
    if (access) {
      setSelectedAccess(access);
      setIsCloneMode(false);
      setIsAccessModalOpen(true);
    }
  }, [accesses]);

  // Função para clonar acesso
  const openCloneAccessModal = useCallback((accessId: number) => {
    const access = accesses.find(a => a.id === accessId);
    if (access) {
      setSelectedAccess(access);
      setIsCloneMode(true);
      setIsAccessModalOpen(true);
    }
  }, [accesses]);

  // Recarregar acessos via Backend API
  const reloadAccesses = useCallback(async () => {
    try {
      const result = await apiClient.get<DbAccessPlatform[]>(`/api/projects/${project.project_id}/accesses`);

      if (result.success) {
        setAccesses(result.data || []);
        showSuccessNotification('Acesso salvo com sucesso!');
      } else {
        console.error('Erro ao recarregar acessos:', result.error);
      }
    } catch (error) {
      console.error('Erro na requisição de acessos:', error);
    }
  }, [project.project_id, showSuccessNotification]);

  const deleteAccess = useCallback((accessId: number) => {
    const access = accesses.find(a => a.id === accessId);
    if (access) {
      setAccessToDelete(access);
      setIsDeleteAccessConfirmModalOpen(true);
    }
  }, [accesses]);

  // Confirmar exclusão de acesso via Backend API
  const handleConfirmDeleteAccess = useCallback(async () => {
    if (!accessToDelete) return;

    try {
      const result = await apiClient.del(`/api/projects/${project.project_id}/accesses/${accessToDelete.id}`);

      if (!result.success) {
        console.error('Erro ao deletar acesso:', result.error);
        showErrorNotification('Erro ao excluir acesso. Tente novamente.');
        setIsDeleteAccessConfirmModalOpen(false);
        setAccessToDelete(null);
        return;
      }

      setAccesses(prev => prev.filter(access => access.id !== accessToDelete.id));
      showSuccessNotification('Acesso excluído com sucesso!');
      setIsDeleteAccessConfirmModalOpen(false);
      setAccessToDelete(null);
    } catch (error) {
      console.error('Erro ao deletar acesso:', error);
      showErrorNotification('Erro ao excluir acesso. Tente novamente.');
      setIsDeleteAccessConfirmModalOpen(false);
      setAccessToDelete(null);
    }
  }, [project.project_id, accessToDelete, showErrorNotification, showSuccessNotification]);


  const filteredRisks = useMemo(() => {
    let filtered = [...risks];

    if (riskSearchTerm) {
      filtered = filtered.filter(risk =>
        (risk.description && risk.description.toLowerCase().includes(riskSearchTerm.toLowerCase())) ||
        (risk.action_plan && risk.action_plan.toLowerCase().includes(riskSearchTerm.toLowerCase()))
      );
    }

    if (selectedRiskStatuses.length > 0) {
      const statusValues = selectedRiskStatuses.map(s => s.value);
      filtered = filtered.filter(risk => risk.status && statusValues.includes(risk.status));
    }

    return filtered;
  }, [risks, riskSearchTerm, selectedRiskStatuses]);

  const taskColumnDefs: ColDef[] = [
    { headerName: 'Tarefa', field: 'title', flex: 3, minWidth: 250 },
    { headerName: 'Tipo', field: 'type_name', flex: 1, minWidth: 120 },
    { headerName: 'Status', field: 'board_stage_name', flex: 1, minWidth: 120 },
    { headerName: 'Início Planejado', field: 'gantt_bar_start_date', flex: 1, minWidth: 150, valueFormatter: params => formatDate(params.value) },
    { headerName: 'Fim Planejado', field: 'gantt_bar_end_date', flex: 1, minWidth: 150, valueFormatter: params => formatDate(params.value) },
    { headerName: 'Horas Previstas', field: 'current_estimate_seconds', flex: 1, minWidth: 130, type: 'numericColumn', valueFormatter: params => formatSecondsToHM(params.value)},
    { headerName: 'Horas Trabalhadas', field: 'time_worked', flex: 1, minWidth: 140, type: 'numericColumn', valueFormatter: params => formatSecondsToHM(params.value)},
    { 
      headerName: 'Atribuído a', 
      field: 'assignments', 
      cellRenderer: AssigneeCellRenderer, 
      flex: 1.5, 
      minWidth: 150,
      sortable: false, 
      filter: false,
    },
  ];

  const riskColumnDefs: ColDef[] = useMemo(() => [
    {
      headerName: 'Tipo',
      field: 'type',
      flex: 1,
      minWidth: 120,
      cellRenderer: (params: any) => <RiskTypeBadge value={params.value || ''} />,
    },
    {
      headerName: 'Prioridade',
      field: 'priority',
      flex: 1,
      minWidth: 120,
      cellRenderer: (params: any) => <RiskPriorityBadge value={params.value || ''} />,
    },
    {
      headerName: 'Descrição',
      field: 'description',
      flex: 2,
      minWidth: 200,
      cellRenderer: HtmlCellRenderer,
    },
    {
      headerName: 'Plano de Ação',
      field: 'action_plan',
      flex: 2,
      minWidth: 200,
      cellRenderer: HtmlCellRenderer,
    },
    {
      headerName: 'Início',
      field: 'start_date',
      flex: 1,
      minWidth: 120,
      valueFormatter: params => formatDate(params.value),
    },
    {
      headerName: 'Previsão',
      field: 'forecast_date',
      flex: 1,
      minWidth: 120,
      valueFormatter: params => formatDate(params.value),
    },
    {
      headerName: 'Fim',
      field: 'close_date',
      flex: 1,
      minWidth: 120,
      valueFormatter: params => formatDate(params.value),
    },
    {
      headerName: 'Status',
      field: 'status',
      flex: 1,
      minWidth: 120,
      cellRenderer: (params: any) => <RiskStatusBadge value={params.value || ''} />,
    },
    {
      headerName: 'Responsável',
      field: 'manual_owner',
      flex: 1,
      minWidth: 150,
    },
    {
      headerName: 'Ações',
      field: 'actions',
      width: 100,
      cellRenderer: (params: any) => (
        <RiskActionsRenderer 
          data={params.data} 
          onDelete={deleteRisk}
          onEdit={openEditRiskModal}
        />
      ),
      sortable: false,
      filter: false,
      resizable: false,
    },
  ], [deleteRisk, openEditRiskModal]);

  const accessDetailColumnDefs: ColDef[] = useMemo(() => [
    {
      headerName: 'Funcionário',
      field: 'user_name',
      flex: 1.5,
      minWidth: 150,
    },
    {
      headerName: 'Ambiente',
      field: 'environment_name',
      flex: 1,
      minWidth: 120,
    },
    {
      headerName: 'Função',
      field: 'role_name',
      flex: 1,
      minWidth: 120,
    },
    {
      headerName: 'Risco',
      field: 'risk_name',
      flex: 1,
      minWidth: 120,
    },
    {
      headerName: 'Política de Acesso',
      field: 'access_policies',
      flex: 1.5,
      minWidth: 150,
      autoHeight: true,
      wrapText: true,
      cellRenderer: (params: any) => {
        const policies = params.value as string[] || [];
        if (policies.length === 0) return <span className="text-gray-400 dark:text-gray-500">-</span>;
        return (
          <div className="flex flex-wrap gap-1 py-2">
            {policies.map((policy, index) => (
              <span 
                key={index} 
                className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
              >
                {policy}
              </span>
            ))}
          </div>
        );
      },
    },
    {
      headerName: 'Tipo de Dados',
      field: 'data_types',
      flex: 1.5,
      minWidth: 150,
      autoHeight: true,
      wrapText: true,
      cellRenderer: (params: any) => {
        const dataTypes = params.value as string[] || [];
        if (dataTypes.length === 0) return <span className="text-gray-400 dark:text-gray-500">-</span>;
        return (
          <div className="flex flex-wrap gap-1 py-2">
            {dataTypes.map((dataType, index) => (
              <span 
                key={index} 
                className="px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300"
              >
                {dataType}
              </span>
            ))}
          </div>
        );
      },
    },
    {
      headerName: 'Descrição',
      field: 'description',
      flex: 2,
      minWidth: 200,
      cellRenderer: HtmlCellRenderer,
    },
    {
      headerName: 'Expiração',
      field: 'expiration_date',
      flex: 1,
      minWidth: 140,
      valueFormatter: params => formatDate(params.value),
    },
    {
      headerName: 'Ações',
      field: 'actions',
      width: 140,
      cellRenderer: (params: any) => (
        <div className="flex items-center justify-center gap-1 h-full">
          <button
            onClick={() => openEditAccessModal(params.data.id)}
            className="p-1 rounded-md hover:bg-blue-100 dark:hover:bg-blue-900 text-blue-600 dark:text-blue-400 transition-colors"
            title="Editar acesso"
          >
            <Edit className="w-4 h-4" />
          </button>
          <button
            onClick={() => openCloneAccessModal(params.data.id)}
            className="p-1 rounded-md hover:bg-green-100 dark:hover:bg-green-900 text-green-600 dark:text-green-400 transition-colors"
            title="Clonar acesso"
          >
            <Copy className="w-4 h-4" />
          </button>
          <button
            onClick={() => deleteAccess(params.data.id)}
            className="p-1 rounded-md hover:bg-red-100 dark:hover:bg-red-900 text-red-600 dark:text-red-400 transition-colors"
            title="Excluir acesso"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ),
      sortable: false,
      filter: false,
      resizable: false,
    },
  ], [openEditAccessModal, openCloneAccessModal, deleteAccess]);

  const defaultRiskColDef = useMemo<ColDef>(() => ({
    sortable: true,
    filter: true,
    resizable: true,
  }), []);

  const progressValue = useMemo(() => {
    if (!taskHoursSummary.planned || taskHoursSummary.planned === 0) {
      return 0;
    }
    
    return taskHoursSummary.worked / taskHoursSummary.planned;
  }, [taskHoursSummary]);

  const handleTaskRowClick = (event: RowClickedEvent<DbTask>) => {
    if (event.data && event.data.task_id) {
      const taskId = event.data.task_id;
      const url = `https://secure.runrun.it/pt-BR/tasks/${taskId}`;
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  const toggleTypeExpansion = useCallback((typeName: string) => {
    setExpandedTypes(prev => {
      const newSet = new Set(prev);
      if (newSet.has(typeName)) {
        newSet.delete(typeName);
      } else {
        newSet.add(typeName);
      }
      return newSet;
    });
  }, []);

  const handleOwnerChange = useCallback((newOwner: DbUser | null) => {
    if (newOwner) {
      // Adicionar o novo responsável à lista
      const newProjectOwner: DbProjectOwner = {
        id: Date.now(), // ID temporário
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        project_id: project.project_id,
        user_id: newOwner.user_id || '',
        users: {
          user_id: newOwner.user_id || '',
          name: newOwner.name,
          avatar_large_url: newOwner.avatar_large_url
        }
      };
      setProjectOwners(prev => [...prev, newProjectOwner]);
      setSuccessNotification('Responsável adicionado com sucesso!');
    }
  }, [project.project_id]);

  const handleOwnerRemove = useCallback((removedOwnerId: number) => {
    setProjectOwners(prev => prev.filter(owner => owner.id !== removedOwnerId));
    setSuccessNotification('Responsável removido com sucesso!');
  }, []);


  // Função para calcular as semanas do projeto baseado nas datas das tarefas
  const calculateProjectWeeks = useCallback(() => {
    if (!tasks || tasks.length === 0) return [];
    
    // Encontrar a data de início e fim do projeto baseado nas tarefas
    // Usar APENAS as datas do Gantt - se vazias, a tarefa não está planejada
    const taskDates = tasks.map(task => {
      const startDate = task.gantt_bar_start_date;
      const endDate = task.gantt_bar_end_date;
      return { start: startDate, end: endDate };
    }).filter(dates => dates.start || dates.end);

    if (taskDates.length === 0) return [];

    // Encontrar a primeira e última data
    const allDates = [
      ...taskDates.map(d => d.start).filter(Boolean).map(d => new Date(d!)),
      ...taskDates.map(d => d.end).filter(Boolean).map(d => new Date(d!))
    ];

    if (allDates.length === 0) return [];

    const minDate = new Date(Math.min(...allDates.map(d => d.getTime())));
    const maxDate = new Date(Math.max(...allDates.map(d => d.getTime())));

    // Calcular o número de semanas entre a primeira e última data
    const timeDiff = maxDate.getTime() - minDate.getTime();
    const weeksDiff = Math.ceil(timeDiff / (1000 * 3600 * 24 * 7));
    
    // Gerar lista de semanas
    const weeks = [];
    for (let i = 1; i <= Math.max(weeksDiff, 1); i++) {
      const weekStartDate = new Date(minDate);
      weekStartDate.setDate(minDate.getDate() + (i - 1) * 7);
      
      const weekEndDate = new Date(weekStartDate);
      weekEndDate.setDate(weekStartDate.getDate() + 6);
      
      weeks.push({
        value: i,
        label: `Semana ${i} (${weekStartDate.toLocaleDateString('pt-BR')} - ${weekEndDate.toLocaleDateString('pt-BR')})`
      });
    }
    
    return weeks;
  }, [tasks]);

  // Calcular semanas do projeto quando as tarefas mudarem
  useEffect(() => {
    const weeks = calculateProjectWeeks();
    setProjectWeeks(weeks);
    
    // Definir semana inicial como 1 se há semanas disponíveis
    if (weeks.length > 0 && selectedWeek === 1) {
      setSelectedWeek(1);
    }
  }, [calculateProjectWeeks, tasks]);


  // Função para calcular dados consolidados das fases para o Status Report
  const getConsolidatedPhases = useMemo(() => {
    if (!projectPhases || projectPhases.length === 0) return [];

    // Agrupar fases por domains_id e calcular média ou valor mais recente
    const phaseGroups = projectPhases.reduce((groups, phase) => {
      const key = phase.domains_id;
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(phase);
      return groups;
    }, {} as Record<number, DbProjectPhase[]>);

    // Para cada grupo de fases, pegar a mais recente (maior período) ou calcular consolidação
    const consolidatedPhases = Object.values(phaseGroups).map(phases => {
      // Ordenar por período (mais recente primeiro)
      const sortedPhases = phases.sort((a, b) => (b.period || 0) - (a.period || 0));
      
      // Pegar a fase mais recente como representação consolidada
      const latestPhase = sortedPhases[0];
      
      return {
        ...latestPhase,
        // Opcionalmente, você pode calcular média dos progressos:
        // progress: Math.round(phases.reduce((sum, p) => sum + p.progress, 0) / phases.length),
        // expected_progress: Math.round(phases.reduce((sum, p) => sum + p.expected_progress, 0) / phases.length)
      };
    });

    return consolidatedPhases.sort((a, b) => (a.order || 0) - (b.order || 0));
  }, [projectPhases]);

  // Função para obter a semana atual do projeto
  const getCurrentProjectWeek = useCallback(() => {
    const weeks = calculateProjectWeeks();
    if (weeks.length === 0) return 1;

    // Calcular data de início do projeto baseado nas tarefas
    // Usar APENAS gantt_bar_start_date - se vazio, a tarefa não está planejada
    const taskDates = tasks.map(task => {
      const startDate = task.gantt_bar_start_date;
      return startDate ? new Date(startDate) : null;
    }).filter(Boolean) as Date[];

    if (taskDates.length === 0) return 1;

    const projectStartDate = new Date(Math.min(...taskDates.map(d => d.getTime())));
    const today = new Date();
    
    // Calcular número da semana atual
    const weeksDiff = Math.ceil((today.getTime() - projectStartDate.getTime()) / (1000 * 3600 * 24 * 7));
    const currentWeek = Math.max(1, weeksDiff);
    
    // Garantir que não exceda o número total de semanas calculadas
    return Math.min(currentWeek, weeks.length);
  }, [calculateProjectWeeks, tasks]);

  // Função para obter fases da semana atual
  const getCurrentWeekPhases = useMemo(() => {
    const currentWeek = getCurrentProjectWeek();
    
    // Buscar fases específicas da semana atual
    const currentWeekPhases = projectPhases.filter(phase => 
      phase.period === currentWeek
    );

    // Se não há fases para a semana atual, buscar a semana mais recente disponível
    if (currentWeekPhases.length === 0) {
      // Encontrar a semana mais recente com dados
      const availableWeeks = [...new Set(projectPhases
        .filter(phase => phase.period !== null)
        .map(phase => phase.period!))]
        .sort((a, b) => b - a); // Ordem decrescente

      if (availableWeeks.length > 0) {
        const latestWeek = availableWeeks[0];
        return projectPhases.filter(phase => phase.period === latestWeek);
      }
    }

    return currentWeekPhases;
  }, [projectPhases, getCurrentProjectWeek]);

  // Função para calcular dados da Curva S
  const calculateSCurveData = useMemo(() => {

    // Mapeamento dos tipos de tarefa para fases
    const taskTypeMapping: Record<string, string[]> = {
      'Levantamento': ['02.Desenho Funcional', '03.Desenho Técnico'],
      'Desenvolvimento': ['04.Desenvolvimento'],
      'Homologação': ['06.Certificação'],
      'Go-live': ['07.Implantação'],
      'Acompanhamento': ['08.Acompanhamento', '103.Manutenção Corretiva'],
      'Gestão': ['09.Gestão e Controle'] // Informativo apenas, sem peso
    };

    // Pesos padrão das fases (soma = 100) - Gestão não tem peso, é apenas informativo
    const defaultWeights: Record<string, number> = {
      'Levantamento': 10,
      'Desenvolvimento': 45,
      'Homologação': 20,
      'Go-live': 15,
      'Acompanhamento': 10,
      'Gestão': 0 // Informativo, não contribui para o cálculo de progresso
    };

    // DETECTAR FASES DINAMICAMENTE baseado nos tipos de tarefas existentes no projeto
    const taskTypesInProject = [...new Set(tasks.map(t => t.type_name).filter(Boolean))];
    
    // Encontrar quais fases têm tarefas no projeto
    const phasesWithTasks: string[] = [];
    Object.entries(taskTypeMapping).forEach(([phase, taskTypes]) => {
      const hasTasksForPhase = taskTypesInProject.some(taskType => 
        taskTypes.some(mappedType => taskType?.includes(mappedType))
      );
      if (hasTasksForPhase) {
        phasesWithTasks.push(phase);
      }
    });
    
    // Distribuir pesos entre fases que têm tarefas
    const totalWeight = phasesWithTasks.reduce((sum, phase) => {
      return sum + (defaultWeights[phase] || 0);
    }, 0);

    const distributedWeights: Record<string, number> = {};
    let cumulativeWeight = 0;
    const cumulativeWeights: Record<string, number> = {};

    // Ordenar fases pela ordem natural do projeto
    const phaseOrder = ['Levantamento', 'Desenvolvimento', 'Homologação', 'Go-live', 'Acompanhamento', 'Gestão'];
    const orderedPhasesWithTasks = phaseOrder.filter(phase => phasesWithTasks.includes(phase));

    orderedPhasesWithTasks.forEach(phase => {
      if (defaultWeights[phase]) {
        const weight = totalWeight > 0 ? (defaultWeights[phase] / totalWeight) * 100 : 0;
        distributedWeights[phase] = weight;
        cumulativeWeight += weight;
        cumulativeWeights[phase] = cumulativeWeight;
      }
    });
    

    // Calcular datas planejadas por agrupamento de tarefas
    const phaseSchedule: Record<string, { startDate?: Date; endDate?: Date; progress: number }> = {};

    orderedPhasesWithTasks.forEach(phase => {
      const taskTypes = taskTypeMapping[phase];
      const phaseTasks = tasks.filter(task => 
        task.type_name && taskTypes.some(type => task.type_name?.includes(type))
      );

      // Só processar se houver tarefas desta fase
      if (phaseTasks.length > 0) {
        // Usar APENAS as datas do Gantt (gantt_bar_start_date e gantt_bar_end_date)
        const startDates = phaseTasks
          .map(task => task.gantt_bar_start_date ? new Date(task.gantt_bar_start_date) : null)
          .filter(Boolean) as Date[];

        const endDates = phaseTasks
          .map(task => task.gantt_bar_end_date ? new Date(task.gantt_bar_end_date) : null)
          .filter(Boolean) as Date[];
        
        // Buscar progresso da fase na tabela projects_phase (se existir)
        // Mapear nome da fase para o nome no banco (sem acento)
        const phaseNameMapping: Record<string, string> = {
          'Homologação': 'Homologacao',
          'Gestão': 'Gestao',
          'Go-live': 'Deploy'
        };
        const dbPhaseName = phaseNameMapping[phase] || phase;
        const phaseData = getConsolidatedPhases.find(p => 
          p.phase_name === phase || p.phase_name === dbPhaseName
        );

        // Só adicionar ao schedule se houver pelo menos uma data de início e fim
        if (startDates.length > 0 && endDates.length > 0) {
          phaseSchedule[phase] = {
            startDate: new Date(Math.min(...startDates.map(d => d.getTime()))),
            endDate: new Date(Math.max(...endDates.map(d => d.getTime()))),
            progress: phaseData?.progress || 0
          };
        }
      }
    });

    return {
      phaseSchedule,
      cumulativeWeights,
      distributedWeights
    };
  }, [tasks, getConsolidatedPhases, projectPhases, calculateProjectWeeks]);

  // Função para gerar dados do gráfico da curva S
  const generateSCurveChartData = useCallback(() => {
    const { phaseSchedule, cumulativeWeights } = calculateSCurveData;

    
    // Encontrar data de início e fim do projeto
    const allDates = Object.values(phaseSchedule)
      .flatMap(phase => [phase.startDate, phase.endDate])
      .filter(Boolean) as Date[];

    if (allDates.length === 0) return { dataPoints: [], currentWeek: null, phaseBars: [] };

    const projectStartDate = new Date(Math.min(...allDates.map(d => d.getTime())));
    const projectEndDate = new Date(Math.max(...allDates.map(d => d.getTime())));
    const oneWeekInMs = 7 * 24 * 60 * 60 * 1000;

    // --- CORREÇÃO: Calcular total de semanas ANTES do loop para garantir consistência ---
    // Contar quantas semanas o loop vai gerar (mesma lógica do while)
    let realTotalWeeks = 0;
    const tempDate = new Date(projectStartDate);
    while (tempDate <= projectEndDate) {
      realTotalWeeks++;
      tempDate.setDate(tempDate.getDate() + 7);
    }
    // Garantir pelo menos 1 semana
    realTotalWeeks = Math.max(1, realTotalWeeks);

    // --- CORREÇÃO APLICADA AQUI ---
    // Calcular semana atual com a lógica unificada
    const today = new Date();
    const currentWeekNumber = Math.floor((today.getTime() - projectStartDate.getTime()) / oneWeekInMs) + 1;
    const currentWeekLabel = currentWeekNumber > 0 ? `Sem ${currentWeekNumber}` : null;

    // Gerar pontos da curva (uma vez por semana)
    const dataPoints = [];
    const currentDate = new Date(projectStartDate);
    
    while (currentDate <= projectEndDate) {
      // --- CORREÇÃO APLICADA AQUI ---
      // Calcular rótulo da semana com a lógica unificada
      const weekNumber = Math.floor((currentDate.getTime() - projectStartDate.getTime()) / oneWeekInMs) + 1;

      // Passar realTotalWeeks para garantir que a última semana chegue a 100%
      const plannedProgress = calculateWeeklyAccumulativePlannedProgress(currentDate, projectStartDate, projectEndDate, phaseSchedule, cumulativeWeights, realTotalWeeks);
      const actualProgress = calculateRealProgressForDate(currentDate, phaseSchedule, cumulativeWeights);

      dataPoints.push({
        date: `Sem ${weekNumber}`,
        fullDate: currentDate.toLocaleDateString('pt-BR'),
        planned: Math.round(plannedProgress * 10) / 10,
        actual: Math.round(actualProgress * 10) / 10
      });

      // Avançar uma semana
      currentDate.setDate(currentDate.getDate() + 7);
    }
    
    if (dataPoints.length === 0) {
      return { dataPoints: [], currentWeek: null, phaseBars: [] };
    }

    // Calcular dados das fases para as barras horizontais
    const phasesWithDates = Object.keys(phaseSchedule)
      .filter(phase => phaseSchedule[phase].startDate && phaseSchedule[phase].endDate);
    
    const lastWeekInGraph = dataPoints.length;
    
    // Ordem fixa das fases (de cima para baixo no gráfico)
    const phaseOrder = ['Gestão', 'Levantamento', 'Desenvolvimento', 'Homologação', 'Go-live', 'Acompanhamento'];
    
    const phaseBars = phasesWithDates
      .map(phase => {
        const phaseData = phaseSchedule[phase];
        
        // Usar a mesma lógica unificada para as barras
        let startWeek = Math.floor((phaseData.startDate!.getTime() - projectStartDate.getTime()) / oneWeekInMs) + 1;
        let endWeek = Math.floor((phaseData.endDate!.getTime() - projectStartDate.getTime()) / oneWeekInMs) + 1;
        
        // Limitar ao range válido do gráfico
        startWeek = Math.max(1, Math.min(startWeek, lastWeekInGraph));
        endWeek = Math.max(1, Math.min(endWeek, lastWeekInGraph));
        
        return {
          phase,
          startWeek: `Sem ${startWeek}`,
          endWeek: `Sem ${endWeek}`,
          startWeekNumber: startWeek,
          endWeekNumber: endWeek
        };
      })
      // Ordenar pela ordem fixa predefinida (fases não listadas vão para o final)
      .sort((a, b) => {
        const indexA = phaseOrder.indexOf(a.phase);
        const indexB = phaseOrder.indexOf(b.phase);
        // Se a fase não está na lista, colocar no final
        const orderA = indexA === -1 ? phaseOrder.length : indexA;
        const orderB = indexB === -1 ? phaseOrder.length : indexB;
        return orderA - orderB;
      });

    return { dataPoints, currentWeek: currentWeekLabel, phaseBars };
  }, [calculateSCurveData, projectPhases, calculateProjectWeeks, tasks]);

  // Função auxiliar para buscar o último progresso real conhecido (carry-forward)
  // Busca retroativamente a partir da semana anterior até encontrar um valor de progresso
  const findLastKnownProgress = useCallback((targetWeek: number, phaseSchedule: any, cumulativeWeights: any): number => {
    // Iterar de targetWeek-1 até 1, buscando o último progresso conhecido
    for (let week = targetWeek - 1; week >= 1; week--) {
      const phasesForWeek = projectPhases.filter(phase => 
        phase.period === week && phase.progress !== null
      );

      if (phasesForWeek.length > 0) {
        // Encontrou fases com progresso, calcular o valor ponderado
        const allScheduledPhases = Object.keys(phaseSchedule)
          .filter(phase => phaseSchedule[phase].startDate && phaseSchedule[phase].endDate);

        const registeredPhaseNames = phasesForWeek.map(phase => phase.phase_name);
        const registeredPhases = allScheduledPhases.filter(phase => 
          registeredPhaseNames.includes(phase)
        );

        if (registeredPhases.length === 0) continue;

        // Calcular pesos das fases
        let totalRegisteredWeight = 0;
        let totalScheduledWeight = 0;
        const phaseWeights: Record<string, number> = {};
        const sortedPhases = allScheduledPhases.sort((a, b) => 
          (cumulativeWeights[a] || 0) - (cumulativeWeights[b] || 0)
        );

        for (let i = 0; i < sortedPhases.length; i++) {
          const phase = sortedPhases[i];
          const currentWeight = cumulativeWeights[phase] || 0;
          const previousWeight = i > 0 ? (cumulativeWeights[sortedPhases[i - 1]] || 0) : 0;
          const phaseWeight = currentWeight - previousWeight;
          
          phaseWeights[phase] = phaseWeight;
          totalScheduledWeight += phaseWeight;
          
          if (registeredPhases.includes(phase)) {
            totalRegisteredWeight += phaseWeight;
          }
        }

        // Calcular progresso ponderado
        let weightedProgress = 0;
        for (const registeredPhase of phasesForWeek) {
          const phaseName = registeredPhase.phase_name;
          const phaseProgress = registeredPhase.progress || 0;
          
          if (phaseName && phaseWeights[phaseName]) {
            const adjustedWeight = totalRegisteredWeight > 0 
              ? (phaseWeights[phaseName] * totalScheduledWeight) / totalRegisteredWeight
              : phaseWeights[phaseName];
            
            weightedProgress += (adjustedWeight * phaseProgress) / 100;
          }
        }

        return Math.min(100, Math.max(0, weightedProgress));
      }
    }

    // Nenhum progresso encontrado em semanas anteriores
    return 0;
  }, [projectPhases]);

  // Função para calcular progresso real baseado nos valores cadastrados na tabela projects_phase
  const calculateRealProgressForDate = useCallback((targetDate: Date, phaseSchedule: any, cumulativeWeights: any) => {
    // Calcular qual semana corresponde à data target
    // Usar APENAS gantt_bar_start_date - se vazio, a tarefa não está planejada
    const taskDates = tasks.map(task => {
      const startDate = task.gantt_bar_start_date;
      return startDate ? new Date(startDate) : null;
    }).filter(Boolean) as Date[];

    if (taskDates.length === 0) return 0;

    const projectStartDate = new Date(Math.min(...taskDates.map(d => d.getTime())));
    const oneWeekInMs = 7 * 24 * 60 * 60 * 1000;
    const timeDiff = targetDate.getTime() - projectStartDate.getTime();
    const targetWeek = Math.floor(timeDiff / oneWeekInMs) + 1;

    // Buscar fases cadastradas para a semana alvo
    const registeredPhasesForWeek = projectPhases.filter(phase => 
      phase.period === targetWeek && phase.progress !== null
    );

    // Se não há fases cadastradas para esta semana, buscar último progresso conhecido (carry-forward)
    if (registeredPhasesForWeek.length === 0) {
      return findLastKnownProgress(targetWeek, phaseSchedule, cumulativeWeights);
    }

    // Obter todas as fases disponíveis no cronograma
    const allScheduledPhases = Object.keys(phaseSchedule)
      .filter(phase => phaseSchedule[phase].startDate && phaseSchedule[phase].endDate);

    // Calcular pesos das fases cadastradas
    const registeredPhaseNames = registeredPhasesForWeek.map(phase => phase.phase_name);
    const registeredPhases = allScheduledPhases.filter(phase => 
      registeredPhaseNames.includes(phase)
    );

    // Se nenhuma fase cadastrada corresponde ao cronograma, retorna 0
    if (registeredPhases.length === 0) {
      return 0;
    }

    // Calcular peso total das fases cadastradas
    let totalRegisteredWeight = 0;
    let totalScheduledWeight = 0;

    // Calcular peso individual de cada fase (diferença entre peso cumulativo atual e anterior)
    const phaseWeights: Record<string, number> = {};
    const sortedPhases = allScheduledPhases.sort((a, b) => 
      (cumulativeWeights[a] || 0) - (cumulativeWeights[b] || 0)
    );

    for (let i = 0; i < sortedPhases.length; i++) {
      const phase = sortedPhases[i];
      const currentWeight = cumulativeWeights[phase] || 0;
      const previousWeight = i > 0 ? (cumulativeWeights[sortedPhases[i - 1]] || 0) : 0;
      const phaseWeight = currentWeight - previousWeight;
      
      phaseWeights[phase] = phaseWeight;
      totalScheduledWeight += phaseWeight;
      
      if (registeredPhases.includes(phase)) {
        totalRegisteredWeight += phaseWeight;
      }
    }

    // Calcular progresso real ponderado
    let weightedProgress = 0;

    for (const registeredPhase of registeredPhasesForWeek) {
      const phaseName = registeredPhase.phase_name;
      const phaseProgress = registeredPhase.progress || 0;
      
      if (phaseName && phaseWeights[phaseName]) {
        // Se a fase não está cadastrada, seu peso é redistribuído proporcionalmente
        const adjustedWeight = totalRegisteredWeight > 0 
          ? (phaseWeights[phaseName] * totalScheduledWeight) / totalRegisteredWeight
          : phaseWeights[phaseName];
        
        weightedProgress += (adjustedWeight * phaseProgress) / 100;
      }
    }

    return Math.min(100, Math.max(0, weightedProgress));
  }, [projectPhases, tasks, findLastKnownProgress]);

  // Função para calcular progresso planejado acumulativo por semana
  const calculateWeeklyAccumulativePlannedProgress = useCallback((currentDate: Date, projectStartDate: Date, projectEndDate: Date, phaseSchedule: any, cumulativeWeights: any, realTotalWeeks?: number) => {
    // Calcular qual semana estamos
    const oneWeekInMs = 7 * 24 * 60 * 60 * 1000;
    const timeDiff = currentDate.getTime() - projectStartDate.getTime();
    const currentWeek = Math.floor(timeDiff / oneWeekInMs) + 1;
    
    // Usar realTotalWeeks se fornecido, senão calcular (fallback)
    let totalWeeks = realTotalWeeks;
    if (!totalWeeks) {
      const totalProjectDuration = projectEndDate.getTime() - projectStartDate.getTime();
      totalWeeks = Math.max(1, Math.ceil(totalProjectDuration / oneWeekInMs) + 1);
    }
    
    // Buscar fases cadastradas para a semana atual com expected_progress
    const registeredPhasesForWeek = projectPhases.filter(phase => 
      phase.period === currentWeek && phase.expected_progress !== null && phase.expected_progress !== undefined
    );

    // Se há fases cadastradas com expected_progress para esta semana, usar cálculo ponderado
    if (registeredPhasesForWeek.length > 0) {
      // Obter todas as fases disponíveis no cronograma
      const allScheduledPhases = Object.keys(phaseSchedule)
        .filter(phase => phaseSchedule[phase].startDate && phaseSchedule[phase].endDate);

      // Calcular pesos das fases cadastradas
      const registeredPhaseNames = registeredPhasesForWeek.map(phase => phase.phase_name);
      const registeredPhases = allScheduledPhases.filter(phase => 
        registeredPhaseNames.includes(phase)
      );

      // Se nenhuma fase cadastrada corresponde ao cronograma, usar cálculo padrão
      if (registeredPhases.length === 0) {
        return calculateDefaultPlannedProgress(currentWeek, totalWeeks, projectPhases);
      }

      // Calcular peso total das fases cadastradas
      let totalRegisteredWeight = 0;
      let totalScheduledWeight = 0;

      // Calcular peso individual de cada fase (diferença entre peso cumulativo atual e anterior)
      const phaseWeights: Record<string, number> = {};
      const sortedPhases = allScheduledPhases.sort((a, b) => 
        (cumulativeWeights[a] || 0) - (cumulativeWeights[b] || 0)
      );

      for (let i = 0; i < sortedPhases.length; i++) {
        const phase = sortedPhases[i];
        const currentWeight = cumulativeWeights[phase] || 0;
        const previousWeight = i > 0 ? (cumulativeWeights[sortedPhases[i - 1]] || 0) : 0;
        const phaseWeight = currentWeight - previousWeight;
        
        phaseWeights[phase] = phaseWeight;
        totalScheduledWeight += phaseWeight;
        
        if (registeredPhases.includes(phase)) {
          totalRegisteredWeight += phaseWeight;
        }
      }

      // Calcular progresso planejado ponderado
      let weightedPlannedProgress = 0;

      for (const registeredPhase of registeredPhasesForWeek) {
        const phaseName = registeredPhase.phase_name;
        const phaseExpectedProgress = registeredPhase.expected_progress || 0;
        
        if (phaseName && phaseWeights[phaseName]) {
          // Se a fase não está cadastrada, seu peso é redistribuído proporcionalmente
          const adjustedWeight = totalRegisteredWeight > 0 
            ? (phaseWeights[phaseName] * totalScheduledWeight) / totalRegisteredWeight
            : phaseWeights[phaseName];
          
          weightedPlannedProgress += (adjustedWeight * phaseExpectedProgress) / 100;
        }
      }

      return Math.min(100, Math.max(0, weightedPlannedProgress));
    }

    // Se não há fases cadastradas com expected_progress para esta semana,
    // usar cálculo que distribui o restante até 100% nas semanas que faltam
    return calculateDefaultPlannedProgress(currentWeek, totalWeeks, projectPhases);
  }, [projectPhases]);

  // Função auxiliar para cálculo do progresso planejado quando não há dados na semana
  // Pega o último valor conhecido e distribui o restante até 100% nas semanas que faltam
  const calculateDefaultPlannedProgress = useCallback((currentWeek: number, totalWeeks: number, phases: DbProjectPhase[]) => {
    // Encontrar a última semana que tem expected_progress preenchido
    const weeksWithExpectedProgress = phases
      .filter(phase => phase.expected_progress !== null && phase.expected_progress !== undefined && phase.period !== null)
      .map(phase => phase.period as number);
    
    const uniqueWeeks = [...new Set(weeksWithExpectedProgress)].sort((a, b) => a - b);
    
    // Encontrar a última semana preenchida que é menor que a semana atual
    const lastFilledWeek = uniqueWeeks.filter(w => w < currentWeek).pop() || 0;
    
    // Se não há nenhuma semana preenchida, fazer cálculo linear do zero
    if (lastFilledWeek === 0 && uniqueWeeks.length === 0) {
      // Progresso linear: distribui 100% igualmente entre todas as semanas
      const progressPerWeek = 100 / totalWeeks;
      return Math.min(100, currentWeek * progressPerWeek);
    }
    
    // Calcular o progresso da última semana preenchida
    // (usando média simples dos expected_progress daquela semana)
    let lastKnownProgress = 0;
    if (lastFilledWeek > 0) {
      const phasesOfLastWeek = phases.filter(p => 
        p.period === lastFilledWeek && p.expected_progress !== null && p.expected_progress !== undefined
      );
      if (phasesOfLastWeek.length > 0) {
        lastKnownProgress = phasesOfLastWeek.reduce((sum, p) => sum + (p.expected_progress || 0), 0) / phasesOfLastWeek.length;
      }
    }
    
    // Se a semana atual é igual ou anterior à última preenchida, retornar o valor linear
    if (currentWeek <= lastFilledWeek) {
      const progressPerWeek = 100 / totalWeeks;
      return Math.min(100, currentWeek * progressPerWeek);
    }
    
    // Calcular quantas semanas faltam a partir da última semana preenchida
    const remainingWeeks = totalWeeks - lastFilledWeek;
    
    // Calcular quanto falta para chegar a 100%
    const remainingProgress = 100 - lastKnownProgress;
    
    // Distribui o restante igualmente entre as semanas que faltam
    const progressPerRemainingWeek = remainingWeeks > 0 ? remainingProgress / remainingWeeks : 0;
    
    // Calcular quantas semanas se passaram desde a última preenchida
    const weeksSinceLastFilled = currentWeek - lastFilledWeek;
    
    // Progresso = último conhecido + (semanas passadas * progresso por semana)
    const calculatedProgress = lastKnownProgress + (weeksSinceLastFilled * progressPerRemainingWeek);
    
    return Math.min(100, Math.max(0, calculatedProgress));
  }, []);



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
        // Entrar em modo full screen apenas na seção Status Report
        if (statusReportRef.current) {
          await statusReportRef.current.requestFullscreen();
          setIsFullScreen(true);
        }
      } else {
        // Sair do modo full screen
        await document.exitFullscreen();
        setIsFullScreen(false);
      }
    } catch (error) {
      console.error('Erro ao alternar full screen:', error);
      // Fallback para o modo anterior se a API não estiver disponível
      setIsFullScreen(!isFullScreen);
    }
  };

  return (
    <div className="h-full flex flex-col animate-fade-in">
      {/* Notificações renderizadas via portal */}
      {errorNotification && (
        <NotificationToast 
          type="error" 
          message={errorNotification} 
          onClose={() => setErrorNotification(null)} 
        />
      )}
      {successNotification && (
        <NotificationToast 
          type="success" 
          message={successNotification} 
          onClose={() => setSuccessNotification(null)} 
        />
      )}
      
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors pb-2"
      >
        <ArrowLeft className="w-4 h-4" />
        Voltar
      </button>
      
      {!isFullScreen && (
        <div className="card px-6 pt-2 pb-4 mb-3">
        <h2 className="text-lg font-semibold mb-2 text-gray-800 dark:text-gray-200">{project.name}</h2>
        <div className="grid grid-cols-1 md:grid-cols-8 gap-6 items-center">
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Cliente</p>
            <p className="text-md font-medium text-gray-900 dark:text-gray-100">{project.client_name}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Responsável</p>
            {isLoadingProjectOwners ? (
              <div className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm text-gray-500">Carregando...</span>
              </div>
            ) : (
              <ProjectOwnerRenderer 
                owners={projectOwners} 
                projectId={project.project_id}
                onOwnerChange={handleOwnerChange}
                onOwnerRemove={handleOwnerRemove}
                onError={(message) => setErrorNotification(message)}
              />
            )}
          </div>
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Data de Início</p>
            <p className="text-md font-medium text-gray-900 dark:text-gray-100">{formatDate(project.start_date)}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Data Fim Desejada</p>
            <p className="text-md font-medium text-gray-900 dark:text-gray-100">{formatDate(project.desired_date)}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Data de Entrega</p>
            <p className="text-md font-medium text-gray-900 dark:text-gray-100">{formatDate(project.close_date)}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Horas Planejadas</p>
            <p className="text-md font-medium text-gray-900 dark:text-gray-100">{formatSecondsToHM(taskHoursSummary.planned)}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Horas Trabalhadas</p>
            <p className="text-md font-medium text-gray-900 dark:text-gray-100">{formatSecondsToHM(taskHoursSummary.worked)}</p>
          </div>
          <div className="col-span-1 md:col-span-1">
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Avanço Horas</p>
            <ProgressBarRenderer value={progressValue} />
          </div>
        </div>
        </div>
      )}

      <div 
        ref={statusReportRef}
        className={`card flex-1 flex flex-col overflow-hidden ${isFullScreen ? 'h-full' : 'mb-0'}`}
      >
          {isFullScreen && (
           <div className="flex items-center justify-center p-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
              <h1 className="text-xl font-bold text-gray-800 dark:text-gray-200 text-center">
                Status Report - {project.name}
              </h1>
            </div>
          )}
        <div className="border-b border-gray-200 dark:border-gray-700">
          <nav className="flex justify-between items-center -mb-px px-6">
            <div className="flex">
              <button
                onClick={() => setActiveTab('tracking')}
                className={`whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm mr-8 ${
                  activeTab === 'tracking'
                    ? 'border-primary-500 text-primary-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Acompanhamento
              </button>
              <button
                onClick={() => setActiveTab('tasks')}
                className={`whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm mr-8 ${
                  activeTab === 'tasks'
                    ? 'border-primary-500 text-primary-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-300 dark:hover:text-gray-200'
                }`}
              >
                Tarefas do Projeto
              </button>
              <button
                onClick={() => setActiveTab('risks')}
                className={`whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm mr-8 ${
                  activeTab === 'risks'
                    ? 'border-primary-500 text-primary-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-300 dark:hover:text-gray-200'
                }`}
              >
                Riscos/Ações
              </button>
             
              <button
                onClick={() => setActiveTab('status-report')}
                className={`whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm mr-8 ${
                  activeTab === 'status-report'
                    ? 'border-primary-500 text-primary-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-300 dark:hover:text-gray-200'
                }`}
              >
                Status Report
              </button>

              <button
                onClick={() => setActiveTab('access')}
                className={`whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'access'
                    ? 'border-primary-500 text-primary-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-300 dark:hover:text-gray-200'
                }`}
              >
                Acesso
              </button>
            </div>
            
            <button
              onClick={toggleFullScreen}
              className="flex items-center gap-2 px-3 py-1 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              title={isFullScreen ? "Sair do modo tela cheia" : "Modo tela cheia"}
            >
              <Maximize className="w-4 h-4" />
              {/* {isFullScreen ? "Sair Full Screen" : "Full Screen"} */}
            </button>
          </nav>
        </div>
        
        {activeTab === 'tasks' && (
          <>
            {isLoadingTasks ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="w-8 h-8 animate-spin text-gray-500" />
                <p className="ml-4 text-gray-600 dark:text-gray-400">Carregando tarefas...</p>
              </div>
            ) : (
              <>
                <div className="px-4 pt-4 pb-2 flex flex-col md:flex-row gap-4">
                  <div className="flex-1 min-w-[200px]">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type="text"
                        placeholder="Buscar por tarefa..."
                        value={taskSearchTerm}
                        onChange={(e) => setTaskSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-orange-500 focus:border-transparent"
                      />
                    </div>
                  </div>
                  <div className="flex-1 min-w-[200px]">
                    <Select
                      isMulti
                      options={typeOptions}
                      onChange={(options) => setSelectedTypes(options as SelectOption[])}
                      placeholder="Filtrar por tipo..."
                      className="text-sm w-full react-select-container"
                      classNamePrefix="react-select"
                      menuPortalTarget={document.body}
                      menuPosition={'fixed'}
                    />
                  </div>
                  <div className="w-full md:w-48">
                    <select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value as 'Aberto' | 'Fechado' | 'Todos')}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-orange-500 focus:border-transparent"
                    >
                      <option value="Aberto">Abertas</option>
                      <option value="Fechado">Fechadas</option>
                      <option value="Todos">Todas</option>
                    </select>
                  </div>
                </div>

                <div className="flex flex-col flex-1 overflow-hidden">
                  <div className="px-6 pt-1 pb-3 flex items-center justify-between text-sm text-gray-600 flex-shrink-0">
                    <div className="flex items-center gap-6">
                      <span>Total: <span className="font-bold text-gray-800 dark:text-gray-200">{summaryCounts.total} Tarefas</span></span>
                      <span className="border-l border-gray-300 dark:border-gray-600 pl-6">Ativos: <span className="font-bold text-green-600 dark:text-green-400">{summaryCounts.active}</span></span>
                      <span>Entregue: <span className="font-bold text-blue-600 dark:text-blue-400">{summaryCounts.delivered}</span></span>
                    </div>
                    <button
                      onClick={() => setTaskViewMode(taskViewMode === 'list' ? 'kanban' : 'list')}
                      className="flex items-center gap-2 px-3 py-1 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                      title={taskViewMode === 'list' ? 'Visualização Kanban' : 'Visualização Lista'}
                    >
                      {taskViewMode === 'list' ? (
                        <Columns className="w-4 h-4" />
                      ) : (
                        <List className="w-4 h-4" />
                      )}
                    </button>
                  </div>

                  {taskViewMode === 'list' ? (
                  <div className="ag-theme-alpine w-full flex-1 p-6 pt-0">
                    <AgGridReact
                      columnDefs={taskColumnDefs}
                      rowData={filteredTasks}
                      defaultColDef={{ sortable: true, filter: true, resizable: true }}
                      rowSelection="single"
                      animateRows={true}
                      rowHeight={48}
                      headerHeight={48}
                      onRowClicked={handleTaskRowClick}
                      getRowStyle={(params) => {
                        // Verificar se a tarefa está entregue (is_closed = true)
                        if (params.data && params.data.is_closed) {
                          return { 
                            backgroundColor: '#dcf5e8',
                            '--ag-row-hover-color': '#c5edd8'
                          };
                        }
                        
                        // Verificar se a data atual é maior que o fim planejado
                        if (params.data && params.data.gantt_bar_end_date) {
                          const endDate = new Date(params.data.gantt_bar_end_date);
                          const currentDate = new Date();
                          
                          // Comparar apenas as datas (sem horários)
                          endDate.setHours(0, 0, 0, 0);
                          currentDate.setHours(0, 0, 0, 0);
                          
                          if (currentDate > endDate) {
                            return { 
                              backgroundColor: '#fee2e2',
                              '--ag-row-hover-color': '#fecaca'
                            };
                          }
                        }
                        // Verificar a tarefa está planejada
                        if (!params.data.gantt_bar_end_date) {
                            return { 
                              backgroundColor: '#fefce8',
                              '--ag-row-hover-color': '#fcf4b8'
                            };
                        }
                        return undefined;
                      }}
                      overlayNoRowsTemplate={
                        '<span class="text-gray-500 dark:text-gray-400">Nenhuma tarefa encontrada para os filtros selecionados.</span>'
                      }
                    />
                  </div>
                  ) : (
                    <div className="flex-1 overflow-x-scroll overflow-y-hidden" style={{ scrollbarWidth: 'auto' }}>
                      <TaskKanbanView
                        tasks={filteredTasks}
                        onTaskClick={(task) => {
                          if (task.task_id) {
                            window.open(`https://viaconsulting.runrun.it/tasks/${task.task_id}`, '_blank');
                          }
                        }}
                        isFullScreen={isFullScreen}
                      />
                    </div>
                  )}
                </div>
              </>
            )}
          </>
        )}

        {activeTab === 'risks' && (
          <>
            {isLoadingRisks ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="w-8 h-8 animate-spin text-gray-500" />
                <p className="ml-4 text-gray-600 dark:text-gray-400">Carregando riscos...</p>
              </div>
            ) : (
              <>
                <div className="px-4 pt-4 pb-2 flex flex-col md:flex-row gap-4">
                  <div className="flex-1 min-w-[200px]">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type="text"
                        placeholder="Buscar por descrição ou plano de ação..."
                        value={riskSearchTerm}
                        onChange={(e) => setRiskSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-orange-500 focus:border-transparent"
                      />
                    </div>
                  </div>
                  <div className="flex-1 min-w-[200px]">
                    <Select
                      isMulti
                      options={riskStatusOptions}
                      onChange={(options) => setSelectedRiskStatuses(options as SelectOption[])}
                      placeholder="Filtrar por status..."
                      className="text-sm w-full react-select-container"
                      classNamePrefix="react-select"
                      menuPortalTarget={document.body}
                      menuPosition={'fixed'}
                    />
                  </div>
                </div>

                <div className="flex flex-col flex-1">
                  <div className="px-6 pt-1 pb-3 flex items-center justify-between text-sm text-gray-600">
                    <div className="flex items-center gap-6">
                      <span>Total: <span className="font-bold text-gray-800 dark:text-gray-200">{risks.length} Riscos</span></span>
                      <span className="border-l border-gray-300 dark:border-gray-600 pl-6">Filtrados: <span className="font-bold text-blue-600 dark:text-blue-400">{filteredRisks.length}</span></span>
                    </div>
                    <button
                      onClick={openAddRiskModal}
                      className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-green-500 rounded-lg hover:bg-green-600 transition-colors"
                      title="Adicionar novo risco"
                    >
                      <Plus className="w-4 h-4" />
                      Adicionar Risco
                    </button>
                  </div>

                  <div className="ag-theme-alpine w-full flex-1 p-6 pt-0">
                    <AgGridReact
                      columnDefs={riskColumnDefs}
                      rowData={filteredRisks}
                      defaultColDef={defaultRiskColDef}
                      rowSelection="single"
                      animateRows={true}
                      rowHeight={48}
                      headerHeight={48}
                      getRowStyle={(params) => {
                        if (!params.data) return undefined;
                        
                        const risk = params.data;
                        const today = new Date();
                        today.setHours(0, 0, 0, 0);
                        
                        // Se status é concluído, não aplicar cores na linha
                        if (risk.status && risk.status.toLowerCase() === 'concluído') {
                          return undefined;
                        }
                        
                        // Sem data de previsão -> linha amarela
                        if (!risk.forecast_date) {
                          return {
                            backgroundColor: 'rgba(250, 204, 21, 0.2)',
                            borderLeft: '4px solid rgb(250, 204, 21)'
                          };
                        }
                        
                        // Previsão atrasada (< hoje) -> linha vermelha
                        const forecastDate = new Date(risk.forecast_date);
                        forecastDate.setHours(0, 0, 0, 0);
                        
                        if (forecastDate < today) {
                          return {
                            backgroundColor: 'rgba(239, 68, 68, 0.2)',
                            borderLeft: '4px solid rgb(239, 68, 68)'
                          };
                        }
                        
                        return undefined;
                      }}
                      overlayNoRowsTemplate={
                        '<span class="text-gray-500 dark:text-gray-400">Nenhum risco encontrado para esse projeto.</span>'
                      }
                    />
                  </div>
                </div>
              </>
            )}
          </>
        )}

        {activeTab === 'access' && (
          <>
            {isLoadingAccesses ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="w-8 h-8 animate-spin text-gray-500" />
                <p className="ml-4 text-gray-600 dark:text-gray-400">Carregando acessos...</p>
              </div>
            ) : (
              <>
                <div className="flex flex-col h-full overflow-hidden">
                  <div className="px-6 pt-4 pb-3 flex items-center justify-between text-sm text-gray-600 flex-shrink-0">
                    <div className="flex items-center gap-6">
                      <span>Total: <span className="font-bold text-gray-800 dark:text-gray-200">{groupedAccesses.length} Plataformas</span></span>
                      <span className="text-gray-400">|</span>
                      <span><span className="font-bold text-gray-800 dark:text-gray-200">{accesses.length}</span> Acessos</span>
                    </div>
                    <button
                      onClick={openAddAccessModal}
                      className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-green-500 rounded-lg hover:bg-green-600 transition-colors"
                      title="Adicionar novo acesso"
                    >
                      <Plus className="w-4 h-4" />
                      Adicionar Acesso
                    </button>
                  </div>

                  {/* Tabela de plataformas com detalhes expandidos inline */}
                  <div className="px-6 pb-6 flex-1 overflow-y-auto">
                    {/* Cabeçalho da tabela */}
                    <div className="grid grid-cols-[auto_1fr_200px] gap-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-4 rounded-t-lg">
                      <div className="w-8"></div>
                      <div className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">
                        Plataforma
                      </div>
                      <div className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide text-center">
                        Total de Acessos
                      </div>
                    </div>

                    {groupedAccesses.length === 0 ? (
                      <div className="py-8 text-center text-gray-500 dark:text-gray-400">
                        Nenhum acesso encontrado para este cliente.
                      </div>
                    ) : (
                      groupedAccesses.map((group) => {
                        const isExpanded = expandedPlatforms.has(group.platform_name);
                        return (
                          <div key={group.platform_name}>
                            {/* Linha da plataforma */}
                            <div 
                              className="grid grid-cols-[auto_1fr_200px] gap-4 py-3 px-4 border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer transition-colors"
                              onClick={() => togglePlatformExpansion(group.platform_name)}
                            >
                              <div className="flex items-center">
                                <ChevronDown 
                                  className={`w-5 h-5 text-gray-500 transition-transform duration-200 ${isExpanded ? 'rotate-0' : '-rotate-90'}`}
                                />
                              </div>
                              <div className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                                {group.platform_name}
                              </div>
                              <div className="text-sm text-gray-600 dark:text-gray-400 text-center">
                                {group.accesses.length}
                              </div>
                            </div>

                            {/* Detalhes expandidos - logo abaixo da linha da plataforma */}
                            {isExpanded && (
                              <div className="border-b border-gray-200 dark:border-gray-700">
                                <div className="bg-gray-50 dark:bg-gray-700 p-4 ml-4 mr-0">
                                  <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                                    <span>Acessos para {group.platform_name}</span>
                                    <span className="text-xs font-normal text-gray-500 dark:text-gray-400">({group.accesses.length} acessos)</span>
                                  </h4>
                                  <div className="ag-theme-alpine">
                                    <AgGridReact
                                      columnDefs={accessDetailColumnDefs}
                                      rowData={group.accesses}
                                      defaultColDef={{ sortable: true, filter: true, resizable: true }}
                                      animateRows={true}
                                      headerHeight={48}
                                      domLayout="autoHeight"
                                    />
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </>
            )}
          </>
        )}

        {activeTab === 'tracking' && (
          <>
            {isLoadingTasks ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="w-8 h-8 animate-spin text-gray-500" />
                <p className="ml-4 text-gray-600 dark:text-gray-400">Carregando acompanhamento...</p>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto">
                {/* Filtros */}
                <div className="px-4 pt-4 pb-2 flex flex-col md:flex-row gap-4">
                  <div className="w-full md:w-48">
                    <select
                      value={trackingPeriodFilter}
                      onChange={(e) => setTrackingPeriodFilter(e.target.value as typeof trackingPeriodFilter)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-orange-500 focus:border-transparent"
                    >
                      <option value="all">Todos os períodos</option>
                      <option value="current_week">Semana atual</option>
                      <option value="current_month">Mês atual</option>
                      <option value="last_month">Mês anterior</option>
                      <option value="last_3_months">Últimos 3 meses</option>
                      <option value="current_year">Ano atual</option>
                    </select>
                  </div>
                  
                  <div className="w-full md:w-48">
                    <select
                      value={trackingStatusFilter}
                      onChange={(e) => setTrackingStatusFilter(e.target.value as typeof trackingStatusFilter)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-orange-500 focus:border-transparent"
                    >
                      <option value="all">Todos</option>
                      <option value="open">Aberto</option>
                      <option value="closed">Fechado</option>
                    </select>
                  </div>
                </div>

                <div className="p-6 pt-2 h-full">
                  <div className="flex gap-6">
                  {/* Card de Tarefas por Status - Gráfico de Barras Horizontal */}
                  <div className="w-1/4">
                    <div className="card p-6">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                          <BarChart3 className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                          <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
                            Tarefas por Status
                          </h3>
                        </div>
                        {filteredTrackingData.taskStatusCounts.length > 0 && (
                          <span className="text-sm font-bold text-primary-600 dark:text-primary-400">
                            {filteredTrackingData.taskStatusCounts.reduce((total, status) => total + status.count, 0)} tarefas
                          </span>
                        )}
                      </div>
                      <div>
                        {filteredTrackingData.taskStatusCounts.length > 0 ? (
                          <div className="h-[340px]">
                            <ResponsiveContainer width="100%" height="100%">
                              <BarChart
                                data={(() => {
                                  // Função para obter a ordem do status
                                  const getStatusOrder = (status: string) => {
                                    const statusLower = status?.toLowerCase() || '';
                                    if (statusLower.includes('backlog')) return 1;
                                    if (statusLower.includes('a fazer') || statusLower.includes('to do')) return 2;
                                    if (statusLower.includes('fazendo') || statusLower.includes('doing') || statusLower.includes('em andamento') || statusLower.includes('in progress')) return 3;
                                    if (statusLower.includes('entregue') || statusLower.includes('done') || statusLower.includes('concluído') || statusLower.includes('concluido')) return 4;
                                    return 5; // outros status ficam no final
                                  };
                                  
                                  return [...filteredTrackingData.taskStatusCounts].sort((a, b) => 
                                    getStatusOrder(a.status) - getStatusOrder(b.status)
                                  );
                                })()}
                                margin={{ top: 15, right: 5, left: -15, bottom: 15 }}
                              >
                                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                                <XAxis 
                                  type="category" 
                                  dataKey="status"
                                  tick={{ fontSize: 9 }}
                                  angle={-35}
                                  textAnchor="end"
                                  interval={0}
                                  height={50}
                                />
                                <YAxis 
                                  type="number" 
                                  tick={{ fontSize: 10 }}
                                  allowDecimals={false}
                                  width={30}
                                />
                                <Tooltip 
                                  formatter={(value: number) => [value, 'Quantidade']}
                                  labelStyle={{ color: '#374151' }}
                                  contentStyle={{ 
                                    backgroundColor: '#f9fafb', 
                                    border: '1px solid #d1d5db',
                                    borderRadius: '6px'
                                  }}
                                />
                                <Bar 
                                  dataKey="count" 
                                  radius={[4, 4, 0, 0]}
                                  maxBarSize={45}
                                >
                                  {(() => {
                                    const getStatusOrder = (status: string) => {
                                      const statusLower = status?.toLowerCase() || '';
                                      if (statusLower.includes('backlog')) return 1;
                                      if (statusLower.includes('a fazer') || statusLower.includes('to do')) return 2;
                                      if (statusLower.includes('fazendo') || statusLower.includes('doing') || statusLower.includes('em andamento') || statusLower.includes('in progress')) return 3;
                                      if (statusLower.includes('entregue') || statusLower.includes('done') || statusLower.includes('concluído') || statusLower.includes('concluido')) return 4;
                                      return 5;
                                    };
                                    
                                    return [...filteredTrackingData.taskStatusCounts]
                                      .sort((a, b) => getStatusOrder(a.status) - getStatusOrder(b.status))
                                      .map((entry, index) => {
                                        const statusLower = entry.status?.toLowerCase() || '';
                                        let color = '#9ca3af'; // cinza padrão
                                        
                                        if (statusLower.includes('backlog')) {
                                          color = '#6b7280'; // cinza escuro
                                        } else if (statusLower.includes('a fazer') || statusLower.includes('to do')) {
                                          color = '#3b82f6'; // azul
                                        } else if (statusLower.includes('fazendo') || statusLower.includes('doing') || statusLower.includes('em andamento') || statusLower.includes('in progress')) {
                                          color = '#f97316'; // laranja
                                        } else if (statusLower.includes('entregue') || statusLower.includes('done') || statusLower.includes('concluído') || statusLower.includes('concluido')) {
                                          color = '#22c55e'; // verde
                                        }
                                        
                                        return <Cell key={`cell-${index}`} fill={color} />;
                                      });
                                  })()}
                                  <LabelList 
                                    dataKey="count" 
                                    position="top" 
                                    style={{ fontSize: 10, fontWeight: 'bold', fill: '#374151' }}
                                  />
                                </Bar>
                              </BarChart>
                            </ResponsiveContainer>
                          </div>
                        ) : (
                          <div className="text-center py-8">
                            <p className="text-gray-500 dark:text-gray-400 text-sm">
                              Nenhuma tarefa encontrada para este projeto
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Card de Tarefas por Consultor - Gráfico de Barras Horizontal */}
                  <div className="w-2/5">
                    <div className="card p-6">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                          <BarChart3 className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                          <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
                            Tarefas por Consultor
                          </h3>
                        </div>
                        {filteredTrackingData.consultorTaskCounts.length > 0 && (
                          <span className="text-sm font-bold text-primary-600 dark:text-primary-400">
                            {filteredTrackingData.consultorTaskCounts.reduce((total, consultor) => total + consultor.task_count, 0)} tarefas
                          </span>
                        )}
                      </div>
                      <div>
                        {filteredTrackingData.consultorTaskCounts.length > 0 ? (
                          <div className="h-[340px]">
                            <ResponsiveContainer width="100%" height="100%">
                              <BarChart
                                layout="vertical"
                                data={[...filteredTrackingData.consultorTaskCounts].sort((a, b) => b.task_count - a.task_count)}
                                margin={{ top: 5, right: 30, left: -40, bottom: -10 }}
                              >
                                <CartesianGrid strokeDasharray="3 3" horizontal={false} vertical={true} />
                                <XAxis 
                                  type="number" 
                                  tick={{ fontSize: 10 }}
                                  allowDecimals={false}
                                />
                                <YAxis 
                                  type="category" 
                                  dataKey="name"
                                  tick={{ fontSize: 11, textAnchor: 'end' }}
                                  width={200}
                                  interval={0}
                                />
                                <Tooltip 
                                  formatter={(value: number) => [value, 'Tarefas']}
                                  labelStyle={{ color: '#374151' }}
                                  contentStyle={{ 
                                    backgroundColor: '#f9fafb', 
                                    border: '1px solid #d1d5db',
                                    borderRadius: '6px'
                                  }}
                                />
                                <Bar 
                                  dataKey="task_count" 
                                  fill="#10b981"
                                  radius={[0, 4, 4, 0]}
                                  maxBarSize={15}
                                >
                                  {[...filteredTrackingData.consultorTaskCounts]
                                    .sort((a, b) => b.task_count - a.task_count)
                                    .map((_, index) => {
                                      // Gradiente de cores do mais escuro para mais claro (verde)
                                      const colors = ['#047857', '#059669', '#10b981', '#34d399', '#6ee7b7', '#a7f3d0'];
                                      const color = colors[Math.min(index, colors.length - 1)];
                                      return <Cell key={`cell-${index}`} fill={color} />;
                                    })}
                                  <LabelList 
                                    dataKey="task_count" 
                                    position="right" 
                                    style={{ fontSize: 10, fontWeight: 'bold', fill: '#374151' }}
                                  />
                                </Bar>
                              </BarChart>
                            </ResponsiveContainer>
                          </div>
                        ) : (
                          <div className="text-center py-8">
                            <p className="text-gray-500 dark:text-gray-400 text-sm">
                              Nenhum consultor encontrado para este projeto
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Card de Consultores - Gráfico de Barras Horizontal */}
                  <div className="w-1/3">
                    <div className="card p-6">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                          <Clock className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                          <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
                            Horas lançadas
                          </h3>
                        </div>
                        {filteredTrackingData.consultors.length > 0 && (
                          <span className="text-sm font-bold text-primary-600 dark:text-primary-400">
                            {formatSecondsToHM(filteredTrackingData.consultors.reduce((total, consultor) => total + consultor.total_hours, 0) * 3600)}
                          </span>
                        )}
                      </div>
                      <div>
                        {filteredTrackingData.consultors.length > 0 ? (
                          <div className="h-[340px]">
                            <ResponsiveContainer width="100%" height="100%">
                              <BarChart
                                layout="vertical"
                                data={[...filteredTrackingData.consultors].sort((a, b) => b.total_hours - a.total_hours)}
                                margin={{ top: 5, right: 50, left: -40, bottom: -10 }}
                              >
                                <CartesianGrid strokeDasharray="3 3" horizontal={false} vertical={true} />
                                <XAxis 
                                  type="number" 
                                  tick={{ fontSize: 10 }}
                                  allowDecimals={false}
                                  tickFormatter={(value) => `${Math.floor(value)}h`}
                                />
                                <YAxis 
                                  type="category" 
                                  dataKey="name"
                                  tick={{ fontSize: 11, textAnchor: 'end' }}
                                  width={200}
                                  interval={0}
                                />
                                <Tooltip 
                                  formatter={(value: number) => [formatSecondsToHM(value * 3600), 'Horas']}
                                  labelStyle={{ color: '#374151' }}
                                  contentStyle={{ 
                                    backgroundColor: '#f9fafb', 
                                    border: '1px solid #d1d5db',
                                    borderRadius: '6px'
                                  }}
                                />
                                <Bar 
                                  dataKey="total_hours" 
                                  fill="#3b82f6"
                                  radius={[0, 4, 4, 0]}
                                  maxBarSize={15}
                                >
                                  {[...filteredTrackingData.consultors]
                                    .sort((a, b) => b.total_hours - a.total_hours)
                                    .map((_, index) => {
                                      // Gradiente de cores do mais escuro para mais claro
                                      const colors = ['#1e40af', '#2563eb', '#3b82f6', '#60a5fa', '#93c5fd', '#bfdbfe'];
                                      const color = colors[Math.min(index, colors.length - 1)];
                                      return <Cell key={`cell-${index}`} fill={color} />;
                                    })}
                                  <LabelList 
                                    dataKey="total_hours" 
                                    position="right" 
                                    formatter={(value: number) => formatSecondsToHM(value * 3600)}
                                    style={{ fontSize: 10, fontWeight: 'bold', fill: '#374151' }}
                                  />
                                </Bar>
                              </BarChart>
                            </ResponsiveContainer>
                          </div>
                        ) : (
                          <div className="text-center py-8">
                            <p className="text-gray-500 dark:text-gray-400 text-sm">
                              Nenhum consultor encontrado para este projeto
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  </div>

                  {/* Segunda linha de cards */}
                  <div className="flex gap-6 mt-6">
                  {/* Card de Horas por Tipo de Tarefa */}
                  <div className="w-1/2">
                    <div className="card p-6 max-h-[calc(100vh-400px)] overflow-y-auto">
                      <div className="flex items-center gap-2 mb-4">
                        <BarChart3 className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
                          Horas por Tipo
                        </h3>
                      </div>
                      <div className="space-y-4">
                        {filteredTrackingData.taskTypeHours.length > 0 ? (
                          <div className="overflow-hidden">
                            {/* Cabeçalho da tabela */}
                            <div className="grid grid-cols-3 gap-4 pb-3 border-b border-gray-200 dark:border-gray-600 mb-3">
                              <div className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
                                Tipo
                              </div>
                              <div className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide text-center">
                                Estimado
                              </div>
                              <div className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide text-center">
                                Executado
                              </div>
                            </div>
                            
                            {/* Linhas da tabela */}
                            <div className="space-y-1">
                              {filteredTrackingData.taskTypeHours.map((typeData) => (
                                <div key={typeData.type_name}>
                                  {/* Linha principal do tipo */}
                                  <div 
                                    className="grid grid-cols-3 gap-4 py-1 border-b border-gray-100 dark:border-gray-700 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                                    onClick={() => toggleTypeExpansion(typeData.type_name)}
                                  >
                                    <div className="flex items-center gap-2 text-sm font-medium text-gray-900 dark:text-gray-100">
                                      {expandedTypes.has(typeData.type_name) ? (
                                        <ChevronDown className="w-4 h-4 text-gray-500" />
                                      ) : (
                                        <ChevronRight className="w-4 h-4 text-gray-500" />
                                      )}
                                      <span className="truncate">{typeData.type_name}</span>
                                    </div>
                                    <div className="text-sm font-semibold text-blue-600 dark:text-blue-400 text-center">
                                      {formatSecondsToHM(typeData.estimated_hours * 3600)}
                                    </div>
                                    <div className={`text-sm font-semibold text-center ${
                                      typeData.worked_hours > typeData.estimated_hours 
                                        ? 'text-red-600 dark:text-red-400' 
                                        : 'text-green-600 dark:text-green-400'
                                    }`}>
                                      {formatSecondsToHM(typeData.worked_hours * 3600)}
                                    </div>
                                  </div>
                                  
                                  {/* Consultores expandidos */}
                                  {expandedTypes.has(typeData.type_name) && typeData.consultors && typeData.consultors.length > 0 && (
                                    <div className="ml-6 mt-1 mb-2 bg-gray-50 dark:bg-gray-800 rounded-md p-2">
                                      {typeData.consultors.map((consultor, index) => (
                                        <div 
                                          key={`${typeData.type_name}-${consultor.user_id || index}`}
                                          className="grid grid-cols-3 gap-4 py-1 text-xs"
                                        >
                                          <div className="text-gray-700 dark:text-gray-300 truncate">
                                            • {consultor.name}
                                          </div>
                                          <div className="text-center text-gray-500">
                                            -
                                          </div>
                                          <div className="text-center text-gray-700 dark:text-gray-300 font-medium">
                                            {formatSecondsToHM(consultor.worked_seconds)}
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <div className="text-center py-8">
                            <p className="text-gray-500 dark:text-gray-400 text-sm">
                              Nenhum tipo de tarefa encontrado
                            </p>
                          </div>
                        )}
                      </div>
                      {filteredTrackingData.taskTypeHours.length > 0 && (
                        <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
                          <div className="grid grid-cols-3 gap-4">
                            <div className="text-sm font-bold text-gray-900 dark:text-gray-100">
                              Total:
                            </div>
                            <div className="text-sm font-bold text-blue-600 dark:text-blue-400 text-center">
                              {formatSecondsToHM(filteredTrackingData.taskTypeHours.reduce((total, type) => total + type.estimated_hours, 0) * 3600)}
                            </div>
                            <div className={`text-sm font-bold text-center ${
                              filteredTrackingData.taskTypeHours.reduce((total, type) => total + type.worked_hours, 0) * 3600
                                > filteredTrackingData.taskTypeHours.reduce((total, type) => total + type.estimated_hours, 0) * 3600
                                ? 'text-red-600 dark:text-red-400' 
                                : 'text-green-600 dark:text-green-400'
                            }`}>
                              {formatSecondsToHM(filteredTrackingData.taskTypeHours.reduce((total, type) => total + type.worked_hours, 0) * 3600)}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {activeTab === 'status-report' && (
          <div className="flex-1 overflow-y-auto">
            {isLoadingPhases ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="w-8 h-8 animate-spin text-gray-500" />
                <p className="ml-4 text-gray-600 dark:text-gray-400">Carregando status do projeto...</p>
              </div>
            ) : (
              <div className="p-6 pt-2">
                {/* Linha de botões para Curva S */}
                {!isFullScreen && (
                  <div className="flex justify-end mb-2">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={async () => {
                          // Calcular semanas do projeto
                          const weeks = calculateProjectWeeks();
                          setProjectWeeks(weeks);
                          
                          // Definir primeira semana como padrão se há semanas disponíveis
                          const initialWeek = weeks.length > 0 ? 1 : 1;
                          setSelectedWeek(initialWeek);

                          // Abrir novo modal
                          setIsProgressModalOpen(true);
                        }}
                        className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                        title="Editar progresso das fases"
                      >
                        <Edit className="w-4 h-4" />
                        Editar Progresso
                      </button>
                    </div>
                  </div>
                )}

                {/* Card Curva S */}
                <div className="card w-full p-6 mb-6 mt-2">
                  <div className="flex items-center gap-2 mb-6">
                    <BarChart3 className="w-6 h-6 text-primary-600 dark:text-primary-400" />
                    <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-200">
                      Avanço do Projeto
                    </h3>
                  </div>
                  {(() => {
                    const { dataPoints, currentWeek, phaseBars } = generateSCurveChartData();
                    return dataPoints.length > 0 ? (
                      <div className="h-80">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={dataPoints}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis 
                              dataKey="date" 
                              tick={{ fontSize: 12 }}
                              angle={-45}
                              textAnchor="end"
                              height={60}
                            />
                            <YAxis 
                              tick={{ fontSize: 12 }}
                              domain={[0, 100]}
                              tickFormatter={(value) => `${value}%`}
                            />
                            <Tooltip 
                              formatter={(value, name) => [
                                `${value}%`, 
                                name === 'planned' ? 'Planejado' : 'Real'
                              ]}
                              labelFormatter={(label: any, payload: any) => {
                                if (payload && payload.length > 0 && payload[0].payload) {
                                  const data = payload[0].payload;
                                  return `${label} (${data.fullDate})`;
                                }
                                return label;
                              }}
                              labelStyle={{ color: '#374151' }}
                              contentStyle={{ 
                                backgroundColor: '#f9fafb', 
                                border: '1px solid #d1d5db',
                                borderRadius: '6px'
                              }}
                            />
                            <Legend 
                              formatter={(value) => value === 'planned' ? 'Progresso Planejado' : 'Progresso Real'}
                            />
                            
                            {/* Barras horizontais das fases começando do topo (100%) */}
                            {phaseBars && phaseBars.map((phaseBar, index) => {
                              const colors = ['#FEF3C7', '#DBEAFE', '#D1FAE5', '#FCE7F3', '#F3E8FF', '#E0E7FF'];
                              const strokeColors = ['#F59E0B', '#3B82F6', '#10B981', '#EC4899', '#8B5CF6', '#6366F1'];
                              const fillColor = colors[index % colors.length];
                              const strokeColor = strokeColors[index % strokeColors.length];
                              
                              // Cada barra tem altura fixa de 8% do gráfico
                              const barHeight = 8;
                              // Começar do topo (100%) e ir descendo para cada fase
                              // Primeira fase: 100 - 8 = 92 até 100
                              // Segunda fase: 92 - 8 = 84 até 92
                              // etc.
                              const yEnd = 100 - (index * barHeight);
                              const yStart = yEnd - barHeight;
                              
                              return (
                                <ReferenceArea
                                  key={`phase-${phaseBar.phase}-${index}`}
                                  x1={phaseBar.startWeek}
                                  x2={phaseBar.endWeek}
                                  y1={yStart}
                                  y2={yEnd}
                                  fill={fillColor}
                                  fillOpacity={0.7}
                                  stroke={strokeColor}
                                  strokeOpacity={0.9}
                                  strokeWidth={2}
                                  label={{
                                    value: phaseBar.phase,
                                    position: 'center',
                                    style: {
                                      fontSize: '11px',
                                      fill: '#1F2937',
                                      fontWeight: 'bold',
                                      textAnchor: 'middle'
                                    }
                                  }}
                                />
                              );
                            })}
                            
                            {currentWeek && (
                              <ReferenceLine 
                                x={currentWeek} 
                                stroke="#374151" 
                                strokeWidth={2}
                                strokeDasharray="3 3"
                                label={{ 
                                  value: "Semana Atual", 
                                  position: "top",
                                  style: { 
                                    textAnchor: 'middle',
                                    fontSize: '12px',
                                    fill: '#374151'
                                  }
                                }}
                              />
                            )}
                            <Line 
                              type="monotone" 
                              dataKey="planned" 
                              stroke="#3B82F6" 
                              strokeWidth={2}
                              strokeDasharray="5 5"
                              dot={{ fill: '#3B82F6', strokeWidth: 2, r: 4 }}
                            />
                            <Line 
                              type="monotone" 
                              dataKey="actual" 
                              stroke="#10B981" 
                              strokeWidth={3}
                              dot={{ fill: '#10B981', strokeWidth: 2, r: 4 }}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center h-64 text-gray-500 dark:text-gray-400">
                        <BarChart3 className="w-16 h-16 mb-4 opacity-50" />
                        <p className="text-lg font-medium">Dados insuficientes</p>
                        <p className="text-sm text-center mt-2">
                          Para gerar avanço do projeto, é necessário ter tarefas com datas planejadas e fases configuradas.
                        </p>
                      </div>
                    );
                  })()}
                </div>

                {/* Card Avanço das Fases */}
                <div className="card w-full p-6 mt-6">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-2">
                      <PieChart className="w-6 h-6 text-primary-600 dark:text-primary-400" />
                      <div>
                        <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-200">
                          Avanço das Fases do Projeto
                        </h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          {(() => {
                            const currentWeek = getCurrentProjectWeek();
                            const weeks = calculateProjectWeeks();
                            const currentWeekData = weeks.find(w => w.value === currentWeek);
                            const displayedPhases = getCurrentWeekPhases;
                            
                            if (displayedPhases.length > 0) {
                              const displayedWeek = displayedPhases[0].period;
                              const displayedWeekData = weeks.find(w => w.value === displayedWeek);
                              
                              if (displayedWeek === currentWeek) {
                                return `Semana Atual: ${currentWeekData?.label || `Semana ${currentWeek}`}`;
                              } else {
                                return `Última semana com dados: ${displayedWeekData?.label || `Semana ${displayedWeek}`}`;
                              }
                            }
                            
                            return `Semana Atual: ${currentWeekData?.label || `Semana ${currentWeek}`} (sem dados cadastrados)`;
                          })()}
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  {getCurrentWeekPhases.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6 h-full">
                        {getCurrentWeekPhases.map((phase, index) => {
                        //  const colors = ['#F97316', '#FB923C', '#FCD34D', '#FBBF24', '#F59E0B'];
                        const colors = ['#f28c1a', '#f28c1a', '#f28c1a', '#f28c1a', '#f28c1a'];
                         const color = colors[index % colors.length];
                         
                         // Lógica para cor de fundo da área central baseada na comparação entre progresso e meta
                         const getCenterBackgroundColor = (progress: number, expectedProgress: number) => {
                           // Se porcentagem e meta são 0, cinza
                           if (progress === 0 && expectedProgress === 0) {
                             return '#e4e6eb'; // Cinza
                           }
                           
                           // Se porcentagem é maior ou igual à meta, verde
                           if (progress >= expectedProgress) {
                             return '#d9ead3ff'; // Verde
                           }
                           
                           // Calcular diferença (meta - progresso)
                           const difference = expectedProgress - progress;
                           
                           // Se diferença é até 5, amarelo
                           if (difference <= 5) {
                             return '#f5f095ff'; // Amarelo
                           }
                           
                           // Se diferença é maior que 5, vermelho
                           return '#f4ccccff'; // Vermelho
                         };
                         
                         const centerBackgroundColor = getCenterBackgroundColor(phase.progress, phase.expected_progress);
                        
                        const data = [
                          { name: 'Concluído', value: phase.progress, fill: color },
                          { name: 'Restante', value: 100 - phase.progress, fill: '#53585fff' }
                        ];

                        return (
                          <div key={phase.id} className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm border border-gray-200 dark:border-gray-700">
                            <h4 className="text-lg font-medium text-gray-800 dark:text-gray-200 text-center">
                              {phase.phase_name}
                            </h4>
                            <div className="flex justify-center ">
                              <span className={`font-medium text-xs px-2 py-1 rounded-full ${
                                phase.progress >= phase.expected_progress 
                                  ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' 
                                  : phase.progress >= phase.expected_progress * 0.9
                                  ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                                  : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                              }`}>
                                {phase.progress >= phase.expected_progress ? 'No prazo' : 
                                  phase.progress >= phase.expected_progress * 0.9 ? 'Atenção' : 'Atrasado'}
                              </span>
                            </div>
                            <div className="h-48 relative">
                              <ResponsiveContainer width="100%" height="100%">
                                <RechartsPieChart>
                                  <Pie
                                    data={data}
                                    dataKey="value"
                                    nameKey="name"
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={80}
                                    paddingAngle={0}
                                    startAngle={90}
                                    endAngle={-270}
                                  >
                                    {data.map((entry, index) => (
                                      <Cell key={`cell-${index}`} fill={entry.fill} />
                                    ))}
                                  </Pie>
                                  <Tooltip 
                                    formatter={(value: number) => [`${value}%`, '']}
                                    labelStyle={{ color: '#374151' }}
                                    contentStyle={{ 
                                      backgroundColor: '#f9fafb', 
                                      borderRadius: '6px'
                                    }}
                                  />
                                </RechartsPieChart>
                              </ResponsiveContainer>
                              
                              {/* Percentage in center */}
                               <div className="absolute inset-0 flex items-center justify-center">
                                   <div 
                                    className="text-center rounded-full w-24 h-24 flex flex-col items-center justify-center border-2 border-gray-300"
                                     style={{ backgroundColor: centerBackgroundColor }}
                                   >
                                   <div className="text-2xl font-bold text-gray-800 dark:text-gray-800">
                                     {phase.progress}%
                                   </div>
                                  <div className="text-xs text-gray-700 dark:text-gray-800">
                                    Meta: {phase.expected_progress}% 
                                  </div>
                                </div>
                              </div>
                            </div>

                           
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-64 text-gray-500 dark:text-gray-400">
                      <PieChart className="w-16 h-16 mb-4 opacity-50" />
                      <p className="text-lg font-medium">Nenhuma fase encontrada</p>
                      <p className="text-sm text-center mt-2">
                        Este projeto ainda não possui fases configuradas.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      
      {/* Modal de Progresso das Fases */}
      <ProjectProgressModal
        isOpen={isProgressModalOpen}
        onClose={() => setIsProgressModalOpen(false)}
        project={project}
        projectWeeks={projectWeeks}
        selectedWeek={selectedWeek}
        onWeekChange={setSelectedWeek}
        onSuccess={showSuccessNotification}
        onError={showErrorNotification}
        onProjectPhasesUpdate={setProjectPhases}
      />

      {/* Modal de Risco */}
      <RiskModal
        isOpen={isRiskModalOpen}
        onClose={() => {
          setIsRiskModalOpen(false);
          setSelectedRisk(null);
        }}
        onSuccess={reloadRisks}
        projectId={project.project_id}
        riskData={selectedRisk}
      />

      {/* Modal de Acesso */}
      <AccessModal
        isOpen={isAccessModalOpen}
        onClose={() => {
          setIsAccessModalOpen(false);
          setSelectedAccess(null);
          setIsCloneMode(false);
        }}
        onSuccess={reloadAccesses}
        projectId={project.project_id}
        accessData={selectedAccess}
        isCloneMode={isCloneMode}
      />

      {/* Modal de Confirmação de Exclusão de Risco */}
      {isDeleteRiskConfirmModalOpen && riskToDelete && (
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
                  Deletar Risco do Projeto
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                  Tem certeza que deseja deletar o risco:
                </p>
                <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg mb-4">
                  <p className="font-semibold text-gray-900 dark:text-gray-100">
                    "{riskToDelete.description}"
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    Tipo: {riskToDelete.type}
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
                  setIsDeleteRiskConfirmModalOpen(false);
                  setRiskToDelete(null);
                }}
                className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 font-semibold bg-gray-200 dark:bg-gray-700 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
              >
                Cancelar
              </button>
              <button 
                onClick={handleConfirmDeleteRisk}
                className="px-4 py-2 text-sm text-white font-semibold bg-red-500 rounded-lg hover:bg-red-600 transition-colors flex items-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                Deletar Risco
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Confirmação de Exclusão de Acesso */}
      {isDeleteAccessConfirmModalOpen && accessToDelete && (
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
                  Deletar Acesso
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                  Tem certeza que deseja deletar o acesso:
                </p>
                <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg mb-4">
                  <p className="font-semibold text-gray-900 dark:text-gray-100">
                    Plataforma: {accessToDelete.platform_name}
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    Ambiente: {accessToDelete.environment_name}
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Função: {accessToDelete.role_name}
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
                  setIsDeleteAccessConfirmModalOpen(false);
                  setAccessToDelete(null);
                }}
                className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 font-semibold bg-gray-200 dark:bg-gray-700 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
              >
                Cancelar
              </button>
              <button 
                onClick={handleConfirmDeleteAccess}
                className="px-4 py-2 text-sm text-white font-semibold bg-red-500 rounded-lg hover:bg-red-600 transition-colors flex items-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                Deletar Acesso
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProjectDetail;
