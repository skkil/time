import { createContext, use } from 'react';

import type { Id, TaskInput } from '@/backend';

export type TaskDialogApi = {
  openTask: (id: Id) => void;
  newTask: (defaults?: Partial<TaskInput>) => void;
};

export const TaskDialogContext = createContext<TaskDialogApi | null>(null);

export function useTaskDialog() {
  const api = use(TaskDialogContext);
  if (!api) throw new Error('useTaskDialog needs TaskDialogProvider');
  return api;
}
