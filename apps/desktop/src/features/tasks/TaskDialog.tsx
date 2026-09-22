import { listen } from '@tauri-apps/api/event';
import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import type { Id, TaskInput } from '@/bindings';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { useOnNavigate } from '@/hooks/use-on-navigate';

import { TaskPanel } from './TaskPanel';
import { useTask } from './api';
import { QuickAdd } from './quick-add/QuickAdd';
import { TaskDialogContext } from './task-dialog-context';

type DialogState =
  | { mode: 'closed' }
  | { mode: 'edit'; id: Id }
  | { mode: 'create'; defaults: Partial<TaskInput> };

export function TaskDialogProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<DialogState>({ mode: 'closed' });

  const openTask = useCallback((id: Id) => setState({ mode: 'edit', id }), []);
  const newTask = useCallback(
    (defaults: Partial<TaskInput> = {}) =>
      setState({ mode: 'create', defaults }),
    [],
  );
  const api = useMemo(() => ({ openTask, newTask }), [openTask, newTask]);
  const close = () => setState({ mode: 'closed' });
  useOnNavigate(close);
  useEffect(() => {
    const unlisten = listen<Id>('open-task', ({ payload }) =>
      openTask(payload),
    );
    return () => void unlisten.then((stop) => stop());
  }, [openTask]);
  const task = useTask(state.mode === 'edit' ? state.id : null);

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
          className="flex h-[min(680px,84vh)] flex-col gap-0 p-12 sm:max-w-3xl"
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
