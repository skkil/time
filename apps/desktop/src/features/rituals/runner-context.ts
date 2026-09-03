import { createContext, use } from 'react';

import type { Id } from '@/bindings';

import type { RitualKind } from './meta';

export type RitualRunner = {
  open: (kind: RitualKind, taskId?: Id | null) => void;
  active: RitualKind | null;
};

export const RitualContext = createContext<RitualRunner | null>(null);

export function useRitualRunner() {
  const context = use(RitualContext);
  if (!context) throw new Error('useRitualRunner needs a RitualProvider');
  return context;
}
