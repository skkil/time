import { useMemo, useState } from 'react';
import { toast } from 'sonner';

import type { TaskInput } from '@/bindings';
import { ProjectDot } from '@/features/projects/ProjectDot';
import {
  useCreateProject,
  useProjectIndex,
  useProjects,
} from '@/features/projects/api';
import { EMPTY_TASK, useCreateTask, useSections } from '@/features/tasks/api';
import { formatDate, formatDue } from '@/features/tasks/meta';
import { useTaskDialog } from '@/features/tasks/task-dialog-context';
import { useSetTaskType, useWorkflow } from '@/features/workflow/api';
import {
  formatEstimate,
  minutesIntoDay,
  nowSeconds,
  todayKey,
} from '@/lib/time';
import { quoted } from '@/lib/undo';

import { SmartInput } from './SmartInput';
import { parseQuickAdd } from './parser/parse';

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
  const createProject = useCreateProject();
  const { openTask } = useTaskDialog();
  const { data: workflow } = useWorkflow();
  const setType = useSetTaskType();
  const [text, setText] = useState('');
  const [ignored, setIgnored] = useState<ReadonlySet<string>>(new Set());

  const parsed = useMemo(
    () =>
      parseQuickAdd(text, {
        today: todayKey(),
        nowMinutes: minutesIntoDay(nowSeconds()),
        ignored,
        projects: (projects ?? []).filter((project) => !project.archived),
        sections: sections ?? [],
        types: workflow?.types ?? [],
        projectId: initial.projectId,
      }),
    [text, ignored, projects, sections, workflow, initial.projectId],
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

  const type = workflow?.types.find((item) => item.id === parsed.typeId);
  const needsTime = type?.kind === 'event' && task.dueTime === null;
  const understood = [
    type && (needsTime ? `${type.name} needs a time` : type.name),
    task.dueDate && formatDue(task),
    task.recurrence,
    task.deadline && `deadline ${formatDate(task.deadline)}`,
    task.estimateMinutes && `about ${formatEstimate(task.estimateMinutes)}`,
    task.priority < 4 && `priority ${task.priority}`,
  ].filter(Boolean);

  const submit = (keepOpen: boolean) => {
    if (!task.title || needsTime) return;
    const place = [project?.name ?? 'Inbox', task.dueDate && formatDue(task)]
      .filter(Boolean)
      .join(' · ');
    create.mutate(task, {
      onSuccess: (created) => {
        if (type) setType.mutate({ id: created.id, typeId: type.id });
        toast(`Added ${quoted(created.title)} to ${place}`, {
          action: { label: 'Open', onClick: () => openTask(created.id) },
        });
        if (keepOpen) {
          setText('');
          setIgnored(new Set());
        } else onClose();
      },
    });
  };

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        submit(false);
      }}
      className="grid gap-4 rounded-[28px] bg-[rgba(10,22,34,.55)] px-8 py-7 shadow-[0_30px_90px_rgba(0,0,0,.35)] ring-1 ring-white/15 backdrop-blur-2xl"
    >
      <SmartInput
        autoFocus
        value={text}
        tokens={parsed.tokens}
        placeholder="What’s on your mind?"
        className="text-2xl font-light"
        onChange={setText}
        onIgnore={(phrase) =>
          setIgnored((current) => new Set(current).add(phrase.toLowerCase()))
        }
        onKeyDown={(event) => {
          if (event.key !== 'Enter') return;
          event.preventDefault();
          submit(event.shiftKey);
        }}
      />
      <p className="flex flex-wrap items-center gap-x-2 text-sm text-foreground/75">
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
        {!text && (
          <span className="ml-auto text-xs text-foreground/75">
            {'tomorrow 3pm · every mon · {fri} · p1 · #project'}
          </span>
        )}
      </p>
      {parsed.unknownProject && (
        <p className="flex items-center gap-3 text-sm text-foreground/70">
          No project called “{parsed.unknownProject}”.
          <button
            type="button"
            disabled={createProject.isPending}
            onClick={() =>
              createProject.mutate({
                name: parsed.unknownProject ?? '',
                parentId: null,
                color: 'blue',
              })
            }
            className="text-foreground underline underline-offset-4"
          >
            Create it
          </button>
        </p>
      )}
      <p className="text-xs text-foreground/75">
        Enter to add · Shift+Enter to add another
      </p>
    </form>
  );
}
