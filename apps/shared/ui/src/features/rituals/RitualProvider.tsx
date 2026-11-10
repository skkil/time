import { type ReactNode, Suspense, lazy, useCallback, useState } from 'react';

import { type Id, type Ritual, type RitualRun, commands } from '@/backend';
import { useOnNavigate } from '@/hooks/use-on-navigate';
import type { DateKey } from '@/lib/time';

import { useRunActions } from './api';
import {
  type RitualKind,
  type RitualPart,
  type WeekHost,
  isWeekHost,
} from './meta';
import { RitualContext, type RitualRunner } from './runner-context';

type Active = {
  ritual: Ritual;
  run: RitualRun;
  week: DateKey | null;
  part: RitualPart;
};

const ZenOverlay = lazy(() =>
  import('./ZenOverlay').then(({ ZenOverlay }) => ({ default: ZenOverlay })),
);

export function RitualProvider({ children }: { children: ReactNode }) {
  const [active, setActive] = useState<Active | null>(null);
  const actions = useRunActions();
  useOnNavigate(() => setActive(null));

  const open = useCallback(
    async (
      kind: RitualKind,
      taskId: Id | null = null,
      part: RitualPart = 'steps',
    ) => {
      if (active) return;
      const rituals = await commands.listRituals();
      const ritual = rituals.find((candidate) => candidate.kind === kind);
      if (!ritual) return;
      const week = isWeekHost(kind) ? await commands.weekToClose(kind) : null;
      if (part === 'week' && !week) return;
      const run = await actions.start.mutateAsync({
        kind: part === 'week' ? 'weekly' : kind,
        taskId,
      });
      setActive({ ritual, run, week, part });
    },
    [active, actions.start],
  );

  const runner: RitualRunner = {
    open: (kind, taskId) => void open(kind, taskId),
    closeWeek: (host: WeekHost) => void open(host, null, 'week'),
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
            week={active.week}
            part={active.part}
            onClose={() => setActive(null)}
          />
        </Suspense>
      )}
    </RitualContext>
  );
}
