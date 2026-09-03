import {
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

import {
  type Id,
  type Ritual,
  type RitualEvent,
  type RitualRun,
  type RunningTimer,
  commands,
} from '@/bindings';
import { useTimer } from '@/features/time/api';
import { nowSeconds } from '@/lib/time';

import { PlanningChooser, ZenOverlay } from './ZenOverlay';
import { usePlanningTime, useRunActions } from './api';
import type { RitualKind } from './meta';
import { RitualContext, type RitualRunner } from './runner-context';

type Active = { ritual: Ritual; run: RitualRun };

const TICK_MS = 60_000;

export function RitualProvider({ children }: { children: ReactNode }) {
  const [active, setActive] = useState<Active | null>(null);
  const [chooserClosed, setChooserClosed] = useState(false);
  const { data: planningTime, isSuccess: planningKnown } = usePlanningTime();
  const { data: timer } = useTimer();
  const actions = useRunActions();
  const busy = useRef(false);
  const previousTimer = useRef<RunningTimer | null | undefined>(undefined);
  const choosing = planningKnown && planningTime === null && !chooserClosed;

  const begin = useCallback(
    async (ritual: Ritual, taskId: Id | null) => {
      const run = await actions.start.mutateAsync({
        kind: ritual.kind,
        taskId,
      });
      setActive({ ritual, run });
    },
    [actions.start],
  );

  const check = useCallback(
    async (event: RitualEvent, taskId: Id | null = null) => {
      if (busy.current || active || choosing) return;
      busy.current = true;
      try {
        const ritual = await commands.dueRitual(event);
        if (ritual) await begin(ritual, taskId);
      } finally {
        busy.current = false;
      }
    },
    [active, choosing, begin],
  );

  const timerRunning = Boolean(timer);
  useEffect(() => {
    if (!planningKnown || choosing || timerRunning) return;
    void check({ kind: 'open' });
    const tick = () => void check({ kind: 'tick' });
    const id = window.setInterval(tick, TICK_MS);
    window.addEventListener('focus', tick);
    return () => {
      window.clearInterval(id);
      window.removeEventListener('focus', tick);
    };
  }, [planningKnown, choosing, timerRunning, check]);

  useEffect(() => {
    const previous = previousTimer.current;
    previousTimer.current = timer;
    if (previous && timer === null) {
      const minutes = Math.floor((nowSeconds() - previous.startedAt) / 60);
      void check({ kind: 'timerStopped', minutes }, previous.taskId);
    }
  }, [timer, check]);

  const open = useCallback(
    async (kind: RitualKind, taskId: Id | null = null) => {
      if (active) return;
      const rituals = await commands.listRituals();
      const ritual = rituals.find((candidate) => candidate.kind === kind);
      if (ritual) await begin(ritual, taskId);
    },
    [active, begin],
  );

  const runner: RitualRunner = {
    open: (kind, taskId) => void open(kind, taskId),
    active: (active?.ritual.kind as RitualKind | undefined) ?? null,
  };

  return (
    <RitualContext value={runner}>
      {children}
      {active && (
        <ZenOverlay
          key={active.run.id}
          ritual={active.ritual}
          run={active.run}
          onClose={() => setActive(null)}
        />
      )}
      {choosing && <PlanningChooser onDone={() => setChooserClosed(true)} />}
    </RitualContext>
  );
}
