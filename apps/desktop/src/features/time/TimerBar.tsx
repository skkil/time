import { ListTodoIcon, PlayIcon, SquareIcon, XIcon } from 'lucide-react';
import { type FormEvent, useState } from 'react';

import type { EntryDetails, RunningTimer, Task } from '@/bindings';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { ProjectPicker } from '@/features/projects/ProjectPicker';
import { TaskPicker } from '@/features/tasks/TaskPicker';
import { useTasks } from '@/features/tasks/api';
import { useNow } from '@/hooks/use-now';
import { formatStopwatch } from '@/lib/time';
import { cn } from '@/lib/utils';

import {
  useDiscardTimer,
  useEditTimer,
  useStartTimer,
  useStopTimer,
  useTimer,
} from './api';

const BLANK: EntryDetails = { description: '', projectId: null, taskId: null };

export function TimerBar() {
  const { data: timer } = useTimer();
  return <TimerForm key={timer?.startedAt ?? 'idle'} timer={timer ?? null} />;
}

function TimerForm({ timer }: { timer: RunningTimer | null }) {
  const [details, setDetails] = useState<EntryDetails>(timer ?? BLANK);
  const start = useStartTimer();
  const edit = useEditTimer();
  const stop = useStopTimer();
  const discard = useDiscardTimer();
  const now = useNow(1000, timer !== null);
  const { data: tasks } = useTasks();
  const running = timer !== null;
  const linked =
    details.taskId === null
      ? undefined
      : tasks?.find((task) => task.id === details.taskId);

  const change = (next: EntryDetails) => {
    setDetails(next);
    if (running) edit.mutate(next);
  };

  const linkTask = (task: Task | null) =>
    change(
      task
        ? {
            description: details.description || task.title,
            projectId: task.projectId,
            taskId: task.id,
          }
        : { ...details, taskId: null },
    );

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (running) stop.mutate(details);
    else start.mutate(details);
  };

  return (
    <form
      onSubmit={submit}
      className={cn(
        'flex items-center gap-2 rounded-md border bg-card py-1.5 pr-1.5 pl-4 transition-colors',
        running && 'border-now/40 bg-now-tint',
      )}
    >
      <input
        value={details.description}
        maxLength={500}
        placeholder="What are you working on?"
        aria-label="Description"
        onChange={(event) =>
          setDetails({ ...details, description: event.target.value })
        }
        onBlur={(event) => {
          const leavingForm = !event.currentTarget.form?.contains(
            event.relatedTarget,
          );
          if (
            running &&
            leavingForm &&
            details.description !== timer.description
          )
            edit.mutate(details);
        }}
        className="h-9 min-w-0 flex-1 bg-transparent outline-none placeholder:text-muted-foreground"
      />
      <TaskPicker
        value={details.taskId}
        onChange={linkTask}
        trigger={
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-label="Link a task"
            className={cn(
              'max-w-48 font-normal',
              !linked && 'text-muted-foreground',
            )}
          >
            <ListTodoIcon />
            <span className="truncate">{linked ? linked.title : 'Task'}</span>
          </Button>
        }
      />
      <ProjectPicker
        value={details.projectId}
        onChange={(projectId) =>
          change({ ...details, projectId, taskId: null })
        }
        className="border-transparent bg-transparent shadow-none"
      />
      <span
        className={cn(
          'w-[5.5rem] text-right text-[17px] font-medium',
          running ? 'text-now' : 'text-muted-foreground',
        )}
        aria-live="off"
      >
        {formatStopwatch(running ? now - timer.startedAt : 0)}
      </span>
      {running ? (
        <>
          <Button type="submit" className="min-w-20" disabled={stop.isPending}>
            <SquareIcon className="fill-current" />
            Stop
          </Button>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                aria-label="Discard timer"
                onClick={() => discard.mutate()}
              >
                <XIcon />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Discard without logging</TooltipContent>
          </Tooltip>
        </>
      ) : (
        <Button type="submit" className="min-w-20" disabled={start.isPending}>
          <PlayIcon />
          Start
        </Button>
      )}
    </form>
  );
}
