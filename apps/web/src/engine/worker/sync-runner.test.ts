import { type SyncAccount, SyncApiError } from '@skkil-time/sync';
import type { SyncDriverOptions } from '@skkil/store-client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SyncState } from '~/engine/protocol';
import { SyncRunner } from '~/engine/worker/sync-runner';
import { fakeCore } from '~/engine/worker/test-core';

const GRANT = {
  token: 'sync-token',
  expiresAt: 1_800_000_000_000,
  storeUrl: 'http://store.test',
  pushUrl: 'http://api.test',
};

function setUp(account: Partial<SyncAccount> = {}, scope: string | null = 's') {
  const { core, status } = fakeCore(scope);
  const states: SyncState[] = [];
  const drivers: SyncDriverOptions[] = [];
  const driver = {
    syncNow: vi.fn(async () => undefined),
    stop: vi.fn(async () => undefined),
    status: vi.fn(),
  };
  const runner = new SyncRunner({
    core,
    account: {
      grant: vi.fn(async () => GRANT),
      scope: vi.fn(),
      pushHeaders: vi.fn(async () => ({ Authorization: 'Bearer a' })),
      ...account,
    },
    report: (state) => states.push(state),
    onChange: vi.fn(),
    createDriver: (options) => {
      drivers.push(options);
      return driver;
    },
    retry: { baseMs: 1_000, maxMs: 4_000 },
    writeDelayMs: 500,
  });
  return { runner, core, status, states, drivers, driver };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('SyncRunner', () => {
  it('starts store’s driver with the servers named by the first sync token', async () => {
    const { runner, drivers } = setUp();
    runner.start();
    await vi.waitFor(() => expect(drivers).toHaveLength(1));
    const options = drivers[0]!;
    expect(options.storeUrl).toBe('http://store.test');
    expect(options.pushUrl).toBe('http://api.test');
    await expect(options.getSyncToken()).resolves.toEqual({
      token: 'sync-token',
      expiresAt: GRANT.expiresAt,
    });
    await expect(options.getPushHeaders?.()).resolves.toEqual({
      Authorization: 'Bearer a',
    });
    expect(runner.state().running).toBe(true);
  });

  it('does nothing until the database belongs to an account', () => {
    const { runner, drivers } = setUp({}, null);
    runner.start();
    expect(drivers).toHaveLength(0);
  });

  it('retries with backoff while the server can’t be reached, and at once on demand', async () => {
    const grant = vi
      .fn<SyncAccount['grant']>()
      .mockRejectedValueOnce(new SyncApiError('unavailable', 'down'))
      .mockRejectedValueOnce(new SyncApiError('unavailable', 'down'))
      .mockResolvedValue(GRANT);
    const { runner, drivers, states } = setUp({ grant });
    runner.start();
    await vi.waitFor(() => expect(grant).toHaveBeenCalledTimes(1));
    expect(states.at(-1)).toMatchObject({ online: false, error: 'down' });
    await vi.advanceTimersByTimeAsync(1_000);
    expect(grant).toHaveBeenCalledTimes(2);
    runner.now();
    await vi.waitFor(() => expect(drivers).toHaveLength(1));
  });

  it('stops asking once the sign-in is refused', async () => {
    const grant = vi.fn(async () => {
      throw new SyncApiError('unauthorized', 'Sign in again.');
    });
    const { runner, states } = setUp({ grant });
    runner.start();
    await vi.waitFor(() =>
      expect(states.at(-1)).toMatchObject({ unauthorized: true }),
    );
    await vi.advanceTimersByTimeAsync(10_000);
    expect(grant).toHaveBeenCalledTimes(1);
  });

  it('treats the driver’s unauthenticated errors as a refused sign-in', async () => {
    const { runner, drivers, states } = setUp();
    runner.start();
    await vi.waitFor(() => expect(drivers).toHaveLength(1));
    drivers[0]!.onError?.({ code: 16, message: 'unauthenticated' });
    expect(states.at(-1)).toMatchObject({ unauthorized: true });
    drivers[0]!.onStatus?.({
      online: true,
      pending: 0,
      issues: 0,
      lastSyncedAt: 1,
    });
    expect(states.at(-1)).toMatchObject({ unauthorized: false, online: true });
  });

  it('syncs shortly after a burst of local writes', async () => {
    const { runner, drivers, driver, status, states } = setUp();
    runner.start();
    await vi.waitFor(() => expect(drivers).toHaveLength(1));
    status.pending = 2;
    runner.wrote();
    runner.wrote();
    expect(states.at(-1)).toMatchObject({ pending: 2 });
    expect(driver.syncNow).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(500);
    expect(driver.syncNow).toHaveBeenCalledTimes(1);
  });

  it('starts over when the browser comes back online after losing the servers', async () => {
    const { runner, drivers, driver } = setUp();
    runner.start();
    await vi.waitFor(() => expect(drivers).toHaveLength(1));
    await runner.connectivity(false);
    expect(runner.state().online).toBe(false);
    await runner.connectivity(true);
    expect(driver.stop).toHaveBeenCalledTimes(1);
    await vi.waitFor(() => expect(drivers).toHaveLength(2));
  });

  it('hands store a core with null pushes and a bigint cursor', async () => {
    const { runner, drivers } = setUp();
    runner.start();
    await vi.waitFor(() => expect(drivers).toHaveLength(1));
    const handle = drivers[0]!.core;
    expect(handle.pushRequest(10)).toBeNull();
    expect(handle.status().cursorVersion).toBe(7n);
  });
});
