import { useNavigate } from '@tanstack/react-router';
import {
  ArchiveIcon,
  ArchiveRestoreIcon,
  CheckIcon,
  ChevronRightIcon,
  Trash2Icon,
} from 'lucide-react';
import { type ReactNode, useState } from 'react';

import type { Project, SavedView } from '@/backend';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import {
  ItemTypes,
  MilestoneLabel,
  Milestones,
  Statuses,
  Templates,
} from '@/features/workflow/StructureSettings';
import {
  useCreateView,
  useDeleteView,
  useProjectWorkflow,
  useUpdateView,
} from '@/features/workflow/api';
import { offerUndo, quoted } from '@/lib/undo';
import { cn } from '@/lib/utils';

import { AutosaveInput } from './AutosaveInput';
import { GroupPicker } from './GroupPicker';
import { ProjectPicker } from './ProjectPicker';
import {
  useArchiveProject,
  useDeleteProject,
  useProjectIndex,
  useSaveProject,
} from './api';
import { SETTINGS_SECTIONS, type SettingId } from './settings-layout';
import {
  MAX_PROJECT_DEPTH,
  PROJECT_COLORS,
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

type Row = {
  label: string;
  hint?: string;
  htmlFor?: string;
  control: ReactNode;
};

function SettingRow({ label, hint, htmlFor, control }: Row) {
  return (
    <div className="grid gap-x-10 gap-y-2 py-3.5 sm:grid-cols-[minmax(0,14rem)_minmax(0,32rem)]">
      <div className="grid content-start gap-1 sm:pt-1.5">
        <Label htmlFor={htmlFor}>{label}</Label>
        {hint && <p className="text-xs text-foreground/75">{hint}</p>}
      </div>
      <div className="min-w-0">{control}</div>
    </div>
  );
}

function SectionHeading({
  title,
  hint,
  collapsible = false,
}: {
  title: string;
  hint?: string;
  collapsible?: boolean;
}) {
  return (
    <div>
      <h2 className="flex items-center gap-1.5 text-base font-medium">
        {title}
        {collapsible && (
          <ChevronRightIcon
            aria-hidden
            className="size-4 text-foreground/75 transition-transform group-open/details:rotate-90 motion-reduce:transition-none"
          />
        )}
      </h2>
      {hint && <p className="mt-0.5 text-sm text-foreground/75">{hint}</p>}
    </div>
  );
}

export function ProjectSettings({ project }: { project: Project }) {
  const index = useProjectIndex();
  const workflow = useProjectWorkflow(project.id);
  const save = useSaveProject(project.id);
  const node = index.byId.get(project.id);
  const blocked = node ? descendantIds(node) : new Set([project.id]);
  const height = node ? subtreeHeight(node) : 1;
  const hasStructure =
    workflow.types.length > 0 ||
    workflow.statuses.length > 0 ||
    workflow.milestoneLabel !== '';

  const setParent = (parentId: Project['parentId']) => {
    if (parentId === project.parentId) return;
    const previous = { parentId: project.parentId, groupId: project.groupId };
    save.project({ parentId });
    if (parentId !== null && project.groupId !== null)
      save.settings({ groupId: null });
    const destination =
      parentId === null ? 'the top level' : index.byId.get(parentId)?.name;
    offerUndo(`Moved ${quoted(project.name)} to ${destination}`, async () => {
      save.project({ parentId: previous.parentId });
      if (previous.groupId !== null)
        save.settings({ groupId: previous.groupId });
    });
  };

  const setStatus = (status: string) => {
    if (!status || status === project.status) return;
    const previous = project.status;
    save.settings({ status });
    const label = STATUSES.find((option) => option.value === status)?.label;
    offerUndo(
      `Marked ${quoted(project.name)} ${label?.toLowerCase()}`,
      async () => save.settings({ status: previous }),
    );
  };

  const rows: Record<SettingId, Row | null> = {
    name: {
      label: 'Name',
      htmlFor: 'project-name',
      control: (
        <AutosaveInput
          id="project-name"
          value={project.name}
          maxLength={120}
          onSave={(name) => {
            const trimmed = name.trim();
            if (!trimmed || trimmed === project.name) return false;
            save.project({ name: trimmed });
            return true;
          }}
        />
      ),
    },
    color: {
      label: 'Colour',
      control: (
        <div
          role="radiogroup"
          aria-label="Colour"
          className="flex flex-wrap gap-2"
        >
          {PROJECT_COLORS.map((option) => (
            <button
              key={option}
              type="button"
              role="radio"
              aria-label={option}
              aria-checked={project.color === option}
              onClick={() => save.project({ color: option })}
              className={cn(
                'grid size-7 place-items-center rounded-full outline-offset-2 focus-visible:outline-2 focus-visible:outline-ring',
                project.color === option &&
                  'ring-2 ring-foreground ring-offset-2 ring-offset-[#0a1220]',
              )}
              style={{ background: projectColorVar(option) }}
            >
              {project.color === option && (
                <CheckIcon className="size-3.5 text-background" />
              )}
            </button>
          ))}
        </div>
      ),
    },
    parent: {
      label: 'Inside',
      hint: 'Sub-projects follow their top-level project’s group.',
      control: (
        <ProjectPicker
          value={project.parentId}
          onChange={setParent}
          noneLabel="Top level"
          className="max-w-none"
          isDisabled={(candidate) =>
            blocked.has(candidate.id) ||
            candidate.depth + 1 + height > MAX_PROJECT_DEPTH
          }
        />
      ),
    },
    group:
      project.parentId === null
        ? {
            label: 'Group',
            hint: 'Who the work is for. Projects in a group sit together.',
            control: (
              <GroupPicker
                value={project.groupId}
                onChange={(groupId) => save.settings({ groupId })}
              />
            ),
          }
        : null,
    status: {
      label: 'Status',
      hint: 'Paused, done and dropped projects leave Day and the sidebar.',
      control: (
        <ToggleGroup
          type="single"
          variant="outline"
          size="sm"
          value={project.status}
          onValueChange={setStatus}
          className="flex-wrap"
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
      ),
    },
    targetDate: {
      label: 'Target date',
      hint: 'Leave empty for ongoing work.',
      htmlFor: 'project-target',
      control: (
        <AutosaveInput
          id="project-target"
          type="date"
          value={project.targetDate ?? ''}
          className="w-44"
          onSave={(date) => {
            const targetDate = date || null;
            if (targetDate === project.targetDate) return false;
            save.settings({ targetDate });
            return true;
          }}
        />
      ),
    },
    weeklyHours: {
      label: 'Hours a week',
      hint: 'A budget, not a target. Leave empty for none.',
      htmlFor: 'project-hours',
      control: (
        <AutosaveInput
          id="project-hours"
          type="number"
          min={0}
          max={80}
          step={0.5}
          className="w-28"
          value={
            project.weeklyMinutes === null
              ? ''
              : String(project.weeklyMinutes / 60)
          }
          onSave={(hours) => {
            const minutes =
              hours.trim() === '' ? null : Math.round(Number(hours) * 60);
            if (minutes !== null && !(minutes >= 0 && minutes <= 80 * 60))
              return false;
            if (minutes === project.weeklyMinutes) return false;
            save.settings({ weeklyMinutes: minutes });
            return true;
          }}
        />
      ),
    },
    review: {
      label: 'Review every',
      hint: 'How often the weekly review brings it up.',
      control: (
        <ToggleGroup
          type="single"
          variant="outline"
          size="sm"
          value={String(project.reviewEveryWeeks)}
          onValueChange={(value) =>
            value && save.settings({ reviewEveryWeeks: Number(value) })
          }
          className="flex-wrap"
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
      ),
    },
    stopIf: {
      label: 'Stop if',
      hint: 'Decide now when you’d drop it. Easier than deciding later.',
      htmlFor: 'project-kill',
      control: (
        <AutosaveInput
          id="project-kill"
          maxLength={300}
          value={project.killCriteria}
          placeholder="No reply from the lab by December"
          onSave={(killCriteria) => {
            if (killCriteria === project.killCriteria) return false;
            save.settings({ killCriteria });
            return true;
          }}
        />
      ),
    },
    inOrder: {
      label: 'Order',
      control: (
        <label className="flex items-start gap-3 text-sm">
          <Checkbox
            checked={project.inOrder}
            onCheckedChange={(checked) =>
              save.settings({ inOrder: checked === true })
            }
            className="mt-0.5"
          />
          <span className="grid gap-0.5">
            <span>Tasks happen in order</span>
            <span className="text-xs text-foreground/75">
              Only the top open task shows as the next action.
            </span>
          </span>
        </label>
      ),
    },
    types: {
      label: 'Item types',
      hint: 'Kinds of work. Events happen at a time and sit on the calendar.',
      control: <ItemTypes projectId={project.id} types={workflow.types} />,
    },
    statuses: {
      label: 'Statuses',
      hint: 'Name them freely; each belongs to a fixed category. Backlog items never count as overdue.',
      control: <Statuses projectId={project.id} statuses={workflow.statuses} />,
    },
    milestones: {
      label: 'Milestones',
      hint: 'Named, dated points that items work towards, like a release or an exam.',
      control: (
        <Milestones
          projectId={project.id}
          label={workflow.milestoneLabel}
          milestones={workflow.milestones}
        />
      ),
    },
    milestoneLabel:
      workflow.milestoneLabel !== ''
        ? {
            label: 'Milestones are called',
            htmlFor: 'project-milestone-label',
            control: (
              <MilestoneLabel
                id="project-milestone-label"
                projectId={project.id}
                label={workflow.milestoneLabel}
              />
            ),
          }
        : null,
    template: {
      label: 'Template',
      hint: 'Set all of the above at once from a ready-made setup.',
      control: <Templates project={project} />,
    },
    views: {
      label: 'Saved views',
      hint: 'Add one from View › New view… on the Tasks tab.',
      control: <SavedViews projectId={project.id} views={workflow.views} />,
    },
    archive: {
      label: project.archived ? 'Restore' : 'Archive',
      hint: project.archived
        ? 'Bring it and its sub-projects back.'
        : 'Hide it and its sub-projects. Nothing is deleted.',
      control: <ArchiveButton project={project} />,
    },
    delete: {
      label: 'Delete',
      hint: 'Deletes its sub-projects and their tasks. Focus time stays in your log.',
      control: <DeleteButton project={project} />,
    },
  };

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-16 sm:px-10">
      {SETTINGS_SECTIONS.map((section) => {
        const sectionRows = section.settings
          .map((id) => ({ id, row: rows[id] }))
          .filter(
            (entry): entry is { id: SettingId; row: Row } => entry.row !== null,
          );
        const body = (
          <div className="divide-y divide-white/[.06]">
            {sectionRows.map(({ id, row }) => (
              <SettingRow key={id} {...row} />
            ))}
          </div>
        );
        return (
          <section
            key={section.id}
            aria-label={section.title}
            className="border-b border-white/[.07] py-6 last:border-b-0"
          >
            {section.collapsible ? (
              <details open={hasStructure} className="group/details">
                <summary className="w-fit cursor-pointer list-none rounded-sm outline-none select-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
                  <SectionHeading
                    title={section.title}
                    hint={section.hint}
                    collapsible
                  />
                </summary>
                <div className="mt-2">{body}</div>
              </details>
            ) : (
              <>
                <SectionHeading title={section.title} hint={section.hint} />
                <div className="mt-2">{body}</div>
              </>
            )}
          </section>
        );
      })}
    </div>
  );
}

