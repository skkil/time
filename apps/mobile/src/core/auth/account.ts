import { unwrap } from '@skkil-time/api';

import { api, auth } from '@/core/api/client';
import { queryClient } from '@/core/api/query-client';
import { sync } from '@/core/sync/sync';

/**
 * Signs out on purpose: syncing stops and this phone's copy of the
 * account is removed, changes not yet synced included. A sign-in that
 * expires on its own keeps the data for the next sign-in.
 */
export async function signOut() {
  await sync.forget();
  await auth.signOut();
  queryClient.clear();
}

export async function deleteAccount() {
  await unwrap(api.DELETE('/api/v1/me'));
  await signOut();
}
