import { useNavigate } from '@tanstack/react-router';
import {
  CalendarCheckIcon,
  CalendarRangeIcon,
  InboxIcon,
  NotebookPenIcon,
  RepeatIcon,
  SunsetIcon,
  TimerIcon,
} from 'lucide-react';

import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { ProjectDot } from '@/features/projects/ProjectDot';
import { useProjectIndex } from '@/features/projects/api';
import { projectPath } from '@/features/projects/tree';
import { PriorityCheck } from '@/features/tasks/PriorityCheck';
import { useTasks } from '@/features/tasks/api';
import { useTaskDialog } from '@/features/tasks/task-dialog-context';
import { mondayOf, todayKey } from '@/lib/time';

export function SearchDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const navigate = useNavigate();
  const { openTask } = useTaskDialog();
  const { data: tasks } = useTasks();
  const index = useProjectIndex();
  const week = mondayOf(todayKey());

  const go = (run: () => void) => {
    onOpenChange(false);
    run();
  };

  const pages = [
    {
      label: 'Day',
      icon: CalendarCheckIcon,
      run: () => navigate({ to: '/', search: { view: 'day', week } }),
    },
    {
      label: 'Week',
      icon: CalendarRangeIcon,
      run: () => navigate({ to: '/', search: { view: 'week', week } }),
    },
    {
      label: 'Inbox',
      icon: InboxIcon,
      run: () => navigate({ to: '/projects' }),
    },
    {
      label: 'Someday',
      icon: SunsetIcon,
      run: () => navigate({ to: '/projects/someday' }),
    },
    {
      label: 'Reviews',
      icon: NotebookPenIcon,
      run: () => navigate({ to: '/reports/reviews' }),
    },
    {
      label: 'Time report',
      icon: TimerIcon,
      run: () => navigate({ to: '/reports/time', search: { week } }),
    },
    {
      label: 'Habits',
      icon: RepeatIcon,
      run: () => navigate({ to: '/reports/habits', search: { week } }),
    },
  ];

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Search"
      description="Find a task, project or page"
      className="sm:max-w-xl"
    >
      <Command>
        <CommandInput placeholder="Search tasks and projects…" />
        <CommandList className="max-h-[60vh]">
          <CommandEmpty>Nothing found.</CommandEmpty>
          <CommandGroup heading="Tasks">
            {(tasks ?? [])
              .filter((task) => task.completedAt === null)
              .map((task) => (
                <CommandItem
                  key={task.id}
                  value={`task ${task.id} ${task.title} ${task.notes.slice(0, 200)}`}
                  onSelect={() => go(() => openTask(task.id))}
                >
                  <PriorityCheck
                    priority={task.priority}
                    checked={false}
                    label=""
                    className="pointer-events-none size-3.5"
                    onToggle={() => {}}
                  />
                  <span className="truncate">{task.title}</span>
                  <span className="ml-auto truncate text-xs text-muted-foreground">
                    {task.projectId === null
                      ? 'Inbox'
                      : projectPath(index, task.projectId)}
                  </span>
                </CommandItem>
              ))}
          </CommandGroup>
          <CommandGroup heading="Projects">
            {index.active.map((node) => (
              <CommandItem
                key={node.id}
                value={`project ${node.id} ${projectPath(index, node.id)}`}
                onSelect={() =>
                  go(() =>
                    navigate({
                      to: '/projects/$projectId',
                      params: { projectId: node.id },
                    }),
                  )
                }
              >
                <ProjectDot color={node.color} />
                {projectPath(index, node.id)}
              </CommandItem>
            ))}
          </CommandGroup>
          <CommandGroup heading="Go to">
            {pages.map((page) => (
              <CommandItem
                key={page.label}
                value={`page ${page.label}`}
                onSelect={() => go(page.run)}
              >
                <page.icon className="text-muted-foreground" />
                {page.label}
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </Command>
    </CommandDialog>
  );
}
