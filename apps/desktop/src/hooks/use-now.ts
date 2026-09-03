import { useEffect, useState } from 'react';

import { nowSeconds } from '@/lib/time';

export function useNow(intervalMs = 1000, enabled = true) {
  const [now, setNow] = useState(nowSeconds);

  useEffect(() => {
    if (!enabled) return;
    const tick = () => setNow(nowSeconds());
    const first = window.setTimeout(tick, 0);
    const id = window.setInterval(tick, intervalMs);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(id);
    };
  }, [intervalMs, enabled]);

  return now;
}
