import {
  ArrowDownIcon,
  ArrowUpIcon,
  DownloadIcon,
  PlusIcon,
  Trash2Icon,
} from 'lucide-react';
import { type ReactNode, useState } from 'react';
import { toast } from 'sonner';

import type {
  Id,
  ItemStatus,
  ItemType,
  ItemTypeInput,
  Milestone,
  Project,
} from '@/bindings';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { useTasks } from '@/features/tasks/api';
import { cn } from '@/lib/utils';

import { TYPE_ICONS, TypeIcon } from './TypeIcon';
import {
  CATEGORIES,
  useCreateMilestone,
  useCreateStatus,
  useCreateType,
  useDeleteMilestone,
  useDeleteStatus,
  useDeleteType,
  useDeleteView,
  useProjectWorkflow,
  useReorderStatus,
  useSavePreset,
  useSetMilestoneLabel,
  useUpdateMilestone,
  useUpdateStatus,
  useUpdateType,
} from './api';

const field =
  'rounded-md bg-white/[.06] px-2 py-1 text-sm outline-none ring-1 ring-white/10 focus:ring-white/40';

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint: string;
  children: ReactNode;
}) {
  return (
    <section className="grid gap-3 border-t border-white/[.07] pt-5">
      <div>
        <h3 className="text-sm font-medium">{title}</h3>
        <p className="text-xs text-foreground/50">{hint}</p>
      </div>
      {children}
    </section>
  );
}

function TurnOn({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-fit rounded-full px-3 py-1 text-sm text-foreground/75 ring-1 ring-white/20 hover:bg-white/10"
    >
      {label}
    </button>
  );
}

function RemoveWithMove<T extends { id: Id; name: string }>({
  item,
  others,
  used,
  onRemove,
}: {
  item: T;
  others: T[];
  used: number;
  onRemove: (replacement: Id | null) => void;
}) {
  const [target, setTarget] = useState<string>(
    others[0] ? String(others[0].id) : '',
  );
  if (used === 0)
    return (
      <button
        type="button"
        aria-label={`Delete ${item.name}`}
        onClick={() => onRemove(null)}
        className="grid size-7 place-items-center rounded-full text-foreground/40 hover:bg-white/10 hover:text-foreground"
      >
        <Trash2Icon className="size-3.5" />
      </button>
    );
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`Delete ${item.name}`}
          className="grid size-7 place-items-center rounded-full text-foreground/40 hover:bg-white/10 hover:text-foreground"
        >
          <Trash2Icon className="size-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="grid w-64 gap-3 text-sm">
        <p>
          {used} {used === 1 ? 'item uses' : 'items use'} “{item.name}”. Where
          should {used === 1 ? 'it' : 'they'} go?
        </p>
        <select
          value={target}
          aria-label="Move items to"
          onChange={(event) => setTarget(event.target.value)}
          className={field}
        >
          {others.map((other) => (
            <option key={other.id} value={other.id}>
              {other.name}
            </option>
          ))}
          <option value="">Nowhere (clear it)</option>
        </select>
        <button
          type="button"
          onClick={() => onRemove(target ? Number(target) : null)}
          className="rounded-full bg-white/90 px-3 py-1.5 font-medium text-[#0b1a22]"
        >
          Move and delete
        </button>
      </PopoverContent>
    </Popover>
  );
}

export function WorkflowSettings({ project }: { project: Project }) {
  const workflow = useProjectWorkflow(project.id);
  const save = useSavePreset();
  return (
    <div className="grid gap-6 px-6 pb-8">
      <Types projectId={project.id} types={workflow.types} />
      <Statuses projectId={project.id} statuses={workflow.statuses} />
      <Milestones
        projectId={project.id}
        label={workflow.milestoneLabel}
        milestones={workflow.milestones}
      />
      <Views
        views={workflow.views.map((view) => ({
          id: view.id,
          name: view.name,
          summary: `${view.layout}${view.groupBy !== 'none' ? ` by ${view.groupBy}` : ''}`,
        }))}
      />
      <section className="border-t border-white/[.07] pt-5">
        <button
          type="button"
          onClick={() =>
            save.mutate(project.id, {
              onSuccess: (path) => toast(`Saved to ${path}`),
            })
          }
          className="flex items-center gap-2 text-sm text-foreground/70 hover:text-foreground"
        >
          <DownloadIcon className="size-4" />
          Save this setup as a preset
        </button>
      </section>
    </div>
  );
}

