import { describe, expect, it, vi } from 'vitest';
import type { EngineClient } from '~/engine/client';
import { webDeviceCommands } from '~/platform/device-commands';

function setUp(opened: string | null = '{"tables":[]}') {
  const call = vi.fn(async (method: string) =>
    method === 'dump' ? '{"tables":[]}' : 1,
  );
  const files = {
    saveFile: vi.fn(async (name: string) => name),
    openFile: vi.fn(async () => opened),
    pickImportFiles: vi.fn(async () => [{ name: 'a', text: 'Title\nx' }]),
  };
  const commands = webDeviceCommands(
    { call } as unknown as EngineClient,
    files,
  );
  return { call, files, commands };
}

describe('webDeviceCommands', () => {
  it('downloads the engine’s dump as a dated JSON backup', async () => {
    const { files, commands } = setUp();
    const name = await commands.exportData();
    expect(name).toMatch(/^skkil-time-\d{4}-\d{2}-\d{2}\.json$/);
    expect(files.saveFile).toHaveBeenCalledWith(
      name,
      '{"tables":[]}',
      'application/json',
    );
  });

  it('restores a picked backup through the engine', async () => {
    const { call, commands } = setUp();
    await expect(commands.importData()).resolves.toBe(true);
    expect(call).toHaveBeenCalledWith('restore', '{"tables":[]}');
  });

  it('does nothing when no backup is picked', async () => {
    const { call, commands } = setUp(null);
    await expect(commands.importData()).resolves.toBe(false);
    expect(call).not.toHaveBeenCalled();
  });

  it('has no desktop extras', async () => {
    const { commands } = setUp();
    await expect(commands.externalChanges()).resolves.toBe(false);
    await expect(commands.getCaptureHotkey()).resolves.toBe(false);
    await expect(commands.pickImportFiles()).resolves.toHaveLength(1);
  });
});
