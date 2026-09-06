import { type ReactNode, useCallback, useMemo, useState } from 'react';

import type { Id, TaskInput } from '@/bindings';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from '@/components/ui/sheet';

import { QuickAdd } from './QuickAdd';
import { TaskPanel } from './TaskPanel';
import { useTaskIndex } from './api';
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
      <Sheet
        open={task !== undefined}
        onOpenChange={(next) => !next && close()}
      >
        <SheetContent
          side="right"
          className="w-[min(640px,92vw)] border-l-0 bg-[rgba(10,18,32,.94)] p-12 pt-16 shadow-[-30px_0_80px_rgba(0,0,0,.25)] ring-1 ring-white/10 backdrop-blur-2xl"
        >
          <SheetTitle className="sr-only">{task?.title ?? 'Task'}</SheetTitle>
          <SheetDescription className="sr-only">
            Edit the task in place.
          </SheetDescription>
          {task && <TaskPanel key={task.id} task={task} />}
        </SheetContent>
      </Sheet>
    </TaskDialogContext>
  );
}
