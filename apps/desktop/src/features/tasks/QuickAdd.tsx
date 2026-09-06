import { type FormEvent, useMemo, useState } from 'react';

import type { TaskInput } from '@/bindings';
import { ProjectDot } from '@/features/projects/ProjectDot';
import { useProjectIndex, useProjects } from '@/features/projects/api';
import { formatEstimate, todayKey } from '@/lib/time';

import { SmartInput } from './SmartInput';
import { EMPTY_TASK, useCreateTask, useSections } from './api';
import { formatDue } from './meta';
import { parseQuickAdd } from './parse';

export function QuickAdd({
  defaults = {},
  onClose,
}: {
  defaults?: Partial<TaskInput>;
  onClose: () => void;
}) {
  const initial = { ...EMPTY_TASK, ...defaults };
  const { data: projects } = useProjects();
  const { data: sections } = useSections();
  const index = useProjectIndex();
  const create = useCreateTask();
  const [text, setText] = useState('');

  const parsed = useMemo(
    () =>
      parseQuickAdd(text, {
        today: todayKey(),
        projects: (projects ?? []).filter((project) => !project.archived),
        sections: sections ?? [],
        projectId: initial.projectId,
      }),
    [text, projects, sections, initial.projectId],
  );

  const task: TaskInput = {
    ...initial,
    title: parsed.title,
    dueDate: parsed.dueDate ?? initial.dueDate,
    dueTime: parsed.dueTime ?? (parsed.dueDate ? null : initial.dueTime),
    recurrence:
      parsed.recurrence ?? (parsed.dueDate ? null : initial.recurrence),
    deadline: parsed.deadline ?? initial.deadline,
    priority: parsed.priority ?? initial.priority,
    estimateMinutes: parsed.estimate ?? initial.estimateMinutes,
    projectId:
      parsed.projectId !== undefined ? parsed.projectId : initial.projectId,
    sectionId:
      parsed.sectionId !== undefined
        ? parsed.sectionId
        : parsed.projectId !== undefined
          ? null
          : initial.sectionId,
  };
  const project =
    task.projectId === null ? undefined : index.byId.get(task.projectId);

  const understood = [
    task.dueDate && formatDue(task),
    task.recurrence,
    task.estimateMinutes && `about ${formatEstimate(task.estimateMinutes)}`,
    task.priority < 4 && `priority ${task.priority}`,
  ].filter(Boolean);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!task.title) return;
    create.mutate(task, { onSuccess: onClose });
  };

  return (
    <form
      onSubmit={submit}
      className="grid gap-4 rounded-[28px] bg-[rgba(10,22,34,.55)] px-8 py-7 shadow-[0_30px_90px_rgba(0,0,0,.35)] ring-1 ring-white/15 backdrop-blur-2xl"
    >
      <SmartInput
        autoFocus
        value={text}
        tokens={parsed.tokens}
        placeholder="What’s on your mind?"
        className="text-2xl font-light"
        onChange={setText}
        onKeyDown={(event) => {
          if (event.key === 'Enter') submit(event);
        }}
      />
      <p className="flex flex-wrap items-center gap-x-2 text-sm text-foreground/55">
        <span className="flex items-center gap-1.5">
          {project && <ProjectDot color={project.color} />}
          {project?.name ?? 'Inbox'}
        </span>
        {understood.map((part) => (
          <span key={String(part)} className="flex items-center gap-2">
            <span className="text-foreground/25">·</span>
            {part}
          </span>
        ))}
        <span className="ml-auto text-xs text-foreground/35">
          tomorrow 3pm · #project · for 1h · Enter to add
        </span>
      </p>
    </form>
  );
}
