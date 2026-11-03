import { describe, expect, it, vi } from 'vitest';
import { createEngineHost } from '~/engine/worker/engine-host';
import type { SyncRunner } from '~/engine/worker/sync-runner';
import { fakeCore } from '~/engine/worker/test-core';

function setUp() {
  const { core } = fakeCore();
  const runner = {
    start: vi.fn(),
    stop: vi.fn(async () => undefined),
    now: vi.fn(),
    wrote: vi.fn(),
    report: vi.fn(),
    connectivity: vi.fn(async () => undefined),
    state: vi.fn(() => ({ running: true })),
  };
  const emit = vi.fn();
  const serve = createEngineHost({
    core,
    runner: runner as unknown as SyncRunner,
    emit,
  });
  return { core, runner, emit, serve };
}

describe('createEngineHost', () => {
  it('runs a write as JSON and tells the other tabs who wrote it', async () => {
    const { core, runner, emit, serve } = setUp();
    await expect(
      serve('mutate', ['createTask', { input: { title: 'A' } }], 'tab-2'),
    ).resolves.toEqual({ id: 't1' });
    expect(core.mutate).toHaveBeenCalledWith(
      'createTask',
      '{"input":{"title":"A"}}',
    );
    expect(emit).toHaveBeenCalledWith({
      kind: 'changed',
      tables: [],
      source: 'tab-2',
    });
    expect(runner.wrote).toHaveBeenCalled();
  });

  it('answers reads without announcing anything', async () => {
    const { emit, serve } = setUp();
    await expect(serve('query', ['listTasks', {}], 'tab-1')).resolves.toEqual(
      [],
    );
    expect(emit).not.toHaveBeenCalled();
  });

  it('stops syncing before forgetting, and every tab refetches', async () => {
    const { core, runner, emit, serve } = setUp();
    await serve('forget', [], 'tab-1');
    expect(runner.stop).toHaveBeenCalled();
    expect(core.forget).toHaveBeenCalled();
    expect(emit).toHaveBeenCalledWith({
      kind: 'changed',
      tables: [],
      source: null,
    });
  });

  it('refreshes every tab after a first sign-in uploads, not after a plain one', async () => {
    const { core, emit, serve } = setUp();
    await serve('bindScope', ['scope-1'], 'tab-1');
    expect(emit).not.toHaveBeenCalled();
    core.bindScope.mockReturnValueOnce({ kind: 'uploading', rows: 0 } as never);
    await serve('bindScope', ['scope-1'], 'tab-1');
    expect(emit).toHaveBeenCalledTimes(1);
  });

  it('passes sync controls to the runner', async () => {
    const { runner, serve } = setUp();
    await serve('startSync', [], 'tab-1');
    await serve('syncNow', [], 'tab-1');
    await serve('connectivity', [false], 'tab-1');
    expect(runner.start).toHaveBeenCalled();
    expect(runner.now).toHaveBeenCalled();
    expect(runner.connectivity).toHaveBeenCalledWith(false);
  });
});
