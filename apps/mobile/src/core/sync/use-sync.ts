import NetInfo from '@react-native-community/netinfo';
import { useEffect, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';

import { type SyncView } from '@/core/sync/controller';
import { sync } from '@/core/sync/sync';

/**
 * While signed in, keeps the replica syncing: from the start, again when
 * the app comes to the foreground or the network returns, paused in the
 * background.
 */
export function useSync(signedIn: boolean) {
  useEffect(() => {
    if (!signedIn) return;
    void sync.start();
    const foreground = AppState.addEventListener('change', (status) => {
      if (status === 'active') void sync.start();
      if (status === 'background') void sync.pause();
    });
    let connected: boolean | null = null;
    const network = NetInfo.addEventListener(({ isConnected }) => {
      if (isConnected && connected === false)
        void sync.pause().then(sync.start);
      connected = isConnected;
    });
    return () => {
      foreground.remove();
      network();
      void sync.stop();
    };
  }, [signedIn]);
}

export const useSyncView = (): SyncView =>
  useSyncExternalStore(sync.subscribe, sync.view);
