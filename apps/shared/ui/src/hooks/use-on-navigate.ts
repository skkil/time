import { useRouter } from '@tanstack/react-router';
import { useEffect, useEffectEvent } from 'react';

export function useOnNavigate(run: () => void) {
  const router = useRouter();
  const onNavigate = useEffectEvent(run);

  useEffect(
    () => router.subscribe('onBeforeNavigate', () => onNavigate()),
    [router],
  );
}
