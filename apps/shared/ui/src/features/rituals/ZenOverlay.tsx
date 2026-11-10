import { ArrowLeftIcon, ArrowRightIcon, XIcon } from 'lucide-react';
import { Dialog as DialogPrimitive } from 'radix-ui';
import { type CSSProperties, type ReactNode, useState } from 'react';

import type { Ritual, RitualRun } from '@/backend';
import { WeekReviewFlow } from '@/features/review/WeekReview';
import { ZenBackdrop } from '@/features/zen/ZenBackdrop';
import { type DateKey, mondayOf, shiftKey, todayKey } from '@/lib/time';
import { cn } from '@/lib/utils';

import { DaySummary } from './DaySummary';
import { WeekOffer } from './WeekOffer';
import { useRitualRuns, useRunActions } from './api';
import {
  RITUALS,
  type RitualKind,
  type RitualPart,
  STEPS,
  type StepKey,
  contextFor,
  isWeekHost,
} from './meta';
import { useShownSteps } from './shown-steps';
import { RitualStep } from './steps';

const glass = {
  '--card': 'rgba(255, 255, 255, 0.06)',
  '--popover': 'rgba(14, 30, 40, 0.92)',
  '--border': 'rgba(255, 255, 255, 0.14)',
  '--input': 'rgba(255, 255, 255, 0.16)',
  '--muted': 'rgba(255, 255, 255, 0.1)',
  '--muted-foreground': 'rgba(255, 255, 255, 0.8)',
  '--accent': 'rgba(255, 255, 255, 0.1)',
  '--primary': 'rgba(255, 255, 255, 0.92)',
  '--primary-foreground': '#0b1a22',
  '--ring': 'rgba(255, 255, 255, 0.5)',
  '--now-tint': 'rgba(255, 255, 255, 0.1)',
} as CSSProperties;

