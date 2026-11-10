import { useCallback, useEffect, useRef, useState } from 'react';

export const AUTOSAVE_MS = 600;

type Draft = { value: string; saved: boolean };

export function useAutosave(
  value: string,
  save: (next: string) => boolean,
  delay = AUTOSAVE_MS,
) {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [seen, setSeen] = useState(value);
  const pending = useRef<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const latestSave = useRef(save);

  useEffect(() => {
    latestSave.current = save;
  });

  const flush = useCallback((leaving: boolean) => {
    clearTimeout(timer.current);
    const next = pending.current;
    pending.current = null;
    const accepted = next !== null && latestSave.current(next);
    setDraft((current) =>
      current && accepted
        ? { ...current, saved: true }
        : leaving
          ? null
          : current,
    );
  }, []);

  useEffect(() => () => flush(true), [flush]);

  if (seen !== value) {
    setSeen(value);
    if (draft?.saved) setDraft(null);
  }

  return {
    value: draft?.value ?? value,
    onChange: (next: string) => {
      setDraft({ value: next, saved: false });
      pending.current = next;
      clearTimeout(timer.current);
      timer.current = setTimeout(() => flush(false), delay);
    },
    onBlur: () => flush(true),
  };
}