function Types({ projectId, types }: { projectId: Id; types: ItemType[] }) {
  const create = useCreateType();
  const remove = useDeleteType();
  const { data: tasks = [] } = useTasks();
  const add = (input: Partial<ItemTypeInput> = {}) =>
    create.mutate({
      projectId,
      input: {
        name: 'Task',
        icon: 'circle',
        kind: 'task',
        defaultMinutes: null,
        checklist: '',
        ...input,
      },
    });
  return (
    <Section
      title="Item types"
      hint="Kinds of work in this project. Events happen at a time and sit on the calendar."
    >
      {types.length === 0 ? (
        <TurnOn label="Turn on types" onClick={() => add()} />
      ) : (
        <>
          <ul className="grid gap-2">
            {types.map((type) => (
              <TypeRow
                key={type.id}
                type={type}
                action={
                  <RemoveWithMove
                    item={type}
                    others={types.filter((t) => t.id !== type.id)}
                    used={tasks.filter((t) => t.typeId === type.id).length}
                    onRemove={(replacement) =>
                      remove.mutate({ id: type.id, replacement })
                    }
                  />
                }
              />
            ))}
          </ul>
          <button
            type="button"
            onClick={() => add({ name: 'New type' })}
            className="flex w-fit items-center gap-1.5 text-sm text-foreground/50 hover:text-foreground"
          >
            <PlusIcon className="size-3.5" />
            Add a type
          </button>
        </>
      )}
    </Section>
  );
}

function TypeRow({ type, action }: { type: ItemType; action: ReactNode }) {
  const update = useUpdateType();
  const [name, setName] = useState(type.name);
  const [minutes, setMinutes] = useState(type.defaultMinutes?.toString() ?? '');
  const [checklist, setChecklist] = useState(type.checklist);
  const save = (patch: Partial<ItemTypeInput>) =>
    update.mutate({
      id: type.id,
      input: {
        name: type.name,
        icon: type.icon,
        kind: type.kind,
        defaultMinutes: type.defaultMinutes,
        checklist: type.checklist,
        ...patch,
      },
    });
  return (
    <li className="grid gap-1.5 rounded-xl bg-white/[.03] p-2">
      <div className="flex items-center gap-2">
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label="Icon"
              className="grid size-7 place-items-center rounded-md ring-1 ring-white/15 hover:bg-white/10"
            >
              <TypeIcon icon={type.icon} />
            </button>
          </PopoverTrigger>
          <PopoverContent className="grid w-56 grid-cols-6 gap-1 p-2">
            {Object.keys(TYPE_ICONS).map((icon) => (
              <button
                key={icon}
                type="button"
                aria-label={icon}
                onClick={() => save({ icon })}
                className={cn(
                  'grid size-8 place-items-center rounded-md hover:bg-white/10',
                  icon === type.icon && 'bg-white/15',
                )}
              >
                <TypeIcon icon={icon} className="size-4" />
              </button>
            ))}
          </PopoverContent>
        </Popover>
        <input
          value={name}
          maxLength={40}
          aria-label="Type name"
          className={cn(field, 'min-w-0 flex-1')}
          onChange={(event) => setName(event.target.value)}
          onBlur={() => name.trim() && name !== type.name && save({ name })}
        />
        {action}
      </div>
      <div className="flex flex-wrap items-center gap-2 pl-9 text-xs text-foreground/60">
        <select
          value={type.kind}
          aria-label="Task or event"
          onChange={(event) => save({ kind: event.target.value })}
          className={field}
        >
          <option value="task">Task</option>
          <option value="event">Event</option>
        </select>
        <input
          value={minutes}
          inputMode="numeric"
          aria-label="Default length in minutes"
          placeholder="min"
          className={cn(field, 'w-14')}
          onChange={(event) =>
            setMinutes(event.target.value.replace(/\D/g, ''))
          }
          onBlur={() => {
            const next = minutes ? Number(minutes) : null;
            if (next !== type.defaultMinutes) save({ defaultMinutes: next });
          }}
        />
        <span>min by default</span>
      </div>
      <textarea
        value={checklist}
        rows={1}
        aria-label="Default checklist, one item per line"
        placeholder="Default checklist, one per line"
        className={cn(field, 'ml-9 field-sizing-content resize-none text-xs')}
        onChange={(event) => setChecklist(event.target.value)}
        onBlur={() => checklist !== type.checklist && save({ checklist })}
      />
    </li>
  );
}

