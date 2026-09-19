import { ArrowLeftIcon, ArrowRightIcon, XIcon } from 'lucide-react';
import { Dialog as DialogPrimitive } from 'radix-ui';
import { type CSSProperties, type ReactNode, useState } from 'react';

import type { Ritual, RitualRun } from '@/bindings';
import { WeekReviewFlow } from '@/features/review/WeekReview';
import { mondayOf, shiftKey, todayKey } from '@/lib/time';
import { cn } from '@/lib/utils';

import { useRunActions } from './api';
import {
  RITUALS,
  type RitualKind,
  STEPS,
  type StepKey,
  contextFor,
} from './meta';
import { RitualStep } from './steps';

const glass = {
  '--card': 'rgba(255, 255, 255, 0.06)',
  '--popover': 'rgba(14, 30, 40, 0.92)',
  '--border': 'rgba(255, 255, 255, 0.14)',
  '--input': 'rgba(255, 255, 255, 0.16)',
  '--muted': 'rgba(255, 255, 255, 0.1)',
  '--muted-foreground': 'rgba(255, 255, 255, 0.66)',
  '--accent': 'rgba(255, 255, 255, 0.1)',
  '--primary': 'rgba(255, 255, 255, 0.92)',
  '--primary-foreground': '#0b1a22',
  '--ring': 'rgba(255, 255, 255, 0.5)',
  '--now-tint': 'rgba(255, 255, 255, 0.1)',
} as CSSProperties;

function Ocean() {
  const [ready, setReady] = useState(false);
  const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  return (
    <div aria-hidden className="absolute inset-0 overflow-hidden bg-[#0b1a22]">
      <img
        src="/checkout/ocean.jpg"
        alt=""
        className="absolute inset-0 size-full object-cover"
      />
      {!still && (
        <img
          src="/checkout/ocean.webp"
          alt=""
          decoding="async"
          onLoad={() => setReady(true)}
          className={cn(
            'absolute inset-0 size-full object-cover transition-opacity duration-[2500ms] motion-safe:animate-[checkout-drift_60s_ease-in-out_infinite_alternate]',
            ready ? 'opacity-100' : 'opacity-0',
          )}
        />
      )}
      <div className="absolute inset-0 bg-[radial-gradient(120%_90%_at_50%_45%,rgba(6,16,24,.05),rgba(6,16,24,.55))]" />
    </div>
  );
}

function ZenFrame({
  label,
  description,
  wide = false,
  onEscape,
  children,
}: {
  label: string;
  description: string;
  wide?: boolean;
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
          <Ocean />
          <DialogPrimitive.Title className="sr-only">
            {label}
          </DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">
            {description}
          </DialogPrimitive.Description>
          <button
            type="button"
            onClick={onEscape}
            className="absolute top-6 left-7 z-10 flex items-center gap-2 rounded-full px-3 py-2 text-sm text-white/70 transition-colors outline-none hover:text-white focus-visible:ring-2 focus-visible:ring-white/50"
          >
            <XIcon className="size-4" strokeWidth={1.5} />
            Leave
          </button>
          <div className="relative grid h-full place-items-center p-8">
            <div
              style={glass}
              className={cn(
                'flex max-h-full min-h-0 w-full animate-in flex-col gap-8 rounded-[40px] bg-white/[.07] px-12 py-11 shadow-[0_40px_120px_rgba(0,0,0,.28)] ring-1 ring-white/15 backdrop-blur-[48px] backdrop-saturate-150 delay-300 duration-[1200ms] fade-in-0 fill-mode-both zoom-in-[.97]',
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

export function ZenOverlay({
  ritual,
  run,
  onClose,
}: {
  ritual: Ritual;
  run: RitualRun;
  onClose: () => void;
}) {
  const kind = ritual.kind as RitualKind;
  const meta = RITUALS[kind];
  const actions = useRunActions();
  const steps = ritual.steps as StepKey[];
  const [index, setIndex] = useState(() =>
    Math.min(run.step, Math.max(0, steps.length - 1)),
  );
  const ctx = contextFor(kind, todayKey(), run.taskId);
  const last = index === steps.length - 1;
  const step = steps[index];

  const finish = () => {
    actions.finish.mutate(run.id);
    onClose();
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

  const header = (
    <header className="grid shrink-0 justify-items-center gap-4 text-center">
      <p className="text-xs tracking-[.2em] text-white/60">
        {meta.label.toUpperCase()}
      </p>
      {steps.length > 1 && (
        <ol className="flex gap-2" aria-label="Steps">
          {steps.map((key, i) => (
            <li
              key={key}
              aria-current={i === index ? 'step' : undefined}
              title={key === 'weekly_review' ? key : STEPS[key].label}
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
        <div className="min-h-0 overflow-y-auto pr-1">
          <WeekReviewFlow
            week={shiftKey(mondayOf(todayKey()), -7)}
            onDone={finish}
          />
        </div>
      </ZenFrame>
    );

  return (
    <ZenFrame
      label={meta.label}
      description={meta.description}
      onEscape={onClose}
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
            className="flex items-center gap-2 text-sm text-white/60 transition-colors hover:text-white"
          >
            <ArrowLeftIcon className="size-4" strokeWidth={1.5} />
            Back
          </button>
        ) : (
          <button
            type="button"
            onClick={skip}
            className="text-sm text-white/50 transition-colors hover:text-white"
          >
            Not today
          </button>
        )}
        <button
          type="button"
          onClick={next}
          className="ml-auto flex h-9 items-center gap-2 rounded-full bg-white/90 px-4 text-sm font-medium text-[#0b1a22] transition-colors hover:bg-white"
        >
          {last ? 'Finish' : 'Continue'}
          {!last && <ArrowRightIcon className="size-4" strokeWidth={1.5} />}
        </button>
      </footer>
    </ZenFrame>
  );
}
