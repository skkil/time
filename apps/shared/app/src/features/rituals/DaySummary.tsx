import { MoonIcon } from 'lucide-react';

import { useBlocks } from '@/features/planner/api';
import { TaskLink } from '@/features/tasks/TaskLink';
import { useTasks } from '@/features/tasks/api';
import { useTimeEntries } from '@/features/time/api';
import {
  dateKeyOf,
  dayStart,
  formatClockTime,
  formatDuration,
  mondayOf,
  secondsWithin,
  shiftKey,
} from '@/lib/time';

import type { RitualContext } from './meta';
import { StepHeading } from './steps';

export function DaySummary({
  ctx,
  onClose,
}: {
  ctx: RitualContext;
  onClose: () => void;
}) {
  const { data: tasks = [] } = useTasks();
  const { data: entries = [] } = useTimeEntries(
    ctx.date,
    shiftKey(ctx.date, 1),
  );
  const { data: blocks = [] } = useBlocks(mondayOf(ctx.target));
  const start = dayStart(ctx.date);
  const end = dayStart(shiftKey(ctx.date, 1));
  const finished = tasks.filter(
    (task) =>
      task.completedAt !== null &&
      task.completedAt >= start &&
      task.completedAt < end,
  ).length;
  const focused = entries.reduce(
    (sum, entry) => sum + secondsWithin(entry, ctx.date, shiftKey(ctx.date, 1)),
    0,
  );
  const musts = tasks.filter(
    (task) => task.completedAt === null && task.mustOn === ctx.target,
  );
  const planned = blocks
    .filter((block) => dateKeyOf(block.startAt) === ctx.target)
    .sort((a, b) => a.startAt - b.startAt);

  return (
    <div className="grid gap-6">
      <StepHeading title="The day is closed">
        {finished === 0 && focused < 60
          ? 'Nothing logged today. Rest counts too.'
          : `${finished} finished · ${formatDuration(focused)} focused`}
      </StepHeading>
      <section aria-label="Tomorrow" className="grid gap-2 text-sm">
        <h3 className="text-xs tracking-wide text-muted-foreground">
          TOMORROW
        </h3>
        {musts.length === 0 && planned.length === 0 ? (
          <p className="text-muted-foreground">
            Nothing set yet. It will be there when you open Day.
          </p>
        ) : (
          <ul className="grid gap-1.5">
            {planned.map((block) => (
              <li key={block.id} className="flex gap-3">
                <span className="w-24 shrink-0 text-muted-foreground tabular-nums">
                  {formatClockTime(block.startAt)}–
                  {formatClockTime(block.endAt)}
                </span>
                <TaskLink taskId={block.taskId} className="truncate">
                  {block.title}
                </TaskLink>
              </li>
            ))}
            {musts
              .filter(
                (task) => !planned.some((block) => block.taskId === task.id),
              )
              .map((task) => (
                <li key={task.id} className="flex gap-3">
                  <span className="w-24 shrink-0 text-muted-foreground">
                    Must
                  </span>
                  <TaskLink taskId={task.id} className="truncate">
                    {task.title}
                  </TaskLink>
                </li>
              ))}
          </ul>
        )}
      </section>
      <button
        type="button"
        autoFocus
        onClick={onClose}
        className="flex h-9 items-center gap-2 justify-self-end rounded-full bg-white/90 px-4 text-sm font-medium text-[#0b1a22] transition-colors hover:bg-white"
      >
        <MoonIcon className="size-4" strokeWidth={1.5} />
        Good night
      </button>
    </div>
  );
}
