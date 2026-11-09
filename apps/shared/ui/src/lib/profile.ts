import { usePreference } from '@/lib/preferences';
import { platform } from '@/platform';

/** The name to greet the user by: the one they chose, else the one their account carries. */
export function useDisplayName(): string {
  const chosen = usePreference('profileName').trim();
  return chosen || platform().account?.name?.trim() || '';
}

export function initialOf(name: string, email: string | null = null): string {
  return (name || email || '').trim().charAt(0).toUpperCase();
}
