import { CalendarIcon } from 'lucide-react';
import { type FormEvent, useState } from 'react';

import type { EntryDetails, TimeEntry } from '@/bindings';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ProjectJump } from '@/features/projects/ProjectLink';
import { ProjectPicker } from '@/features/projects/ProjectPicker';
import { useProjectIndex } from '@/features/projects/api';
import { TaskJump } from '@/features/tasks/TaskLink';
import { TaskPicker } from '@/features/tasks/TaskPicker';
import { useTask } from '@/features/tasks/api';
import {
  type DateKey,
  atMinutes,
  dateKeyOf,
  formatDayLabel,
  formatDuration,
  formatMinutesOfDay,
  fromDateKey,
  minutesIntoDay,
  nowSeconds,
  parseClockInput,
  toDateKey,
  todayKey,
} from '@/lib/time';

import { useCreateEntry, useDeleteEntry, useUpdateEntry } from './api';

type EntryDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entry?: TimeEntry;
  date?: DateKey;
};

export function EntryDialog({
  open,
  onOpenChange,
  entry,
  date,
}: EntryDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        {open && (
          <EntryForm
            entry={entry}
            date={date}
            onDone={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function defaultSpan(date: DateKey) {
  if (date !== todayKey()) return { start: 9 * 60, end: 10 * 60 };
  const end = Math.floor(minutesIntoDay(nowSeconds()) / 5) * 5;
  return { start: Math.max(0, end - 60), end };
}

function EntryForm({
  entry,
  date,
  onDone,
}: {
  entry?: TimeEntry;
  date?: DateKey;
  onDone: () => void;
}) {
  const create = useCreateEntry();
  const update = useUpdateEntry();
  const remove = useDeleteEntry();
  const initialDay = entry ? dateKeyOf(entry.startedAt) : (date ?? todayKey());
  const fallback = defaultSpan(initialDay);
  const [details, setDetails] = useState<EntryDetails>(
    entry ?? { description: '', projectId: null, taskId: null },
  );
  const projects = useProjectIndex();
  const project =
    details.projectId === null
      ? undefined
      : projects.byId.get(details.projectId);
  const task = useTask(details.taskId);
  const [day, setDay] = useState(initialDay);
  const [dayOpen, setDayOpen] = useState(false);
  const [startText, setStartText] = useState(
    formatMinutesOfDay(
      entry ? minutesIntoDay(entry.startedAt) : fallback.start,
    ),
  );
  const [endText, setEndText] = useState(
    formatMinutesOfDay(entry ? minutesIntoDay(entry.endedAt) : fallback.end),
  );

  const start = parseClockInput(startText);
  const end = parseClockInput(endText);
  const valid = start !== null && end !== null;
  const startedAt = valid ? atMinutes(day, start) : 0;
  const endedAt = valid
    ? atMinutes(day, end) + (end < start ? 24 * 3600 : 0)
    : 0;
  const length = endedAt - startedAt;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!valid) return;
    const input = { ...details, startedAt, endedAt };
    if (entry) update.mutate({ id: entry.id, input }, { onSuccess: onDone });
    else create.mutate(input, { onSuccess: onDone });
  };

  return (
    <form onSubmit={submit} className="grid gap-5">
      <DialogHeader>
        <DialogTitle>
          {entry ? 'Edit focus session' : 'Add focus session'}
        </DialogTitle>
        <DialogDescription>
          {valid
            ? `${formatDuration(length)}${end! < start! ? ', ending the next day' : ''}.`
            : 'Times use 24-hour HH:MM.'}
        </DialogDescription>
      </DialogHeader>

      <div className="grid gap-2">
        <Label htmlFor="entry-description">Description</Label>
        <Input
          id="entry-description"
          autoFocus
          value={details.description}
          maxLength={500}
          placeholder="What did you work on?"
          onChange={(event) =>
            setDetails({ ...details, description: event.target.value })
          }
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <ProjectPicker
          value={details.projectId}
          onChange={(projectId) =>
            setDetails({ ...details, projectId, taskId: null })
          }
        />
        {project && <ProjectJump projectId={project.id} name={project.name} />}
        <TaskPicker
          value={details.taskId}
          onChange={(task) =>
            setDetails(
              task
                ? {
                    description: details.description || task.title,
                    projectId: task.projectId,
                    taskId: task.id,
                  }
                : { ...details, taskId: null },
            )
          }
        />
        {task && <TaskJump taskId={task.id} name={task.title} />}
      </div>

      <div className="grid grid-cols-[1fr_auto_auto] items-end gap-3">
        <div className="grid gap-2">
          <Label>Day</Label>
          <Popover open={dayOpen} onOpenChange={setDayOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" className="justify-start font-normal">
                <CalendarIcon className="text-muted-foreground" />
                {formatDayLabel(day)}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                weekStartsOn={1}
                selected={fromDateKey(day)}
                defaultMonth={fromDateKey(day)}
                disabled={{ after: new Date() }}
                onSelect={(selected) => {
                  if (selected) setDay(toDateKey(selected));
                  setDayOpen(false);
                }}
              />
            </PopoverContent>
          </Popover>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="entry-start">Start</Label>
          <Input
            id="entry-start"
            className="w-20"
            value={startText}
            aria-invalid={start === null}
            onChange={(event) => setStartText(event.target.value)}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="entry-end">End</Label>
          <Input
            id="entry-end"
            className="w-20"
            value={endText}
            aria-invalid={end === null}
            onChange={(event) => setEndText(event.target.value)}
          />
        </div>
      </div>

      <DialogFooter>
        {entry && (
          <Button
            type="button"
            variant="ghost"
            className="mr-auto text-destructive hover:text-destructive"
            disabled={remove.isPending}
            onClick={() => remove.mutate(entry, { onSuccess: onDone })}
          >
            Delete
          </Button>
        )}
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={!valid || create.isPending || update.isPending}
        >
          {entry ? 'Save' : 'Add session'}
        </Button>
      </DialogFooter>
    </form>
  );
}
