import { beforeEach, describe, expect, it, vi } from 'vitest';

import { offerUndo, quoted, undoLatest } from './undo';

const { toast } = vi.hoisted(() => ({
  toast: Object.assign(vi.fn(), { dismiss: vi.fn(), error: vi.fn() }),
}));
vi.mock('sonner', () => ({ toast }));

describe('undo', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    for (let left = 40; left > 0; left -= 1) await undoLatest();
    vi.clearAllMocks();
  });

  it('undoes the latest action first, once each', async () => {
    const order: string[] = [];
    offerUndo('first', async () => order.push('first'));
    offerUndo('second', async () => order.push('second'));

    await undoLatest();
    await undoLatest();
    await undoLatest();

    expect(order).toEqual(['second', 'first']);
  });

  it('keeps the toast up long enough and wires its button', async () => {
    const undo = vi.fn(async () => {});
    offerUndo('Dropped', undo);

    const options = toast.mock.calls[0][1];
    expect(options.duration).toBeGreaterThanOrEqual(5000);
    options.action.onClick();
    await undoLatest();

    expect(undo).toHaveBeenCalledTimes(1);
  });

  it('reports a failed undo', async () => {
    offerUndo('Dropped', () => Promise.reject(new Error('Gone')));

    await undoLatest();

    expect(toast.error).toHaveBeenCalledWith('Gone');
  });

  it('shortens long titles', () => {
    expect(quoted('Buy milk')).toBe('“Buy milk”');
    expect(quoted('x'.repeat(80))).toHaveLength(50);
  });
});
