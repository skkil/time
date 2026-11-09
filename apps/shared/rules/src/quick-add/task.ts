import type { Parsed } from '#quick-add/types';
import type { TaskInput } from '@skkil-time/client/types';

/** Applies what Quick Add understood on top of the task the user started from. */
export const taskFromParsed = (
  initial: TaskInput,
  parsed: Parsed,
): TaskInput => ({
  ...initial,
  title: parsed.title,
  dueDate: parsed.dueDate ?? initial.dueDate,
  dueTime: parsed.dueTime ?? (parsed.dueDate ? null : initial.dueTime),
  recurrence: parsed.recurrence ?? (parsed.dueDate ? null : initial.recurrence),
  deadline: parsed.deadline ?? initial.deadline,
  priority: parsed.priority ?? initial.priority,
  estimateMinutes: parsed.estimate ?? initial.estimateMinutes,
  projectId:
    parsed.projectId !== undefined ? parsed.projectId : initial.projectId,
  sectionId:
    parsed.sectionId !== undefined
      ? parsed.sectionId
      : parsed.projectId !== undefined
        ? null
        : initial.sectionId,
});

export const EMPTY_TASK: TaskInput = {
  title: '',
  notes: '',
  projectId: null,
  sectionId: null,
  parentId: null,
  priority: 4,
  dueDate: null,
  dueTime: null,
  deadline: null,
  recurrence: null,
  estimateMinutes: null,
};
