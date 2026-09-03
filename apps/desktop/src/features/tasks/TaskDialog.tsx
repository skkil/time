import {
  ChevronRightIcon,
  PlayIcon,
  SquareIcon,
  Trash2Icon,
  XIcon,
} from 'lucide-react';
import { type ReactNode, useCallback, useMemo, useState } from 'react';

import type { Id, Task, TaskInput } from '@/bindings';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { useProjectIndex } from '@/features/projects/api';
import { OutcomePicker } from '@/features/review/OutcomePicker';
import { useStartTimer, useStopTimer, useTimer } from '@/features/time/api';
import { formatDuration } from '@/lib/time';

import { PriorityCheck } from './PriorityCheck';
import { TaskEditor } from './TaskEditor';
import { AddTaskRow, TaskList } from './TaskList';
import {
  taskToInput,
  useDeleteTask,
  useMoveTask,
  useSections,
  useSetTaskCompleted,
  useSetTaskOutcome,
  useTaskIndex,
  useUpdateTask,
} from './api';
import { containerOf } from './container';
import { TaskDnd } from './dnd';
import {
  DeadlinePicker,
  DuePicker,
  EstimatePicker,
  LabelPicker,
  PlacementPicker,
  PriorityPicker,
} from './fields';
import { TaskDialogContext, useTaskDialog } from './task-dialog-context';

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
          className="top-[18%] translate-y-0 gap-0 border-0 bg-transparent p-0 shadow-none sm:max-w-xl"
        >
          <DialogTitle className="sr-only">Quick add</DialogTitle>
          <DialogDescription className="sr-only">
            Type a task. Dates, p1–p4, #project, /section, @label and “every …”
            are recognised as you type.
          </DialogDescription>
          {state.mode === 'create' && (
            <TaskEditor
              defaults={state.defaults}
              onClose={close}
              className="shadow-lg"
            />
          )}
        </DialogContent>
      </Dialog>
      <Dialog
        open={task !== undefined}
        onOpenChange={(next) => !next && close()}
      >
        <DialogContent
          showCloseButton={false}
          className="h-[min(720px,85vh)] gap-0 overflow-hidden p-0 sm:max-w-4xl"
        >
          {task && <TaskDetail key={task.id} task={task} onClose={close} />}
        </DialogContent>
      </Dialog>
    </TaskDialogContext>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-1.5 border-b py-3 last:border-b-0">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <div className="flex flex-wrap">{children}</div>
    </div>
  );
}

