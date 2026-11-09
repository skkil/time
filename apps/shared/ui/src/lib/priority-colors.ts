import { PRIORITIES } from '@/features/tasks/meta';
import {
  getPreference,
  setPreference,
  subscribePreferences,
} from '@/lib/preferences';

const property = (priority: number) => `--p${priority}`;

export function priorityColorValue(priority: number) {
  return getComputedStyle(document.documentElement)
    .getPropertyValue(property(priority))
    .trim();
}

export function setPriorityColor(priority: number, color: string | null) {
  const colors = { ...getPreference('priorityColors') };
  if (color) colors[priority] = color;
  else delete colors[priority];
  setPreference('priorityColors', colors);
}

export function syncPriorityColors() {
  const apply = () => {
    const colors = getPreference('priorityColors');
    for (const priority of PRIORITIES) {
      const color = colors[priority];
      if (color)
        document.documentElement.style.setProperty(property(priority), color);
      else document.documentElement.style.removeProperty(property(priority));
    }
  };
  apply();
  return subscribePreferences(apply);
}
