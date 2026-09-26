import type { DueTone } from '@skkil-time/domain/due';

export {
  PRIORITIES,
  type DueTone,
  dueTone,
  formatDate,
  formatDue,
  isOpen,
  isOverdue,
} from '@skkil-time/domain/due';

export const priorityColor = (priority: number) =>
  priority === 1
    ? 'var(--p1)'
    : priority === 2
      ? 'var(--p2)'
      : priority === 3
        ? 'var(--p3)'
        : undefined;

export const priorityTint = (priority: number) =>
  `var(--p${Math.min(Math.max(priority, 1), 4)})`;

export const dueToneClass: Record<DueTone, string> = {
  overdue: 'text-p1',
  today: 'text-due-today',
  soon: 'text-p2',
  later: 'text-muted-foreground',
};
