import type { EngineClient } from '~/engine/client';

import type { RemoteChange } from '@/platform';

type Subscribe = (listener: (change: RemoteChange) => void) => () => void;

/**
 * Changes the app should refetch for: rows another tab wrote or a pull brought (`sync`), and account
 * preferences, which still live on the server and arrive over its realtime socket.
 */
export function localChanges(
  engine: EngineClient,
  serverChanges?: Subscribe,
): Subscribe {
  return (listener) => {
    const stopEngine = engine.onEvent((event) => {
      if (event.kind === 'changed') listener({ topic: 'sync' });
    });
    const stopServer = serverChanges?.((change) => {
      if (change.topic === 'preferences') listener(change);
    });
    return () => {
      stopEngine();
      stopServer?.();
    };
  };
}