const viewSummary = (view: SavedView) => {
  const layout = view.layout.charAt(0).toUpperCase() + view.layout.slice(1);
  return view.groupBy === 'none' ? layout : `${layout} by ${view.groupBy}`;
};

function SavedViews({
  projectId,
  views,
}: {
  projectId: Project['id'];
  views: SavedView[];
}) {
  const update = useUpdateView();
  const remove = useDeleteView();
  const create = useCreateView();
  if (views.length === 0)
    return (
      <p className="pt-1.5 text-sm text-foreground/75">No saved views yet.</p>
    );
  const inputOf = (view: SavedView) => ({
    name: view.name,
    layout: view.layout,
    groupBy: view.groupBy,
    sort: view.sort,
    filter: view.filter,
  });
  return (
    <ul className="grid gap-2">
      {views.map((view) => (
        <li key={view.id} className="flex items-center gap-2">
          <AutosaveInput
            value={view.name}
            maxLength={40}
            aria-label={`Name of the ${view.name} view`}
            className="flex-1"
            onSave={(name) => {
              const trimmed = name.trim();
              if (!trimmed || trimmed === view.name) return false;
              update.mutate({
                id: view.id,
                input: { ...inputOf(view), name: trimmed },
              });
              return true;
            }}
          />
          <span className="w-28 shrink-0 truncate text-xs text-foreground/75">
            {viewSummary(view)}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={`Delete the ${view.name} view`}
            className="text-foreground/75"
            onClick={() =>
              remove.mutate(view.id, {
                onSuccess: () =>
                  offerUndo(`Deleted the ${quoted(view.name)} view`, () =>
                    create.mutateAsync({ projectId, input: inputOf(view) }),
                  ),
              })
            }
          >
            <Trash2Icon />
          </Button>
        </li>
      ))}
    </ul>
  );
}

