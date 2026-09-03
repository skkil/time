import { type FormEvent, useMemo, useState } from 'react';

import type { Id, TaskInput } from '@/bindings';
import { Button } from '@/components/ui/button';
import { useProjects } from '@/features/projects/api';
import { todayKey } from '@/lib/time';
import { cn } from '@/lib/utils';

import { SmartInput } from './SmartInput';
import {
  EMPTY_TASK,
  useCreateTask,
  useResolveLabels,
  useSections,
} from './api';
import {
  DeadlinePicker,
  type Due,
  DuePicker,
  EstimatePicker,
  LabelPicker,
  PlacementPicker,
  PriorityPicker,
} from './fields';
import { parseQuickAdd } from './parse';

type TaskEditorProps = {
  defaults?: Partial<TaskInput>;
  onClose: () => void;
  keepOpen?: boolean;
  autoFocus?: boolean;
  className?: string;
};

export function TaskEditor({
  defaults = {},
  onClose,
  keepOpen = false,
  autoFocus = true,
  className,
}: TaskEditorProps) {
  const initial = { ...EMPTY_TASK, ...defaults };
  const { data: projects } = useProjects();
  const { data: sections } = useSections();
  const create = useCreateTask();
  const resolveLabels = useResolveLabels();
  const [text, setText] = useState('');
  const [notes, setNotes] = useState('');
  const [due, setDue] = useState<Due>({
    dueDate: initial.dueDate,
    dueTime: initial.dueTime,
    recurrence: initial.recurrence,
  });
  const [deadline, setDeadline] = useState(initial.deadline);
  const [priority, setPriority] = useState(initial.priority);
  const [estimate, setEstimate] = useState(initial.estimateMinutes);
  const [labelIds, setLabelIds] = useState<Id[]>(initial.labelIds);
  const [placement, setPlacement] = useState({
    projectId: initial.projectId,
    sectionId: initial.sectionId,
  });

  const parsed = useMemo(
    () =>
      parseQuickAdd(text, {
        today: todayKey(),
        projects: (projects ?? []).filter((project) => !project.archived),
        sections: sections ?? [],
        projectId: placement.projectId,
      }),
    [text, projects, sections, placement.projectId],
  );

  const effective = {
    due: {
      dueDate: parsed.dueDate ?? due.dueDate,
      dueTime: parsed.dueTime ?? (parsed.dueDate ? null : due.dueTime),
      recurrence: parsed.recurrence ?? (parsed.dueDate ? null : due.recurrence),
    },
    deadline: parsed.deadline ?? deadline,
    priority: parsed.priority ?? priority,
    estimate: parsed.estimate ?? estimate,
    placement:
      parsed.projectId !== undefined
        ? { projectId: parsed.projectId, sectionId: parsed.sectionId ?? null }
        : parsed.sectionId !== undefined
          ? { ...placement, sectionId: parsed.sectionId }
          : placement,
  };

  const reset = () => {
    setText('');
    setNotes('');
    setPriority(initial.priority);
    setEstimate(initial.estimateMinutes);
    setDeadline(initial.deadline);
    setLabelIds(initial.labelIds);
    setDue({
      dueDate: initial.dueDate,
      dueTime: initial.dueTime,
      recurrence: initial.recurrence,
    });
  };

  const submit = async (event?: FormEvent) => {
    event?.preventDefault();
    if (!parsed.title) return;
    const typedLabels = await resolveLabels(parsed.labels);
    create.mutate(
      {
        ...initial,
        title: parsed.title,
        notes,
        ...effective.due,
        deadline: effective.deadline,
        priority: effective.priority,
        estimateMinutes: effective.estimate,
        labelIds: [...new Set([...labelIds, ...typedLabels])],
        projectId: effective.placement.projectId,
        sectionId: effective.placement.sectionId,
        parentId: initial.parentId,
      },
      {
        onSuccess: () => {
          if (keepOpen) reset();
          else onClose();
        },
      },
    );
  };

  return (
    <form
      onSubmit={submit}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && !event.defaultPrevented) {
          event.stopPropagation();
          onClose();
        }
      }}
      className={cn(
        'rounded-lg border bg-card shadow-xs focus-within:border-ring/50',
        className,
      )}
    >
      <div className="grid gap-1 px-3 pt-2.5">
        <SmartInput
          autoFocus={autoFocus}
          value={text}
          tokens={parsed.tokens}
          placeholder="Task name"
          className="font-medium"
          onChange={setText}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              void submit();
            }
          }}
        />
        <textarea
          value={notes}
          rows={1}
          placeholder="Description"
          aria-label="Description"
          className="field-sizing-content max-h-40 resize-none bg-transparent text-sm leading-5 outline-none placeholder:text-muted-foreground"
          onChange={(event) => setNotes(event.target.value)}
        />
      </div>
      <div className="flex flex-wrap gap-1.5 px-3 pt-2 pb-3">
        <DuePicker
          value={effective.due}
          onChange={(next) => {
            setDue(next);
          }}
        />
        <DeadlinePicker value={effective.deadline} onChange={setDeadline} />
        <PriorityPicker value={effective.priority} onChange={setPriority} />
        <LabelPicker
          value={labelIds}
          typed={parsed.labels}
          onChange={setLabelIds}
        />
        <EstimatePicker value={effective.estimate} onChange={setEstimate} />
      </div>
      <div className="flex items-center gap-2 border-t px-2 py-2">
        {initial.parentId === null ? (
          <PlacementPicker
            value={effective.placement}
            onChange={setPlacement}
          />
        ) : (
          <span className="px-2 text-sm text-muted-foreground">Sub-task</span>
        )}
        <div className="ml-auto flex gap-2">
          <Button type="button" variant="secondary" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            size="sm"
            disabled={!parsed.title || create.isPending}
          >
            Add task
          </Button>
        </div>
      </div>
    </form>
  );
}
