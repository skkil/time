import { dayTarget, weekTarget } from '@skkil-time/rules/move';
import { parseDatePhrase } from '@skkil-time/rules/quick-add/dates';
import { format } from 'date-fns';
import {
  CalendarIcon,
  CheckIcon,
  ChevronDownIcon,
  ClockIcon,
  FlagIcon,
  InboxIcon,
  MapPinIcon,
  RepeatIcon,
  TargetIcon,
  TimerIcon,
  XIcon,
} from 'lucide-react';
import { type ReactNode, useState } from 'react';

import type { Id, MoveTarget } from '@/backend';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Input } from '@/components/ui/input';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { usePlaces } from '@/features/places/api';
import { ProjectDot } from '@/features/projects/ProjectDot';
import { useProjectIndex } from '@/features/projects/api';
import { useSettings } from '@/features/settings/settings-context';
import {
  type DateKey,
  formatEstimate,
  formatMinutesOfDay,
  fromDateKey,
  mondayOf,
  parseClockInput,
  parseDurationInput,
  shiftKey,
  toDateKey,
  todayKey,
} from '@/lib/time';
import { cn } from '@/lib/utils';

import { useSections } from './api';
import {
  PRIORITIES,
  dueToneClass,
  formatDate,
  formatDue,
  priorityColor,
  taskTone,
} from './meta';

type ChipProps = {
  icon: ReactNode;
  children: ReactNode;
  active: boolean;
  onClear?: () => void;
  className?: string;
} & React.ComponentProps<typeof Button>;

export function Chip({
  icon,
  children,
  active,
  onClear,
  className,
  ...props
}: ChipProps) {
  return (
    <Button
      variant="outline"
      size="xs"
      className={cn(
        'h-7 gap-1.5 px-2 font-normal',
        !active && 'text-muted-foreground',
        className,
      )}
      {...props}
    >
      {icon}
      <span className="truncate">{children}</span>
      {active && onClear && (
        <span
          role="button"
          tabIndex={-1}
          aria-label="Clear"
          className="-mr-1 rounded-sm p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation();
            onClear();
          }}
        >
          <XIcon className="size-3" />
        </span>
      )}
    </Button>
  );
}

export type Due = {
  dueDate: DateKey | null;
  dueUntil: DateKey | null;
  dueTime: number | null;
  recurrence: string | null;
};

const REPEATS = [
  'every day',
  'every weekday',
  'every week',
  'every other week',
  'every month',
  'every year',
];

function quickTargets(today: DateKey, repeating: boolean) {
  const day = fromDateKey(today).getDay();
  const weekend = shiftKey(today, (6 - day + 7) % 7 || 7);
  const monday = mondayOf(today);
  const days = [
    { label: 'Today', hint: 'EEE', target: dayTarget(today) },
    { label: 'Tomorrow', hint: 'EEE', target: dayTarget(shiftKey(today, 1)) },
    { label: 'This weekend', hint: 'EEE', target: dayTarget(weekend) },
  ];
  if (repeating) return days;
  return [
    ...days,
    { label: 'This week', hint: 'any day', target: weekTarget(monday) },
    {
      label: 'Next week',
      hint: 'any day',
      target: weekTarget(shiftKey(monday, 7)),
    },
  ];
}

const hintFor = (target: MoveTarget, hint: string) =>
  target.kind === 'day' ? format(fromDateKey(target.date), hint) : hint;

