import {
  ArrowLeftIcon,
  ArrowRightIcon,
  MoonIcon,
  SunIcon,
  XIcon,
} from 'lucide-react';
import { Dialog as DialogPrimitive } from 'radix-ui';
import { type ReactNode, useState } from 'react';

import type { Ritual, RitualRun } from '@/bindings';
import { Button } from '@/components/ui/button';
import { WeekReviewFlow } from '@/features/review/WeekReview';
import { ZenBackdrop } from '@/features/zen/ZenBackdrop';
import { mondayOf, shiftKey, todayKey } from '@/lib/time';
import { cn } from '@/lib/utils';

import { useChoosePlanningTime, useRunActions } from './api';
import {
  RITUALS,
  type RitualKind,
  STEPS,
  type StepKey,
  contextFor,
} from './meta';
import { RitualStep } from './steps';

function ZenFrame({
  label,
  description,
  wide = false,
  dark = false,
  onEscape,
  children,
}: {
  label: string;
  description: string;
  wide?: boolean;
  dark?: boolean;
  onEscape?: () => void;
  children: ReactNode;
}) {
  return (
    <DialogPrimitive.Root
      open
      onOpenChange={(open) => {
        if (!open) onEscape?.();
      }}
    >
      <DialogPrimitive.Portal>
        <DialogPrimitive.Content
          aria-describedby={undefined}
          onPointerDownOutside={(event) => event.preventDefault()}
          className={cn(
            'fixed inset-0 z-50 grid place-items-center overflow-y-auto p-6 outline-none data-open:animate-in data-open:duration-500 data-open:fade-in-0',
            dark && 'dark',
          )}
        >
          <ZenBackdrop className="fixed" />
          <div
            className={cn(
              'relative grid w-full gap-6 rounded-2xl bg-card/95 p-8 text-card-foreground shadow-[0_24px_64px_rgba(7,26,21,.28)]',
              wide ? 'max-w-3xl' : 'max-w-xl',
            )}
          >
            <DialogPrimitive.Title className="sr-only">
              {label}
            </DialogPrimitive.Title>
            <DialogPrimitive.Description className="sr-only">
              {description}
            </DialogPrimitive.Description>
            {children}
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
  const later = () => {
    actions.snooze.mutate(run.id);
    onClose();
  };

  const header = (
    <header className="flex items-center gap-3">
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold tracking-wide text-primary uppercase">
          {meta.label}
        </p>
        <p className="text-xs text-muted-foreground">{meta.minutes}</p>
      </div>
      {kind !== 'session' && run.snoozedUntil === null && (
        <Button variant="ghost" size="sm" onClick={later}>
          In 15 min
        </Button>
      )}
      <Button variant="ghost" size="sm" onClick={skip}>
        Skip
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Close (Esc)"
        title="Close (Esc). Pick it up again from Reports."
        onClick={onClose}
      >
        <XIcon />
      </Button>
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
        <div className="max-h-[70vh] overflow-y-auto pr-1">
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
      dark={kind === 'wind_down'}
      onEscape={onClose}
    >
      {header}
      {steps.length > 1 && (
        <ol className="flex gap-1.5" aria-label="Steps">
          {steps.map((key, i) => (
            <li
              key={key}
              aria-current={i === index ? 'step' : undefined}
              title={key === 'weekly_review' ? key : STEPS[key].label}
              className={cn(
                'h-1 flex-1 rounded-full',
                i <= index ? 'bg-primary' : 'bg-muted',
              )}
            />
          ))}
        </ol>
      )}
      <section aria-live="polite" className="min-h-40">
        <RitualStep key={step} step={step} ctx={ctx} onNext={next} />
      </section>
      <footer className="flex items-center gap-3">
        {index > 0 && (
          <Button variant="ghost" onClick={() => setIndex(index - 1)}>
            <ArrowLeftIcon />
            Back
          </Button>
        )}
        <Button className="ml-auto" onClick={next}>
          {last ? 'Done' : 'Next'}
          {!last && <ArrowRightIcon />}
        </Button>
      </footer>
    </ZenFrame>
  );
}

export function PlanningChooser({ onDone }: { onDone: () => void }) {
  const choose = useChoosePlanningTime();
  const pick = (time: 'morning' | 'evening') =>
    choose.mutate(time, { onSuccess: onDone });
  const options = [
    {
      time: 'morning' as const,
      icon: SunIcon,
      title: 'In the morning',
      body: 'When you open the app, sort leftovers and pick today’s musts.',
    },
    {
      time: 'evening' as const,
      icon: MoonIcon,
      title: 'In the evening',
      body: 'At the end of the day, see what moved and set up tomorrow.',
    },
  ];
  return (
    <ZenFrame
      label="When do you plan your day?"
      description="Choose when skkil time helps you plan."
      onEscape={onDone}
    >
      <div className="grid gap-1">
        <p className="text-xs font-semibold tracking-wide text-primary uppercase">
          Welcome
        </p>
        <h2 className="text-2xl font-bold">When do you plan your day?</h2>
        <p className="text-sm text-muted-foreground">
          There’s no right answer. You can change it any time in Settings.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {options.map(({ time, icon: Icon, title, body }) => (
          <button
            key={time}
            type="button"
            onClick={() => pick(time)}
            className="grid gap-2 rounded-xl border bg-card p-4 text-left outline-none hover:border-primary focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Icon className="size-5 text-primary" strokeWidth={1.5} />
            <span className="font-semibold">{title}</span>
            <span className="text-sm text-muted-foreground">{body}</span>
          </button>
        ))}
      </div>
    </ZenFrame>
  );
}
