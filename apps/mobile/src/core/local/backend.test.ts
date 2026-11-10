import { type Engine, createLocalBackend } from '@skkil-time/client/local';
import { describe, expect, it, vi } from 'vitest';

import { deferredEngine } from '@/core/local/deferred-engine';
import { deviceCommands } from '@/core/local/device-commands';

const stored = new Map<string, string>();
vi.mock('expo-secure-store', () => ({
  getItemAsync: async (key: string) => stored.get(key) ?? null,
  setItemAsync: async (key: string, value: string) => {
    stored.set(key, value);
  },
}));

function setup() {
  const engine = {
    mutate: vi.fn<Engine['mutate']>(async (name) => ({ applied: name })),
    query: vi.fn<Engine['query']>(async () => []),
  };
  let open: (engine: Engine) => void = () => undefined;
  const opened = new Promise<Engine>((resolve) => (open = resolve));
  const wrote = vi.fn();
  const backend = createLocalBackend(
    deferredEngine(() => opened, wrote),
    deviceCommands,
  );
  return { engine, open: () => open(engine), wrote, backend };
}

describe('the phone backend', () => {
  it('waits for the replica, then runs commands on it by contract name', async () => {
    const { engine, open, backend } = setup();
    const created = backend.createProject({
      name: 'Thesis',
      parentId: null,
      color: 'blue',
    });
    expect(engine.mutate).not.toHaveBeenCalled();
    open();
    await expect(created).resolves.toEqual({ applied: 'createProject' });
    expect(engine.mutate).toHaveBeenCalledWith('createProject', {
      input: { name: 'Thesis', parentId: null, color: 'blue' },
    });
  });

  it('announces writes so sync can push them, and only writes', async () => {
    const { engine, open, wrote, backend } = setup();
    open();
    await backend.listTasks();
    expect(engine.query).toHaveBeenCalledWith('listTasks', {});
    expect(wrote).not.toHaveBeenCalled();
    await backend.setTaskCompleted('t1', true);
    expect(wrote).toHaveBeenCalledTimes(1);
  });

  it('does not announce a write that failed', async () => {
    const { engine, open, wrote, backend } = setup();
    engine.mutate.mockRejectedValueOnce({ kind: 'notFound', message: 'Task' });
    open();
    await expect(backend.setTaskCompleted('t1', true)).rejects.toEqual({
      kind: 'notFound',
      message: 'Task',
    });
    expect(wrote).not.toHaveBeenCalled();
  });

  it('answers device-only commands on the phone', async () => {
    const { engine, backend } = setup();
    await expect(backend.externalChanges()).resolves.toBe(false);
    await expect(backend.exportData()).resolves.toBeNull();
    await expect(backend.syncHabits()).resolves.toMatchObject({
      activitywatch: 'notNeeded',
    });
    expect(engine.mutate).not.toHaveBeenCalled();
    expect(engine.query).not.toHaveBeenCalled();
  });

  it('keeps notification choices on the phone', async () => {
    const { engine, backend } = setup();
    await expect(backend.getNotificationPrefs()).resolves.toEqual({
      on: true,
      tasks: true,
      blocks: true,
      events: true,
    });
    const quiet = { on: true, tasks: true, blocks: false, events: true };
    await backend.setNotificationPrefs(quiet);
    await expect(backend.getNotificationPrefs()).resolves.toEqual(quiet);
    expect(engine.mutate).not.toHaveBeenCalled();
  });
});
