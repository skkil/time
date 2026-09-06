import {
  DndContext,
  type DragEndEvent,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react';
import { useState } from 'react';

import type { EventOccurrence, Id, Task } from '@/bindings';
import { PriorityCheck } from '@/features/tasks/PriorityCheck';
import { useRescheduleTasks, useSetTaskCompleted } from '@/features/tasks/api';
import { useTaskDialog } from '@/features/tasks/task-dialog-context';
import {
  type DateKey,
  dateKeyOf,
  formatClockTime,
  formatDayOfMonth,
  formatWeekRange,
  formatWeekday,
  mondayOf,
  shiftKey,
  todayKey,
  weekKeys,
} from '@/lib/time';
import { cn } from '@/lib/utils';

import { TypeIcon } from './TypeIcon';
import { useEvents, useWorkflowIndex } from './api';

export function CalendarView({
  projectId,
  tasks,
}: {
  projectId: Id;
  tasks: Task[];
}) {
  const today = todayKey();
  const [week, setWeek] = useState(mondayOf(today));
  const { data: events = [] } = useEvents(week, shiftKey(week, 7));
  const reschedule = useRescheduleTasks();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );
  const own = events.filter((event) => event.projectId === projectId);
  const drop = ({ active, over }: DragEndEvent) => {
    const task = active.data.current?.task as Task | undefined;
    const day = over?.id as DateKey | undefined;
    if (task && day && task.dueDate !== day)
      reschedule.mutate({ ids: [task.id], dueDate: day });
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col px-8 py-4">
      <div className="mb-3 flex items-center gap-2 text-sm text-foreground/60">
        <button
          type="button"
          aria-label="Previous week"
          onClick={() => setWeek(shiftKey(week, -7))}
          className="grid size-8 place-items-center rounded-full hover:bg-white/10"
        >
          <ChevronLeftIcon className="size-4" />
        </button>
        <span className="min-w-44 text-center">{formatWeekRange(week)}</span>
        <button
          type="button"
          aria-label="Next week"
          onClick={() => setWeek(shiftKey(week, 7))}
          className="grid size-8 place-items-center rounded-full hover:bg-white/10"
        >
          <ChevronRightIcon className="size-4" />
        </button>
        {week !== mondayOf(today) && (
          <button
            type="button"
            onClick={() => setWeek(mondayOf(today))}
            className="ml-1 hover:text-foreground hover:underline"
          >
            This week
          </button>
        )}
      </div>
      <DndContext sensors={sensors} onDragEnd={drop}>
        <div className="grid min-h-0 flex-1 grid-cols-7 gap-1.5">
          {weekKeys(week).map((day) => (
            <Day
              key={day}
              day={day}
              today={today}
              events={own.filter((event) => dateKeyOf(event.startAt) === day)}
              tasks={tasks.filter(
                (task) => task.dueDate === day && task.kind !== 'event',
              )}
            />
          ))}
        </div>
      </DndContext>
    </div>
  );
}

function Day({
  day,
  today,
  events,
  tasks,
}: {
  day: DateKey;
  today: DateKey;
  events: EventOccurrence[];
  tasks: Task[];
}) {
  const { setNodeRef, isOver } = useDroppable({ id: day });
  const { openTask } = useTaskDialog();
  const types = useWorkflowIndex().types;
  return (
    <section
      ref={setNodeRef}
      aria-label={`${formatWeekday(day)} ${formatDayOfMonth(day)}`}
      className={cn(
        'flex min-h-0 flex-col gap-1 overflow-y-auto rounded-2xl bg-white/[.04] p-2 ring-1 ring-white/[.06] transition-colors',
        day === today && 'bg-white/[.08]',
        isOver && 'bg-white/[.1]',
      )}
    >
      <h3 className="px-1 pb-1 text-xs text-foreground/50">
        {formatWeekday(day)}{' '}
        <span className={cn('text-sm', day === today && 'text-foreground')}>
          {formatDayOfMonth(day)}
        </span>
      </h3>
      {events.map((event) => {
        const type =
          event.typeId === null ? undefined : types.get(event.typeId);
        return (
          <button
            key={`${event.taskId}-${event.startAt}`}
            type="button"
            onClick={() => openTask(event.taskId)}
            className="rounded-lg bg-white/80 px-2 py-1.5 text-left text-xs text-[#0b1a22] hover:bg-white"
          >
            <span className="flex items-center gap-1.5 font-medium">
              {type && <TypeIcon icon={type.icon} className="size-3" />}
              <span className="truncate">{event.title}</span>
            </span>
            <span className="text-[#0b1a22]/65">
              {formatClockTime(event.startAt)}–{formatClockTime(event.endAt)}
            </span>
          </button>
        );
      })}
      {tasks.map((task) => (
        <CalendarTask key={task.id} task={task} />
      ))}
    </section>
  );
}

function CalendarTask({ task }: { task: Task }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id: `task-${task.id}`, data: { task } });
  const { openTask } = useTaskDialog();
  const complete = useSetTaskCompleted();
  const done = task.completedAt !== null;
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className={cn(
        'flex touch-none items-start gap-1.5 rounded-lg bg-white/[.08] px-1.5 py-1.5 text-xs',
        isDragging && 'z-50 opacity-80',
      )}
      style={
        transform
          ? { transform: `translate(${transform.x}px, ${transform.y}px)` }
          : undefined
      }
    >
      <PriorityCheck
        priority={task.priority}
        checked={done}
        label={done ? `Reopen ${task.title}` : `Complete ${task.title}`}
        className="size-3.5"
        onToggle={() => complete.mutate({ id: task.id, completed: !done })}
      />
      <button
        type="button"
        onClick={() => openTask(task.id)}
        className={cn(
          'min-w-0 flex-1 text-left leading-snug hover:underline',
          done && 'text-foreground/40 line-through',
        )}
      >
        {task.title}
      </button>
    </div>
  );
}
