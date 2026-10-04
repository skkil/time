import type { Auth, Session } from '@skkil-time/auth';
import { onOpenTask } from '~/notifications';

import type { Notifications, Platform } from '@/platform';

const noop = () => () => undefined;

export function webPlatform(
  auth: Auth,
  session: Session,
  deleteAccount: () => Promise<void>,
  notifications: Notifications | null,
): Platform {
  return {
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
