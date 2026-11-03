import { createSyncAccount, syncTokens } from '#account';
import { SyncApiError } from '#errors';
import { tokenSubject } from '#token';
import { describe, expect, it, vi } from 'vitest';

const SCOPE = '0195f7a0-0000-7000-8000-000000000001';

const jwt = (claims: object) =>
  ['e30', btoa(JSON.stringify(claims)).replace(/=+$/, ''), 'sig'].join('.');

const grantBody = (sub = SCOPE) => ({
  token: jwt({ sub }),
  expiresAt: 1_800_000_000,
  storeUrl: 'http://store.test',
  pushUrl: 'http://api.test',
});

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

function account(fetch: typeof globalThis.fetch, token: string | null = 'a') {
  return createSyncAccount({
    apiUrl: 'http://api.test/',
    getAccessToken: async () => token,
    fetch,
    newClientId: () => 'fresh-client',
  });
}

describe('createSyncAccount', () => {
  it('asks for a sync token with the bearer token and reports expiry in milliseconds', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(async () => json(grantBody()));
    const grant = await account(fetch).grant('client-1');
    expect(grant.expiresAt).toBe(1_800_000_000_000);
    expect(grant.storeUrl).toBe('http://store.test');
    const [url, init] = fetch.mock.calls[0]!;
    expect(url).toBe('http://api.test/api/v1/sync/token');
    expect(init?.method).toBe('POST');
    expect(init?.headers).toMatchObject({ Authorization: 'Bearer a' });
    expect(JSON.parse(String(init?.body))).toEqual({ clientId: 'client-1' });
  });

  it('takes the scope from /me when the server reports it', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(async () =>
      json({ scopeId: SCOPE }),
    );
    await expect(account(fetch).scope()).resolves.toBe(SCOPE);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('falls back to the sub of a token for a fresh client id', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(async (url) =>
      String(url).endsWith('/me') ? json({ id: 1 }) : json(grantBody()),
    );
    await expect(account(fetch).scope()).resolves.toBe(SCOPE);
    expect(JSON.parse(String(fetch.mock.calls[1]![1]?.body))).toEqual({
      clientId: 'fresh-client',
    });
  });

  it('maps refusals and failures to kinds', async () => {
    const refused = account(async () => json({}, 401));
    await expect(refused.grant('c')).rejects.toMatchObject({
      kind: 'unauthorized',
    });
    const taken = account(async () => json({}, 409));
    await expect(taken.grant('c')).rejects.toMatchObject({ kind: 'conflict' });
    const down = account(async () => {
      throw new TypeError('Failed to fetch');
    });
    await expect(down.grant('c')).rejects.toBeInstanceOf(SyncApiError);
    await expect(down.grant('c')).rejects.toMatchObject({
      kind: 'unavailable',
    });
    const signedOut = account(async () => json({}), null);
    await expect(signedOut.pushHeaders()).rejects.toMatchObject({
      kind: 'unauthorized',
    });
  });
});

describe('syncTokens', () => {
  it('hands out the first grant once, then fetches new ones', async () => {
    const grant = vi.fn(async () => ({ ...grantBody(), expiresAt: 2 }));
    const source = syncTokens(
      { grant, scope: vi.fn(), pushHeaders: vi.fn() },
      'client-1',
      { ...grantBody(), expiresAt: 1 },
    );
    await expect(source()).resolves.toMatchObject({ expiresAt: 1 });
    await expect(source()).resolves.toMatchObject({ expiresAt: 2 });
    expect(grant).toHaveBeenCalledWith('client-1');
  });
});

describe('tokenSubject', () => {
  it('reads the sub claim, or null when there is none', () => {
    expect(tokenSubject(jwt({ sub: SCOPE }))).toBe(SCOPE);
    expect(tokenSubject(jwt({}))).toBeNull();
    expect(tokenSubject('not-a-jwt')).toBeNull();
  });
});
