import type { Session } from '@skkil-time/client/sign-in';
import { onOpenTask } from '~/notifications/web-push';

import type {
  ConnectionStatus,
  Notifications,
  Platform,
  RemoteChange,
  SharedPreferences,
  Sync,
} from '@/platform';

const noop = () => () => undefined;

export type WebServices = {
  /** Who is signed in, or last signed in on this browser. */
  profile: Session;
  signIn(): void;
  signOut(): Promise<void>;
  deleteAccount(): Promise<void>;
  preferences: SharedPreferences;
  notifications: Notifications | null;
  onRemoteChange: (listener: (change: RemoteChange) => void) => () => void;
  onConnectionChange: (
    listener: (status: ConnectionStatus) => void,
  ) => () => void;
  sync?: Sync;
};

export function webPlatform({
  profile,
  signIn,
  signOut,
  deleteAccount,
  preferences,
  notifications,
  onRemoteChange,
  onConnectionChange,
  sync,
}: WebServices): Platform {
  return {
    onRemoteChange,
    onConnectionChange,
    preferences,
    sync,
    kind: 'web',
    openUrl: (url) => void window.open(url, '_blank', 'noopener,noreferrer'),
    onFocusChange(listener) {
      const focus = () => listener(true);
      const blur = () => listener(false);
      window.addEventListener('focus', focus);
      window.addEventListener('blur', blur);
      return () => {
        window.removeEventListener('focus', focus);
        window.removeEventListener('blur', blur);
      };
    },
    setZoom: (zoom) => {
      document.documentElement.style.zoom = zoom === 1 ? '' : String(zoom);
    },
    onOpenTask,
    onQuickAdd: noop,
    account: {
      label: profile.email ?? profile.name ?? 'Signed in',
      name: profile.name,
      email: profile.email,
      signInAgain: signIn,
      signOut: () => void signOut(),
      deleteAccount,
    },
    notifications: notifications ?? undefined,
    features: {
      captureHotkey: false,
      reminders: notifications !== null,
      activityTracking: false,
      databaseFile: false,
    },
  };
}
