import type { Id } from '@skkil-time/client/types';
import { type ReactNode, createContext, use, useMemo, useState } from 'react';

type Selection = {
  selected: Id | null;
  select: (id: Id | null) => void;
};

const SelectionContext = createContext<Selection>({
  selected: null,
  select: () => undefined,
});

/** The task shown in the detail pane when the screen is wide enough for two panes. */
export function SelectionProvider({ children }: { children: ReactNode }) {
  const [selected, select] = useState<Id | null>(null);
  const value = useMemo(() => ({ selected, select }), [selected]);
  return <SelectionContext value={value}>{children}</SelectionContext>;
}

export const useSelection = () => use(SelectionContext);
