import { describe, expect, it } from 'vitest';

import { matchesShortcut } from './shortcuts';

const press = (
  key: string,
  code: string,
  mods: Partial<KeyboardEvent> = {},
) => ({
  key,
  code,
  ctrlKey: false,
  metaKey: false,
  shiftKey: false,
  altKey: false,
  ...mods,
});

describe('matchesShortcut', () => {
  it('matches Mod against Ctrl and Cmd', () => {
    expect(
      matchesShortcut(press('k', 'KeyK', { ctrlKey: true }), 'Mod+K'),
    ).toBe(true);
    expect(
      matchesShortcut(press('k', 'KeyK', { metaKey: true }), 'Mod+K'),
    ).toBe(true);
    expect(matchesShortcut(press('k', 'KeyK'), 'Mod+K')).toBe(false);
  });

  it('matches letters by physical key so a Korean layout still works', () => {
    expect(matchesShortcut(press('ㅂ', 'KeyQ'), 'Q')).toBe(true);
  });

  it('requires shift to match for letters and digits', () => {
    expect(matchesShortcut(press('Q', 'KeyQ', { shiftKey: true }), 'Q')).toBe(
      false,
    );
    expect(
      matchesShortcut(
        press('!', 'Digit1', { ctrlKey: true, shiftKey: true }),
        'Mod+1',
      ),
    ).toBe(false);
  });

  it('requires shift to match for named keys', () => {
    expect(
      matchesShortcut(
        press('ArrowLeft', 'ArrowLeft', { shiftKey: true }),
        'Shift+ArrowLeft',
      ),
    ).toBe(true);
    expect(
      matchesShortcut(press('ArrowLeft', 'ArrowLeft'), 'Shift+ArrowLeft'),
    ).toBe(false);
  });

  it('ignores shift for symbols, which already encode it', () => {
    expect(
      matchesShortcut(
        press('+', 'Equal', { ctrlKey: true, shiftKey: true }),
        'Mod++',
      ),
    ).toBe(true);
    expect(
      matchesShortcut(press('+', 'NumpadAdd', { ctrlKey: true }), 'Mod++'),
    ).toBe(true);
    expect(
      matchesShortcut(press('-', 'Minus', { ctrlKey: true }), 'Mod+-'),
    ).toBe(true);
    expect(
      matchesShortcut(press('0', 'Numpad0', { ctrlKey: true }), 'Mod+0'),
    ).toBe(true);
  });
});
