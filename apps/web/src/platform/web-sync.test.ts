import { type SyncAccount, SyncApiError } from '@skkil-time/client/sync';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { EngineClient } from '~/engine/client';
import type { EngineEvent, SyncState } from '~/engine/protocol';
import { createWebSync } from '~/platform/web-sync';

const PROFILE = { subject: 'u1', email: 'ada@example.com', name: 'Ada' };
const RUNNING: SyncState = {
  running: true,
  online: true,
  pending: 0,
  issues: 0,
  lastSyncedAt: 5,
  error: null,
  unauthorized: false,
};

beforeEach(() => {
  vi.stubGlobal('window', new EventTarget());
  vi.stubGlobal(
    'document',
    Object.assign(new EventTarget(), { hidden: false }),
  );
});

function setUp({
  bound = null as string | null,
  signIn = { kind: 'synced' } as unknown,
  scope = vi.fn<SyncAccount['scope']>(async () => 'scope-1'),
  session = PROFILE as typeof PROFILE | null,
} = {}) {
  let listener: (event: EngineEvent) => void = () => undefined;
  const call = vi.fn(async (method: string) => {
    switch (method) {
      case 'status':
        return { scopeId: bound };
      case 'bindScope':
        return signIn;
      case 'syncState':
        return RUNNING;
      default:
        return undefined;
    }
  });
  const engine = {
    call,
    onEvent: (next: (event: EngineEvent) => void) => {
      listener = next;
      return () => undefined;
    },
  } as unknown as EngineClient;
  const web = createWebSync({
    engine,
    account: { scope, grant: vi.fn(), pushHeaders: vi.fn() },
    session,
    profile: PROFILE,
    signIn: vi.fn(),
    signOut: vi.fn(async () => undefined),
    online: () => true,
  });
  return { web, call, emit: (event: EngineEvent) => listener(event) };
}

describe('createWebSync', () => {
  it('binds the engine to the account and starts syncing', async () => {
    const { web, call } = setUp();
    await web.bind();
    expect(call).toHaveBeenCalledWith('bindScope', 'scope-1');
    expect(call).toHaveBeenCalledWith('startSync');
    await expect(web.sync.status()).resolves.toMatchObject({
      phase: 'idle',
      account: { name: 'Ada', email: 'ada@example.com' },
      lastSyncedAt: 5,
    });
  });

  it('asks before touching another account’s data, then does what was chosen', async () => {
    const { web, call } = setUp({
      signIn: { kind: 'otherAccount', bound: 'scope-0' },
    });
    await web.bind();
    expect(call).not.toHaveBeenCalledWith('startSync');
    await expect(web.sync.status()).resolves.toMatchObject({
      phase: 'needsChoice',
    });
    await web.sync.chooseAccountData('startFresh');
    expect(call).toHaveBeenCalledWith('startFresh', 'scope-1');
    expect(call).toHaveBeenCalledWith('startSync');
  });

  it('offline, a database that already belongs to an account syncs once it can', async () => {
    const scope = vi.fn(async () => {
      throw new SyncApiError('unavailable', 'offline');
    });
    const { web, call } = setUp({ bound: 'scope-1', scope });
    await web.bind();
    expect(call).not.toHaveBeenCalledWith('bindScope', expect.anything());
    expect(call).toHaveBeenCalledWith('startSync');
  });

  it('a refused or expired sign-in shows as sign in again', async () => {
    const scope = vi.fn(async () => {
      throw new SyncApiError('unauthorized', 'expired');
    });
    const { web } = setUp({ scope });
    await web.bind();
    const statuses: string[] = [];
    web.onConnectionChange((status) => statuses.push(status));
    expect(statuses).toEqual(['signedOut']);
    const expired = setUp({ session: null });
    await expect(expired.web.sync.status()).resolves.toMatchObject({
      phase: 'needsSignIn',
    });
  });

  it('follows what the owning tab reports', async () => {
    const { web, emit } = setUp();
    const phases: string[] = [];
    web.sync.onStatus((status) => phases.push(status.phase));
    emit({ kind: 'sync', state: { ...RUNNING, online: false } });
    emit({ kind: 'sync', state: { ...RUNNING, unauthorized: true } });
    expect(phases).toEqual(['offline', 'needsSignIn']);
  });
});
