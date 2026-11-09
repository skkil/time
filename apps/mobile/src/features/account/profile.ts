import { unwrap } from '@skkil-time/client/server';
import { useQuery } from '@tanstack/react-query';

import { api } from '@/core/api/client';
import { useSession } from '@/core/auth/session';

export const preferencesKey = ['preferences'];

/** The name chosen in Settings on any device, else the account's own name. */
export function useDisplayName(): string {
  const { session } = useSession();
  const { data } = useQuery({
    queryKey: preferencesKey,
    queryFn: () => unwrap(api.GET('/api/v1/preferences')),
    enabled: session !== null,
  });
  const chosen =
    typeof data?.profileName === 'string' ? data.profileName.trim() : '';
  return chosen || session?.name?.trim() || '';
}

export const initialOf = (name: string, email: string | null = null) =>
  (name || email || '').trim().charAt(0).toUpperCase();
