import { ListTodoIcon, PlusIcon, XIcon } from 'lucide-react';
import { type ReactNode, useMemo, useState } from 'react';

import type { Id, Task } from '@/bindings';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ProjectDot } from '@/features/projects/ProjectDot';
import { useProjectIndex } from '@/features/projects/api';
import { formatEstimate } from '@/lib/time';

import { useTasks } from './api';

export function TaskCommand({
  value,
  onSelect,
  onCreate,
  placeholder = 'Find a task',
  autoFocus,
}: {
  value?: Id | null;
  onSelect: (task: Task) => void;
  onCreate?: (title: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
}) {
  const { data: tasks } = useTasks();
  const index = useProjectIndex();
  const [search, setSearch] = useState('');
  const open = useMemo(
    () => (tasks ?? []).filter((task) => task.completedAt === null),
    [tasks],
  );
  const trimmed = search.trim();

  return (
    <Command>
      <CommandInput
        autoFocus={autoFocus}
        placeholder={placeholder}
        value={search}
        onValueChange={setSearch}
      />
      <CommandList>
        <CommandEmpty>
          {onCreate ? 'No match. Create it below.' : 'No matching task.'}
        </CommandEmpty>
        <CommandGroup>
          {open.map((task) => {
            const project =
              task.projectId === null
                ? undefined
                : index.byId.get(task.projectId);
            return (
              <CommandItem
                key={task.id}
                value={`${task.title} ${task.id}`}
                data-checked={value === task.id}
                onSelect={() => onSelect(task)}
              >
                <ProjectDot color={project?.color} />
                <span className="truncate">{task.title}</span>
                {task.estimateMinutes !== null && value !== task.id && (
                  <CommandShortcut className="tracking-normal">
                    {formatEstimate(task.estimateMinutes)}
                  </CommandShortcut>
                )}
              </CommandItem>
            );
          })}
        </CommandGroup>
        {onCreate && trimmed && (
          <CommandGroup forceMount>
            <CommandItem
              forceMount
              value={`create ${trimmed}`}
              onSelect={() => onCreate(trimmed)}
            >
              <PlusIcon />
              Create “{trimmed}”
            </CommandItem>
          </CommandGroup>
        )}
      </CommandList>
    </Command>
  );
}

export function TaskPicker({
  value,
  onChange,
  trigger,
}: {
  value: Id | null;
  onChange: (task: Task | null) => void;
  trigger?: ReactNode;
}) {
  const { data: tasks } = useTasks();
  const [open, setOpen] = useState(false);
  const selected =
    value === null ? undefined : tasks?.find((task) => task.id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {trigger ?? (
          <Button variant="outline" size="sm" className="max-w-56 font-normal">
            <ListTodoIcon className="text-muted-foreground" />
            <span className="truncate">
              {selected ? selected.title : 'Link a task'}
            </span>
          </Button>
        )}
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start">
        <TaskCommand
          value={value}
          onSelect={(task) => {
            onChange(task);
            setOpen(false);
          }}
        />
        {value !== null && (
          <div className="border-t p-1">
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start"
              onClick={() => {
                onChange(null);
                setOpen(false);
              }}
            >
              <XIcon />
              Unlink task
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
