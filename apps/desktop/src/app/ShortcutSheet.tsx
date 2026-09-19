import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Kbd } from '@/components/ui/kbd';
import { PROJECTS_NAV_KEYS } from '@/features/projects/ProjectsNavToggle';
import { formatShortcut } from '@/lib/shortcuts';

const GROUPS: { title: string; items: [string, string][] }[] = [
  {
    title: 'Anywhere',
    items: [
      ['Q', 'Add a task'],
      ['Mod+N', 'Add a task, even while typing'],
      ['Mod+K', 'Search'],
      ['Mod+Z', 'Undo the last change'],
      ['Mod+,', 'Settings'],
      ['?', 'This list'],
    ],
  },
  {
    title: 'Spaces',
    items: [
      ['Mod+1', 'Day'],
      ['Mod+2', 'Week'],
      ['Mod+3', 'Projects'],
      [PROJECTS_NAV_KEYS, 'Show or hide the projects sidebar'],
    ],
  },
  {
    title: 'Day and Week',
    items: [
      ['Escape', 'Close the task panel'],
      ['Shift+ArrowLeft', 'Previous week'],
      ['Shift+ArrowRight', 'Next week'],
    ],
  },
  {
    title: 'Adding a task',
    items: [
      ['Enter', 'Add it'],
      ['Shift+Enter', 'Add it and start another'],
    ],
  },
  {
    title: 'Zoom',
    items: [
      ['Mod+=', 'Zoom in'],
      ['Mod+-', 'Zoom out'],
      ['Mod+0', 'Actual size'],
    ],
  },
];

const KEY_NAMES: Record<string, string> = {
  ArrowLeft: '←',
  ArrowRight: '→',
  Escape: 'Esc',
};

const label = (combo: string) =>
  formatShortcut(combo)
    .split(' ')
    .map((part) => KEY_NAMES[part] ?? part)
    .join(' ');

export function ShortcutSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Keyboard shortcuts</DialogTitle>
          <DialogDescription>
            Letter keys work when you aren’t typing in a field.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-x-10 gap-y-6 sm:grid-cols-2">
          {GROUPS.map((group) => (
            <section key={group.title} aria-label={group.title}>
              <h3 className="pb-2 text-xs text-muted-foreground">
                {group.title}
              </h3>
              <dl className="grid gap-1.5">
                {group.items.map(([combo, what]) => (
                  <div
                    key={combo}
                    className="flex items-center justify-between gap-4"
                  >
                    <dt>{what}</dt>
                    <dd>
                      <Kbd>{label(combo)}</Kbd>
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
