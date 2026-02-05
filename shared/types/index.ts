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

// Project Types
export interface Project {
  id: string
  name: string
  description?: string
  status: ProjectStatus
  priority: Priority
  startDate: string
  endDate: string
  budget?: number
  members: ProjectMember[]
  tasks: Task[]
  allocations: Allocation[]
  createdAt: string
  updatedAt: string
}

export enum ProjectStatus {
  PLANNED = 'PLANNED',
  IN_PROGRESS = 'IN_PROGRESS',
  ON_HOLD = 'ON_HOLD',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED'
}

export enum Priority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  URGENT = 'URGENT'
}

export interface ProjectMember {
  id: string
  projectId: string
  userId: string
  role: ProjectRole
  startDate: string
  endDate?: string
  user: User
  createdAt: string
  updatedAt: string
}

export enum ProjectRole {
  LEADER = 'LEADER',
  MEMBER = 'MEMBER',
  OBSERVER = 'OBSERVER'
}

// Task Types
export interface Task {
  id: string
  projectId: string
  name: string
  description?: string
  status: TaskStatus
  priority: Priority
  estimatedHours?: number
  actualHours?: number
  startDate?: string
  endDate?: string
  allocations: Allocation[]
  createdAt: string
  updatedAt: string
}

export enum TaskStatus {
  TODO = 'TODO',
  IN_PROGRESS = 'IN_PROGRESS',
  REVIEW = 'REVIEW',
  DONE = 'DONE',
  CANCELLED = 'CANCELLED'
}

// Allocation Types
export interface Allocation {
  id: string
  employeeId: string
  projectId: string
  taskId?: string
  weekStart: string
  weekEnd: string
  hours: number
  status: AllocationStatus
  notes?: string
  employee: Employee
  project: Project
  task?: Task
  createdAt: string
  updatedAt: string
}

export enum AllocationStatus {
  PLANNED = 'PLANNED',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED'
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

// API Response Types
export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  error?: {
    message: string
    code?: string
    details?: any
  }
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

// Dashboard Types
export interface DashboardStats {
  totalHours: number
  utilizationRate: number
  deviations: number
  activeProjects: number
  activeEmployees: number
  weeklyTrend: {
    planned: number
    actual: number
  }
}

// Form Types
export interface LoginForm {
  email: string
  password: string
}

export interface CreateAllocationForm {
  employeeId: string
  projectId: string
  taskId?: string
  weekStart: string
  weekEnd: string
  hours: number
  notes?: string
}

export interface CreateProjectForm {
  name: string
  description?: string
  startDate: string
  endDate: string
  budget?: number
  priority: Priority
}

export interface CreateEmployeeForm {
  name: string
  email: string
  employeeCode: string
  department?: string
  position?: string
  hourlyRate?: number
  skills?: string[]
}

// Allocation Calendar Types
export interface FullCalendarResource {
  id: string
  title: string
}

export interface SelectOption {
  value: string
  label: string
}

export interface UserSkillData {
  id: string
  skills: {
    id: string
    area: string
    category: string
    skill: string
  }
}

export interface UserWithSkills {
  user_id: string
  name?: string
  email?: string
  is_active?: boolean
  employees_skill: UserSkillData[]
}

export interface AllocationFilterParams {
  consultantIds: string[]
  projectNames: string[]
  status: boolean | null
  startDate: string
}

export interface AssignmentTask {
  task_id: string
  title: string
  client_name: string
  project_name: string
  type_name: string
  gantt_bar_start_date: string | null
  gantt_bar_end_date: string | null
}

export interface Assignment {
  id: string
  assignee_id: string
  is_closed: boolean
  close_date: string | null
  created_at: string
  current_estimate_seconds: number | null
  time_worked: number | null
  billing_type: string | null
  tasks: AssignmentTask
} 