function TaskDetail({ task, onClose }: { task: Task; onClose: () => void }) {
  const update = useUpdateTask();
  const setOutcome = useSetTaskOutcome();
  const move = useMoveTask();
  const complete = useSetTaskCompleted();
  const remove = useDeleteTask();
  const start = useStartTimer();
  const stop = useStopTimer();
  const { data: timer } = useTimer();
  const tasks = useTaskIndex();
  const index = useProjectIndex();
  const { data: sections } = useSections();
  const { openTask } = useTaskDialog();
  const [title, setTitle] = useState(task.title);
  const [notes, setNotes] = useState(task.notes);
  const [showDone, setShowDone] = useState(false);
  const done = task.completedAt !== null;
  const running = timer?.taskId === task.id;
  const children = tasks.children.get(task.id) ?? [];
  const openChildren = children.filter((child) => child.completedAt === null);
  const doneChildren = children.filter((child) => child.completedAt !== null);
  const parent =
    task.parentId === null ? undefined : tasks.byId.get(task.parentId);
  const project =
    task.projectId === null ? undefined : index.byId.get(task.projectId);
  const section = sections?.find((s) => s.id === task.sectionId);

  const save = (patch: Partial<TaskInput>) =>
    update.mutate({ id: task.id, input: { ...taskToInput(task), ...patch } });

  return (
    <div className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)]">
      <header className="flex items-center gap-2 border-b px-4 py-2.5 text-sm text-muted-foreground">
        <span className="truncate">{project?.name ?? 'Inbox'}</span>
        {section && (
          <>
            <ChevronRightIcon className="size-3.5" />
            <span className="truncate">{section.name}</span>
          </>
        )}
        {parent && (
          <>
            <ChevronRightIcon className="size-3.5" />
            <button
              type="button"
              className="truncate hover:text-foreground hover:underline"
              onClick={() => openTask(parent.id)}
            >
              {parent.title}
            </button>
          </>
        )}
        <Button
          size="icon-sm"
          variant="ghost"
          aria-label="Close"
          className="ml-auto"
          onClick={onClose}
        >
          <XIcon />
        </Button>
      </header>

      <div className="grid min-h-0 grid-cols-[minmax(0,1fr)_260px]">
        <div className="min-h-0 overflow-y-auto px-6 py-5">
          <div className="flex items-start gap-3">
            <PriorityCheck
              priority={task.priority}
              checked={done}
              label={done ? 'Reopen task' : 'Complete task'}
              className="mt-1.5"
              onToggle={() =>
                complete.mutate({ id: task.id, completed: !done })
              }
            />
            <div className="grid min-w-0 flex-1 gap-1">
              <DialogTitle asChild>
                <input
                  value={title}
                  aria-label="Task name"
                  maxLength={500}
                  className="w-full bg-transparent font-heading text-xl font-semibold outline-none"
                  onChange={(event) => setTitle(event.target.value)}
                  onBlur={() =>
                    title.trim() && title !== task.title
                      ? save({ title })
                      : setTitle(task.title)
                  }
                  onKeyDown={(event) =>
                    event.key === 'Enter' && event.currentTarget.blur()
                  }
                />
              </DialogTitle>
              <DialogDescription asChild>
                <textarea
                  value={notes}
                  placeholder="Description"
                  aria-label="Description"
                  className="field-sizing-content min-h-12 resize-none bg-transparent text-sm leading-6 text-foreground/85 outline-none placeholder:text-muted-foreground"
                  onChange={(event) => setNotes(event.target.value)}
                  onBlur={() => notes !== task.notes && save({ notes })}
                />
              </DialogDescription>
            </div>
          </div>

          <section aria-label="Sub-tasks" className="mt-6 ml-7">
            <h3 className="mb-1 flex items-center gap-2 font-sans text-sm font-semibold">
              Sub-tasks
              {children.length > 0 && (
                <span className="text-xs font-normal text-muted-foreground">
                  {doneChildren.length}/{children.length}
                </span>
              )}
            </h3>
            <TaskDnd>
              <TaskList
                tasks={openChildren}
                container={{ ...containerOf(task), parentId: task.id }}
              />
            </TaskDnd>
            {!done && (
              <AddTaskRow
                label="Add sub-task"
                defaults={{ ...containerOf(task), parentId: task.id }}
              />
            )}
            {doneChildren.length > 0 && (
              <>
                <Button
                  variant="ghost"
                  size="xs"
                  className="-ml-2 text-muted-foreground"
                  onClick={() => setShowDone((value) => !value)}
                >
                  {showDone ? 'Hide' : 'Show'} completed ({doneChildren.length})
                </Button>
                {showDone && (
                  <ul className="text-sm text-muted-foreground">
                    {doneChildren.map((child) => (
                      <li
                        key={child.id}
                        className="flex items-center gap-2.5 border-b py-2"
                      >
                        <PriorityCheck
                          priority={child.priority}
                          checked
                          label={`Reopen ${child.title}`}
                          onToggle={() =>
                            complete.mutate({ id: child.id, completed: false })
                          }
                        />
                        <span className="line-through">{child.title}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </section>
        </div>

        <aside className="min-h-0 overflow-y-auto border-l bg-muted/40 px-4 py-2">
          <Field label="Project">
            <div className="-ml-2.5">
              <PlacementPicker
                value={{ projectId: task.projectId, sectionId: task.sectionId }}
                onChange={(placement) =>
                  move.mutate({
                    id: task.id,
                    placement: { ...placement, parentId: null, before: null },
                  })
                }
              />
            </div>
          </Field>
          <Field label="Date">
            <DuePicker value={task} onChange={(due) => save(due)} />
          </Field>
          <Field label="Deadline">
            <DeadlinePicker
              value={task.deadline}
              onChange={(deadline) => save({ deadline })}
            />
          </Field>
          <Field label="Priority">
            <PriorityPicker
              value={task.priority}
              onChange={(priority) => save({ priority })}
            />
          </Field>
          <Field label="Labels">
            <LabelPicker
              value={task.labelIds}
              onChange={(labelIds) => save({ labelIds })}
            />
          </Field>
          <Field label="Outcome">
            <OutcomePicker
              value={task.outcomeId}
              onChange={(outcomeId) =>
                setOutcome.mutate({ id: task.id, outcomeId })
              }
            />
          </Field>
          <Field label="Duration">
            <EstimatePicker
              value={task.estimateMinutes}
              onChange={(estimateMinutes) => save({ estimateMinutes })}
            />
          </Field>
          <Field label="Tracked">
            <div className="flex w-full items-center justify-between gap-2">
              <span className="text-sm">
                {formatDuration(task.trackedSeconds)}
              </span>
              {running ? (
                <Button
                  size="xs"
                  variant="outline"
                  onClick={() => stop.mutate(undefined)}
                >
                  <SquareIcon className="fill-current" />
                  Stop
                </Button>
              ) : (
                <Button
                  size="xs"
                  variant="outline"
                  disabled={done}
                  onClick={() =>
                    start.mutate({
                      description: task.title,
                      projectId: task.projectId,
                      taskId: task.id,
                    })
                  }
                >
                  <PlayIcon />
                  Start timer
                </Button>
              )}
            </div>
          </Field>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="mt-3 -ml-2 text-muted-foreground"
              >
                <Trash2Icon />
                Delete task
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete “{task.title}”?</AlertDialogTitle>
                <AlertDialogDescription>
                  Its sub-tasks and planned blocks go too. Tracked time stays in
                  your log, unlinked.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Keep</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => remove.mutate(task.id, { onSuccess: onClose })}
                >
                  Delete task
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </aside>
      </div>
    </div>
  );
}
