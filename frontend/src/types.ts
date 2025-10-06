// User Types
export interface User {
  id: string
  name: string
  email: string
  role: UserRole
  avatar?: string
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export enum UserRole {
  ADMIN = 'ADMIN',
  MANAGER = 'MANAGER',
  EMPLOYEE = 'EMPLOYEE'
}

// Employee Types
export interface Employee {
  id: string
  userId: string
  employeeCode: string
  department?: string
  position?: string
  hourlyRate?: number
  isActive: boolean
  user: User
  skills: EmployeeSkill[]
  createdAt: string
  updatedAt: string
}

export interface EmployeeSkill {
  id: string
  employeeId: string
  skillId: string
  level: SkillLevel
  skill: Skill
  createdAt: string
}

// Skill Types
export interface Skill {
  id: string
  name: string
  category?: string
  description?: string
  createdAt: string
  updatedAt: string
}

export enum SkillLevel {
  BEGINNER = 'BEGINNER',
  INTERMEDIATE = 'INTERMEDIATE',
  ADVANCED = 'ADVANCED',
  EXPERT = 'EXPERT'
}

export interface DbUser {
  id: number;
  created_at: string;
  updated_at: string; 
  user_id: string | null;
  name: string;
  email: string;
  avatar_large_url: string | null;
  position: string | null;
  skill_id: number | null;
  on_vacation: boolean;
  birthday: string | null;
  phone: string | null;
  is_active: boolean;
  log_hours: boolean;
  skills: {
    name: string;
  } | null;
  in_company_since?: string;
  users_skill?: Array<{
    id: string;
    skills: {
      id: string;
      area: string | null;
      category: string | null;
      skill: string | null;
    };
  }>;
}

export interface DbTask {
  id: number;
  created_at: string;
  updated_at: string;
  task_id: number | null;
  project_id: number | null; 
  title: string;
  is_closed: boolean;
  board_name: string | null;
  board_stage_name: string | null;
  type_name: string | null; 
  gantt_bar_start_date: string | null;
  gantt_bar_end_date: string | null;
  desired_date: string | null;
  desired_start_date: string | null;
  desired_date_with_time: string | null;
  project_name: string | null;
  client_name: string | null;
  responsible_id: string | null; 
  responsible_name: string | null;
  current_estimate_seconds: number | null;
  time_worked: number | null;
  billing_type : string | null;
  technology: string | null;
  assignments: TaskAssignment[];
}
export interface AssigneeUser {
  user_id: string;
  name: string;
  avatar_large_url: string | null;
}


export interface TaskAssignment {
  assignee_id: string;
  users: AssigneeUser | null; 
}

export interface DbProject {
  id: number;
  project_id: number;
  name: string;
  client_name: string;
  project_sub_group_name: string;
  start_date: string | null;
  close_date: string | null;
  tasks_count: number;
  tasks_closed_count: number;
  tasks_working_on_count: number;
  tasks_queued_count: number;
  time_progress: number; // float (ex: 0.75 para 75%)
  time_total: number; 
  time_worked: number;
  is_closed: boolean;
  planned_seconds_total: number | null;
  owners?: DbProjectOwner[];
}

export interface DbDomain {
  id: number;
  created_at: string;
  updated_at: string;
  type: string;
  value: string;
  is_active: boolean;
}

export interface DbRisk {
  id: number;
  created_at: string;
  updated_at: string;
  project_id: number;
  type_id: number | null;
  type: string;
  priority_id: number | null;
  priority: string;
  description: string;
  action_plan: string;
  start_date: string | null;
  forecast_date: string | null;
  close_date: string | null;
  status_id: number | null;
  status: string;
  owner_id: string | null;
  owner_name: string | null;
  manual_owner: string | null;
  owner_user_id?: string | null;
  owner_is_user?: boolean;
}

export interface DbProjectOwner {
  id: number;
  created_at: string;
  updated_at: string;
  project_id: number;
  user_id: string;
  users?: {
    user_id: string;
    name: string;
    avatar_large_url: string | null;
  } | null;
}

export interface DbProjectPhase {
  id: number;
  created_at: string;
  updated_at: string;
  project_id: number;
  domains_id: number;
  expected_progress: number;
  progress: number;
  order: number; // Ordem de exibição das fases
  period: number | null; // Número da semana do projeto
  phase_name?: string; // Nome da fase obtido através do relacionamento com domains
  domains?: {
    id: number;
    value: string;
  };
}

// Time Entries Types
export interface TimeEntryData {
  user_id: string;
  user_name: string;
  expected_hours: number;
  worked_hours: number;
  expected_hours_until_yesterday?: number;
  overtime_hours_in_period: number;
  positive_comp_hours_in_period: number;
  negative_comp_hours_in_period: number;
  total_positive_comp_hours: number;
  total_negative_comp_hours: number;
  time_balance: number;
}

export interface DailyTimeEntry {
  date: string;
  dayOfWeek: string;
  expected_hours: number;
  worked_hours: number;
  isInsufficient: boolean;
  isMoresufficient: boolean;
}

export interface TimesheetReportRow {
  user_name: string;
  hours_worked_in_period: number;
  overtime_hours_in_period: number;
  positive_comp_hours_in_period: number;
  negative_comp_hours_in_period: number;
  total_positive_comp_hours: number;
  total_negative_comp_hours: number;
  time_balance: number;
}

export interface ConsultantOption {
  value: string;
  label: string;
}