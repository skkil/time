import { type FormEvent, useState } from 'react';

import type { Habit, HabitInput, Tracking } from '@/bindings';
import { Button } from '@/components/ui/button';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { ProjectPicker } from '@/features/projects/ProjectPicker';
import { todayKey } from '@/lib/time';
import { cn } from '@/lib/utils';

import { useCreateHabit, useUpdateHabit } from './api';
import { ALL_DAYS, SOURCES, TIMES_OF_DAY, WEEKDAY_LETTERS } from './meta';

export type HabitDialogState =
  | { mode: 'create'; kind: 'build' | 'quit' }
  | { mode: 'edit'; habit: Habit }
  | null;

const OFF = 'off';

const KINDS = [
  { value: 'build', label: 'Build', hint: 'Do it, reach a goal' },
  { value: 'quit', label: 'Quit', hint: 'Not at all' },
  { value: 'limit', label: 'Limit', hint: 'No more than a goal' },
];

export function HabitDialog({
  state,
  areas,
  onClose,
}: {
  state: HabitDialogState;
  areas: string[];
  onClose: () => void;
}) {
  return (
    <Dialog open={state !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        {state && (
          <HabitForm
            key={state.mode === 'edit' ? state.habit.id : state.kind}
            state={state}
            areas={areas}
            onDone={onClose}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function initialInput(state: NonNullable<HabitDialogState>): HabitInput {
  if (state.mode === 'edit') {
    const { habit } = state;
    return {
      name: habit.name,
      kind: habit.kind,
      goal: habit.goal,
      unit: habit.unit,
      days: habit.days,
      timeOfDay: habit.timeOfDay,
      area: habit.area,
      startDate: habit.startDate,
      tracking: habit.tracking,
    };
  }
  return {
    name: '',
    kind: state.kind,
    goal: 1,
    unit: 'times',
    days: ALL_DAYS,
    timeOfDay: 'anytime',
    area: '',
    startDate: todayKey(),
    tracking: null,
  };
}

function HabitForm({
  state,
  areas,
  onDone,
}: {
  state: NonNullable<HabitDialogState>;
  areas: string[];
  onDone: () => void;
}) {
  const create = useCreateHabit();
  const update = useUpdateHabit();
  const [input, setInput] = useState<HabitInput>(() => initialInput(state));
  const [patterns, setPatterns] = useState(
    input.tracking?.patterns.join('\n') ?? '',
  );
  const set = <K extends keyof HabitInput>(key: K, value: HabitInput[K]) =>
    setInput((current) => ({ ...current, [key]: value }));
  const tracking = input.tracking;
  const setTracking = (patch: Partial<Tracking> | null) =>
    set(
      'tracking',
      patch === null
        ? null
        : {
            source: 'website',
            patterns: [],
            projectId: null,
            ...tracking,
            ...patch,
          },
    );
  const unitLocked = tracking?.source === 'project';
  const pending = create.isPending || update.isPending;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const payload: HabitInput = {
      ...input,
      unit: unitLocked ? 'minutes' : input.unit,
      tracking: tracking && {
        ...tracking,
        patterns: patterns
          .split(/[\n,]/)
          .map((p) => p.trim())
          .filter(Boolean),
      },
    };
    if (state.mode === 'edit')
      update.mutate(
        { id: state.habit.id, input: payload },
        { onSuccess: onDone },
      );
    else create.mutate(payload, { onSuccess: onDone });
  };

  return (
    <form onSubmit={submit} className="grid gap-5">
      <DialogHeader>
        <DialogTitle>
          {state.mode === 'edit' ? 'Edit habit' : 'New habit'}
        </DialogTitle>
        <DialogDescription>
          {input.kind === 'build'
            ? 'Something to do regularly.'
            : input.kind === 'quit'
              ? 'Something to stop. Each clean day counts toward the streak.'
              : 'Something to keep under a daily limit.'}
        </DialogDescription>
      </DialogHeader>

      <div className="grid gap-2">
        <Label htmlFor="habit-name">Name</Label>
        <Input
          id="habit-name"
          autoFocus
          value={input.name}
          maxLength={80}
          placeholder={
            input.kind === 'build' ? 'Read 30 pages' : 'Stay off YouTube'
          }
          onChange={(event) => set('name', event.target.value)}
        />
      </div>

      <ToggleGroup
        type="single"
        variant="outline"
        value={input.kind}
        onValueChange={(kind) => kind && set('kind', kind)}
        className="w-full"
      >
        {KINDS.map((kind) => (
          <ToggleGroupItem
            key={kind.value}
            value={kind.value}
            className="h-auto flex-1 flex-col items-start gap-0 px-3 py-2"
          >
            <span className="font-medium">{kind.label}</span>
            <span className="text-xs font-normal text-muted-foreground">
              {kind.hint}
            </span>
          </ToggleGroupItem>
        ))}
      </ToggleGroup>

      {input.kind !== 'quit' && (
        <div className="grid gap-2">
          <Label htmlFor="habit-goal">
            {input.kind === 'build' ? 'Daily goal' : 'Daily limit'}
          </Label>
          <div className="flex items-center gap-2">
            <Input
              id="habit-goal"
              type="number"
              min={input.kind === 'build' ? 1 : 0}
              step="any"
              className="w-24"
              value={input.goal ?? 0}
              onChange={(event) => set('goal', Number(event.target.value))}
            />
            <Choice
              label="Unit"
              className="w-28"
              value={unitLocked ? 'minutes' : input.unit}
              disabled={unitLocked}
              onChange={(unit) => set('unit', unit)}
              options={[
                { value: 'times', label: 'times' },
                { value: 'minutes', label: 'minutes' },
              ]}
            />
            <span className="text-sm text-muted-foreground">per day</span>
          </div>
        </div>
      )}

      <div className="grid grid-cols-[auto_1fr] items-end gap-x-6 gap-y-5">
        <div className="grid gap-2">
          <Label>Repeat on</Label>
          <div className="flex gap-1">
            {WEEKDAY_LETTERS.map((letter, i) => {
              const on = (input.days & (1 << i)) !== 0;
              return (
                <button
                  key={i}
                  type="button"
                  aria-pressed={on}
                  aria-label={
                    ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][i]
                  }
                  onClick={() => {
                    const next = input.days ^ (1 << i);
                    if (next !== 0) set('days', next);
                  }}
                  className={cn(
                    'grid size-8 place-items-center rounded-md border text-xs font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    on
                      ? 'border-foreground bg-foreground text-background'
                      : 'text-muted-foreground hover:border-foreground/40',
                  )}
                >
                  {letter}
                </button>
              );
            })}
          </div>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="habit-time">Time of day</Label>
          <Choice
            id="habit-time"
            label="Time of day"
            value={input.timeOfDay}
            onChange={(timeOfDay) => set('timeOfDay', timeOfDay)}
            options={TIMES_OF_DAY}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="habit-start">Start date</Label>
          <Input
            id="habit-start"
            type="date"
            className="w-40"
            value={input.startDate}
            max={todayKey()}
            onChange={(event) =>
              event.target.value && set('startDate', event.target.value)
            }
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="habit-area">Area</Label>
          <Input
            id="habit-area"
            list="habit-areas"
            value={input.area}
            maxLength={40}
            placeholder="e.g. Health"
            onChange={(event) => set('area', event.target.value)}
          />
          <datalist id="habit-areas">
            {areas.map((area) => (
              <option key={area} value={area} />
            ))}
          </datalist>
        </div>
      </div>

      <fieldset className="grid gap-3 rounded-md border p-3">
        <legend className="px-1 text-sm font-medium">
          Track automatically
        </legend>
        <Choice
          label="Tracking source"
          value={tracking?.source ?? OFF}
          onChange={(source) => setTracking(source === OFF ? null : { source })}
          options={[
            { value: OFF, label: "Off, I'll log it myself" },
            ...SOURCES,
          ]}
        />
        {tracking && tracking.source !== 'project' && (
          <div className="grid gap-1.5">
            <Textarea
              rows={3}
              aria-label={tracking.source === 'website' ? 'Websites' : 'Apps'}
              placeholder={
                tracking.source === 'website'
                  ? 'youtube.com\nreddit.com'
                  : 'steam\ndiscord'
              }
              value={patterns}
              onChange={(event) => setPatterns(event.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              One per line.{' '}
              {tracking.source === 'website'
                ? 'Subdomains count too. '
                : 'Matches the app name or window title. '}
              {input.kind === 'build'
                ? `Counts ${input.unit === 'minutes' ? 'minutes spent' : 'visits'} toward the goal.`
                : input.kind === 'quit'
                  ? 'Any visit marks the day as failed.'
                  : `Fails when ${input.unit === 'minutes' ? 'minutes spent' : 'visits'} go over the limit.`}{' '}
              Read from ActivityWatch.
            </p>
          </div>
        )}
        {tracking?.source === 'project' && (
          <div className="flex items-center gap-2 text-sm">
            <ProjectPicker
              value={tracking.projectId}
              noneLabel="Pick a project"
              onChange={(projectId) => setTracking({ projectId })}
            />
            <span className="text-muted-foreground">
              minutes from your time log, including sub-projects
            </span>
          </div>
        )}
        <p className="text-xs text-muted-foreground">
          Days you set by hand always win over automatic results.
        </p>
      </fieldset>

      <DialogFooter>
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" disabled={!input.name.trim() || pending}>
          {state.mode === 'edit' ? 'Save' : 'Create habit'}
        </Button>
      </DialogFooter>
    </form>
  );
}

function Choice({
  id,
  label,
  value,
  options,
  disabled,
  className,
  onChange,
}: {
  id?: string;
  label: string;
  value: string;
  options: { value: string; label: string }[];
  disabled?: boolean;
  className?: string;
  onChange: (value: string) => void;
}) {
  return (
    <Select value={value} disabled={disabled} onValueChange={onChange}>
      <SelectTrigger
        id={id}
        aria-label={label}
        className={cn('w-full', className)}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
