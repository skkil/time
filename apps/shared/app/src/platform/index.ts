import type { Id } from '@/backend';

type Unsubscribe = () => void;

export interface Platform {
  kind: 'desktop' | 'web';
  openUrl(url: string): void;
  onFocusChange(listener: (focused: boolean) => void): Unsubscribe;
  setZoom(zoom: number): void;
  onOpenTask(listener: (id: Id) => void): Unsubscribe;
  onQuickAdd(listener: () => void): Unsubscribe;
  features: {
    captureHotkey: boolean;
    reminders: boolean;
    activityTracking: boolean;
    databaseFile: boolean;
  };
}

let installed: Platform | null = null;

export function installPlatform(next: Platform) {
  installed = next;
}

export function platform(): Platform {
  if (!installed) throw new Error('No platform installed');
  return installed;
}
