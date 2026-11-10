import { useEffect } from 'react';
import { AppState } from 'react-native';

import { onWrite } from '@/core/local/writes';
import { widgets } from '@/core/widgets/widgets';

export function useWidgets(signedIn: boolean | null) {
  useEffect(() => {
    if (signedIn === null) return;
    widgets.signedIn(signedIn);
    if (!signedIn) return;
    const writes = onWrite(widgets.soon);
    const foreground = AppState.addEventListener('change', (status) => {
      if (status === 'active') widgets.soon();
      if (status === 'background') void widgets.flush();
    });
    return () => {
      writes();
      foreground.remove();
    };
  }, [signedIn]);
}
