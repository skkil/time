import { createApi } from '@skkil-time/api';
import { describe, expect, it, vi } from 'vitest';

import { fetchGrant } from '@/core/sync/grant';
import { accountScope, subjectOf } from '@/core/sync/scope';

const jwt = (claims: object) =>
  `h.${btoa(JSON.stringify(claims)).replace(/=+$/, '')}.s`;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

function server(routes: Record<string, () => Response>) {
  const calls: { url: string; body: string | null; auth: string | null }[] = [];
  const fetch = vi.fn(async (request: Request) => {
    const url = new URL(request.url).pathname;
    calls.push({
      url,
      body: request.body ? await request.text() : null,
      auth: request.headers.get('Authorization'),
    });
    return routes[url]?.() ?? json({ title: 'missing' }, 404);
  });
  const api = createApi({
    baseUrl: 'https://time.test',
    getToken: async () => 'access',
    fetch: fetch as unknown as typeof globalThis.fetch,
  });
  return { api, calls };
}

const GRANT = {
  token: jwt({ sub: 'scope-from-token', exp: 1 }),
  expiresAt: 1,
  storeUrl: 'https://store.test',
  pushUrl: 'https://time.test',
};

describe('sync tokens and scopes', () => {
  it('reads the subject of a token', () => {
    expect(subjectOf(jwt({ sub: 'abc' }))).toBe('abc');
    expect(subjectOf('not a jwt')).toBeNull();
  });

  it('asks for a sync token with the bearer token and this client id', async () => {
    const { api, calls } = server({ '/api/v1/sync/token': () => json(GRANT) });
    await expect(fetchGrant(api, 'client-1')).resolves.toEqual(GRANT);
    expect(calls[0]).toEqual({
      url: '/api/v1/sync/token',
      body: JSON.stringify({ clientId: 'client-1' }),
      auth: 'Bearer access',
    });
  });

  it('refuses a grant without the store addresses', async () => {
    const { api } = server({
      '/api/v1/sync/token': () => json({ token: 't', expiresAt: 1 }),
    });
    await expect(fetchGrant(api, 'client-1')).rejects.toMatchObject({
      kind: 'invalid',
    });
  });

  it('prefers the scope the server reports', async () => {
    const { api, calls } = server({
      '/api/v1/me': () => json({ id: 1, timeZone: 'UTC', scopeId: 'scope-me' }),
    });
    await expect(accountScope(api, () => 'fresh')).resolves.toBe('scope-me');
    expect(calls).toHaveLength(1);
  });

  it('falls back to the subject of a token for a fresh client id', async () => {
    const { api, calls } = server({
      '/api/v1/me': () => json({ id: 1, timeZone: 'UTC' }),
      '/api/v1/sync/token': () => json(GRANT),
    });
    await expect(accountScope(api, () => 'fresh')).resolves.toBe(
      'scope-from-token',
    );
    expect(calls[1].body).toBe(JSON.stringify({ clientId: 'fresh' }));
  });
});
