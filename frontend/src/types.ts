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

// ============================================================================
// EVALUATION ACCEPT TYPES
// ============================================================================

/**
 * Dados da avaliação retornados pelo endpoint de verificação de token
 */
export interface EvaluationAcceptInfo {
  id: number
  name: string
  userName: string
  ownerName: string
  periodStart: string
  periodEnd: string
  averageScore: number | null
}

/**
 * Pergunta da avaliação com resposta (read-only)
 */
export interface EvaluationAcceptQuestion {
  question_id: number
  question: string
  description: string | null
  category_id: number
  category: string
  subcategory_id: number | null
  subcategory: string
  reply_type_id: number
  reply_type: string // 'Escala', 'Texto', 'Sim/Não'
  weight: number
  required: boolean
  category_order: number
  subcategory_order: number
  question_order: number
  // Resposta
  score: number | null
  reply: string | null
  yes_no: boolean | null
}

/**
 * Categoria/Subcategoria da avaliação
 */
export interface EvaluationAcceptCategory {
  id: number
  type: string
  value: string
  is_active: boolean
  parent_id: number | null
}

/**
 * Resposta completa do endpoint /api/evaluation-accept/verify/:token
 */
export interface EvaluationAcceptVerifyResponse {
  evaluation: EvaluationAcceptInfo
  questions: EvaluationAcceptQuestion[]
  categories: EvaluationAcceptCategory[]
  expiresAt: string
}

// ============================================================================
// FEEDBACK ACCEPT TYPES
// ============================================================================

/**
 * Dados do feedback retornados pelo endpoint de verificação de token
 */
export interface FeedbackAcceptInfo {
  id: number
  feedbackUserName: string
  ownerName: string
  feedbackDate: string
  type: string
  typeId: number | null
  publicComment: string
}

/**
 * Resposta completa do endpoint /api/feedback-accept/verify/:token
 */
export interface FeedbackAcceptVerifyResponse {
  feedback: FeedbackAcceptInfo
  expiresAt: string
}

// ============================================================================

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
  board_stage_id: number | null;
  board_stage_name: string | null;
  stage_position: number | null;
  stage_group: string | null;
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

/**
 * Tempo trabalhado agrupado por usuário e tarefa
 * Usado para calcular horas lançadas e tarefas por consultor baseado em quem efetivamente lançou horas
 */
export interface TimeEntryGrouped {
  user_id: string;
  user_name: string;
  task_id: number;
  time_seconds: number;
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
  tag: string;
  is_active: boolean;
  parent_id: number | null;
  description: string | null;
  parent?: {
    id: number;
    type: string;
    value: string;
  } | null;
}

