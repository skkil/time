import { ChevronDownIcon, FoldersIcon, PlusIcon } from 'lucide-react';
import { useState } from 'react';

import type { Id } from '@/backend';
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

import { useCreateGroup, useGroups } from './groups';

export function GroupPicker({
  value,
  onChange,
}: {
  value: Id | null;
  onChange: (id: Id | null) => void;
}) {
  const groups = useGroups();
  const create = useCreateGroup();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const selected = value === null ? undefined : groups.byId.get(value);
  const typed = query.trim();
  const exists = groups.list.some(
    (group) => group.name.toLowerCase() === typed.toLowerCase(),
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
          <FoldersIcon
            className="size-3.5 shrink-0 text-foreground/75"
            strokeWidth={1.5}
          />
          <span
            className={selected ? 'truncate' : 'truncate text-foreground/75'}
          >
            {selected?.name ?? 'None'}
          </span>
          <ChevronDownIcon className="ml-auto size-3.5 text-foreground/75" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-0" align="start">
        <Command>
          <CommandInput
            placeholder="Find or add a group"
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
              {groups.list.map((group) => (
                <CommandItem
                  key={group.id}
                  value={`${group.name} ${group.id}`}
                  data-checked={value === group.id}
                  onSelect={() => choose(group.id)}
                >
                  <span className="truncate">{group.name}</span>
                </CommandItem>
              ))}
              {typed && !exists && (
                <CommandItem
                  value={`add ${typed}`}
                  disabled={create.isPending}
                  onSelect={() =>
                    create.mutate(typed, {
                      onSuccess: (group) => choose(group.id),
                    })
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