function ZenFrame({
  label,
  description,
  wide = false,
  leaveLabel = 'Finish later',
  onEscape,
  children,
}: {
  label: string;
  description: string;
  wide?: boolean;
  leaveLabel?: string;
  onEscape: () => void;
  children: ReactNode;
}) {
  return (
    <DialogPrimitive.Root open onOpenChange={(open) => !open && onEscape()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Content
          aria-describedby={undefined}
          onPointerDownOutside={(event) => event.preventDefault()}
          className="fixed inset-0 z-50 text-white outline-none data-open:animate-in data-open:duration-[1400ms] data-open:fade-in-0"
        >
          <ZenBackdrop deep className="absolute" />
          <DialogPrimitive.Title className="sr-only">
            {label}
          </DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">
            {description}
          </DialogPrimitive.Description>
          <button
            type="button"
            onClick={onEscape}
            className="absolute top-[max(1.5rem,env(safe-area-inset-top))] left-[max(1.75rem,env(safe-area-inset-left))] z-10 flex items-center gap-2 rounded-full px-3 py-2 text-sm text-white/70 transition-colors outline-none hover:text-white focus-visible:ring-2 focus-visible:ring-white/50 max-sm:left-3 pointer-coarse:min-h-10"
          >
            <XIcon className="size-4" strokeWidth={1.5} />
            {leaveLabel}
          </button>
          <div className="relative grid h-full place-items-center p-8 max-sm:px-3 max-sm:pt-[calc(4.5rem+env(safe-area-inset-top))] max-sm:pb-[max(1rem,env(safe-area-inset-bottom))]">
            <div
              style={glass}
              className={cn(
                'flex max-h-full min-h-0 w-full animate-in flex-col gap-8 rounded-[40px] bg-white/[.07] px-12 py-11 shadow-[0_40px_120px_rgba(0,0,0,.28)] ring-1 ring-white/15 backdrop-blur-[48px] backdrop-saturate-150 delay-300 duration-[1200ms] fade-in-0 fill-mode-both zoom-in-[.97] max-sm:rounded-[32px] max-sm:px-5 max-sm:py-8',
                wide ? 'max-w-4xl' : 'max-w-[600px]',
              )}
            >
              {children}
            </div>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

type Phase = 'steps' | 'offer' | 'week' | 'closed';

export function ZenOverlay({
  ritual,
  run,
  week,
  part,
  onClose,
}: {
  ritual: Ritual;
  run: RitualRun;
  week: DateKey | null;
  part: RitualPart;
  onClose: () => void;
}) {
  const kind = ritual.kind as RitualKind;
  const meta = RITUALS[kind];
  const actions = useRunActions();
  const today = todayKey();
  const steps = useShownSteps(ritual.steps as StepKey[], today);
  const { data: runs = [] } = useRitualRuns(today, shiftKey(today, 1));
  const [index, setIndex] = useState(() =>
    Math.min(run.step, Math.max(0, steps.length - 1)),
  );
  const [phase, setPhase] = useState<Phase>(part === 'week' ? 'week' : 'steps');
  const [weekly, setWeekly] = useState<RitualRun | null>(
    part === 'week' ? run : null,
  );
  const [busy, setBusy] = useState(false);
  const ctx = contextFor(kind, today, run.taskId);
  const closesWeek = week !== null && isWeekHost(kind);
  const last = index === steps.length - 1;
  const step = steps[index];
  const snoozed = runs.some(
    (other) =>
      other.kind === 'weekly' &&
      other.finishedAt === null &&
      other.snoozedUntil !== null,
  );

  const closeDay = () => (kind === 'evening' ? setPhase('closed') : onClose());
  const finish = () => {
    actions.finish.mutate(run.id);
    if (closesWeek) setPhase('offer');
    else closeDay();
  };
  const next = () => {
    if (last) return finish();
    actions.reach.mutate({ id: run.id, step: index + 1 });
    setIndex(index + 1);
  };
  const skip = () => {
    actions.skip.mutate(run.id);
    onClose();
  };
  const weeklyRun = async () =>
    weekly ??
    (await actions.start.mutateAsync({ kind: 'weekly', taskId: null }));
  const startWeek = async () => {
    setBusy(true);
    try {
      setWeekly(await weeklyRun());
      setPhase('week');
    } finally {
      setBusy(false);
    }
  };
  const putOffWeek = async () => {
    setBusy(true);
    try {
      const pending = await weeklyRun();
      if (kind === 'evening' && pending.snoozedUntil === null)
        await actions.snooze.mutateAsync(pending.id);
      else await actions.skip.mutateAsync(pending.id);
      closeDay();
    } finally {
      setBusy(false);
    }
  };
  const finishWeek = () => {
    if (weekly) actions.finish.mutate(weekly.id);
    closeDay();
  };

  const dots = closesWeek ? [...steps, 'weekly_review' as const] : steps;
  const header = (
    <header className="grid shrink-0 justify-items-center gap-4 text-center">
      <p className="text-xs tracking-[.2em] text-white/80">
        {(phase === 'week' ? 'Close the week' : meta.label).toUpperCase()}
      </p>
      {phase === 'steps' && dots.length > 1 && (
        <ol className="flex gap-2" aria-label="Steps">
          {dots.map((key, i) => (
            <li
              key={key}
              aria-current={i === index ? 'step' : undefined}
              title={
                key === 'weekly_review' ? 'Close the week' : STEPS[key].label
              }
              className={cn(
                'h-1.5 rounded-full transition-all duration-700',
                i === index
                  ? 'w-6 bg-white/90'
                  : i < index
                    ? 'w-1.5 bg-white/60'
                    : 'w-1.5 bg-white/25',
              )}
            />
          ))}
        </ol>
      )}
    </header>
  );

  if (kind === 'weekly')
    return (
      <ZenFrame
        label={meta.label}
        description={meta.description}
        wide
        onEscape={onClose}
      >
        {header}
        <div className="grid min-h-0 content-start gap-6 overflow-y-auto pr-1">
          <WeekReviewFlow
            week={shiftKey(mondayOf(today), -7)}
            onDone={finish}
          />
        </div>
      </ZenFrame>
    );

  if (phase === 'week' && week)
    return (
      <ZenFrame
        label="Close the week"
        description="Feel the week, settle its outcomes, clear the deck and plan the next one."
        wide
        onEscape={onClose}
      >
        {header}
        <div className="grid min-h-0 content-start gap-6 overflow-y-auto pr-1">
          <WeekReviewFlow week={week} onDone={finishWeek} />
        </div>
      </ZenFrame>
    );

  if (phase === 'offer' && week && isWeekHost(kind))
    return (
      <ZenFrame
        label={meta.label}
        description={meta.description}
        onEscape={onClose}
        leaveLabel="Close"
      >
        {header}
        <WeekOffer
          host={kind}
          week={week}
          snoozed={snoozed}
          busy={busy}
          onStart={() => void startWeek()}
          onLater={() => void putOffWeek()}
        />
      </ZenFrame>
    );

  if (phase === 'closed')
    return (
      <ZenFrame
        label={meta.label}
        description={meta.description}
        onEscape={onClose}
        leaveLabel="Close"
      >
        <DaySummary ctx={ctx} onClose={onClose} />
      </ZenFrame>
    );

  return (
    <ZenFrame
      label={meta.label}
      description={meta.description}
      onEscape={onClose}
      leaveLabel="Finish later"
    >
      {header}
      <section
        key={step}
        aria-live="polite"
        className="min-h-0 flex-1 animate-in [scrollbar-width:thin] overflow-y-auto duration-700 fade-in-0 slide-in-from-bottom-2"
      >
        <RitualStep step={step} ctx={ctx} onNext={next} />
      </section>
      <footer className="flex shrink-0 items-center gap-3">
        {index > 0 ? (
          <button
            type="button"
            onClick={() => setIndex(index - 1)}
            className="flex items-center gap-2 text-sm text-white/80 transition-colors hover:text-white"
          >
            <ArrowLeftIcon className="size-4" strokeWidth={1.5} />
            Back
          </button>
        ) : (
          <button
            type="button"
            onClick={skip}
            className="text-sm text-white/80 transition-colors hover:text-white"
          >
            Skip {meta.label.toLowerCase()} today
          </button>
        )}
        <button
          type="button"
          onClick={next}
          className="ml-auto flex h-9 shrink-0 items-center gap-2 rounded-full bg-white/90 px-4 text-sm font-medium whitespace-nowrap text-[#0b1a22] transition-colors hover:bg-white pointer-coarse:h-10"
        >
          {last && !closesWeek ? 'Finish' : 'Continue'}
          {(!last || closesWeek) && (
            <ArrowRightIcon className="size-4" strokeWidth={1.5} />
          )}
        </button>
      </footer>
    </ZenFrame>
  );
}
