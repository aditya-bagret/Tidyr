// Response types from API_CONTRACT §2. Request types are inferred from the schemas.
import type {
  ActivityAction,
  ActivityEntityType,
  ProjectStatus,
  TaskPriority,
  TaskStatus,
} from './enums';

export interface User {
  id: string;
  fullName: string;
  email: string;
  createdAt: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResult extends TokenPair {
  user: User;
}

export interface TaskCounts {
  total: number;
  pending: number;
  inProgress: number;
  completed: number;
}

export interface Project {
  id: string;
  key: string;
  name: string;
  description: string | null;
  status: ProjectStatus;
  startDate: string | null;
  endDate: string | null;
  taskCounts: TaskCounts;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectSummary {
  id: string;
  key: string;
  name: string;
}

export interface Task {
  id: string;
  key: string;
  number: number;
  projectId: string;
  project: ProjectSummary;
  name: string;
  description: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  dueDate: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Dashboard {
  today: string;
  totalProjects: number;
  projectsInProgress: number;
  totalTasks: number;
  completedTasks: number;
  pendingTasks: number;
  inProgressTasks: number;
  overdueTasks: number;
  projectsByStatus: Record<ProjectStatus, number>;
  tasksByPriority: Record<TaskPriority, number>;
  overdue: Task[];
  upcoming: Task[];
}

export interface FieldChange {
  from: unknown;
  to: unknown;
}

export interface ActivityEntry {
  id: string;
  entityType: ActivityEntityType;
  entityId: string;
  action: ActivityAction;
  changes: Record<string, FieldChange> | null;
  createdAt: string;
}

export interface PageMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface DataResponse<T> {
  data: T;
}

export interface ListResponse<T> {
  data: T[];
  meta: PageMeta;
}

export interface HealthStatus {
  status: 'ok';
  uptime: number;
}

/** API_CONTRACT §1.2. `NETWORK_ERROR` and `TIMEOUT` are set only by the shared API client. */
export const ERROR_CODES = [
  'VALIDATION_ERROR',
  'INVALID_JSON',
  'UNAUTHENTICATED',
  'TOKEN_EXPIRED',
  'TOKEN_INVALID',
  'SESSION_REVOKED',
  'INVALID_CREDENTIALS',
  'INVALID_REFRESH_TOKEN',
  'NOT_FOUND',
  'EMAIL_TAKEN',
  'CONFLICT',
  'PAYLOAD_TOO_LARGE',
  'RATE_LIMITED',
  'INTERNAL_ERROR',
  'NETWORK_ERROR',
  'TIMEOUT',
] as const;
export type ErrorCode = (typeof ERROR_CODES)[number];

export interface ErrorDetail {
  path: string;
  message: string;
}

export interface ErrorBody {
  error: {
    code: ErrorCode;
    message: string;
    details?: ErrorDetail[];
    requestId?: string;
  };
}
