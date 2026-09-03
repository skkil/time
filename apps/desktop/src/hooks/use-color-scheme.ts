import { useSyncExternalStore } from 'react';

const query = window.matchMedia('(prefers-color-scheme: dark)');

function subscribe(onChange: () => void) {
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
}

export function useColorScheme(): 'light' | 'dark' {
  return useSyncExternalStore(subscribe, () =>
    query.matches ? 'dark' : 'light',
  );
}

export function syncColorScheme() {
  const apply = () =>
    document.documentElement.classList.toggle('dark', query.matches);
  apply();
  return subscribe(apply);
}
