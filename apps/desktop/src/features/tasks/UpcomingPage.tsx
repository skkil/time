import {
  DndContext,
  type DragEndEvent,
  DragOverlay,
  PointerSensor,
  pointerWithin,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { getRouteApi, useNavigate } from '@tanstack/react-router';
import { format } from 'date-fns';
import {
  CalendarClockIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from 'lucide-react';
import { useMemo, useRef, useState } from 'react';

import type { Task } from '@/bindings';
import { Page, PageBody, PageHeader } from '@/components/page';
import { Button } from '@/components/ui/button';
import { type DateKey, fromDateKey, shiftKey, todayKey } from '@/lib/time';
import { cn } from '@/lib/utils';

import { TaskItem } from './TaskItem';
import { AddTaskRow, FlatTaskList } from './TaskList';
import { useRescheduleTasks, useTasks } from './api';
import { DuePicker } from './fields';
import { byDayOrder } from './order';

const route = getRouteApi('/upcoming');

function DraggableTask({ task }: { task: Task }) {
  const { setNodeRef, isDragging, attributes, listeners } = useDraggable({
    id: task.id,
    data: { task },
  });
  return (
    <li
      ref={setNodeRef}
      className={cn('touch-none', isDragging && 'opacity-40')}
      {...attributes}
      {...listeners}
    >
      <TaskItem task={task} showPlacement showParent />
    </li>
  );
}

function Day({
  date,
  tasks,
  today,
  dayRef,
}: {
  date: DateKey;
  tasks: Task[];
  today: DateKey;
  dayRef: (node: HTMLElement | null) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: date, data: { date } });
  const isToday = date === today;
  const past = date < today;
  return (
    <section
      ref={(node) => {
        setNodeRef(node);
        dayRef(node);
      }}
      aria-label={format(fromDateKey(date), 'EEEE d MMMM')}
      className={cn(
        'scroll-mt-4 rounded-md transition-colors',
        isOver && 'bg-now-tint',
        past && 'opacity-60',
      )}
    >
      <div className="flex h-9 items-center gap-2 border-b">
        <h2 className="font-sans text-sm font-semibold">
          {format(fromDateKey(date), 'd MMM')}
          {isToday && ' · Today'}
          {' · '}
          {format(fromDateKey(date), 'EEEE')}
        </h2>
        <span className="text-xs text-muted-foreground">
          {tasks.length || ''}
        </span>
      </div>
      <ul>
        {tasks.map((task) => (
          <DraggableTask key={task.id} task={task} />
        ))}
      </ul>
      {!past && <AddTaskRow defaults={{ dueDate: date }} />}
    </section>
  );
}

export function UpcomingPage() {
  const { from } = route.useSearch();
  const navigate = useNavigate();
  const { data: tasks } = useTasks();
  const reschedule = useRescheduleTasks();
  const [dragging, setDragging] = useState<Task | null>(null);
  const dayNodes = useRef(new Map<DateKey, HTMLElement>());
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );
  const today = todayKey();
  const days = Array.from({ length: 7 }, (_, i) => shiftKey(from, i));

  const { overdue, byDay } = useMemo(() => {
    const open = (tasks ?? []).filter(
      (task) => task.completedAt === null && task.dueDate !== null,
    );
    const byDay = new Map<DateKey, Task[]>();
    for (const task of open) {
      const list = byDay.get(task.dueDate!) ?? [];
      list.push(task);
      byDay.set(task.dueDate!, list);
    }
    for (const list of byDay.values()) list.sort(byDayOrder);
    return {
      overdue: open
        .filter((task) => task.dueDate! < today)
        .sort((a, b) => a.dueDate!.localeCompare(b.dueDate!)),
      byDay,
    };
  }, [tasks, today]);

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    setDragging(null);
    const task = active.data.current?.task as Task | undefined;
    const date = over?.data.current?.date as DateKey | undefined;
    if (task && date && task.dueDate !== date)
      reschedule.mutate({ ids: [task.id], dueDate: date });
  };

  const showOverdue = overdue.length > 0 && days.includes(today);
  const go = (next: DateKey) =>
    navigate({ to: '/upcoming', search: { from: next } });

  return (
    <Page>
      <PageHeader
        title="Upcoming"
        meta={format(fromDateKey(days[0]), 'MMMM yyyy')}
        actions={
          <div className="flex items-center gap-1">
            <Button
              size="icon-sm"
              variant="ghost"
              aria-label="Previous 7 days"
              onClick={() => go(shiftKey(from, -7))}
            >
              <ChevronLeftIcon />
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={from === today}
              onClick={() => go(today)}
            >
              Today
            </Button>
            <Button
              size="icon-sm"
              variant="ghost"
              aria-label="Next 7 days"
              onClick={() => go(shiftKey(from, 7))}
            >
              <ChevronRightIcon />
            </Button>
          </div>
        }
      >
        <div className="grid grid-cols-7 gap-1">
          {days.map((date) => {
            const count = byDay.get(date)?.length ?? 0;
            return (
              <button
                key={date}
                type="button"
                onClick={() =>
                  dayNodes.current
                    .get(date)
                    ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                }
                className={cn(
                  'flex flex-col items-center rounded-md py-1.5 text-sm hover:bg-accent',
                  date === today && 'bg-today-tint font-semibold',
                  date < today && 'text-muted-foreground',
                )}
              >
                <span className="text-xs">
                  {format(fromDateKey(date), 'EEE')}
                </span>
                <span className="font-medium">
                  {format(fromDateKey(date), 'd')}
                </span>
                <span
                  aria-label={`${count} tasks`}
                  className={cn(
                    'mt-0.5 size-1 rounded-full bg-current',
                    count === 0 && 'invisible',
                  )}
                />
              </button>
            );
          })}
        </div>
      </PageHeader>
      <PageBody>
        <div className="mx-auto grid max-w-3xl gap-8">
          {showOverdue && (
            <section aria-label="Overdue">
              <div className="flex h-9 items-center gap-2 border-b">
                <h2 className="font-sans text-sm font-semibold">Overdue</h2>
                <span className="text-xs text-muted-foreground">
                  {overdue.length}
                </span>
                <DuePicker
                  value={{ dueDate: null, dueTime: null, recurrence: null }}
                  onChange={({ dueDate }) =>
                    reschedule.mutate({
                      ids: overdue.map((task) => task.id),
                      dueDate,
                    })
                  }
                  trigger={
                    <Button
                      size="xs"
                      variant="ghost"
                      className="ml-auto text-p1"
                    >
                      <CalendarClockIcon />
                      Reschedule
                    </Button>
                  }
                />
              </div>
              <FlatTaskList tasks={overdue} />
            </section>
          )}
          <DndContext
            sensors={sensors}
            collisionDetection={pointerWithin}
            onDragStart={({ active }) =>
              setDragging((active.data.current?.task as Task) ?? null)
            }
            onDragCancel={() => setDragging(null)}
            onDragEnd={onDragEnd}
          >
            {days.map((date) => (
              <Day
                key={date}
                date={date}
                today={today}
                tasks={byDay.get(date) ?? []}
                dayRef={(node) => {
                  if (node) dayNodes.current.set(date, node);
                  else dayNodes.current.delete(date);
                }}
              />
            ))}
            <DragOverlay dropAnimation={null}>
              {dragging && (
                <div className="max-w-md truncate rounded-md border bg-card px-3 py-2 text-sm shadow-lg">
                  {dragging.title}
                </div>
              )}
            </DragOverlay>
          </DndContext>
        </div>
      </PageBody>
    </Page>
  );
}
