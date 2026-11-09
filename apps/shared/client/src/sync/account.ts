import type {
  Me,
  SyncGrant as ServerGrant,
  SyncTokenRequest,
} from '#server/api';
import { SyncApiError, statusError } from '#sync/errors';

/** The server's answer to `POST /api/v1/sync/token`, with `expiresAt` in epoch milliseconds. */
export type SyncGrant = ServerGrant;

export type SyncAccountOptions = {
  /** The time server's base URL, without a trailing slash. */
  apiUrl: string;
  /** The signed-in account's access token, or null when signed out. */
  getAccessToken: () => Promise<string | null>;
  fetch?: typeof globalThis.fetch;
};

/** The signed-in account as store's sync driver needs it. */
export type SyncAccount = {
  /** A sync token for `clientId`, which the server claims for this account on first use. */
  grant(clientId: string): Promise<SyncGrant>;
  /** The account's store scope: `scopeId` from `/api/v1/me`. */
  scope(): Promise<string>;
  /** Headers for a push to the time server. */
  pushHeaders(): Promise<Record<string, string>>;
};

const unreachable = (error: unknown) =>
  new SyncApiError(
    'unavailable',
    `Couldn’t reach the server: ${error instanceof Error ? error.message : String(error)}`,
  );

export function createSyncAccount({
  apiUrl,
  getAccessToken,
  fetch = globalThis.fetch.bind(globalThis),
}: SyncAccountOptions): SyncAccount {
  const base = apiUrl.replace(/\/+$/, '');

  const authorization = async () => {
    const token = await getAccessToken();
    if (!token)
      throw new SyncApiError('unauthorized', 'Sign in to sync this device.');
    return { Authorization: `Bearer ${token}` };
  };

  const call = async (path: string, init: RequestInit = {}) => {
    const headers = { ...(await authorization()), ...init.headers };
    const response = await fetch(`${base}${path}`, { ...init, headers }).catch(
      (error: unknown) => {
        throw unreachable(error);
      },
    );
    if (!response.ok)
      throw statusError(response.status, await response.text().catch(() => ''));
    return response.json() as Promise<unknown>;
  };

  const grant = async (clientId: string): Promise<SyncGrant> => {
    const body: SyncTokenRequest = { clientId };
    const raw = (await call('/api/v1/sync/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })) as ServerGrant;
    return { ...raw, expiresAt: raw.expiresAt * 1000 };
  };

  return {
    grant,
    async scope() {
      const me = (await call('/api/v1/me')) as Me;
      return me.scopeId;
    },
    pushHeaders: authorization,
  };
}

/**
 * `getSyncToken` for store's driver: hands out `initial` (the grant the driver was built from) once,
 * then asks the server again whenever the driver needs a new token.
 */
export function syncTokens(
  account: SyncAccount,
  clientId: string,
  initial?: SyncGrant,
) {
  let first = initial;
  return async () => {
    const grant = first ?? (await account.grant(clientId));
    first = undefined;
    return { token: grant.token, expiresAt: grant.expiresAt };
  };
}
