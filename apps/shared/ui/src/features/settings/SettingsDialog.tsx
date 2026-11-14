import {
  BellIcon,
  CalendarDaysIcon,
  CalendarRangeIcon,
  DatabaseIcon,
  FlagIcon,
  KeyboardIcon,
  type LucideIcon,
  MapPinIcon,
  PaletteIcon,
  RefreshCwIcon,
  SunIcon,
  SunriseIcon,
  UserIcon,
} from 'lucide-react';
import { type ComponentType, useState } from 'react';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { CalendarSettings } from '@/features/calendar/CalendarSettings';
import { PlaceSettings } from '@/features/places/PlaceSettings';
import { SyncSettings } from '@/features/sync/SyncSettings';
import { type Platform, platform } from '@/platform';

import { AccountSettings } from './AccountSettings';
import { AppearanceSettings } from './AppearanceSettings';
import { CaptureSettings } from './CaptureSettings';
import { DataSettings } from './DataSettings';
import { PrioritySettings } from './PrioritySettings';
import { ReminderSettings } from './ReminderSettings';
import { RitualSettings } from './RitualSettings';
import { TodaySettings } from './TodaySettings';
import { WeekSettings } from './WeekSettings';

type Section = {
  id: string;
  label: string;
  description: string | ((platform: Platform) => string);
  icon: LucideIcon;
  content: ComponentType;
  available?: (platform: Platform) => boolean;
};

const sections: Section[] = [
  {
    id: 'appearance',
    label: 'Appearance',
    description: (platform) =>
      platform.kind === 'desktop'
        ? 'How skkil time looks on this computer.'
        : 'How skkil time looks in this browser.',
    icon: PaletteIcon,
    content: AppearanceSettings,
  },
  {
    id: 'today',
    label: 'Today',
    description: 'Your name and what the top of Day shows.',
    icon: SunIcon,
    content: TodaySettings,
  },
  {
    id: 'week',
    label: 'Week',
    description: 'How weeks are laid out, and what counts as tracked time.',
    icon: CalendarRangeIcon,
    content: WeekSettings,
  },
  {
    id: 'calendars',
    label: 'Calendars',
    description: 'Show events from Google Calendar on Day and Week.',
    icon: CalendarDaysIcon,
    content: CalendarSettings,
    available: (platform) => platform.calendars !== undefined,
  },
  {
    id: 'reminders',
    label: 'Reminders',
    description: 'Alerts for timed tasks, focus blocks and events.',
    icon: BellIcon,
    content: ReminderSettings,
    available: (platform) => platform.features.reminders,
  },
  {
    id: 'capture',
    label: 'Capture',
    description: 'Add a task or see today without switching to skkil time.',
    icon: KeyboardIcon,
    content: CaptureSettings,
    available: (platform) => platform.features.captureHotkey,
  },
  {
    id: 'places',
    label: 'Places',
    description: 'Where tasks happen. Each task can have one place.',
    icon: MapPinIcon,
    content: PlaceSettings,
  },
  {
    id: 'priorities',
    label: 'Priorities',
    description: 'The colour of each priority on tasks and the week grid.',
    icon: FlagIcon,
    content: PrioritySettings,
  },
  {
    id: 'rituals',
    label: 'Rituals',
    description: 'The water, Check out and the weekly review.',
    icon: SunriseIcon,
    content: RitualSettings,
  },
  {
    id: 'data',
    label: 'Data',
    description: 'Import, back up or delete your data.',
    icon: DatabaseIcon,
    content: DataSettings,
  },
  {
    id: 'account',
    label: 'Account',
    description: 'The account you’re signed in with.',
    icon: UserIcon,
    content: AccountSettings,
    available: (platform) => platform.account !== null,
  },
  {
    id: 'sync',
    label: 'Sync',
    description: 'Sign in and keep your devices in step.',
    icon: RefreshCwIcon,
    content: SyncSettings,
    available: (platform) => platform.sync !== undefined,
  },
];

export function SettingsDialog({
  open,
  onOpenChange,
  section,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The section to show when the dialog opens; otherwise the last one shown. */
  section?: string;
}) {
  const visible = sections.filter(
    (candidate) => candidate.available?.(platform()) ?? true,
  );
  const [activeId, setActiveId] = useState(visible[0].id);
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open && visible.some((candidate) => candidate.id === section))
      setActiveId(section!);
  }
  const active = visible.find((section) => section.id === activeId)!;
  const Content = active.content;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          (event.currentTarget as HTMLElement).focus();
        }}
        className="flex h-[min(560px,calc(100dvh-2rem))] flex-col gap-0 overflow-hidden p-0 *:data-[slot=dialog-close]:top-3 *:data-[slot=dialog-close]:right-3 sm:grid sm:max-w-3xl sm:grid-cols-[196px_minmax(0,1fr)] sm:*:data-[slot=dialog-close]:top-5 sm:*:data-[slot=dialog-close]:right-5"
      >
        <nav
          aria-label="Settings"
          className="mr-12 flex shrink-0 items-center gap-0.5 overflow-x-auto px-3 py-3 sm:mr-0 sm:grid sm:content-start sm:items-stretch sm:border-r sm:bg-white/[.03] sm:px-4 sm:py-6"
        >
          <DialogTitle className="sr-only text-sm sm:not-sr-only sm:mb-3 sm:px-2">
            Settings
          </DialogTitle>
          {visible.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              aria-current={id === activeId ? 'page' : undefined}
              onClick={(event) => {
                setActiveId(id);
                event.currentTarget.scrollIntoView({
                  block: 'nearest',
                  inline: 'nearest',
                });
              }}
              className="flex h-8 shrink-0 items-center gap-2.5 rounded-md px-2 text-sm text-sidebar-foreground/85 outline-none hover:bg-sidebar-accent focus-visible:ring-2 focus-visible:ring-ring aria-[current=page]:bg-sidebar-accent aria-[current=page]:font-medium aria-[current=page]:text-sidebar-foreground"
            >
              <Icon
                className="size-4 text-muted-foreground"
                strokeWidth={1.5}
              />
              {label}
            </button>
          ))}
        </nav>
        <section className="min-h-0 flex-1 overflow-y-auto border-t p-5 sm:border-t-0 sm:px-8 sm:py-7">
          <h3 className="font-heading text-base font-bold">{active.label}</h3>
          <DialogDescription className="mb-4">
            {typeof active.description === 'function'
              ? active.description(platform())
              : active.description}
          </DialogDescription>
          <Content />
        </section>
      </DialogContent>
    </Dialog>
  );
}
