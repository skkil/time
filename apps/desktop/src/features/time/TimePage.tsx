import { getRouteApi, useNavigate } from '@tanstack/react-router';
import {
  ListTodoIcon,
  MoreHorizontalIcon,
  PencilIcon,
  PlayIcon,
  PlusIcon,
  Trash2Icon,
} from 'lucide-react';
import { useMemo, useState } from 'react';

import type { TimeEntry } from '@/bindings';
import {
  EmptyState,
  Page,
  PageBody,
  PageHeader,
  SectionTitle,
  Stat,
  WeekSwitcher,
} from '@/components/page';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { ProjectDot } from '@/features/projects/ProjectDot';
import { ProjectTimeBreakdown } from '@/features/projects/ProjectTimeBreakdown';
import { useProjectIndex } from '@/features/projects/api';
import { projectPath } from '@/features/projects/tree';
import { useNow } from '@/hooks/use-now';
import {
  type DateKey,
  dateKeyOf,
  formatClockTime,
  formatDayLabel,
  formatDuration,
  formatWeekRange,
  isoWeekNumber,
  shiftKey,
  todayKey,
} from '@/lib/time';

import { EntryDialog } from './EntryDialog';
import { TimerBar } from './TimerBar';
import { useDeleteEntry, useStartTimer, useTimeEntries, useTimer } from './api';

const route = getRouteApi('/time');

type EditorState = { entry?: TimeEntry; date?: DateKey } | null;

export function TimePage() {
  const { week } = route.useSearch();
  const navigate = useNavigate();
  const end = shiftKey(week, 7);
  const { data: entries, isPending } = useTimeEntries(week, end);
  const { data: timer } = useTimer();
  const now = useNow(30_000, Boolean(timer));
  const [editor, setEditor] = useState<EditorState>(null);

  const days = useMemo(() => {
    const grouped = new Map<DateKey, TimeEntry[]>();
    for (const entry of entries ?? []) {
      const key = dateKeyOf(entry.startedAt);
      grouped.set(key, [...(grouped.get(key) ?? []), entry]);
    }
    return [...grouped.entries()].sort(([a], [b]) => b.localeCompare(a));
  }, [entries]);

  const spans = useMemo(() => {
    const logged = (entries ?? []).map((e) => ({
      projectId: e.projectId,
      seconds: e.endedAt - e.startedAt,
    }));
    const runningHere =
      timer &&
      dateKeyOf(timer.startedAt) >= week &&
      dateKeyOf(timer.startedAt) < end;
    return runningHere
      ? [
          ...logged,
          { projectId: timer.projectId, seconds: now - timer.startedAt },
        ]
      : logged;
  }, [entries, timer, now, week, end]);

  const total = spans.reduce((sum, span) => sum + span.seconds, 0);

  return (
    <Page>
      <PageHeader
        title="Time"
        meta={[
          `Week ${isoWeekNumber(week)}`,
          formatWeekRange(week),
          <Stat value={formatDuration(total)} label="tracked" />,
        ]}
        actions={
          <>
            <WeekSwitcher
              week={week}
              onChange={(next) =>
                navigate({ to: '/time', search: { week: next } })
              }
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => setEditor({ date: todayKey() })}
            >
              <PlusIcon />
              Add entry
            </Button>
          </>
        }
      >
        <TimerBar />
      </PageHeader>

      <PageBody>
        <div className="mx-auto grid max-w-6xl grid-cols-[minmax(0,1fr)_300px] gap-10">
          <div className="grid content-start gap-8">
            {days.length === 0 && !isPending && (
              <EmptyState
                title="Nothing logged this week."
                action={
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setEditor({ date: todayKey() })}
                  >
                    Add an entry by hand
                  </Button>
                }
              >
                Start the timer above, or press play on any task. Stopping the
                timer adds the entry here.
              </EmptyState>
            )}
            {days.map(([day, dayEntries]) => (
              <section key={day} aria-label={formatDayLabel(day)}>
                <div className="flex items-baseline justify-between border-b pb-2">
                  <h2 className="font-sans text-sm font-semibold">
                    {formatDayLabel(day)}
                  </h2>
                  <span className="text-sm">
                    {formatDuration(
                      dayEntries.reduce(
                        (sum, e) => sum + e.endedAt - e.startedAt,
                        0,
                      ),
                    )}
                  </span>
                </div>
                <ul>
                  {dayEntries.map((entry) => (
                    <EntryRow
                      key={entry.id}
                      entry={entry}
                      onEdit={() => setEditor({ entry })}
                    />
                  ))}
                </ul>
              </section>
            ))}
          </div>

          <aside className="sticky top-0 self-start rounded-md border bg-card p-5">
            <SectionTitle aside={<span>{formatDuration(total)}</span>}>
              By project
            </SectionTitle>
            <ProjectTimeBreakdown
              spans={spans}
              emptyText="Tracked time shows up here, rolled up by project."
            />
          </aside>
        </div>
      </PageBody>

      <EntryDialog
        open={editor !== null}
        onOpenChange={(open) => !open && setEditor(null)}
        entry={editor?.entry}
        date={editor?.date}
      />
    </Page>
  );
}

function EntryRow({ entry, onEdit }: { entry: TimeEntry; onEdit: () => void }) {
  const index = useProjectIndex();
  const start = useStartTimer();
  const remove = useDeleteEntry();
  const project =
    entry.projectId === null ? undefined : index.byId.get(entry.projectId);

  return (
    <li className="group/entry flex h-12 items-center gap-4 border-b last:border-b-0">
      <button
        type="button"
        onClick={onEdit}
        className="flex min-w-0 flex-1 items-center gap-3 rounded-sm text-left outline-offset-2 focus-visible:outline-2 focus-visible:outline-ring"
      >
        <span
          className={
            entry.description ? 'truncate' : 'truncate text-muted-foreground'
          }
        >
          {entry.description || 'No description'}
        </span>
        {entry.taskId !== null && (
          <ListTodoIcon
            className="size-3.5 shrink-0 text-muted-foreground"
            aria-label="Linked to a task"
          />
        )}
        <span className="flex min-w-0 shrink items-center gap-1.5 text-sm text-muted-foreground">
          <ProjectDot color={project?.color} />
          <span className="truncate">
            {project ? projectPath(index, project.id) : 'No project'}
          </span>
        </span>
      </button>
      <span className="text-xs text-muted-foreground">
        {formatClockTime(entry.startedAt)} – {formatClockTime(entry.endedAt)}
      </span>
      <span className="w-16 text-right text-sm font-medium">
        {formatDuration(entry.endedAt - entry.startedAt)}
      </span>
      <div className="flex w-16 justify-end opacity-0 group-hover/entry:opacity-100 focus-within:opacity-100 has-[[data-state=open]]:opacity-100">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="icon-sm"
              variant="ghost"
              aria-label="Continue this entry"
              onClick={() =>
                start.mutate({
                  description: entry.description,
                  projectId: entry.projectId,
                  taskId: entry.taskId,
                })
              }
            >
              <PlayIcon />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Continue</TooltipContent>
        </Tooltip>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="icon-sm" variant="ghost" aria-label="Entry options">
              <MoreHorizontalIcon />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={onEdit}>
              <PencilIcon />
              Edit
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => remove.mutate(entry.id)}>
              <Trash2Icon />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </li>
  );
}
