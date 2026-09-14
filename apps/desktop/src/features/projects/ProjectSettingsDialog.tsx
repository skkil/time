import { CheckIcon } from 'lucide-react';
import { type FormEvent, type ReactNode, useState } from 'react';

import type { Id, Project, ProjectSettings } from '@/bindings';
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
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[min(720px,88vh)] flex-col gap-0 overflow-hidden rounded-[32px] border-0 bg-[rgba(10,18,32,.92)] p-0 shadow-[0_40px_120px_rgba(0,0,0,.4)] ring-1 ring-white/10 backdrop-blur-2xl sm:max-w-xl">
        {open && (
          <div className="min-h-0 flex-1 overflow-y-auto">
            <ProjectForm
              key={project.id}
              project={project}
              onDone={() => onOpenChange(false)}
            />
            <WorkflowSettings project={project} />
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

function ProjectForm({
  project,
  onDone,
}: {
  project: Project;
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

      <div className="grid grid-cols-2 gap-4">
        <Field label="Hours a week" htmlFor="project-hours">
          <Input
            id="project-hours"
            type="number"
            min={0}
            max={80}
            step={0.5}
            value={
              settings.weeklyMinutes === null ? '' : settings.weeklyMinutes / 60
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
        <Field label="Target date" htmlFor="project-target">
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
