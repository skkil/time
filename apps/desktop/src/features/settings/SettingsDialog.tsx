import { type LucideIcon, PaletteIcon } from 'lucide-react';
import { type ComponentType, useState } from 'react';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';

import { AppearanceSettings } from './AppearanceSettings';

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
      <DialogContent className="grid h-[480px] grid-cols-[180px_minmax(0,1fr)] gap-0 overflow-hidden p-0 sm:max-w-2xl">
        <nav
          aria-label="Settings"
          className="grid content-start gap-0.5 border-r bg-sidebar p-3"
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
