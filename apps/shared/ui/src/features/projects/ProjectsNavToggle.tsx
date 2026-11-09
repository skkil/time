import { PanelLeftIcon } from 'lucide-react';

import { Hint } from '@/components/ui/tooltip';
import { setPreference, usePreference } from '@/lib/preferences';
import { formatShortcut } from '@/lib/shortcuts';

export const PROJECTS_NAV_KEYS = 'Mod+B';

export function ProjectsNavToggle() {
  const open = usePreference('projectsSidebarOpen');
  return (
    <Hint label={formatShortcut(PROJECTS_NAV_KEYS)} side="bottom">
      <button
        type="button"
        aria-label={open ? 'Hide projects sidebar' : 'Show projects sidebar'}
        aria-controls="projects-nav"
        aria-expanded={open}
        onClick={() => setPreference('projectsSidebarOpen', !open)}
        className="grid size-9 animate-in place-items-center rounded-full text-foreground/70 transition-colors duration-500 fade-in-0 outline-none hover:bg-white/10 hover:text-foreground focus-visible:ring-2 focus-visible:ring-white/60 motion-reduce:animate-none"
      >
        <PanelLeftIcon className="size-[18px]" strokeWidth={1.5} />
      </button>
    </Hint>
  );
}
