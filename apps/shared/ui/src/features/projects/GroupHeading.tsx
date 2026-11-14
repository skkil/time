import type { useSortable } from '@dnd-kit/sortable';
import { Link } from '@tanstack/react-router';
import {
  ArrowDownIcon,
  ArrowUpIcon,
  MoreHorizontalIcon,
  PencilIcon,
  Trash2Icon,
} from 'lucide-react';
import { useState } from 'react';

import type { Group } from '@/backend';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { stepBefore } from '@/lib/reorder';

import { useDeleteGroup, useRenameGroup, useReorderGroup } from './groups';

export function GroupHeading({
  group,
  siblings = [],
  drag,
}: {
  group: Group;
  siblings?: Group['id'][];
  drag?: {
    ref: (node: HTMLElement | null) => void;
    listeners: ReturnType<typeof useSortable>['listeners'];
  };
}) {
  const rename = useRenameGroup();
  const remove = useDeleteGroup();
  const reorder = useReorderGroup();
  const up = stepBefore(siblings, group.id, -1);
  const down = stepBefore(siblings, group.id, 1);
  const [renaming, setRenaming] = useState(false);

  if (renaming)
    return (
      <input
        autoFocus
        defaultValue={group.name}
        maxLength={80}
        aria-label="Group name"
        onBlur={(event) => {
          const name = event.target.value.trim();
          if (name && name !== group.name)
            rename.mutate({ id: group.id, name });
          setRenaming(false);
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter') event.currentTarget.blur();
          if (event.key === 'Escape') setRenaming(false);
        }}
        className="mx-2 mt-4 mb-1 h-6 w-[calc(100%-1rem)] rounded-sm bg-white/10 px-1 text-xs text-foreground outline-none focus-visible:ring-2 focus-visible:ring-white/40"
      />
    );

  return (
    <div
      ref={drag?.ref}
      {...drag?.listeners}
      className="group/org mt-4 mb-1 flex h-6 items-center px-2"
    >
      <h3 className="min-w-0 flex-1 truncate font-sans text-xs font-semibold text-muted-foreground">
        <Link
          to="/projects/groups/$groupId"
          params={{ groupId: group.id }}
          onDoubleClick={() => setRenaming(true)}
          className="rounded-sm outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-white/40 data-[status=active]:text-foreground"
        >
          {group.name}
        </Link>
      </h3>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label={`${group.name} options`}
            className="hidden size-5 place-items-center rounded-sm text-foreground/75 group-hover/org:grid hover:text-foreground focus-visible:grid data-[state=open]:grid"
          >
            <MoreHorizontalIcon className="size-3.5" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-52">
          <DropdownMenuItem onSelect={() => setRenaming(true)}>
            <PencilIcon />
            Rename
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={up === undefined}
            onSelect={() =>
              up !== undefined && reorder.mutate({ id: group.id, before: up })
            }
          >
            <ArrowUpIcon />
            Move up
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={down === undefined}
            onSelect={() =>
              down !== undefined &&
              reorder.mutate({ id: group.id, before: down })
            }
          >
            <ArrowDownIcon />
            Move down
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => remove.mutate(group.id)}>
            <Trash2Icon />
            Remove group
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
