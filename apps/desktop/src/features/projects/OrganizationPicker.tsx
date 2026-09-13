import { Building2Icon, ChevronDownIcon, PlusIcon } from 'lucide-react';
import { useState } from 'react';

import type { Id } from '@/bindings';
import {
  Command,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

import { useCreateOrganization, useOrganizations } from './organizations';

export function OrganizationPicker({
  value,
  onChange,
}: {
  value: Id | null;
  onChange: (id: Id | null) => void;
}) {
  const organizations = useOrganizations();
  const create = useCreateOrganization();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const selected = value === null ? undefined : organizations.byId.get(value);
  const typed = query.trim();
  const exists = organizations.list.some(
    (org) => org.name.toLowerCase() === typed.toLowerCase(),
  );

  const choose = (id: Id | null) => {
    onChange(id);
    setOpen(false);
    setQuery('');
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex h-9 w-full max-w-64 items-center gap-2 rounded-full px-3 text-sm ring-1 ring-white/15 transition-colors outline-none hover:bg-white/[.06] focus-visible:ring-2 focus-visible:ring-white/50"
        >
          <Building2Icon
            className="size-3.5 shrink-0 text-foreground/50"
            strokeWidth={1.5}
          />
          <span
            className={selected ? 'truncate' : 'truncate text-foreground/50'}
          >
            {selected?.name ?? 'None'}
          </span>
          <ChevronDownIcon className="ml-auto size-3.5 text-foreground/40" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-0" align="start">
        <Command>
          <CommandInput
            placeholder="Find or add an organization"
            value={query}
            onValueChange={setQuery}
          />
          <CommandList>
            <CommandGroup>
              <CommandItem
                value="None"
                data-checked={value === null}
                onSelect={() => choose(null)}
              >
                None
              </CommandItem>
              {organizations.list.map((org) => (
                <CommandItem
                  key={org.id}
                  value={`${org.name} ${org.id}`}
                  data-checked={value === org.id}
                  onSelect={() => choose(org.id)}
                >
                  <span className="truncate">{org.name}</span>
                </CommandItem>
              ))}
              {typed && !exists && (
                <CommandItem
                  value={`add ${typed}`}
                  disabled={create.isPending}
                  onSelect={() =>
                    create.mutate(typed, { onSuccess: (org) => choose(org.id) })
                  }
                >
                  <PlusIcon />
                  Add “{typed}”
                </CommandItem>
              )}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
