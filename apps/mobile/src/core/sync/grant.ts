import { type Api, type ApiError, unwrap } from '@skkil-time/api';

/**
 * The server's answer to `POST /api/v1/sync/token`: a store token for Pull
 * and Pokes (expiring at `expiresAt`, Unix seconds) and where the store
 * service and the server's Push endpoint live.
 */
export type SyncGrant = {
  token: string;
  expiresAt: number;
  storeUrl: string;
  pushUrl: string;
};

const isGrant = (value: unknown): value is SyncGrant =>
  typeof value === 'object' &&
  value !== null &&
  'token' in value &&
  'storeUrl' in value &&
  'pushUrl' in value &&
  typeof value.token === 'string' &&
  typeof value.storeUrl === 'string' &&
  typeof value.pushUrl === 'string';

/** A sync token for `clientId`, which the server claims for the caller's account on first use. */
export async function fetchGrant(
  api: Api,
  clientId: string,
): Promise<SyncGrant> {
  const grant: unknown = await unwrap(
    api.POST('/api/v1/sync/token', { body: { clientId } }),
  );
  if (!isGrant(grant))
    throw {
      kind: 'invalid',
      message: 'The server sent an incomplete sync token.',
    } satisfies ApiError;
  return grant;
}
