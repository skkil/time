import type { Id } from '@/backend';
import type { Calendars } from '@/platform/calendars';
import type { Sync } from '@/platform/sync';

export type * from '@/platform/calendars';
export type * from '@/platform/sync';

type Unsubscribe = () => void;

export type Account = {
  label: string;
  name: string | null;
  email: string | null;
  signInAgain(): void;
  signOut(): void;
  deleteAccount(): Promise<void>;
};

export type SharedPreferences = {
  load(): Promise<Record<string, unknown>>;
  save(changes: Record<string, unknown>): Promise<void>;
};

export type RemoteChange = { topic: string };

/** `unreachable`: the browser is online but the server can't be reached. */
export type ConnectionStatus =
  'online' | 'offline' | 'unreachable' | 'signedOut';

/** Push delivery to this device, for platforms where reminders arrive as push. */
export type Notifications = {
  isEnabled(): Promise<boolean>;
  /** Resolves false when the user refuses notification permission. */
  enable(): Promise<boolean>;
  disable(): Promise<void>;
};

export interface Tray {
  keepOnClose(): Promise<boolean>;
  setKeepOnClose(keep: boolean): Promise<void>;
}

export interface Platform {
  kind: 'desktop' | 'web';
  openUrl(url: string): void;
  onFocusChange(listener: (focused: boolean) => void): Unsubscribe;
  setZoom(zoom: number): void;
  onOpenTask(listener: (id: Id) => void): Unsubscribe;
  onQuickAdd(listener: () => void): Unsubscribe;
  onOpenEarlier?(listener: () => void): Unsubscribe;
  account: Account | null;
  /** Pushes other devices' writes as they happen; without it the app polls. */
  onRemoteChange?(listener: (change: RemoteChange) => void): Unsubscribe;
  /** Reports lost connections and ended sessions; desktop never loses either. */
  onConnectionChange?(
    listener: (status: ConnectionStatus) => void,
  ): Unsubscribe;
  /** Account-wide preferences; without it every preference stays on this device. */
  preferences?: SharedPreferences;
  notifications?: Notifications;
  /** Sign-in and background sync for a local-first device. */
  sync?: Sync;
  /** Calendars connected to the account, such as Google Calendar. */
  calendars?: Calendars;
  /** Whether closing the window leaves the app running in the tray. */
  tray?: Tray;
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

export function installedPlatform(): Platform | null {
  return installed;
}

export function platform(): Platform {
  if (!installed) throw new Error('No platform installed');
  return installed;
}
