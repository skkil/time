import { format } from 'date-fns';
import { CalendarClockIcon } from 'lucide-react';
import { useMemo } from 'react';

import {
  EmptyState,
  Page,
  PageBody,
  PageHeader,
  Stat,
} from '@/components/page';
import { Button } from '@/components/ui/button';
import { DayCheckIn } from '@/features/review/DayCheckIn';
import { fromDateKey, todayKey } from '@/lib/time';

import { AddTaskRow, FlatTaskList } from './TaskList';
import { useRescheduleTasks, useTasks } from './api';
import { DuePicker } from './fields';
import { byDayOrder } from './order';

export function TodayPage() {
  const { data: tasks, isPending } = useTasks();
  const reschedule = useRescheduleTasks();
  const today = todayKey();

  const { overdue, due } = useMemo(() => {
    const open = (tasks ?? []).filter(
      (task) => task.completedAt === null && task.dueDate !== null,
    );
    return {
      overdue: open
        .filter((task) => task.dueDate! < today)
        .sort(
          (a, b) => a.dueDate!.localeCompare(b.dueDate!) || byDayOrder(a, b),
        ),
      due: open.filter((task) => task.dueDate === today).sort(byDayOrder),
    };
  }, [tasks, today]);

  return (
    <Page>
      <PageHeader
        title="Today"
        meta={[
          format(fromDateKey(today), 'EEEE d MMMM'),
          <Stat value={String(overdue.length + due.length)} label="tasks" />,
        ]}
      />
      <PageBody>
        <div className="mx-auto grid max-w-3xl gap-8">
          {overdue.length > 0 && (
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

          <section aria-label="Today">
            <div className="flex h-9 items-center gap-2 border-b">
              <h2 className="font-sans text-sm font-semibold">
                {format(fromDateKey(today), 'd MMM')} · Today ·{' '}
                {format(fromDateKey(today), 'EEEE')}
              </h2>
              <span className="text-xs text-muted-foreground">
                {due.length}
              </span>
            </div>
            <FlatTaskList tasks={due} />
            <AddTaskRow defaults={{ dueDate: today }} />
          </section>

          {overdue.length + due.length === 0 && !isPending && (
            <EmptyState title="Nothing due today.">
              Enjoy it, or pull something forward from Upcoming.
            </EmptyState>
          )}

          <DayCheckIn />
        </div>
      </PageBody>
    </Page>
  );
}
