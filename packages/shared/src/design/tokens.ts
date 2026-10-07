// DESIGN §2. Plain values only, so web (Tailwind/CSS) and mobile (StyleSheet) can both map them.
import type { ProjectStatus, TaskPriority, TaskStatus } from '../enums';

export const colors = {
  brand: { 50: '#EEF2FF', 600: '#4F46E5', 700: '#4338CA' },
  neutral: {
    0: '#FFFFFF',
    50: '#F8FAFC',
    100: '#F1F5F9',
    200: '#E2E8F0',
    400: '#94A3B8',
    600: '#475569',
    900: '#0F172A',
  },
  danger: { 50: '#FEF2F2', 600: '#DC2626' },
  warning: { 50: '#FFFBEB', 600: '#D97706' },
  success: { 50: '#F0FDF4', 600: '#16A34A' },
  info: { 50: '#EFF6FF', 600: '#2563EB' },
} as const;

/** 4 px grid: `spacing[4]` = 16. */
export const spacing = {
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  10: 40,
  12: 48,
} as const;

export const radius = { sm: 4, md: 8, lg: 12, full: 9999 } as const;

/** Font size / line height in px. */
export const fontSize = {
  xs: { size: 12, lineHeight: 16 },
  sm: { size: 14, lineHeight: 20 },
  base: { size: 16, lineHeight: 24 },
  lg: { size: 18, lineHeight: 28 },
  xl: { size: 20, lineHeight: 28 },
  '2xl': { size: 24, lineHeight: 32 },
  '3xl': { size: 30, lineHeight: 36 },
} as const;

export const fontWeight = { body: 400, label: 500, heading: 600, stat: 700 } as const;

/** Shadow colour is neutral.900 (rgb 15 23 42) at the given opacity. */
export const shadows = {
  card: { offsetX: 0, offsetY: 1, blur: 2, color: '#0F172A', opacity: 0.06 },
  overlay: { offsetX: 0, offsetY: 8, blur: 24, color: '#0F172A', opacity: 0.12 },
} as const;

export const breakpoints = { sm: 640, md: 768, lg: 1024, xl: 1280 } as const;

export const layout = {
  contentMaxWidth: 1200,
  minSupportedWidth: 360,
  minTouchTarget: 44,
} as const;

export interface LozengeStyle {
  background: string;
  text: string;
}

export const PROJECT_STATUS_STYLE: Record<ProjectStatus, LozengeStyle> = {
  NOT_STARTED: { background: colors.neutral[100], text: colors.neutral[600] },
  IN_PROGRESS: { background: colors.info[50], text: colors.info[600] },
  COMPLETED: { background: colors.success[50], text: colors.success[600] },
};

export const TASK_STATUS_STYLE: Record<TaskStatus, LozengeStyle> = {
  PENDING: { background: colors.neutral[100], text: colors.neutral[600] },
  IN_PROGRESS: { background: colors.info[50], text: colors.info[600] },
  COMPLETED: { background: colors.success[50], text: colors.success[600] },
};

export interface PriorityStyle {
  color: string;
  /** Lucide icon name; `lucide-react` and `lucide-react-native` export the same names. */
  icon: 'ChevronsUp' | 'Equal' | 'ChevronsDown';
}

export const TASK_PRIORITY_STYLE: Record<TaskPriority, PriorityStyle> = {
  HIGH: { color: colors.danger[600], icon: 'ChevronsUp' },
  MEDIUM: { color: colors.warning[600], icon: 'Equal' },
  LOW: { color: colors.info[600], icon: 'ChevronsDown' },
};
