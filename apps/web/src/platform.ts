import type { Auth, Session } from '@skkil-time/auth';

import type { Platform, RemoteChange, SharedPreferences } from '@/platform';

const noop = () => () => undefined;

export type WebServices = {
  deleteAccount: () => Promise<void>;
  preferences: SharedPreferences;
  onRemoteChange: (listener: (change: RemoteChange) => void) => () => void;
};

export function webPlatform(
  auth: Auth,
  session: Session,
  { deleteAccount, preferences, onRemoteChange }: WebServices,
): Platform {
  return {
    onRemoteChange,
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
    onOpenTask: noop,
    onQuickAdd: noop,
    account: {
      label: session.email ?? session.name ?? 'Signed in',
      signOut: () => void auth.signOut(),
      deleteAccount: async () => {
        await deleteAccount();
        await auth.signOut();
      },
    },
    features: {
      captureHotkey: false,
      reminders: false,
      activityTracking: false,
      databaseFile: false,
    },
  };
}
