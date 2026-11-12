import { CheckIcon } from 'lucide-react';
import { useState } from 'react';

import type { Task } from '@/backend';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Dot, Phrase } from '@/features/tasks/Phrase';
import { formatDay, formatMinutesOfDay, fromDateKey } from '@/lib/time';

import { TypeIcon } from './TypeIcon';
import {
  CATEGORIES,
  useProjectWorkflow,
  useSetTaskEvent,
  useSetTaskMilestone,
  useSetTaskStatus,
  useSetTaskType,
} from './api';

export function WorkflowLine({ task }: { task: Task }) {
  const workflow = useProjectWorkflow(task.projectId);
  const setType = useSetTaskType();
  const setStatus = useSetTaskStatus();
  const setMilestone = useSetTaskMilestone();
  if (!workflow.structured) return null;
  const type = workflow.types.find((t) => t.id === task.typeId);
  const status = workflow.statuses.find((s) => s.id === task.statusId);
  const milestone = workflow.milestones.find((m) => m.id === task.milestoneId);
  const parts = [];

  if (workflow.types.length > 0)
    parts.push(
      <DropdownMenu key="type">
        <DropdownMenuTrigger asChild>
          <Phrase
            set={type !== undefined}
            className="flex items-center gap-1.5"
          >
            {type && <TypeIcon icon={type.icon} />}
            {type?.name ?? 'type'}
          </Phrase>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          {workflow.types.map((item) => {
            const needsTime = item.kind === 'event' && task.dueTime === null;
            return (
              <DropdownMenuItem
                key={item.id}
                disabled={needsTime}
                onSelect={() =>
                  setType.mutate({ id: task.id, typeId: item.id })
                }
              >
                <TypeIcon icon={item.icon} />
                <span className="flex-1">{item.name}</span>
                {needsTime ? (
                  <span className="text-xs text-foreground/75">
                    needs a time
                  </span>
                ) : (
                  item.id === task.typeId && <CheckIcon />
                )}
              </DropdownMenuItem>
            );
          })}
          {task.typeId !== null && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={() => setType.mutate({ id: task.id, typeId: null })}
              >
                No type
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>,
    );

  if (workflow.statuses.length > 0 && task.kind !== 'event')
    parts.push(
      <DropdownMenu key="status">
        <DropdownMenuTrigger asChild>
          <Phrase set={status !== undefined}>{status?.name ?? 'status'}</Phrase>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          {CATEGORIES.map((category) => {
            const items = workflow.statuses.filter(
              (s) => s.category === category.value,
            );
            if (items.length === 0) return null;
            return (
              <div key={category.value}>
                <DropdownMenuLabel className="text-xs text-foreground/75">
                  {category.label}
                </DropdownMenuLabel>
                {items.map((item) => (
                  <DropdownMenuItem
                    key={item.id}
                    onSelect={() =>
                      setStatus.mutate({ id: task.id, statusId: item.id })
                    }
                  >
                    <span className="flex-1">{item.name}</span>
                    {item.id === task.statusId && <CheckIcon />}
                  </DropdownMenuItem>
                ))}
              </div>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>,
    );

  if (workflow.milestoneLabel)
    parts.push(
      <DropdownMenu key="milestone">
        <DropdownMenuTrigger asChild>
          <Phrase set={milestone !== undefined}>
            {milestone?.name ?? workflow.milestoneLabel.toLowerCase()}
          </Phrase>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          {workflow.milestones.length === 0 && (
            <p className="px-2 py-1.5 text-sm text-foreground/75">
              Add {workflow.milestoneLabel.toLowerCase()} in project settings.
            </p>
          )}
          {workflow.milestones.map((item) => (
            <DropdownMenuItem
              key={item.id}
              onSelect={() =>
                setMilestone.mutate({ id: task.id, milestoneId: item.id })
              }
            >
              <span className="flex-1">{item.name}</span>
              {item.date && (
                <span className="text-xs text-foreground/75">
                  {formatDay(fromDateKey(item.date), 'dayMonth')}
                </span>
              )}
              {item.id === task.milestoneId && <CheckIcon />}
            </DropdownMenuItem>
          ))}
          {task.milestoneId !== null && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={() =>
                  setMilestone.mutate({ id: task.id, milestoneId: null })
                }
              >
                None
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>,
    );

  if (parts.length === 0) return null;
  return (
    <p className="mt-1.5 flex flex-wrap items-baseline gap-x-2 text-[15px]">
      {parts.map((part, i) => (
        <span key={i} className="flex items-baseline gap-2">
          {i > 0 && <Dot />}
          {part}
        </span>
      ))}
    </p>
  );
}

export function EventLine({ task }: { task: Task }) {
  const setEvent = useSetTaskEvent();
  const [location, setLocation] = useState(task.location);
  if (task.kind !== 'event' || task.dueDate === null || task.dueTime === null)
    return null;
  const end = task.dueTime + (task.estimateMinutes ?? 60);
  const save = (patch: { location?: string; countsAsTime?: boolean }) =>
    setEvent.mutate({
      id: task.id,
      location: patch.location ?? task.location,
      countsAsTime: patch.countsAsTime ?? task.countsAsTime,
    });
  return (
    <p className="mt-1.5 flex flex-wrap items-baseline gap-x-2 text-[15px] text-foreground/80">
      <span className="rounded-sm bg-white/10 px-1.5 text-xs tracking-wide text-foreground/70">
        Event
      </span>
      <span>
        {formatDay(fromDateKey(task.dueDate), 'weekdayDayMonth')},{' '}
        {formatMinutesOfDay(task.dueTime)}–{formatMinutesOfDay(end)}
      </span>
      <Dot />
      <input
        value={location}
        maxLength={300}
        aria-label="Place or link"
        placeholder="place or link"
        className="w-40 bg-transparent outline-none placeholder:text-foreground/35"
        onChange={(event) => setLocation(event.target.value)}
        onBlur={() => location !== task.location && save({ location })}
      />
      <Dot />
      <Phrase
        set={task.countsAsTime}
        aria-pressed={task.countsAsTime}
        onClick={() => save({ countsAsTime: !task.countsAsTime })}
      >
        {task.countsAsTime ? 'counts as time spent' : 'doesn’t count as time'}
      </Phrase>
    </p>
  );
}
