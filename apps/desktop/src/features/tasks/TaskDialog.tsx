import { type ReactNode, useCallback, useMemo, useState } from 'react';

import type { Id, TaskInput } from '@/bindings';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';

import { TaskPanel } from './TaskPanel';
import { useTaskIndex } from './api';
import { QuickAdd } from './quick-add/QuickAdd';
import { TaskDialogContext } from './task-dialog-context';

type DialogState =
  | { mode: 'closed' }
  | { mode: 'edit'; id: Id }
  | { mode: 'create'; defaults: Partial<TaskInput> };

export function TaskDialogProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<DialogState>({ mode: 'closed' });
  const tasks = useTaskIndex();

  const openTask = useCallback((id: Id) => setState({ mode: 'edit', id }), []);
  const newTask = useCallback(
    (defaults: Partial<TaskInput> = {}) =>
      setState({ mode: 'create', defaults }),
    [],
  );
  const api = useMemo(() => ({ openTask, newTask }), [openTask, newTask]);
  const close = () => setState({ mode: 'closed' });
  const task = state.mode === 'edit' ? tasks.byId.get(state.id) : undefined;

  return (
    <TaskDialogContext value={api}>
      {children}
      <Dialog
        open={state.mode === 'create'}
        onOpenChange={(next) => !next && close()}
      >
        <DialogContent
          showCloseButton={false}
          className="top-[22%] translate-y-0 gap-0 border-0 bg-transparent p-0 shadow-none ring-0 sm:max-w-2xl"
        >
          <DialogTitle className="sr-only">Add a task</DialogTitle>
          <DialogDescription className="sr-only">
            Type a task. Dates, #project and durations are recognised as you
            type.
          </DialogDescription>
          {state.mode === 'create' && (
            <QuickAdd defaults={state.defaults} onClose={close} />
          )}
        </DialogContent>
      </Dialog>
      <Dialog
        open={task !== undefined}
        onOpenChange={(next) => !next && close()}
      >
        <DialogContent
          showCloseButton={false}
          className="flex h-[min(680px,84vh)] flex-col gap-0 rounded-[32px] border-0 bg-[rgba(10,18,32,.92)] p-12 shadow-[0_40px_120px_rgba(0,0,0,.4)] ring-1 ring-white/10 backdrop-blur-2xl sm:max-w-3xl"
        >
          <DialogTitle className="sr-only">{task?.title ?? 'Task'}</DialogTitle>
          <DialogDescription className="sr-only">
            Edit the task in place.
          </DialogDescription>
          {task && <TaskPanel key={task.id} task={task} />}
        </DialogContent>
      </Dialog>
    </TaskDialogContext>
  );
}
