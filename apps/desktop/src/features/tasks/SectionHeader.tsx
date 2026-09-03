import {
  ChevronRightIcon,
  MoreHorizontalIcon,
  PencilIcon,
  Trash2Icon,
} from 'lucide-react';
import { useState } from 'react';

import type { Section } from '@/bindings';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

import { useCollapseSection, useDeleteSection, useRenameSection } from './api';

export function SectionName({
  section,
  onDone,
}: {
  section: Section;
  onDone: () => void;
}) {
  const rename = useRenameSection();
  const [name, setName] = useState(section.name);
  return (
    <input
      autoFocus
      value={name}
      maxLength={120}
      aria-label="Section name"
      className="min-w-0 flex-1 rounded-sm bg-card px-1.5 py-0.5 font-sans text-sm font-semibold outline-2 outline-ring"
      onChange={(event) => setName(event.target.value)}
      onBlur={() => {
        if (name.trim() && name !== section.name)
          rename.mutate({ id: section.id, name });
        onDone();
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter') event.currentTarget.blur();
        if (event.key === 'Escape') {
          setName(section.name);
          onDone();
        }
      }}
    />
  );
}

export function SectionMenu({
  section,
  count,
  onRename,
}: {
  section: Section;
  count: number;
  onRename: () => void;
}) {
  const remove = useDeleteSection();
  const [confirming, setConfirming] = useState(false);
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            size="icon-xs"
            variant="ghost"
            aria-label={`${section.name} actions`}
            className="text-muted-foreground"
          >
            <MoreHorizontalIcon />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={onRename}>
            <PencilIcon />
            Rename
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            onSelect={() => setConfirming(true)}
          >
            <Trash2Icon />
            Delete section
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{section.name}”?</AlertDialogTitle>
            <AlertDialogDescription>
              {count > 0
                ? `Its ${count} open task${count === 1 ? '' : 's'} will be deleted too.`
                : 'The section is empty.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep</AlertDialogCancel>
            <AlertDialogAction onClick={() => remove.mutate(section.id)}>
              Delete section
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export function SectionHeader({
  section,
  count,
}: {
  section: Section;
  count: number;
}) {
  const collapse = useCollapseSection();
  const [renaming, setRenaming] = useState(false);
  return (
    <div className="group/section relative flex h-9 items-center gap-1.5 border-b">
      <button
        type="button"
        aria-label={
          section.collapsed
            ? `Expand ${section.name}`
            : `Collapse ${section.name}`
        }
        aria-expanded={!section.collapsed}
        className="absolute -left-7 rounded-sm p-0.5 text-muted-foreground hover:text-foreground"
        onClick={() =>
          collapse.mutate({ id: section.id, collapsed: !section.collapsed })
        }
      >
        <ChevronRightIcon
          className={cn(
            'size-4 transition-transform',
            !section.collapsed && 'rotate-90',
          )}
        />
      </button>
      {renaming ? (
        <SectionName section={section} onDone={() => setRenaming(false)} />
      ) : (
        <h2
          className="truncate font-sans text-sm font-semibold"
          onDoubleClick={() => setRenaming(true)}
        >
          {section.name}
        </h2>
      )}
      <span className="text-xs text-muted-foreground">{count}</span>
      <div className="ml-auto opacity-0 group-focus-within/section:opacity-100 group-hover/section:opacity-100 has-[[data-state=open]]:opacity-100">
        <SectionMenu
          section={section}
          count={count}
          onRename={() => setRenaming(true)}
        />
      </div>
    </div>
  );
}

export function AddSection({
  onAdd,
  always = false,
}: {
  onAdd: (name: string) => void;
  always?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');

  if (editing)
    return (
      <form
        className="my-3 grid gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          if (!name.trim()) return;
          onAdd(name);
          setName('');
          setEditing(false);
        }}
      >
        <input
          autoFocus
          value={name}
          maxLength={120}
          placeholder="Name this section"
          aria-label="Section name"
          className="h-9 rounded-md border bg-card px-2.5 text-sm font-semibold outline-none focus:border-ring/50"
          onChange={(event) => setName(event.target.value)}
          onKeyDown={(event) => event.key === 'Escape' && setEditing(false)}
        />
        <div className="flex gap-2">
          <Button type="submit" size="sm" disabled={!name.trim()}>
            Add section
          </Button>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={() => setEditing(false)}
          >
            Cancel
          </Button>
        </div>
      </form>
    );

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      className={cn(
        'group/add-section my-1 flex h-7 w-full items-center gap-3 text-sm font-medium text-now opacity-0 transition-opacity hover:opacity-100 focus-visible:opacity-100',
        always && 'text-muted-foreground opacity-100 hover:text-now',
      )}
    >
      <span className="h-px flex-1 bg-current opacity-40" />
      Add section
      <span className="h-px flex-1 bg-current opacity-40" />
    </button>
  );
}
