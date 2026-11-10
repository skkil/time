import { useEffect } from 'react';
import { AppState } from 'react-native';

import { queryClient } from '@/core/api/query-client';
import { commands } from '@/core/local/backend';

async function logEnded() {
  try {
    if ((await commands.countEndedBlocks()) === 0) return;
    await commands.logEndedBlocks();
    await queryClient.invalidateQueries();
  } catch {
    return;
  }
}

/** Turns focus blocks that have ended into tracked time, on start and whenever the app comes back. */
export function useBlockLog(signedIn: boolean) {
  useEffect(() => {
    if (!signedIn) return;
    void logEnded();
    const foreground = AppState.addEventListener('change', (status) => {
      if (status === 'active') void logEnded();
    });
    return () => foreground.remove();
  }, [signedIn]);
}
