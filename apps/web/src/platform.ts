import type { Auth, Session } from '@skkil-time/auth';
import { onOpenTask } from '~/notifications';

import type {
  ConnectionStatus,
  Notifications,
  Platform,
  RemoteChange,
  SharedPreferences,
} from '@/platform';

const noop = () => () => undefined;

export type WebServices = {
  deleteAccount: () => Promise<void>;
  preferences: SharedPreferences;
  onRemoteChange: (listener: (change: RemoteChange) => void) => () => void;
  notifications: Notifications | null;
  onConnectionChange: (
    listener: (status: ConnectionStatus) => void,
  ) => () => void;
};

export function webPlatform(
  auth: Auth,
  session: Session,
  {
    deleteAccount,
    preferences,
    onRemoteChange,
    notifications,
    onConnectionChange,
  }: WebServices,
): Platform {
  return {
    onRemoteChange,
    onConnectionChange,
    preferences,
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
      label: session.email ?? session.name ?? 'Signed in',
      name: session.name,
      email: session.email,
      signInAgain: () => void auth.signIn(),
      signOut: () => void auth.signOut(),
      deleteAccount: async () => {
        await deleteAccount();
        await auth.signOut();
      },
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