export function DuePicker({
  value,
  onChange,
  onMove,
  trigger,
}: {
  value: Due;
  onChange: (value: Due) => void;
  onMove: (target: MoveTarget) => void;
  trigger?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [phrase, setPhrase] = useState('');
  const [timeText, setTimeText] = useState('');
  const today = todayKey();
  const typed = phrase ? parseDatePhrase(phrase, today) : undefined;
  const tone = taskTone(value, today) ?? 'later';

  const move = (target: MoveTarget) => {
    onMove(target);
    setPhrase('');
    setOpen(false);
  };

  const setDate = (dueDate: DateKey | null) => {
    if (dueDate) move(dayTarget(dueDate));
    else {
      onChange({
        dueDate: null,
        dueUntil: null,
        dueTime: null,
        recurrence: null,
      });
      setPhrase('');
    }
  };

  const commitTime = () => {
    const minutes = timeText ? parseClockInput(timeText) : null;
    if (timeText && minutes === null) return false;
    if (minutes !== value.dueTime) onChange({ ...value, dueTime: minutes });
    return true;
  };

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next)
          setTimeText(
            value.dueTime === null ? '' : formatMinutesOfDay(value.dueTime),
          );
      }}
    >
      <PopoverTrigger asChild>
        {trigger ?? (
          <Chip
            active={value.dueDate !== null}
            icon={
              value.recurrence ? (
                <RepeatIcon className={dueToneClass[tone]} />
              ) : (
                <CalendarIcon
                  className={value.dueDate ? dueToneClass[tone] : undefined}
                />
              )
            }
            className={value.dueDate ? dueToneClass[tone] : undefined}
            onClear={() => setDate(null)}
          >
            {value.dueDate ? formatDue(value, today) : 'Date'}
          </Chip>
        )}
      </PopoverTrigger>
      <PopoverContent className="w-64 p-0" side="right" align="center">
        <form
          className="border-b p-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (typed) setDate(typed);
          }}
        >
          <Input
            autoFocus
            value={phrase}
            placeholder="Type a date, e.g. next fri"
            aria-label="Type a date"
            className="h-8 text-sm"
            onChange={(event) => setPhrase(event.target.value)}
          />
          {phrase && (
            <p className="mt-1.5 px-1 text-xs text-muted-foreground">
              {typed ? formatDate(typed, today) : 'No date recognised'}
            </p>
          )}
        </form>
        <div className="grid border-b p-1">
          {quickTargets(today, value.recurrence !== null).map((option) => (
            <button
              key={option.label}
              type="button"
              className="flex h-8 items-center justify-between rounded-sm px-2 text-sm hover:bg-accent"
              onClick={() => move(option.target)}
            >
              {option.label}
              <span className="text-xs text-muted-foreground">
                {hintFor(option.target, option.hint)}
              </span>
            </button>
          ))}
          {value.dueDate && (
            <button
              type="button"
              className="flex h-8 items-center gap-2 rounded-sm px-2 text-sm text-muted-foreground hover:bg-accent"
              onClick={() => setDate(null)}
            >
              <XIcon className="size-3.5" />
              No date
            </button>
          )}
        </div>
        <Calendar
          mode="single"
          weekStartsOn={1}
          className="mx-auto"
          selected={value.dueDate ? fromDateKey(value.dueDate) : undefined}
          defaultMonth={value.dueDate ? fromDateKey(value.dueDate) : undefined}
          onSelect={(date) => date && setDate(toDateKey(date))}
        />
        <div className="grid gap-2 border-t p-2">
          <label className="flex items-center gap-2 text-sm">
            <ClockIcon className="size-3.5 text-muted-foreground" />
            <span className="w-14 text-muted-foreground">Time</span>
            <Input
              value={timeText}
              placeholder="HH:MM"
              aria-label="Time"
              className="h-7 flex-1 text-sm"
              disabled={!value.dueDate}
              onChange={(event) => setTimeText(event.target.value)}
              onBlur={() => commitTime()}
              onKeyDown={(event) => {
                if (event.key !== 'Enter') return;
                event.preventDefault();
                if (commitTime()) setOpen(false);
              }}
            />
          </label>
          <label className="flex items-center gap-2 text-sm">
            <RepeatIcon className="size-3.5 text-muted-foreground" />
            <span className="w-14 text-muted-foreground">Repeat</span>
            <select
              aria-label="Repeat"
              className="h-7 flex-1 rounded-md border bg-transparent px-1.5 text-sm"
              disabled={!value.dueDate}
              value={value.recurrence ?? ''}
              onChange={(event) =>
                onChange({ ...value, recurrence: event.target.value || null })
              }
            >
              <option value="">Never</option>
              {value.recurrence && !REPEATS.includes(value.recurrence) && (
                <option value={value.recurrence}>{value.recurrence}</option>
              )}
              {REPEATS.map((rule) => (
                <option key={rule} value={rule}>
                  {rule}
                </option>
              ))}
            </select>
          </label>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function DeadlinePicker({
  value,
  onChange,
  trigger,
}: {
  value: DateKey | null;
  onChange: (value: DateKey | null) => void;
  trigger?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const overdue = value !== null && value < todayKey();
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {trigger ?? (
          <Chip
            active={value !== null}
            icon={<TargetIcon className={cn(overdue && 'text-p1')} />}
            className={cn(overdue && 'text-p1')}
            onClear={() => onChange(null)}
          >
            {value ? formatDate(value) : 'Deadline'}
          </Chip>
        )}
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          weekStartsOn={1}
          selected={value ? fromDateKey(value) : undefined}
          defaultMonth={value ? fromDateKey(value) : undefined}
          onSelect={(date) => {
            onChange(date ? toDateKey(date) : null);
            setOpen(false);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}

export function PriorityFlag({
  priority,
  className,
}: {
  priority: number;
  className?: string;
}) {
  const color = priorityColor(priority);
  return (
    <FlagIcon
      className={cn(!color && 'text-muted-foreground', className)}
      style={color ? { color, fill: color } : undefined}
    />
  );
}

export function PriorityPicker({
  value,
  onChange,
  trigger,
}: {
  value: number;
  onChange: (value: number) => void;
  trigger?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {trigger ?? (
          <Chip
            active={value < 4}
            icon={<PriorityFlag priority={value} />}
            onClear={() => onChange(4)}
          >
            {value < 4 ? `P${value}` : 'Priority'}
          </Chip>
        )}
      </PopoverTrigger>
      <PopoverContent className="w-44 p-1" align="start">
        {PRIORITIES.map((priority) => (
          <button
            key={priority}
            type="button"
            className="flex h-8 w-full items-center gap-2 rounded-sm px-2 text-sm hover:bg-accent"
            onClick={() => {
              onChange(priority);
              setOpen(false);
            }}
          >
            <PriorityFlag priority={priority} className="size-4" />
            Priority {priority}
            {value === priority && <CheckIcon className="ml-auto size-4" />}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}

export function PlacePicker({
  value,
  onChange,
  trigger,
}: {
  value: Id | null;
  onChange: (value: Id | null) => void;
  trigger: ReactNode;
}) {
  const places = usePlaces();
  const { openSettings } = useSettings();
  const [open, setOpen] = useState(false);
  const choose = (next: Id | null) => {
    onChange(next);
    setOpen(false);
  };
  const option = (id: Id | null, label: string) => (
    <button
      key={id ?? 'none'}
      type="button"
      className="flex h-8 w-full items-center gap-2 rounded-sm px-2 text-sm hover:bg-accent"
      onClick={() => choose(id)}
    >
      <MapPinIcon
        className={cn('size-4', id === null && 'text-muted-foreground')}
      />
      <span className="truncate">{label}</span>
      {value === id && <CheckIcon className="ml-auto size-4" />}
    </button>
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent className="w-56 p-1" align="start">
        <p className="px-2 pt-1 pb-1.5 text-xs text-muted-foreground">Place</p>
        {option(null, 'No place')}
        {places.list.map((place) => option(place.id, place.name))}
        {places.list.length === 0 && (
          <p className="px-2 py-1.5 text-xs text-muted-foreground">
            No saved places yet.
          </p>
        )}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="w-full justify-start font-normal text-muted-foreground"
          onClick={() => {
            setOpen(false);
            openSettings('places');
          }}
        >
          {places.list.length === 0 ? 'Add places in Settings' : 'Edit places'}
        </Button>
      </PopoverContent>
    </Popover>
  );
}

const ESTIMATE_PRESETS = [15, 30, 45, 60, 90, 120, 180];

export function EstimatePicker({
  value,
  onChange,
  trigger,
}: {
  value: number | null;
  onChange: (value: number | null) => void;
  trigger?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const parsed = parseDurationInput(draft);

  const choose = (next: number | null) => {
    onChange(next);
    setDraft('');
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {trigger ?? (
          <Chip
            active={value !== null}
            icon={<TimerIcon />}
            onClear={() => onChange(null)}
          >
            {value ? formatEstimate(value) : 'Duration'}
          </Chip>
        )}
      </PopoverTrigger>
      <PopoverContent className="w-60 p-2" align="start">
        <div className="grid grid-cols-4 gap-1">
          {ESTIMATE_PRESETS.map((minutes) => (
            <Button
              key={minutes}
              size="xs"
              variant={value === minutes ? 'secondary' : 'ghost'}
              onClick={() => choose(minutes)}
            >
              {formatEstimate(minutes)}
            </Button>
          ))}
        </div>
        <form
          className="mt-2 flex gap-1"
          onSubmit={(event) => {
            event.preventDefault();
            if (parsed !== null && parsed <= 24 * 60) choose(parsed);
          }}
        >
          <Input
            value={draft}
            placeholder="Custom, e.g. 1h 20m"
            className="h-7 text-sm"
            aria-label="Custom duration"
            onChange={(event) => setDraft(event.target.value)}
          />
          <Button
            size="sm"
            type="submit"
            disabled={parsed === null || parsed > 24 * 60}
          >
            Set
          </Button>
        </form>
      </PopoverContent>
    </Popover>
  );
}

export type Placement = { projectId: Id | null; sectionId: Id | null };

export function PlacementPicker({
  value,
  onChange,
  trigger,
  align = 'start',
}: {
  value: Placement;
  onChange: (value: Placement) => void;
  trigger?: ReactNode;
  align?: 'start' | 'end';
}) {
  const index = useProjectIndex();
  const { data: sections } = useSections();
  const [open, setOpen] = useState(false);
  const project =
    value.projectId === null ? undefined : index.byId.get(value.projectId);
  const section = sections?.find((s) => s.id === value.sectionId);

  const choose = (next: Placement) => {
    onChange(next);
    setOpen(false);
  };

  const sectionItems = (projectId: Id | null, path: string, depth: number) =>
    (sections ?? [])
      .filter((s) => s.projectId === projectId)
      .map((s) => (
        <CommandItem
          key={`s${s.id}`}
          value={`${path} / ${s.name} s${s.id}`}
          data-checked={value.sectionId === s.id}
          onSelect={() => choose({ projectId, sectionId: s.id })}
        >
          <span style={{ width: depth * 14 + 18 }} className="shrink-0" />
          <span className="truncate text-muted-foreground">{s.name}</span>
        </CommandItem>
      ));

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {trigger ?? (
          <Button
            variant="ghost"
            size="sm"
            className="max-w-64 justify-start gap-1.5 font-normal"
          >
            {project ? (
              <ProjectDot color={project.color} />
            ) : (
              <InboxIcon className="text-muted-foreground" />
            )}
            <span className="truncate">
              {project?.name ?? 'Inbox'}
              {section && (
                <span className="text-muted-foreground"> / {section.name}</span>
              )}
            </span>
            <ChevronDownIcon className="text-muted-foreground" />
          </Button>
        )}
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0" align={align}>
        <Command>
          <CommandInput placeholder="Type a project name" />
          <CommandList>
            <CommandEmpty>No matching project.</CommandEmpty>
            <CommandGroup>
              <CommandItem
                value="Inbox"
                data-checked={
                  value.projectId === null && value.sectionId === null
                }
                onSelect={() => choose({ projectId: null, sectionId: null })}
              >
                <InboxIcon className="text-muted-foreground" />
                Inbox
              </CommandItem>
              {sectionItems(null, 'Inbox', 0)}
              {index.active.map((node) => [
                <CommandItem
                  key={node.id}
                  value={`${node.name} ${node.id}`}
                  data-checked={
                    value.projectId === node.id && value.sectionId === null
                  }
                  onSelect={() =>
                    choose({ projectId: node.id, sectionId: null })
                  }
                >
                  <span
                    style={{ width: node.depth * 14 }}
                    className="shrink-0"
                  />
                  <ProjectDot color={node.color} />
                  <span className="truncate">{node.name}</span>
                </CommandItem>,
                ...sectionItems(node.id, node.name, node.depth),
              ])}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