function ArchiveButton({ project }: { project: Project }) {
  const archive = useArchiveProject();
  const toggle = (archived: boolean) =>
    archive.mutate(
      { id: project.id, archived },
      {
        onSuccess: () =>
          offerUndo(
            `${archived ? 'Archived' : 'Restored'} ${quoted(project.name)}`,
            () => archive.mutateAsync({ id: project.id, archived: !archived }),
          ),
      },
    );
  return project.archived ? (
    <Button type="button" variant="outline" onClick={() => toggle(false)}>
      <ArchiveRestoreIcon />
      Restore project
    </Button>
  ) : (
    <Button type="button" variant="outline" onClick={() => toggle(true)}>
      <ArchiveIcon />
      Archive project
    </Button>
  );
}

function DeleteButton({ project }: { project: Project }) {
  const navigate = useNavigate();
  const remove = useDeleteProject();
  const [confirming, setConfirming] = useState(false);
  return (
    <>
      <Button
        type="button"
        variant="outline"
        onClick={() => setConfirming(true)}
      >
        <Trash2Icon />
        Delete project…
      </Button>
      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {quoted(project.name)}?</AlertDialogTitle>
            <AlertDialogDescription>
              This deletes its sub-projects and their tasks. Focus time stays in
              your log without a project. Archive instead to keep everything.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                remove.mutate(project.id, {
                  onSuccess: () => void navigate({ to: '/projects' }),
                })
              }
            >
              Delete project
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
