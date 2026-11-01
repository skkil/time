import type { Binding, NativeCore, SyncState } from '@skkil-time/core-native';
import type {
  SyncDriver,
  SyncDriverOptions,
  SyncTokenGrant,
} from '@skkil/store-client';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  type SyncControllerOptions,
  createSyncController,
} from '@/core/sync/controller';
import type { SyncGrant } from '@/core/sync/grant';

const SCOPE = 'scope-a';

function fakeCore(binding: Binding = { kind: 'uploading', rows: 0 }) {
  const state: SyncState = {
    clientId: 'client-1',
    scopeId: null,
    pending: 2,
    issues: 0,
    cursorVersion: 0n,
    lastPullAt: 1_000,
  };
  return {
    engine: { mutate: vi.fn(), query: vi.fn() },
    handle: {
      pushRequest: vi.fn(),
      applyPushResponse: vi.fn(),
      pullRequest: vi.fn(),
      applyPullResponse: vi.fn(),
      status: vi.fn(),
    },
    state: vi.fn(() => state),
    bindScope: vi.fn(async () => binding),
    keepLocal: vi.fn(async () => 3),
    startFresh: vi.fn(async () => undefined),
    forget: vi.fn(async () => undefined),
    issues: vi.fn(() => []),
    dismissIssue: vi.fn(() => true),
  } satisfies NativeCore;
}

const grant = (token: string): SyncGrant => ({
  token,
  expiresAt: 2_000,
  storeUrl: 'https://store.test',
  pushUrl: 'https://time.test',
});

function setup(core = fakeCore()) {
  const drivers: { options: SyncDriverOptions; driver: SyncDriver }[] = [];
  const options = {
    core: vi.fn(async () => core),
    scope: vi.fn(async () => SCOPE),
    grant: vi
      .fn<(clientId: string) => Promise<SyncGrant>>()
      .mockResolvedValueOnce(grant('first'))
      .mockResolvedValue(grant('next')),
    pushHeaders: vi.fn(async () => ({ Authorization: 'Bearer access' })),
    createDriver: vi.fn((driverOptions: SyncDriverOptions) => {
      const driver: SyncDriver = {
        syncNow: vi.fn(async () => undefined),
        stop: vi.fn(async () => undefined),
        status: vi.fn(),
      };
      drivers.push({ options: driverOptions, driver });
      return driver;
    }),
    onChange: vi.fn(),
    pushDelayMs: 10,
  } satisfies SyncControllerOptions;
  return { core, options, drivers, sync: createSyncController(options) };
}

afterEach(() => {
  vi.useRealTimers();
});

describe('createSyncController', () => {
  it('binds the replica, then drives store with the first grant', async () => {
    const { core, options, drivers, sync } = setup();
    await sync.start();

    expect(core.bindScope).toHaveBeenCalledWith(SCOPE);
    expect(options.grant).toHaveBeenCalledWith('client-1');
    expect(drivers).toHaveLength(1);
    const driver = drivers[0].options;
    expect(driver.core).toBe(core.handle);
    expect(driver.storeUrl).toBe('https://store.test');
    expect(driver.pushUrl).toBe('https://time.test');
    expect(driver.getPushHeaders).toBe(options.pushHeaders);

    await expect(driver.getSyncToken()).resolves.toEqual<SyncTokenGrant>({
      token: 'first',
      expiresAt: 2_000_000,
    });
    await expect(driver.getSyncToken()).resolves.toEqual<SyncTokenGrant>({
      token: 'next',
      expiresAt: 2_000_000,
    });
    expect(options.grant).toHaveBeenCalledTimes(2);
  });

  it('reports what the driver and the replica say', async () => {
    const { options, drivers, sync } = setup();
    const heard = vi.fn();
    sync.subscribe(heard);
    await sync.start();
    expect(sync.view().phase).toBe('connecting');

    drivers[0].options.onStatus?.({
      online: true,
      pending: 0,
      issues: 0,
      lastSyncedAt: 5,
    });
    await vi.waitFor(() => expect(sync.view().phase).toBe('online'));
    expect(sync.view()).toMatchObject({ pending: 2, lastSyncedAt: 1_000 });
    expect(heard).toHaveBeenCalled();

    drivers[0].options.onChange?.(['task']);
    expect(options.onChange).toHaveBeenCalledWith(['task']);
  });

  it('stays local while the server is out of reach and retries on Sync now', async () => {
    const { options, drivers, sync } = setup();
    options.scope.mockRejectedValueOnce({
      kind: 'network',
      message: 'Network request failed',
    });
    await sync.start();
    expect(drivers).toHaveLength(0);
    expect(sync.view()).toMatchObject({
      phase: 'offline',
      error: 'Network request failed',
    });

    await sync.syncNow();
    expect(drivers).toHaveLength(1);
  });

  it('waits for a choice when the replica belongs to another account', async () => {
    const core = fakeCore({ kind: 'otherAccount', bound: 'scope-b' });
    const { options, drivers, sync } = setup(core);
    await sync.start();
    expect(sync.view().phase).toBe('needsChoice');
    expect(drivers).toHaveLength(0);

    await sync.start();
    expect(drivers).toHaveLength(0);

    await sync.choose('startFresh');
    expect(core.startFresh).toHaveBeenCalledWith(SCOPE);
    expect(options.onChange).toHaveBeenCalledWith(['*']);
    expect(drivers).toHaveLength(1);
  });

  it('pushes a burst of local writes once', async () => {
    vi.useFakeTimers();
    const { drivers, sync } = setup();
    await sync.start();
    sync.wrote();
    sync.wrote();
    await vi.advanceTimersByTimeAsync(20);
    expect(drivers[0].driver.syncNow).toHaveBeenCalledTimes(1);
  });

  it('keeps the account check across a pause but not across a stop', async () => {
    const { core, drivers, sync } = setup();
    await sync.start();
    await sync.pause();
    expect(drivers[0].driver.stop).toHaveBeenCalled();
    await sync.start();
    expect(core.bindScope).toHaveBeenCalledTimes(1);

    await sync.stop();
    await sync.start();
    expect(core.bindScope).toHaveBeenCalledTimes(2);
    expect(drivers).toHaveLength(3);
  });

  it('forgets the replica on sign-out', async () => {
    const { core, options, drivers, sync } = setup();
    await sync.start();
    await sync.forget();
    expect(drivers[0].driver.stop).toHaveBeenCalled();
    expect(core.forget).toHaveBeenCalled();
    expect(options.onChange).toHaveBeenCalledWith(['*']);
    expect(sync.view().phase).toBe('off');
  });
});
