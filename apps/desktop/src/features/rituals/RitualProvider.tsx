import { type ReactNode, Suspense, lazy, useCallback, useState } from 'react';

import { type Id, type Ritual, type RitualRun, commands } from '@/bindings';

import { useRunActions } from './api';
import type { RitualKind } from './meta';
import { RitualContext, type RitualRunner } from './runner-context';

type Active = { ritual: Ritual; run: RitualRun };

const ZenOverlay = lazy(() =>
  import('./ZenOverlay').then(({ ZenOverlay }) => ({ default: ZenOverlay })),
);

export function RitualProvider({ children }: { children: ReactNode }) {
  const [active, setActive] = useState<Active | null>(null);
  const actions = useRunActions();

  const open = useCallback(
    async (kind: RitualKind, taskId: Id | null = null) => {
      if (active) return;
      const rituals = await commands.listRituals();
      const ritual = rituals.find((candidate) => candidate.kind === kind);
      if (!ritual) return;
      const run = await actions.start.mutateAsync({ kind, taskId });
      setActive({ ritual, run });
    },
    [active, actions.start],
  );

  const runner: RitualRunner = {
    open: (kind, taskId) => void open(kind, taskId),
    active: (active?.ritual.kind as RitualKind | undefined) ?? null,
  };

  return (
    <RitualContext value={runner}>
      {children}
      {active && (
        <Suspense>
          <ZenOverlay
            key={active.run.id}
            ritual={active.ritual}
            run={active.run}
            onClose={() => setActive(null)}
          />
        </Suspense>
      )}
    </RitualContext>
  );
}
