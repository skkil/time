import {
  BellIcon,
  CalendarRangeIcon,
  DatabaseIcon,
  FlagIcon,
  type LucideIcon,
  PaletteIcon,
  SunIcon,
  SunriseIcon,
} from 'lucide-react';
import { type ComponentType, useState } from 'react';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';

import { AppearanceSettings } from './AppearanceSettings';
import { DataSettings } from './DataSettings';
import { PrioritySettings } from './PrioritySettings';
import { ReminderSettings } from './ReminderSettings';
import { RitualSettings } from './RitualSettings';
import { TodaySettings } from './TodaySettings';
import { WeekSettings } from './WeekSettings';

type Section = {
  id: string;
  label: string;
  description: string;
  icon: LucideIcon;
  content: ComponentType;
};

const sections: Section[] = [
  {
    id: 'appearance',
    label: 'Appearance',
    description: 'How skkil time looks on this computer.',
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
    description: 'How weeks and the hours of the day are laid out.',
    icon: CalendarRangeIcon,
    content: WeekSettings,
  },
  {
    id: 'reminders',
    label: 'Reminders',
    description: 'Alerts for tasks with a time.',
    icon: BellIcon,
    content: ReminderSettings,
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
    label: 'Calm',
    description: 'The water, Check out and the weekly review.',
    icon: SunriseIcon,
    content: RitualSettings,
  },
  {
    id: 'data',
    label: 'Data',
    description: 'Everything skkil time keeps on this computer.',
    icon: DatabaseIcon,
    content: DataSettings,
  },
];

export function SettingsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [activeId, setActiveId] = useState(sections[0].id);
  const active = sections.find((section) => section.id === activeId)!;
  const Content = active.content;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="grid h-[560px] grid-cols-[180px_minmax(0,1fr)] gap-0 overflow-hidden p-0 sm:max-w-3xl">
        <nav
          aria-label="Settings"
          className="grid content-start gap-0.5 border-r bg-white/[.03] p-3"
        >
          <DialogTitle className="mb-2 px-2 text-sm">Settings</DialogTitle>
          {sections.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              aria-current={id === activeId ? 'page' : undefined}
              onClick={() => setActiveId(id)}
              className="flex h-8 items-center gap-2.5 rounded-md px-2 text-sm text-sidebar-foreground/85 outline-none hover:bg-sidebar-accent focus-visible:ring-2 focus-visible:ring-ring aria-[current=page]:bg-sidebar-accent aria-[current=page]:font-medium aria-[current=page]:text-sidebar-foreground"
            >
              <Icon
                className="size-4 text-muted-foreground"
                strokeWidth={1.5}
              />
              {label}
            </button>
          ))}
        </nav>
        <section className="min-h-0 overflow-y-auto p-6">
          <h3 className="font-heading text-base font-bold">{active.label}</h3>
          <DialogDescription className="mb-4">
            {active.description}
          </DialogDescription>
          <Content />
        </section>
      </DialogContent>
    </Dialog>
  );
}
