import { createContext, use } from 'react';

import type { Id } from '@/backend';

import type { RitualKind, WeekHost } from './meta';

export type RitualRunner = {
  open: (kind: RitualKind, taskId?: Id | null) => void;
  closeWeek: (host: WeekHost) => void;
  active: RitualKind | null;
};

export const RitualContext = createContext<RitualRunner | null>(null);

export function useRitualRunner() {
  const context = use(RitualContext);
  if (!context) throw new Error('useRitualRunner needs a RitualProvider');
  return context;
}
