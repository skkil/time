import type { Api } from '@skkil-time/api';
import { connectRealtime } from '@skkil-time/api/realtime';
import type { RealtimeStatus } from '@skkil-time/api/realtime';

import type { RemoteChange } from '@/platform';

type LiveUpdatesOptions = {
  api: Api;
  baseUrl: string;
  clientId: string;
  onStatus: (status: RealtimeStatus) => void;
};

/** Other devices' writes as they happen, resumed when the tab or the network comes back. */
export function createLiveUpdates({
  api,
  baseUrl,
  clientId,
  onStatus,
}: LiveUpdatesOptions) {
  const listeners = new Set<(change: RemoteChange) => void>();
  const announce = (change: RemoteChange) =>
    listeners.forEach((listener) => listener(change));
  const realtime = connectRealtime({
    api,
    baseUrl,
    clientId,
    onChange: ({ topic }) => announce({ topic }),
    onReconnect: () => announce({ topic: 'reconnect' }),
    onStatus,
  });
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) realtime.resume();
  });
  window.addEventListener('online', () => realtime.resume());

  return (listener: (change: RemoteChange) => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  };
}
