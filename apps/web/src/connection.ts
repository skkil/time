import type { RealtimeStatus } from '@skkil-time/api/realtime';

import type { ConnectionStatus } from '@/platform';

const UNREACHABLE_AFTER_MS = 5_000;

/** Folds the browser's network state, the live connection and the session into one status. */
export function createConnection() {
  const listeners = new Set<(status: ConnectionStatus) => void>();
  let online = navigator.onLine;
  let socketDown = false;
  let signedOut = false;
  let timer: number | undefined;
  let current: ConnectionStatus = 'online';

  const publish = () => {
    const next: ConnectionStatus = signedOut
      ? 'signedOut'
      : !online
        ? 'offline'
        : socketDown
          ? 'unreachable'
          : 'online';
    if (next === current) return;
    current = next;
    listeners.forEach((listener) => listener(next));
  };

  window.addEventListener('online', () => {
    online = true;
    publish();
  });
  window.addEventListener('offline', () => {
    online = false;
    publish();
  });

  return {
    realtime(status: RealtimeStatus) {
      if (status === 'open') {
        window.clearTimeout(timer);
        timer = undefined;
        socketDown = false;
        return publish();
      }
      if (status === 'closed' && timer === undefined)
        timer = window.setTimeout(() => {
          socketDown = true;
          publish();
        }, UNREACHABLE_AFTER_MS);
    },
    signedOut() {
      signedOut = true;
      publish();
    },
    subscribe(listener: (status: ConnectionStatus) => void) {
      listeners.add(listener);
      listener(current);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
