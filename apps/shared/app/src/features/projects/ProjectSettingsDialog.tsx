import { CheckIcon, ChevronRightIcon } from 'lucide-react';
import { type FormEvent, type ReactNode, useState } from 'react';

import type { Id, Project, ProjectSettings } from '@/backend';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { WorkflowSettings } from '@/features/workflow/WorkflowSettings';
import { useProjectWorkflow } from '@/features/workflow/api';
import { cn } from '@/lib/utils';

import { GroupPicker } from './GroupPicker';
import { ProjectPicker } from './ProjectPicker';
import {
  settingsOf,
  useProjectIndex,
  useUpdateProject,
  useUpdateProjectSettings,
} from './api';
import {
  MAX_PROJECT_DEPTH,
  PROJECT_COLORS,
  type ProjectColor,
  STATUSES,
  descendantIds,
  projectColorVar,
  subtreeHeight,
} from './tree';

const DEFAULT_CADENCE = 4;

const CADENCES = [
  { value: 1, label: 'Weekly' },
  { value: 2, label: 'Every 2 weeks' },
  { value: 4, label: 'Monthly' },
];

type ProjectSettingsDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project: Project;
};

export function ProjectSettingsDialog({
  open,
  onOpenChange,
  project,
}: ProjectSettingsDialogProps) {
  const workflow = useProjectWorkflow(project.id);
  const [advanced, setAdvanced] = useState(
    () => workflow.structured || hasAdvancedSettings(project),
  );
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[min(720px,88vh)] flex-col gap-0 overflow-hidden p-0 sm:max-w-xl">
        {open && (
          <div className="min-h-0 flex-1 overflow-y-auto">
            <ProjectForm
              key={project.id}
              project={project}
              advanced={advanced}
              onAdvancedChange={setAdvanced}
              onDone={() => onOpenChange(false)}
            />
            {advanced && <WorkflowSettings project={project} />}
          </div>
        )}
      </DialogContent>
    </Dialog>
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
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function hasAdvancedSettings(project: Project) {
  return (
    project.weeklyMinutes !== null ||
    project.reviewEveryWeeks !== DEFAULT_CADENCE ||
    project.killCriteria !== '' ||
    project.inOrder
  );
}

function ProjectForm({
  project,
  advanced,
  onAdvancedChange,
  onDone,
}: {
  project: Project;
  advanced: boolean;
  onAdvancedChange: (open: boolean) => void;
  onDone: () => void;
}) {
  const index = useProjectIndex();
  const update = useUpdateProject();
  const updateSettings = useUpdateProjectSettings();
  const [name, setName] = useState(project.name);
  const [parent, setParent] = useState<Id | null>(project.parentId);
  const [color, setColor] = useState<string>(project.color);
  const [settings, setSettings] = useState<ProjectSettings>(
    settingsOf(project),
  );
  const set = (patch: Partial<ProjectSettings>) =>
    setSettings({ ...settings, ...patch });

  const node = index.byId.get(project.id);
  const blocked = node ? descendantIds(node) : new Set<Id>();
  const height = node ? subtreeHeight(node) : 1;
  const pending = update.isPending || updateSettings.isPending;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const input = { name, parentId: parent, color };
    await update.mutateAsync({ id: project.id, input });
    await updateSettings.mutateAsync({
      id: project.id,
      settings: {
        ...settings,
        groupId: parent === null ? settings.groupId : null,
      },
    });
    onDone();
  };

  return (
    <form onSubmit={submit} className="grid gap-6 p-6 pt-10">
      <div className="grid gap-1.5">
        <DialogTitle className="text-3xl font-light">
          Project settings
        </DialogTitle>
        <DialogDescription className="sr-only">
          Name, group, dates and rhythm of {project.name}.
        </DialogDescription>
      </div>

      <Field label="Name" htmlFor="project-name">
        <Input
          id="project-name"
          value={name}
          maxLength={120}
          onChange={(event) => setName(event.target.value)}
        />
      </Field>

      {parent === null && (
        <Field
          label="Group"
          hint="Who the work is for. Sub-projects follow it."
        >
          <GroupPicker
            value={settings.groupId}
            onChange={(groupId) => set({ groupId })}
          />
        </Field>
      )}

      <Field label="Inside">
        <ProjectPicker
          value={parent}
          onChange={setParent}
          noneLabel="Top level"
          className="max-w-none"
          isDisabled={(candidate) =>
            blocked.has(candidate.id) ||
            candidate.depth + 1 + height > MAX_PROJECT_DEPTH
          }
        />
      </Field>
      <fieldset className="grid gap-2">
        <legend className="mb-2 text-sm font-medium">Colour</legend>
        <div className="flex flex-wrap gap-2">
          {PROJECT_COLORS.map((option: ProjectColor) => (
            <button
              key={option}
              type="button"
              aria-label={option}
              aria-pressed={color === option}
              onClick={() => setColor(option)}
              className={cn(
                'grid size-7 place-items-center rounded-full outline-offset-2 transition-transform focus-visible:outline-2 focus-visible:outline-ring',
                color === option &&
                  'ring-2 ring-foreground ring-offset-2 ring-offset-[#0a1220]',
              )}
              style={{ background: projectColorVar(option) }}
            >
              {color === option && (
                <CheckIcon className="size-3.5 text-background" />
              )}
            </button>
          ))}
        </div>
      </fieldset>
      <Field label="Status">
        <ToggleGroup
          type="single"
          variant="outline"
          size="sm"
          value={settings.status}
          onValueChange={(status) => status && set({ status })}
        >
          {STATUSES.map((option) => (
            <ToggleGroupItem
              key={option.value}
              value={option.value}
              className="px-3"
            >
              {option.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </Field>
      <div className="max-w-[50%]">
        <Field
          label="Target date"
          htmlFor="project-target"
          hint="Leave empty for ongoing work."
        >
          <Input
            id="project-target"
            type="date"
            value={settings.targetDate ?? ''}
            onChange={(event) =>
              set({ targetDate: event.target.value || null })
            }
          />
        </Field>
      </div>

      <button
        type="button"
        aria-expanded={advanced}
        onClick={() => onAdvancedChange(!advanced)}
        className="flex items-center gap-1.5 justify-self-start text-sm text-foreground/75 hover:text-foreground"
      >
        <ChevronRightIcon
          className={cn('size-4 transition-transform', advanced && 'rotate-90')}
        />
        Advanced
        <span className="text-xs text-muted-foreground">
          weekly hours, review rhythm, stop rule, order, types and statuses
        </span>
      </button>

      {advanced && (
        <>
          <Field label="Hours a week" htmlFor="project-hours">
            <Input
              id="project-hours"
              type="number"
              min={0}
              max={80}
              step={0.5}
              value={
                settings.weeklyMinutes === null
                  ? ''
                  : settings.weeklyMinutes / 60
              }
              onChange={(event) =>
                set({
                  weeklyMinutes:
                    event.target.value === ''
                      ? null
                      : Math.round(Number(event.target.value) * 60),
                })
              }
            />
          </Field>
          <Field label="Look at it">
            <ToggleGroup
              type="single"
              variant="outline"
              size="sm"
              value={String(settings.reviewEveryWeeks)}
              onValueChange={(value) =>
                value && set({ reviewEveryWeeks: Number(value) })
              }
            >
              {CADENCES.map((option) => (
                <ToggleGroupItem
                  key={option.value}
                  value={String(option.value)}
                  className="px-3"
                >
                  {option.label}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </Field>
          <Field
            label="Stop if"
            htmlFor="project-kill"
            hint="Decide now when you’d drop it. Easier than deciding later."
          >
            <Input
              id="project-kill"
              maxLength={300}
              value={settings.killCriteria}
              placeholder="No reply from the lab by December"
              onChange={(event) => set({ killCriteria: event.target.value })}
            />
          </Field>
          <label className="flex items-start gap-3 text-sm">
            <Checkbox
              checked={settings.inOrder}
              onCheckedChange={(checked) => set({ inOrder: checked === true })}
              className="mt-0.5"
            />
            <span className="grid gap-0.5">
              <span className="font-medium">Tasks happen in order</span>
              <span className="text-xs text-muted-foreground">
                Only the top open task shows as the next action.
              </span>
            </span>
          </label>
        </>
      )}

      <div className="sticky bottom-0 z-10 -mx-6 -mb-6 flex justify-end gap-2 border-t border-white/[.07] bg-[#0a1220]/95 px-6 py-3 backdrop-blur-xl">
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" disabled={!name.trim() || pending}>
          Save
        </Button>
      </div>
    </form>
  );
}
