import { getRouteApi, useNavigate } from '@tanstack/react-router';
import {
  ArchiveIcon,
  BanIcon,
  CheckIcon,
  MinusIcon,
  MoreHorizontalIcon,
  PencilIcon,
  PlusIcon,
  RefreshCwIcon,
  RepeatIcon,
  ShieldCheckIcon,
  SkipForwardIcon,
  XIcon,
} from 'lucide-react';
import { useMemo, useState } from 'react';

import type { Habit, HabitDay, ManualStatus, SyncReport } from '@/bindings';
import {
  EmptyState,
  Page,
  PageBody,
  PageHeader,
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
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import {
  type DateKey,
  formatDayOfMonth,
  formatWeekRange,
  formatWeekday,
  isoWeekNumber,
  nowSeconds,
  shiftKey,
  todayKey,
  weekKeys,
} from '@/lib/time';
import { cn } from '@/lib/utils';

import { HabitCell } from './HabitCell';
import { HabitDialog, type HabitDialogState } from './HabitDialog';
import { HabitRing } from './HabitRing';
import {
  dayLookup,
  useAddHabitValue,
  useArchiveHabit,
  useHabitDays,
  useHabitSync,
  useHabits,
  useSetHabitStatus,
} from './api';
import {
  SOURCES,
  TIMES_OF_DAY,
  formatSince,
  progressLabel,
  statusLabel,
} from './meta';

const route = getRouteApi('/habits');

type Lookup = ReturnType<typeof dayLookup>;

export function HabitsPage() {
  const { week } = route.useSearch();
  const navigate = useNavigate();
  const days = useMemo(() => weekKeys(week), [week]);
  const today = todayKey();
  const { data: habits = [], isPending } = useHabits();
  const { data: weekDays } = useHabitDays(week, shiftKey(week, 7));
  const { data: todayDays } = useHabitDays(today, shiftKey(today, 1));
  const sync = useHabitSync();
  const setStatus = useSetHabitStatus();
  const [dialog, setDialog] = useState<HabitDialogState>(null);
  const [area, setArea] = useState('');
  const lookup = useMemo(() => dayLookup(weekDays), [weekDays]);
  const todayLookup = useMemo(() => dayLookup(todayDays), [todayDays]);

  const areas = useMemo(
    () => [...new Set(habits.map((h) => h.area).filter(Boolean))].sort(),
    [habits],
  );
  const visible = habits.filter((habit) => !area || habit.area === area);
  const good = visible.filter((habit) => habit.kind === 'build');
  const bad = visible.filter((habit) => habit.kind !== 'build');
  const onStatus = (habit: Habit, date: DateKey, status: ManualStatus | null) =>
    setStatus.mutate({ habitId: habit.id, date, status });

  return (
    <Page>
      <PageHeader
        title="Habits"
        meta={`Week ${isoWeekNumber(week)} · ${formatWeekRange(week)}`}
        actions={
          <>
            <WeekSwitcher
              week={week}
              onChange={(next) =>
                navigate({ to: '/habits', search: { week: next } })
              }
            />
            <NewHabitMenu
              onPick={(kind) => setDialog({ mode: 'create', kind })}
            />
          </>
        }
      />
      <PageBody>
        <div className="mx-auto grid max-w-4xl gap-8">
          <SyncNotice
            report={sync.data}
            habits={habits}
            syncing={sync.isFetching}
            onRetry={() => sync.refetch()}
          />

          {habits.length === 0 && !isPending ? (
            <EmptyState title="No habits yet.">
              Build something new, or break a bad habit. Bad habits can be
              checked automatically from the websites and apps you use.
            </EmptyState>
          ) : (
            <>
              {areas.length > 0 && (
                <ToggleGroup
                  type="single"
                  variant="outline"
                  size="sm"
                  value={area || 'all'}
                  onValueChange={(next) => setArea(next === 'all' ? '' : next)}
                  className="justify-start"
                >
                  <ToggleGroupItem value="all">All</ToggleGroupItem>
                  {areas.map((name) => (
                    <ToggleGroupItem key={name} value={name}>
                      {name}
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
              )}

              <section aria-labelledby="today-title" className="grid gap-4">
                <h2
                  id="today-title"
                  className="font-sans text-sm font-semibold"
                >
                  Today
                </h2>
                {TIMES_OF_DAY.map((time) => {
                  const group = good.filter((h) => h.timeOfDay === time.value);
                  if (group.length === 0) return null;
                  return (
                    <JournalGroup
                      key={time.value}
                      title={time.label}
                      icon={time.icon}
                      habits={group}
                      lookup={todayLookup}
                      today={today}
                      onStatus={onStatus}
                      onEdit={(habit) => setDialog({ mode: 'edit', habit })}
                    />
                  );
                })}
                {bad.length > 0 && (
                  <JournalGroup
                    title="Bad habits"
                    icon={BanIcon}
                    habits={bad}
                    lookup={todayLookup}
                    today={today}
                    onStatus={onStatus}
                    onEdit={(habit) => setDialog({ mode: 'edit', habit })}
                  />
                )}
              </section>

              <WeekGrid
                habits={visible}
                days={days}
                today={today}
                lookup={lookup}
                onStatus={onStatus}
              />
            </>
          )}
        </div>
      </PageBody>
      <HabitDialog
        state={dialog}
        areas={areas}
        onClose={() => setDialog(null)}
      />
    </Page>
  );
}

function NewHabitMenu({
  onPick,
}: {
  onPick: (kind: 'build' | 'quit') => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm">
          <PlusIcon />
          New habit
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuItem onSelect={() => onPick('build')}>
          <RepeatIcon />
          Build a good habit
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onPick('quit')}>
          <BanIcon />
          Break a bad habit
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function SyncNotice({
  report,
  habits,
  syncing,
  onRetry,
}: {
  report: SyncReport | undefined;
  habits: Habit[];
  syncing: boolean;
  onRetry: () => void;
}) {
  const uses = (source: string) =>
    habits.some((habit) => habit.tracking?.source === source);
  if (!report) return null;
  let message: string | null = null;
  if (report.activitywatch === 'unreachable')
    message =
      'ActivityWatch isn’t running, so website and app tracking is paused. Start it and these habits update on their own.';
  else if (
    report.activitywatch === 'connected' &&
    uses('website') &&
    !report.hasWebData
  )
    message =
      'ActivityWatch has no browser data yet. Install the aw-watcher-web extension in your browser.';
  else if (
    report.activitywatch === 'connected' &&
    uses('app') &&
    !report.hasWindowData
  )
    message =
      'ActivityWatch has no window data yet. On Hyprland, run awatcher as the window watcher.';
  if (!message) return null;

  return (
    <div
      role="status"
      className="flex items-center gap-3 rounded-md border border-dashed px-4 py-3 text-sm"
    >
      <span className="flex-1 text-muted-foreground">{message}</span>
      <Button variant="outline" size="sm" disabled={syncing} onClick={onRetry}>
        <RefreshCwIcon className={cn(syncing && 'animate-spin')} />
        Check again
      </Button>
    </div>
  );
}

function JournalGroup({
  title,
  icon: Icon,
  habits,
  lookup,
  today,
  onStatus,
  onEdit,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  habits: Habit[];
  lookup: Lookup;
  today: DateKey;
  onStatus: (habit: Habit, date: DateKey, status: ManualStatus | null) => void;
  onEdit: (habit: Habit) => void;
}) {
  return (
    <div>
      <h3 className="mb-1 flex items-center gap-1.5 border-b pb-1.5 font-sans text-xs font-semibold text-muted-foreground">
        <Icon className="size-3.5" />
        {title}
        <span className="font-normal">{habits.length}</span>
      </h3>
      <ul>
        {habits.map((habit) => (
          <JournalRow
            key={habit.id}
            habit={habit}
            day={lookup(habit.id, today)}
            onStatus={(status) => onStatus(habit, today, status)}
            onEdit={() => onEdit(habit)}
          />
        ))}
      </ul>
    </div>
  );
}

function JournalRow({
  habit,
  day,
  onStatus,
  onEdit,
}: {
  habit: Habit;
  day: HabitDay | undefined;
  onStatus: (status: ManualStatus | null) => void;
  onEdit: () => void;
}) {
  const addValue = useAddHabitValue();
  const archive = useArchiveHabit();
  const bad = habit.kind !== 'build';
  const status = day?.status ?? 'off';
  const value = day?.value ?? 0;
  const goal = habit.goal ?? 0;
  const progress = goal > 0 ? value / goal : value > 0 ? 1 : 0;
  const step = habit.unit === 'minutes' ? 15 : 1;
  const canCount = !habit.tracking && status !== 'off';

  const subtitle =
    habit.cleanSince && status !== 'failed'
      ? `Clean for ${formatSince(habit.cleanSince, nowSeconds())}`
      : status === 'off'
        ? 'Not scheduled today'
        : progressLabel(habit, value);

  return (
    <li className="group/habit flex items-center gap-3 border-b py-2.5 last:border-b-0">
      <HabitRing progress={progress} status={status} bad={bad}>
        {status === 'done' ? (
          <CheckIcon className="size-4" strokeWidth={2.5} />
        ) : status === 'failed' ? (
          <XIcon className="size-4" strokeWidth={2.5} />
        ) : bad ? (
          <ShieldCheckIcon className="size-4" />
        ) : (
          <span className="text-[11px]">{Math.round(progress * 100)}</span>
        )}
      </HabitRing>
      <div className="min-w-0 flex-1">
        <p
          className={cn(
            'truncate text-sm font-medium',
            (status === 'done' || status === 'skipped') &&
              'text-muted-foreground',
          )}
        >
          {habit.name}
        </p>
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span>{subtitle}</span>
          {habit.kind !== 'build' &&
            day &&
            habit.kind === 'limit' &&
            status !== 'failed' && <span>· {progressLabel(habit, value)}</span>}
          {habit.tracking && (
            <span
              className="flex items-center gap-1"
              title="Tracked automatically"
            >
              · <SourceIcon source={habit.tracking.source} />
              auto
            </span>
          )}
          {day?.manual && <span>· set by you</span>}
        </p>
      </div>
      {habit.dueDays > 0 && (
        <span
          className="text-xs text-muted-foreground"
          title="Done on these days out of the last 14, rest days not counted"
        >
          {habit.doneDays} of {habit.dueDays}
        </span>
      )}
      {canCount && (
        <div className="flex items-center opacity-0 group-hover/habit:opacity-100 focus-within:opacity-100">
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label={`Remove ${step} ${habit.unit}`}
            disabled={value <= 0}
            onClick={() =>
              day &&
              addValue.mutate({
                habitId: habit.id,
                date: day.date,
                delta: -step,
              })
            }
          >
            <MinusIcon />
          </Button>
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label={`Add ${step} ${habit.unit}`}
            onClick={() =>
              day &&
              addValue.mutate({
                habitId: habit.id,
                date: day.date,
                delta: step,
              })
            }
          >
            <PlusIcon />
          </Button>
        </div>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label={`${habit.name} options`}
          >
            <MoreHorizontalIcon />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem onSelect={() => onStatus('done')}>
            <CheckIcon />
            {bad ? 'Mark clean' : 'Complete'}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => onStatus('skipped')}>
            <SkipForwardIcon />
            Skip today
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => onStatus('failed')}>
            <XIcon />
            {bad ? 'I slipped' : 'Fail'}
          </DropdownMenuItem>
          {day?.manual && (
            <DropdownMenuItem onSelect={() => onStatus(null)}>
              <RefreshCwIcon />
              {habit.tracking ? 'Back to automatic' : 'Clear'}
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={onEdit}>
            <PencilIcon />
            Edit
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => archive.mutate(habit.id)}>
            <ArchiveIcon />
            Archive
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </li>
  );
}

function WeekGrid({
  habits,
  days,
  today,
  lookup,
  onStatus,
}: {
  habits: Habit[];
  days: DateKey[];
  today: DateKey;
  lookup: Lookup;
  onStatus: (habit: Habit, date: DateKey, status: ManualStatus | null) => void;
}) {
  return (
    <section aria-labelledby="week-title" className="grid gap-2">
      <h2 id="week-title" className="font-sans text-sm font-semibold">
        This week
      </h2>
      <div className="overflow-hidden rounded-md border bg-card">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b text-xs text-muted-foreground">
              <th className="px-4 py-2.5 text-left font-medium">Habit</th>
              {days.map((day) => (
                <th
                  key={day}
                  className={cn(
                    'w-12 py-2.5 font-medium',
                    day === today && 'bg-today-tint text-foreground',
                  )}
                >
                  {formatWeekday(day)}
                  <span className="block text-[11px] font-normal">
                    {formatDayOfMonth(day)}
                  </span>
                </th>
              ))}
              <th className="w-20 px-4 py-2.5 text-right font-medium">Rate</th>
            </tr>
          </thead>
          <tbody>
            {habits.map((habit) => {
              const results = days.map((day) => lookup(habit.id, day));
              const counted = results.filter(
                (day) =>
                  day && ['done', 'failed', 'missed'].includes(day.status),
              );
              const done = counted.filter(
                (day) => day?.status === 'done',
              ).length;
              return (
                <tr key={habit.id} className="border-b last:border-b-0">
                  <td className="max-w-0 truncate px-4 py-2 text-sm font-medium">
                    {habit.name}
                  </td>
                  {days.map((day, i) => (
                    <td key={day} className="py-2 text-center">
                      <div className="flex justify-center">
                        <HabitCell
                          day={results[i]}
                          label={`${habit.name}, ${formatWeekday(day)} ${formatDayOfMonth(day)}`}
                          onChange={(status) => onStatus(habit, day, status)}
                        />
                      </div>
                    </td>
                  ))}
                  <td
                    className="px-4 py-2 text-right text-sm"
                    title={counted.length ? undefined : statusLabel.off}
                  >
                    {counted.length ? (
                      <>
                        {done}
                        <span className="text-muted-foreground">
                          /{counted.length}
                        </span>
                      </>
                    ) : (
                      <span className="text-muted-foreground">–</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function SourceIcon({ source }: { source: string }) {
  const Icon = SOURCES.find((s) => s.value === source)?.icon;
  return Icon ? <Icon className="size-3" /> : null;
}