function Statuses({
  projectId,
  statuses,
}: {
  projectId: Id;
  statuses: ItemStatus[];
}) {
  const create = useCreateStatus();
  const remove = useDeleteStatus();
  const reorder = useReorderStatus();
  const { data: tasks = [] } = useTasks();
  const turnOn = async () => {
    for (const [name, category] of [
      ['To do', 'todo'],
      ['In progress', 'active'],
      ['Done', 'done'],
    ])
      await create.mutateAsync({ projectId, input: { name, category } });
  };
  return (
    <Section
      title="Statuses"
      hint="Name them freely; each belongs to one of five fixed categories. Backlog items never count as overdue."
    >
      {statuses.length === 0 ? (
        <TurnOn label="Turn on statuses" onClick={turnOn} />
      ) : (
        <>
          <ul className="grid gap-1.5">
            {statuses.map((status, i) => (
              <StatusRow
                key={status.id}
                status={status}
                onUp={
                  i > 0
                    ? () =>
                        reorder.mutate({
                          id: status.id,
                          before: statuses[i - 1].id,
                        })
                    : undefined
                }
                onDown={
                  i < statuses.length - 1
                    ? () =>
                        reorder.mutate({
                          id: status.id,
                          before: statuses[i + 2]?.id ?? null,
                        })
                    : undefined
                }
                action={
                  <RemoveWithMove
                    item={status}
                    others={statuses.filter((s) => s.id !== status.id)}
                    used={tasks.filter((t) => t.statusId === status.id).length}
                    onRemove={(replacement) =>
                      remove.mutate({ id: status.id, replacement })
                    }
                  />
                }
              />
            ))}
          </ul>
          <button
            type="button"
            onClick={() =>
              create.mutate({
                projectId,
                input: { name: 'New status', category: 'active' },
              })
            }
            className="flex w-fit items-center gap-1.5 text-sm text-foreground/50 hover:text-foreground"
          >
            <PlusIcon className="size-3.5" />
            Add a status
          </button>
        </>
      )}
    </Section>
  );
}

function StatusRow({
  status,
  onUp,
  onDown,
  action,
}: {
  status: ItemStatus;
  onUp?: () => void;
  onDown?: () => void;
  action: ReactNode;
}) {
  const update = useUpdateStatus();
  const [name, setName] = useState(status.name);
  return (
    <li className="flex items-center gap-1.5">
      <div className="flex flex-col">
        <button
          type="button"
          aria-label={`Move ${status.name} up`}
          disabled={!onUp}
          onClick={onUp}
          className="text-foreground/40 hover:text-foreground disabled:opacity-20"
        >
          <ArrowUpIcon className="size-3" />
        </button>
        <button
          type="button"
          aria-label={`Move ${status.name} down`}
          disabled={!onDown}
          onClick={onDown}
          className="text-foreground/40 hover:text-foreground disabled:opacity-20"
        >
          <ArrowDownIcon className="size-3" />
        </button>
      </div>
      <input
        value={name}
        maxLength={40}
        aria-label="Status name"
        className={cn(field, 'min-w-0 flex-1')}
        onChange={(event) => setName(event.target.value)}
        onBlur={() =>
          name.trim() &&
          name !== status.name &&
          update.mutate({
            id: status.id,
            input: { name, category: status.category },
          })
        }
      />
      <select
        value={status.category}
        aria-label="Category"
        onChange={(event) =>
          update.mutate({
            id: status.id,
            input: { name: status.name, category: event.target.value },
          })
        }
        className={field}
      >
        {CATEGORIES.map((category) => (
          <option key={category.value} value={category.value}>
            {category.label}
          </option>
        ))}
      </select>
      {action}
    </li>
  );
}

