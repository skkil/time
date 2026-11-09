import { deviceOnly, mutations, parameters, reads } from '#local/catalog';
import {
  type DeviceCommands,
  type Engine,
  createLocalBackend,
} from '#local/index';
import { describe, expect, it, vi } from 'vitest';

const engine = () => ({
  mutate: vi.fn<Engine['mutate']>(async (name) => ({ mutated: name })),
  query: vi.fn<Engine['query']>(async (name) => ({ read: name })),
});

const device = Object.fromEntries(
  deviceOnly.map((name) => [name, vi.fn(async () => name)]),
) as unknown as DeviceCommands;

describe('createLocalBackend', () => {
  it('classifies every contract command exactly once', () => {
    const classified = [...mutations, ...reads, ...deviceOnly];
    expect(new Set(classified).size).toBe(classified.length);
    expect(new Set(classified)).toEqual(new Set(Object.keys(parameters)));
  });

  it('runs mutations through the engine with arguments named as in the contract', async () => {
    const local = engine();
    const backend = createLocalBackend(local, device);
    await expect(
      backend.moveTask('t1', {
        projectId: null,
        sectionId: null,
        parentId: null,
        index: 2,
      } as never),
    ).resolves.toEqual({
      mutated: 'moveTask',
    });
    expect(local.mutate).toHaveBeenCalledWith('moveTask', {
      id: 't1',
      placement: { projectId: null, sectionId: null, parentId: null, index: 2 },
    });
  });

  it('sends a missing optional argument as null', async () => {
    const local = engine();
    await createLocalBackend(local, device).rescheduleTasks(
      ['a'],
      undefined as never,
    );
    expect(local.mutate).toHaveBeenCalledWith('rescheduleTasks', {
      ids: ['a'],
      dueDate: null,
    });
  });

  it('runs reads as queries', async () => {
    const local = engine();
    await createLocalBackend(local, device).getTask('t1');
    expect(local.query).toHaveBeenCalledWith('getTask', { id: 't1' });
    expect(local.mutate).not.toHaveBeenCalled();
  });

  it('leaves device-only commands to the host', async () => {
    const local = engine();
    await expect(createLocalBackend(local, device).exportData()).resolves.toBe(
      'exportData',
    );
    expect(local.query).not.toHaveBeenCalled();
    expect(local.mutate).not.toHaveBeenCalled();
  });
});
