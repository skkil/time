import { type Api, type ApiError, unwrap } from '@skkil-time/api';

import { fetchGrant } from '@/core/sync/grant';

/** The `sub` claim of a JWT, without checking its signature. */
export function subjectOf(jwt: string): string | null {
  const payload = jwt.split('.')[1];
  if (!payload) return null;
  try {
    const claims = JSON.parse(
      atob(payload.replace(/-/g, '+').replace(/_/g, '/')),
    ) as { sub?: unknown };
    return typeof claims.sub === 'string' ? claims.sub : null;
  } catch {
    return null;
  }
}

const scopeIdOf = (me: unknown): string | null =>
  typeof me === 'object' &&
  me !== null &&
  'scopeId' in me &&
  typeof me.scopeId === 'string'
    ? me.scopeId
    : null;

/**
 * The store scope of the signed-in account: `scopeId` from `/api/v1/me`
 * when the server reports it, else the `sub` of a sync token issued for a
 * fresh client id (a phone bound to another account can't use its own).
 */
export async function accountScope(
  api: Api,
  freshClientId: () => string,
): Promise<string> {
  const me: unknown = await unwrap(api.GET('/api/v1/me')).catch(() => null);
  const reported = scopeIdOf(me);
  if (reported) return reported;
  const scope = subjectOf((await fetchGrant(api, freshClientId())).token);
  if (!scope)
    throw {
      kind: 'invalid',
      message: 'The sync token names no account.',
    } satisfies ApiError;
  return scope;
}
