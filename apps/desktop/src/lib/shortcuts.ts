import { useEffect, useEffectEvent } from 'react';

export type Shortcut = {
  keys: string | string[];
  run: () => void;
  idle?: boolean;
};

type KeyInput = Pick<
  KeyboardEvent,
  'key' | 'code' | 'ctrlKey' | 'metaKey' | 'shiftKey' | 'altKey'
>;

const isMac = /Mac|iPhone|iPad/.test(navigator.userAgent);

function physicalKey(event: KeyInput) {
  if (/^Key[A-Z]$/.test(event.code)) return event.code.slice(3).toLowerCase();
  if (/^(Digit|Numpad)[0-9]$/.test(event.code)) return event.code.slice(-1);
  return event.key.toLowerCase();
}

export function matchesShortcut(event: KeyInput, combo: string) {
  const parts = combo.split(/\+(?!$)/);
  const key = parts.pop()!.toLowerCase();
  const mods = new Set(parts.map((part) => part.toLowerCase()));
  const isSymbol = !/^[a-z0-9]$/.test(key);
  return (
    physicalKey(event) === key &&
    mods.has('mod') === (event.ctrlKey || event.metaKey) &&
    mods.has('alt') === event.altKey &&
    (isSymbol || mods.has('shift') === event.shiftKey)
  );
}

export function formatShortcut(combo: string) {
  return combo
    .split(/\+(?!$)/)
    .map((part) =>
      part === 'Mod'
        ? isMac
          ? '⌘'
          : 'Ctrl'
        : part.length === 1
          ? part.toUpperCase()
          : part,
    )
    .join(isMac ? '' : ' ');
}

export const isTyping = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  (target.isContentEditable ||
    ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));

const isIdle = (event: KeyboardEvent) =>
  !isTyping(event.target) && !document.querySelector('[role="dialog"]');

export function useShortcuts(shortcuts: Shortcut[]) {
  const onKey = useEffectEvent((event: KeyboardEvent) => {
    if (event.defaultPrevented || event.isComposing) return;
    const shortcut = shortcuts.find(
      ({ keys, idle }) =>
        [keys].flat().some((combo) => matchesShortcut(event, combo)) &&
        (!idle || isIdle(event)),
    );
    if (!shortcut) return;
    event.preventDefault();
    shortcut.run();
  });

  useEffect(() => {
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}
