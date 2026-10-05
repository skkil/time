import type { Id } from '@/backend';

type Unsubscribe = () => void;

export type Account = {
  label: string;
  signOut(): void;
  deleteAccount(): Promise<void>;
};

export type SharedPreferences = {
  load(): Promise<Record<string, unknown>>;
  save(changes: Record<string, unknown>): Promise<void>;
};

export type RemoteChange = { topic: string };

/** Push delivery to this device, for platforms where reminders arrive as push. */
export type Notifications = {
  isEnabled(): Promise<boolean>;
  /** Resolves false when the user refuses notification permission. */
  enable(): Promise<boolean>;
  disable(): Promise<void>;
};

export interface Platform {
  kind: 'desktop' | 'web';
  openUrl(url: string): void;
  onFocusChange(listener: (focused: boolean) => void): Unsubscribe;
  setZoom(zoom: number): void;
  onOpenTask(listener: (id: Id) => void): Unsubscribe;
  onQuickAdd(listener: () => void): Unsubscribe;
  account: Account | null;
  /** Pushes other devices' writes as they happen; without it the app polls. */
  onRemoteChange?(listener: (change: RemoteChange) => void): Unsubscribe;
  /** Account-wide preferences; without it every preference stays on this device. */
  preferences?: SharedPreferences;
  notifications?: Notifications;
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