function Milestones({
  projectId,
  label,
  milestones,
}: {
  projectId: Id;
  label: string;
  milestones: Milestone[];
}) {
  const setLabel = useSetMilestoneLabel();
  const create = useCreateMilestone();
  const [draft, setDraft] = useState(label);
  return (
    <Section
      title="Milestones"
      hint="Named, dated points that items work towards, like a release or an exam."
    >
      {label === '' ? (
        <TurnOn
          label="Turn on milestones"
          onClick={() =>
            setLabel.mutate({ id: projectId, label: 'Milestones' })
          }
        />
      ) : (
        <>
          <label className="flex items-center gap-2 text-xs text-foreground/60">
            Called
            <input
              value={draft}
              maxLength={40}
              aria-label="What milestones are called"
              className={cn(field, 'w-32')}
              onChange={(event) => setDraft(event.target.value)}
              onBlur={() =>
                draft.trim() &&
                draft !== label &&
                setLabel.mutate({ id: projectId, label: draft })
              }
            />
          </label>
          <ul className="grid gap-1.5">
            {milestones.map((milestone) => (
              <MilestoneRow key={milestone.id} milestone={milestone} />
            ))}
          </ul>
          <button
            type="button"
            onClick={() =>
              create.mutate({
                projectId,
                input: {
                  name: `New ${label.toLowerCase().replace(/s$/, '')}`,
                  date: null,
                },
              })
            }
            className="flex w-fit items-center gap-1.5 text-sm text-foreground/50 hover:text-foreground"
          >
            <PlusIcon className="size-3.5" />
            Add
          </button>
          <button
            type="button"
            onClick={() => setLabel.mutate({ id: projectId, label: '' })}
            className="w-fit text-xs text-foreground/40 hover:text-foreground"
          >
            Turn off
          </button>
        </>
      )}
    </Section>
  );
}

function MilestoneRow({ milestone }: { milestone: Milestone }) {
  const update = useUpdateMilestone();
  const remove = useDeleteMilestone();
  const [name, setName] = useState(milestone.name);
  return (
    <li className="flex items-center gap-1.5">
      <input
        value={name}
        maxLength={80}
        aria-label="Milestone name"
        className={cn(field, 'min-w-0 flex-1')}
        onChange={(event) => setName(event.target.value)}
        onBlur={() =>
          name.trim() &&
          name !== milestone.name &&
          update.mutate({
            id: milestone.id,
            input: { name, date: milestone.date },
          })
        }
      />
      <input
        type="date"
        value={milestone.date ?? ''}
        aria-label="Date"
        className={field}
        onChange={(event) =>
          update.mutate({
            id: milestone.id,
            input: { name: milestone.name, date: event.target.value || null },
          })
        }
      />
      <button
        type="button"
        aria-label={`Delete ${milestone.name}`}
        onClick={() => remove.mutate(milestone.id)}
        className="grid size-7 place-items-center rounded-full text-foreground/40 hover:bg-white/10 hover:text-foreground"
      >
        <Trash2Icon className="size-3.5" />
      </button>
    </li>
  );
}

function Views({
  views,
}: {
  views: { id: Id; name: string; summary: string }[];
}) {
  const remove = useDeleteView();
  return (
    <Section
      title="Views"
      hint="Saved ways to look at this project. Add and edit them from the tabs above the project."
    >
      {views.length === 0 ? (
        <p className="text-sm text-foreground/45">
          No saved views. Use + next to the project's tabs to add one.
        </p>
      ) : (
        <ul className="grid gap-1">
          {views.map((view) => (
            <li key={view.id} className="flex items-center gap-2 text-sm">
              <span className="flex-1">{view.name}</span>
              <span className="text-xs text-foreground/45">{view.summary}</span>
              <button
                type="button"
                aria-label={`Delete ${view.name}`}
                onClick={() => remove.mutate(view.id)}
                className="grid size-7 place-items-center rounded-full text-foreground/40 hover:bg-white/10 hover:text-foreground"
              >
                <Trash2Icon className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}
