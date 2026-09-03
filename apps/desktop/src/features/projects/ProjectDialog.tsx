import { CheckIcon } from 'lucide-react';
import { type FormEvent, useState } from 'react';

import type { Id, Project } from '@/bindings';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

import { ProjectPicker } from './ProjectPicker';
import { useCreateProject, useProjectIndex, useUpdateProject } from './api';
import {
  MAX_PROJECT_DEPTH,
  PROJECT_COLORS,
  type ProjectColor,
  descendantIds,
  projectColorVar,
  subtreeHeight,
} from './tree';

type ProjectDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project?: Project;
  parentId?: Id | null;
};

export function ProjectDialog({
  open,
  onOpenChange,
  project,
  parentId = null,
}: ProjectDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {open && (
          <ProjectForm
            project={project}
            parentId={parentId}
            onDone={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function ProjectForm({
  project,
  parentId,
  onDone,
}: {
  project?: Project;
  parentId: Id | null;
  onDone: () => void;
}) {
  const index = useProjectIndex();
  const create = useCreateProject();
  const update = useUpdateProject();
  const [name, setName] = useState(project?.name ?? '');
  const [parent, setParent] = useState<Id | null>(
    project?.parentId ?? parentId,
  );
  const [color, setColor] = useState<string>(
    project?.color ??
      (parent !== null ? index.byId.get(parent)?.color : undefined) ??
      'blue',
  );

  const node = project ? index.byId.get(project.id) : undefined;
  const blocked = node ? descendantIds(node) : new Set<Id>();
  const height = node ? subtreeHeight(node) : 1;
  const pending = create.isPending || update.isPending;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const input = { name, parentId: parent, color };
    const options = { onSuccess: onDone };
    if (project) update.mutate({ id: project.id, input }, options);
    else create.mutate(input, options);
  };

  return (
    <form onSubmit={submit} className="grid gap-5">
      <DialogHeader>
        <DialogTitle>{project ? 'Edit project' : 'New project'}</DialogTitle>
        <DialogDescription>
          Projects nest up to {MAX_PROJECT_DEPTH} levels. Time rolls up to the
          parent.
        </DialogDescription>
      </DialogHeader>

      <div className="grid gap-2">
        <Label htmlFor="project-name">Name</Label>
        <Input
          id="project-name"
          autoFocus
          value={name}
          maxLength={120}
          onChange={(event) => setName(event.target.value)}
        />
      </div>

      <div className="grid gap-2">
        <Label>Inside</Label>
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
      </div>

      <fieldset className="grid gap-2">
        <legend className="mb-2 text-sm font-medium">Color</legend>
        <div className="flex gap-2">
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
                  'ring-2 ring-foreground ring-offset-2 ring-offset-popover',
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

      <DialogFooter>
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" disabled={!name.trim() || pending}>
          {project ? 'Save' : 'Create project'}
        </Button>
      </DialogFooter>
    </form>
  );
}
