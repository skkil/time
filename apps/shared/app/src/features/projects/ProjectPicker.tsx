import { ChevronDownIcon, InboxIcon } from 'lucide-react';
import { type ReactNode, useState } from 'react';

import type { Id } from '@/backend';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
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
import { cn } from '@/lib/utils';

import { ProjectDot } from './ProjectDot';
import { useProjectIndex } from './api';
import { type ProjectNode, projectPath } from './tree';

type ProjectPickerProps = {
  value: Id | null;
  onChange: (id: Id | null) => void;
  noneLabel?: string;
  isDisabled?: (node: ProjectNode) => boolean;
  trigger?: ReactNode;
  className?: string;
  children?: ReactNode;
};

export function ProjectPicker({
  value,
  onChange,
  noneLabel = 'No project',
  isDisabled,
  trigger,
  className,
  children,
}: ProjectPickerProps) {
  const index = useProjectIndex();
  const [open, setOpen] = useState(false);
  const selected = value === null ? undefined : index.byId.get(value);

  const choose = (id: Id | null) => {
    onChange(id);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {trigger ?? (
          <Button
            variant="outline"
            size="sm"
            className={cn('max-w-56 justify-start font-normal', className)}
          >
            {selected ? (
              <ProjectDot color={selected.color} />
            ) : (
              <InboxIcon className="text-muted-foreground" />
            )}
            <span className="truncate">
              {selected ? selected.name : noneLabel}
            </span>
            <ChevronDownIcon className="ml-auto text-muted-foreground" />
          </Button>
        )}
      </PopoverTrigger>
      <PopoverContent className="w-64 p-0" align="start">
        <Command>
          <CommandInput placeholder="Find a project" />
          <CommandList>
            <CommandEmpty>No matching project.</CommandEmpty>
            <CommandGroup>
              <CommandItem
                value={noneLabel}
                data-checked={value === null}
                onSelect={() => choose(null)}
              >
                <InboxIcon className="text-muted-foreground" />
                {noneLabel}
              </CommandItem>
              {index.active.map((node) => (
                <CommandItem
                  key={node.id}
                  value={`${projectPath(index, node.id)} ${node.id}`}
                  disabled={isDisabled?.(node)}
                  data-checked={value === node.id}
                  onSelect={() => choose(node.id)}
                >
                  <span
                    style={{ width: node.depth * 14 }}
                    className="shrink-0"
                  />
                  <ProjectDot color={node.color} />
                  <span className="truncate">{node.name}</span>
                </CommandItem>
              ))}
              {children}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
