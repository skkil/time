import { describe, expect, it, vi } from 'vitest';

import { createNativeCore } from './core';
import {
  SignInOutcome_Tags,
  type TimeCoreLike,
} from './native/generated/time_core_native';

const coreError = (tag: string, message: string) =>
  Object.assign(new Error(message), { tag, inner: { message } });

function fake(overrides: Partial<TimeCoreLike> = {}): TimeCoreLike {
  return {
    mutate: vi.fn(async (name: string, args: string) =>
      JSON.stringify({ name, args: JSON.parse(args) as unknown }),
    ),
    query: vi.fn(async () => '[{"id":"p1"}]'),
    pushRequest: vi.fn(() => undefined),
    applyPushResponse: vi.fn(),
    pullRequest: vi.fn(() => new Uint8Array([1, 2])),
    applyPullResponse: vi.fn(() => ({
      changedTables: ['task'],
      more: false,
      reset: false,
    })),
    status: vi.fn(() => ({
      clientId: 'c1',
      scopeId: undefined,
      pending: 3n,
      issues: 1n,
      cursorVersion: 42n,
      lastPullAt: 1_700_000_000_000n,
    })),
    bindScope: vi.fn(async () => ({
      tag: SignInOutcome_Tags.Uploading,
      inner: { rows: 7n },
    })),
    keepLocal: vi.fn(async () => 5n),
    startFresh: vi.fn(async () => undefined),
    forget: vi.fn(async () => undefined),
    issues: vi.fn(() => [
      {
        id: 9n,
        name: 'createTask',
        subject: 'Buy milk',
        reason: 'Project not found',
        createdAt: 1n,
      },
    ]),
    dismissIssue: vi.fn(() => true),
    ...overrides,
  } as unknown as TimeCoreLike;
}

describe('createNativeCore', () => {
  it('sends commands as JSON and parses the result', async () => {
    const core = fake();
    const { engine } = createNativeCore(core);
    await expect(
      engine.mutate('createTask', { input: { title: 'Write' } }),
    ).resolves.toEqual({
      name: 'createTask',
      args: { input: { title: 'Write' } },
    });
    await expect(engine.query('listProjects', {})).resolves.toEqual([
      { id: 'p1' },
    ]);
    expect(core.query).toHaveBeenCalledWith('listProjects', '{}');
  });

  it('throws errors in the desktop shape', async () => {
    const core = fake({
      mutate: vi.fn(async () => {
        throw coreError('NotFound', 'Task');
      }),
      status: vi.fn(() => {
        throw coreError('Database', 'disk I/O error');
      }),
    });
    const native = createNativeCore(core);
    await expect(native.engine.mutate('getTask', {})).rejects.toEqual({
      kind: 'notFound',
      message: 'Task',
    });
    expect(() => native.handle.status()).toThrow(
      expect.objectContaining({ kind: 'database', message: 'disk I/O error' }),
    );
  });

  it('is a store CoreHandle', () => {
    const native = createNativeCore(fake());
    expect(native.handle.pushRequest(100)).toBeNull();
    expect(native.handle.pullRequest(500)).toEqual(new Uint8Array([1, 2]));
    expect(native.handle.applyPullResponse(new Uint8Array())).toEqual({
      changedTables: ['task'],
      more: false,
      reset: false,
    });
    expect(native.handle.status()).toEqual({
      clientId: 'c1',
      scopeId: null,
      pending: 3,
      issues: 1,
      cursorVersion: 42n,
      lastPullAt: 1_700_000_000_000,
    });
  });

  it('reports account steps and issues with plain numbers', async () => {
    const core = fake();
    const native = createNativeCore(core);
    await expect(native.bindScope('s1')).resolves.toEqual({
      kind: 'uploading',
      rows: 7,
    });
    await expect(native.keepLocal('s2')).resolves.toBe(5);
    expect(native.issues()).toEqual([
      {
        id: 9,
        name: 'createTask',
        subject: 'Buy milk',
        reason: 'Project not found',
        createdAt: 1,
      },
    ]);
    expect(native.dismissIssue(9)).toBe(true);
    expect(core.dismissIssue).toHaveBeenCalledWith(9n);
  });
});