export interface DomainWithChildren extends DbDomain {
  children?: DbDomain[];
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
  comp_positive: number;
  comp_negative: number;
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

// Evaluation types
export interface EvaluationData {
  id: number;
  name: string;
  description: string;
  is_active: boolean;
  created_at: string;
}

export interface CategoryData {
  id: number;
  type: string;
  value: string;
  is_active: boolean;
  parent_id: number | null;
}

export interface QuestionData {
  id: number;
  question: string;
  description?: string | null; // Descrição da pergunta
  category: string;
  subcategory: string;
  category_id: number;
  subcategory_id: number | null;
  weight: number;
  required: boolean;
  reply_type_id: number;
  category_order: number;
  question_order: number;
  subcategory_order: number; // Ordem da subcategoria dentro da categoria
  evaluation_question_id?: number; // ID da linha na tabela evaluations_questions_model
}

export interface ReplyTypeOption {
  id: number;
  value: string;
}

// Employee Evaluation types (instances of evaluation applied to employees)
export interface EmployeeEvaluationData {
  id: number;
  created_at: string;
  updated_at: string;
  evaluation_model_id: number;
  name: string;
  user_id: string;
  user_name: string;
  owner_id: string;
  owner_name: string;
  period_start: string;
  period_end: string;
  status_id: number | null;
  is_done: boolean;
  is_closed?: boolean;
  accepted?: boolean;
  accepted_at?: string | null;
  status?: {
    id: number;
    value: string;
  } | null;
  evaluations_projects?: Array<{
    project_id: number;
  }>;
}

export interface EvaluationProjectOption {
  value: number;
  label: string;
}

export interface PdiData {
  id: number;
  created_at: string;
  updated_at: string;
  user_id: string;
  user_name: string;
  owner_id: string;
  owner_name: string;
  status_id: number;
  status: { id: number; value: string } | null;
  start_date: string;
  end_date: string;
  review_date: string;
  comments: string;
  is_closed?: boolean;
}

// Evaluation Response types (for filling out evaluations)
export interface EvaluationInfo {
  id: number;
  name: string;
  evaluation_model_id: number;
  user_id: string;
  user_name: string;
  owner_id: string;
  owner_name: string;
  period_start: string;
  period_end: string;
  status_id: number | null;
  is_done: boolean;
  is_closed?: boolean;
}

export interface EvaluationQuestionData {
  id: number;
  question: string;
  description: string | null;
  category_id: number;
  subcategory_id: number | null;
  reply_type_id: number;
  reply_type: string;
  weight: number;
  required: boolean;
  category_order: number;
  question_order: number;
  subcategory_order: number;
  question_id: number; // ID da tabela questions_model
}

export interface QuestionResponse {
  question_id: number;
  score: number | null;
  reply: string | null;
  yes_no: boolean | null;
}

// Evaluation tracking types (for radar chart)
export interface SubcategoryEvaluationData {
  subcategory: string;
  [key: string]: string | number; // Para permitir propriedades dinâmicas como "Avaliação 1", "Avaliação 2", etc.
}

export interface EvaluationMetadata {
  id: number;
  name: string;
  updated_at: string;
}

// Notification types
export interface Notification {
  id: number;
  created_at: string;
  updated_at: string;
  title: string;
  message: string;
  type_id: number;
  type: 'info' | 'success' | 'warning' | 'error';
  source_type: string | null; // 'feedback', 'evaluation', 'task', 'system'
  source_id: string | null;
  audience: 'all' | 'user';
  auth_user_id: string | null;
  link_url: string | null;
  is_read: boolean;
  read_at: string | null;
  is_deleted?: boolean; // Para notificações 'all', indica se o usuário marcou como deletada
}

export interface NotificationAllUsersState {
  id: number;
  notification_id: number;
  auth_user_id: string;
  is_read: boolean;
  read_at: string | null;
  is_deleted: boolean;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateNotificationParams {
  title: string;
  message: string;
  type_id: number;
  type: 'info' | 'success' | 'warning' | 'error';
  audience?: 'all' | 'user';
  auth_user_id?: string | null;
  link_url?: string | null;
  source_type?: string | null;
  source_id?: string | null;
}

// Access Platform Types
export interface DbAccessPlatform {
  id: number;
  created_at: string;
  updated_at: string;
  client_id: number;
  client_name: string;
  user_id: string;
  user_name?: string; // Nome do funcionário via join
  platform_id: number;
  platform_name: string;
  environment_id: number;
  environment_name: string;
  role_id: number;
  role_name: string;
  risk_id: number;
  risk_name: string;
  description: string | null;
  expiration_date: string | null;
  is_active: boolean;
  repositories?: DbAccessRepository[]; // Para plataforma GitHub
  access_policies?: string[]; // Políticas de acesso (valores desnormalizados)
  data_types?: string[]; // Tipos de dados (valores desnormalizados)
}

export interface DbAccessRepository {
  id: number;
  created_at: string;
  updated_at: string;
  client_id: number;
  name: string;
  description: string | null;
  is_active: boolean;
}

export interface DbAccessRepositoryPlatform {
  id: number;
  created_at: string;
  updated_at: string;
  plataform_id: number;
  repository_id: number | null;
}

// Access Platform Details Types (vinculado com domains)
export interface DbAccessPlatformDetail {
  id: number;
  created_at: string;
  updated_at: string;
  access_platform_id: number;
  domain_id: number;
  domain_value: string;
  domain_tag: string | null;
  domain_type: string; // 'access_policy' | 'access_data_type'
}

// Access Platform Grouped Types
export interface DbAccessPlatformGrouped {
  platform_name: string;
  platform_id: number;
  accesses: DbAccessPlatform[];
  expanded?: boolean;
}