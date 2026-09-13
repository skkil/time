import { MoreHorizontalIcon, PencilIcon, Trash2Icon } from 'lucide-react';
import { useState } from 'react';

import type { Organization } from '@/bindings';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

import { useDeleteOrganization, useRenameOrganization } from './organizations';

export function OrganizationHeading({
  organization,
}: {
  organization: Organization;
}) {
  const rename = useRenameOrganization();
  const remove = useDeleteOrganization();
  const [renaming, setRenaming] = useState(false);

  if (renaming)
    return (
      <input
        autoFocus
        defaultValue={organization.name}
        maxLength={80}
        aria-label="Organization name"
        onBlur={(event) => {
          const name = event.target.value.trim();
          if (name && name !== organization.name)
            rename.mutate({ id: organization.id, name });
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
    <div className="group/org mt-4 mb-1 flex h-6 items-center px-2">
      <h3
        className="min-w-0 flex-1 truncate font-sans text-xs font-semibold text-muted-foreground"
        onDoubleClick={() => setRenaming(true)}
      >
        {organization.name}
      </h3>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label={`${organization.name} options`}
            className="hidden size-5 place-items-center rounded-sm text-foreground/45 group-hover/org:grid hover:text-foreground focus-visible:grid data-[state=open]:grid"
          >
            <MoreHorizontalIcon className="size-3.5" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-52">
          <DropdownMenuItem onSelect={() => setRenaming(true)}>
            <PencilIcon />
            Rename
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => remove.mutate(organization.id)}>
            <Trash2Icon />
            Remove organization
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
