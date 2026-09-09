import { CheckIcon } from 'lucide-react';
import { type FormEvent, type ReactNode, useState } from 'react';

import type { Id, Preset } from '@/bindings';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Textarea } from '@/components/ui/textarea';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { PresetPicker } from '@/features/workflow/PresetPicker';
import { useApplyPreset } from '@/features/workflow/api';
import { cn } from '@/lib/utils';

import { ProjectPicker } from './ProjectPicker';
import {
  useCreateProject,
  useProjectIndex,
  useUpdateProjectSettings,
} from './api';
import {
  MAX_PROJECT_DEPTH,
  PROJECT_COLORS,
  type ProjectIndex,
  projectColorVar,
} from './tree';

const STEPS = ['What is it', 'How it works', 'When it’s done'];
const LAST = STEPS.length - 1;

export function NewProjectDialog({
  open,
  onOpenChange,
  parentId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  parentId: Id | null;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="flex h-[min(600px,84vh)] flex-col gap-0 rounded-[32px] border-0 bg-[rgba(10,18,32,.92)] p-10 shadow-[0_40px_120px_rgba(0,0,0,.4)] ring-1 ring-white/10 backdrop-blur-2xl sm:max-w-xl"
      >
        {open && (
          <NewProjectForm
            parentId={parentId}
            onDone={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function autoColor(index: ProjectIndex, parent: Id | null) {
  const inherited = parent !== null ? index.byId.get(parent)?.color : undefined;
  return (
    inherited ??
    PROJECT_COLORS.find(
      (color) => !index.active.some((project) => project.color === color),
    ) ??
    'blue'
  );
}

function NewProjectForm({
  parentId,
  onDone,
}: {
  parentId: Id | null;
  onDone: () => void;
}) {
  const index = useProjectIndex();
  const create = useCreateProject();
  const updateSettings = useUpdateProjectSettings();
  const applyPreset = useApplyPreset();
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [parent, setParent] = useState<Id | null>(parentId);
  const [kind, setKind] = useState('project');
  const [picked, setPicked] = useState<string | null>(null);
  const [preset, setPreset] = useState<Preset | null>(null);
  const [outcome, setOutcome] = useState('');
  const [weeklyMinutes, setWeeklyMinutes] = useState<number | null>(null);
  const [targetDate, setTargetDate] = useState<string | null>(null);
  const [killCriteria, setKillCriteria] = useState('');

  const color = picked ?? autoColor(index, parent);
  const finite = kind === 'project';
  const parentKind = parent !== null ? index.byId.get(parent)?.kind : undefined;
  const named = name.trim() !== '';
  const pending =
    create.isPending || updateSettings.isPending || applyPreset.isPending;

  const finish = async () => {
    if (!named || pending) return;
    const { id } = await create.mutateAsync({
      name: name.trim(),
      parentId: parent,
      color,
    });
    await updateSettings.mutateAsync({
      id,
      settings: {
        kind,
        status: 'active',
        outcome,
        weeklyMinutes,
        targetDate: finite ? targetDate : null,
        killCriteria: finite ? killCriteria : '',
        reviewEveryWeeks: 1,
        inOrder: false,
      },
    });
    if (preset && preset.key !== 'simple')
      await applyPreset.mutateAsync({ id, preset });
    onDone();
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!named) return;
    if (step < LAST) setStep(step + 1);
    else void finish();
  };

  return (
    <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
      <p className="text-xs text-foreground/45 tabular-nums">
        {step + 1} of {STEPS.length} · {STEPS[step]}
      </p>
      <DialogTitle className="mt-2 text-3xl font-light">
        New project
      </DialogTitle>
      <DialogDescription className="sr-only">
        Name it, pick how it works, and say when it’s done. Only the name is
        needed.
      </DialogDescription>

      <div
        key={step}
        className="-mx-2 mt-8 grid min-h-0 flex-1 animate-in content-start gap-6 overflow-y-auto px-2 duration-300 fade-in-0 slide-in-from-right-2 motion-reduce:animate-none"
      >
        {step === 0 && (
          <>
            <div className="flex items-center gap-3">
              <ColorDot color={color} onPick={setPicked} />
              <Input
                aria-label="Name"
                autoFocus
                value={name}
                maxLength={120}
                placeholder="Name"
                onChange={(event) => setName(event.target.value)}
                className="h-11 border-0 border-b border-white/15 bg-transparent px-0 text-xl shadow-none focus-visible:border-white/40 focus-visible:ring-0 dark:bg-transparent"
              />
            </div>
            <Field
              label="Kind"
              hint="A project finishes. An area is ongoing, like Health or Admin."
            >
              <ToggleGroup
                type="single"
                variant="outline"
                size="sm"
                value={kind}
                onValueChange={(next) => next && setKind(next)}
              >
                <ToggleGroupItem value="project" className="px-3">
                  Project
                </ToggleGroupItem>
                <ToggleGroupItem
                  value="area"
                  className="px-3"
                  disabled={parentKind === 'project'}
                >
                  Area
                </ToggleGroupItem>
              </ToggleGroup>
            </Field>
            <Field label="Inside">
              <ProjectPicker
                value={parent}
                onChange={setParent}
                noneLabel="Top level"
                className="max-w-none"
                isDisabled={(candidate) =>
                  candidate.depth + 2 > MAX_PROJECT_DEPTH ||
                  (kind === 'area' && candidate.kind === 'project')
                }
              />
            </Field>
          </>
        )}

        {step === 1 && (
          <PresetPicker value={preset} onChange={setPreset} color={color} />
        )}

        {step === 2 && (
          <>
            <Field
              label={finite ? 'Done when' : 'Standard to keep'}
              htmlFor="new-project-outcome"
              hint={
                finite
                  ? 'One sentence you could check off.'
                  : 'What “fine” looks like here.'
              }
            >
              <Textarea
                id="new-project-outcome"
                autoFocus
                rows={2}
                maxLength={500}
                value={outcome}
                placeholder={
                  finite ? 'Paper submitted to CVPR' : 'Run three times a week'
                }
                onChange={(event) => setOutcome(event.target.value)}
              />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Hours a week" htmlFor="new-project-hours">
                <Input
                  id="new-project-hours"
                  type="number"
                  min={0}
                  max={80}
                  step={0.5}
                  value={weeklyMinutes === null ? '' : weeklyMinutes / 60}
                  onChange={(event) =>
                    setWeeklyMinutes(
                      event.target.value === ''
                        ? null
                        : Math.round(Number(event.target.value) * 60),
                    )
                  }
                />
              </Field>
              {finite && (
                <Field label="Target date" htmlFor="new-project-target">
                  <Input
                    id="new-project-target"
                    type="date"
                    value={targetDate ?? ''}
                    onChange={(event) =>
                      setTargetDate(event.target.value || null)
                    }
                  />
                </Field>
              )}
            </div>
            {finite && (
              <Field
                label="Stop if"
                htmlFor="new-project-kill"
                hint="Decide now when you’d drop it. Easier than deciding later."
              >
                <Input
                  id="new-project-kill"
                  maxLength={300}
                  value={killCriteria}
                  placeholder="No reply from the lab by December"
                  onChange={(event) => setKillCriteria(event.target.value)}
                />
              </Field>
            )}
          </>
        )}
      </div>

      <div className="mt-6 flex items-center gap-2">
        {step > 0 ? (
          <Button
            type="button"
            variant="ghost"
            onClick={() => setStep(step - 1)}
          >
            Back
          </Button>
        ) : (
          <Button type="button" variant="ghost" onClick={onDone}>
            Cancel
          </Button>
        )}
        <div className="ml-auto flex gap-2">
          {step < LAST && (
            <Button
              type="button"
              variant="ghost"
              disabled={!named || pending}
              onClick={() => void finish()}
            >
              Create now
            </Button>
          )}
          <Button type="submit" disabled={!named || pending}>
            {step < LAST ? 'Next' : 'Create project'}
          </Button>
        </div>
      </div>
    </form>
  );
}

function Field({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string;
  htmlFor?: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {hint && <p className="text-xs text-foreground/45">{hint}</p>}
    </div>
  );
}

function ColorDot({
  color,
  onPick,
}: {
  color: string;
  onPick: (color: string) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`Colour: ${color}`}
          className="size-5 shrink-0 rounded-full outline-offset-2 focus-visible:outline-2 focus-visible:outline-ring"
          style={{ background: projectColorVar(color) }}
        />
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="flex w-auto gap-2 rounded-2xl p-3"
      >
        {PROJECT_COLORS.map((option) => (
          <button
            key={option}
            type="button"
            aria-label={option}
            aria-pressed={color === option}
            onClick={() => {
              onPick(option);
              setOpen(false);
            }}
            className={cn(
              'grid size-7 place-items-center rounded-full outline-offset-2 focus-visible:outline-2 focus-visible:outline-ring',
              color === option &&
                'ring-2 ring-foreground ring-offset-2 ring-offset-popover',
            )}
            style={{ background: projectColorVar(option) }}
          >
            {color === option && (
              <CheckIcon className="size-3.5 text-background" />
            )}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}
