import { useNavigate } from '@tanstack/react-router';
import { type FormEvent, useState } from 'react';

import type { Id } from '@/backend';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

import { ProjectPicker } from './ProjectPicker';
import {
  useCreateProject,
  useProjectIndex,
  useUpdateProjectSettings,
} from './api';
import { MAX_PROJECT_DEPTH, PROJECT_COLORS, type ProjectIndex } from './tree';

export function NewProjectDialog({
  open,
  onOpenChange,
  parentId,
  groupId = null,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  parentId: Id | null;
  groupId?: Id | null;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="p-8 sm:max-w-md">
        {open && (
          <NewProjectForm
            parentId={parentId}
            groupId={groupId}
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
    PROJECT_COLORS[index.active.length % PROJECT_COLORS.length]
  );
}

function NewProjectForm({
  parentId,
  groupId,
  onDone,
}: {
  parentId: Id | null;
  groupId: Id | null;
  onDone: () => void;
}) {
  const navigate = useNavigate();
  const index = useProjectIndex();
  const create = useCreateProject();
  const updateSettings = useUpdateProjectSettings();
  const [name, setName] = useState('');
  const [parent, setParent] = useState<Id | null>(parentId);
  const pending = create.isPending || updateSettings.isPending;
  const named = name.trim() !== '';

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!named || pending) return;
    const { id } = await create.mutateAsync({
      name: name.trim(),
      parentId: parent,
      color: autoColor(index, parent),
    });
    await updateSettings.mutateAsync({
      id,
      settings: {
        groupId: parent === null ? groupId : null,
        status: 'active',
        outcome: '',
        weeklyMinutes: null,
        targetDate: null,
        killCriteria: '',
        reviewEveryWeeks: 1,
        inOrder: false,
      },
    });
    onDone();
    void navigate({
      to: '/projects/$projectId',
      params: { projectId: id },
      search: { tab: 'tasks' },
    });
  };

  return (
    <form onSubmit={submit} className="grid gap-6">
      <div className="grid gap-1.5">
        <DialogTitle className="text-2xl font-light">New project</DialogTitle>
        <DialogDescription>
          Give it a name. Dates, hours and structure live in its Settings tab.
        </DialogDescription>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="new-project-name">Name</Label>
        <Input
          id="new-project-name"
          autoFocus
          value={name}
          maxLength={120}
          onChange={(event) => setName(event.target.value)}
        />
      </div>
      <div className="grid gap-1.5">
        <Label>
          Inside
          <span className="font-normal text-foreground/75">(optional)</span>
        </Label>
        <ProjectPicker
          value={parent}
          onChange={setParent}
          noneLabel="Top level"
          className="max-w-none"
          isDisabled={(candidate) => candidate.depth + 2 > MAX_PROJECT_DEPTH}
        />
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" disabled={!named || pending}>
          Create project
        </Button>
      </div>
    </form>
  );
}
