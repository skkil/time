import { toast } from 'sonner';

import { errorMessage } from '@/lib/query';

const TOAST_MS = 6000;
const MAX_ENTRIES = 30;

type Entry = { id: number; undo: () => Promise<unknown> };

let entries: Entry[] = [];
let nextId = 0;

async function run(entry: Entry) {
  entries = entries.filter((other) => other.id !== entry.id);
  toast.dismiss(entry.id);
  try {
    await entry.undo();
  } catch (error) {
    toast.error(errorMessage(error));
  }
}

export function offerUndo(message: string, undo: () => Promise<unknown>) {
  const entry = { id: ++nextId, undo };
  entries = [...entries, entry].slice(-MAX_ENTRIES);
  toast(message, {
    id: entry.id,
    duration: TOAST_MS,
    action: { label: 'Undo', onClick: () => void run(entry) },
  });
}

export function undoLatest() {
  const latest = entries.at(-1);
  return latest ? run(latest) : Promise.resolve();
}

export const quoted = (title: string) =>
  `“${title.length > 48 ? `${title.slice(0, 47).trimEnd()}…` : title}”`;
