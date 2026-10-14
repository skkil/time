import { connectRealtime } from '@skkil-time/api/realtime';
import { useEffect } from 'react';
import { AppState } from 'react-native';

import { api, host } from '@/core/api/client';
import { queryClient } from '@/core/api/query-client';
import { config } from '@/core/config';
import { reportRealtime } from '@/core/realtime/connection-status';

const BURST_MS = 150;

/** While signed in, keeps a live connection and refetches as soon as another device writes. */
export function useRealtime(signedIn: boolean) {
  useEffect(() => {
    if (!signedIn) return;
    let burst: ReturnType<typeof setTimeout> | undefined;
    const refetch = () => {
      clearTimeout(burst);
      burst = setTimeout(() => void queryClient.invalidateQueries(), BURST_MS);
    };
    const realtime = connectRealtime({
      api,
      baseUrl: config.apiUrl,
      clientId: host.clientId,
      onChange: refetch,
      onReconnect: refetch,
      onStatus: reportRealtime,
    });
    const foreground = AppState.addEventListener('change', (status) => {
      if (status === 'active') realtime.resume();
    });
    return () => {
      clearTimeout(burst);
      foreground.remove();
      realtime.close();
    };
  }, [signedIn]);
}
