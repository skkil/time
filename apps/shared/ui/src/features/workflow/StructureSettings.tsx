import {
  ArrowDownIcon,
  ArrowUpIcon,
  DownloadIcon,
  LayoutTemplateIcon,
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
  Preset,
  Project,
} from '@/backend';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { AutosaveInput } from '@/features/projects/AutosaveInput';
import { useAutosave } from '@/features/projects/autosave';
import { useTasks } from '@/features/tasks/api';
import { offerUndo } from '@/lib/undo';
import { cn } from '@/lib/utils';

import { PresetPicker } from './PresetPicker';
import { TYPE_ICONS, TypeIcon } from './TypeIcon';
import {
  CATEGORIES,
  useApplyPreset,
  useCreateMilestone,
  useCreateStatus,
  useCreateType,
  useDeleteMilestone,
  useDeleteStatus,
  useDeleteType,
  useReorderStatus,
  useSavePreset,
  useSetMilestoneLabel,
  useUpdateMilestone,
  useUpdateStatus,
  useUpdateType,
} from './api';

const select =
  'h-8 rounded-lg border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30';

function TurnOn({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <Button type="button" variant="outline" size="sm" onClick={onClick}>
      {label}
    </Button>
  );
}

function AddButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={onClick}
      className="-ml-2.5 w-fit text-foreground/75"
    >
      <PlusIcon />
      {label}
    </Button>
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
  const trigger = (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      aria-label={`Delete ${item.name}`}
      onClick={used === 0 ? () => onRemove(null) : undefined}
      className="text-foreground/75"
    >
      <Trash2Icon />
    </Button>
  );
  if (used === 0) return trigger;
  return (
    <Popover>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent className="grid w-64 gap-3 text-sm">
        <p>
          {used} {used === 1 ? 'item uses' : 'items use'} “{item.name}”. Where
          should {used === 1 ? 'it' : 'they'} go?
        </p>
        <select
          value={target}
          aria-label="Move items to"
          onChange={(event) => setTarget(event.target.value)}
          className={select}
        >
          {others.map((other) => (
            <option key={other.id} value={other.id}>
              {other.name}
            </option>
          ))}
          <option value="">Nowhere (clear it)</option>
        </select>
        <Button type="button" onClick={() => onRemove(target || null)}>
          Move and delete
        </Button>
      </PopoverContent>
    </Popover>
  );
}

export function ItemTypes({
  projectId,
  types,
}: {
  projectId: Id;
  types: ItemType[];
}) {
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
  if (types.length === 0)
    return <TurnOn label="Turn on types" onClick={() => add()} />;
  return (
    <div className="grid gap-2">
      <ul className="grid gap-2">
        {types.map((type) => (
          <TypeRow
            key={type.id}
            type={type}
            action={
              <RemoveWithMove
                item={type}
                others={types.filter((other) => other.id !== type.id)}
                used={tasks.filter((task) => task.typeId === type.id).length}
                onRemove={(replacement) =>
                  remove.mutate({ id: type.id, replacement })
                }
              />
            }
          />
        ))}
      </ul>
      <AddButton label="Add a type" onClick={() => add({ name: 'New type' })} />
    </div>
  );
}

function TypeRow({ type, action }: { type: ItemType; action: ReactNode }) {
  const update = useUpdateType();
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
    <li className="grid gap-2 rounded-lg border border-white/[.07] p-2">
      <div className="flex items-center gap-2">
        <Popover>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label={`Icon for ${type.name}`}
            >
              <TypeIcon icon={type.icon} />
            </Button>
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
        <AutosaveInput
          value={type.name}
          maxLength={40}
          aria-label="Type name"
          className="flex-1"
          onSave={(name) => {
            const trimmed = name.trim();
            if (!trimmed || trimmed === type.name) return false;
            save({ name: trimmed });
            return true;
          }}
        />
        <select
          value={type.kind}
          aria-label={`Kind of ${type.name}`}
          onChange={(event) => save({ kind: event.target.value })}
          className={select}
        >
          <option value="task">Task</option>
          <option value="event">Event</option>
          <option value="record">Record (has phases)</option>
        </select>
        {action}
      </div>
      <div className="flex flex-wrap items-center gap-2 pl-10 text-sm text-foreground/75">
        <AutosaveInput
          value={type.defaultMinutes?.toString() ?? ''}
          inputMode="numeric"
          aria-label={`Default length of ${type.name} in minutes`}
          className="w-16"
          onSave={(text) => {
            const digits = text.replace(/\D/g, '');
            const next = digits ? Number(digits) : null;
            if (next === type.defaultMinutes) return false;
            save({ defaultMinutes: next });
            return true;
          }}
        />
        <span>minutes by default</span>
      </div>
      <div className="pl-10">
        <ChecklistInput
          value={type.checklist}
          label={`Default checklist for ${type.name}, one item per line`}
          onSave={(checklist) => {
            if (checklist === type.checklist) return false;
            save({ checklist });
            return true;
          }}
        />
      </div>
    </li>
  );
}

function ChecklistInput({
  value,
  label,
  onSave,
}: {
  value: string;
  label: string;
  onSave: (next: string) => boolean;
}) {
  const draft = useAutosave(value, onSave);
  return (
    <textarea
      value={draft.value}
      rows={1}
      aria-label={label}
      placeholder="Default checklist, one per line"
      className="field-sizing-content w-full resize-none rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
      onChange={(event) => draft.onChange(event.target.value)}
      onBlur={draft.onBlur}
    />
  );
}

export function Statuses({
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
  if (statuses.length === 0)
    return <TurnOn label="Turn on statuses" onClick={() => void turnOn()} />;
  return (
    <div className="grid gap-2">
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
                others={statuses.filter((other) => other.id !== status.id)}
                used={
                  tasks.filter((task) => task.statusId === status.id).length
                }
                onRemove={(replacement) =>
                  remove.mutate({ id: status.id, replacement })
                }
              />
            }
          />
        ))}
      </ul>
      <AddButton
        label="Add a status"
        onClick={() =>
          create.mutate({
            projectId,
            input: { name: 'New status', category: 'active' },
          })
        }
      />
    </div>
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
  return (
    <li className="flex items-center gap-1.5">
      <div className="flex flex-col">
        <button
          type="button"
          aria-label={`Move ${status.name} up`}
          disabled={!onUp}
          onClick={onUp}
          className="text-foreground/75 hover:text-foreground disabled:opacity-20"
        >
          <ArrowUpIcon className="size-3.5" />
        </button>
        <button
          type="button"
          aria-label={`Move ${status.name} down`}
          disabled={!onDown}
          onClick={onDown}
          className="text-foreground/75 hover:text-foreground disabled:opacity-20"
        >
          <ArrowDownIcon className="size-3.5" />
        </button>
      </div>
      <AutosaveInput
        value={status.name}
        maxLength={40}
        aria-label="Status name"
        className="flex-1"
        onSave={(name) => {
          const trimmed = name.trim();
          if (!trimmed || trimmed === status.name) return false;
          update.mutate({
            id: status.id,
            input: { name: trimmed, category: status.category },
          });
          return true;
        }}
      />
      <select
        value={status.category}
        aria-label={`Category of ${status.name}`}
        onChange={(event) =>
          update.mutate({
            id: status.id,
            input: { name: status.name, category: event.target.value },
          })
        }
        className={select}
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

export function Milestones({
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
  if (label === '')
    return (
      <TurnOn
        label="Turn on milestones"
        onClick={() => setLabel.mutate({ id: projectId, label: 'Milestones' })}
      />
    );
  const turnOff = () =>
    setLabel.mutate(
      { id: projectId, label: '' },
      {
        onSuccess: () =>
          offerUndo(`Turned off ${label.toLowerCase()}`, () =>
            setLabel.mutateAsync({ id: projectId, label }),
          ),
      },
    );
  return (
    <div className="grid gap-2">
      {milestones.length > 0 && (
        <ul className="grid gap-1.5">
          {milestones.map((milestone) => (
            <MilestoneRow key={milestone.id} milestone={milestone} />
          ))}
        </ul>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <AddButton
          label="Add"
          onClick={() =>
            create.mutate({
              projectId,
              input: {
                name: `New ${label.toLowerCase().replace(/s$/, '')}`,
                date: null,
              },
            })
          }
        />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={turnOff}
          className="text-foreground/75"
        >
          Turn off
        </Button>
      </div>
    </div>
  );
}

function MilestoneRow({ milestone }: { milestone: Milestone }) {
  const update = useUpdateMilestone();
  const remove = useDeleteMilestone();
  return (
    <li className="flex items-center gap-1.5">
      <AutosaveInput
        value={milestone.name}
        maxLength={80}
        aria-label="Milestone name"
        className="flex-1"
        onSave={(name) => {
          const trimmed = name.trim();
          if (!trimmed || trimmed === milestone.name) return false;
          update.mutate({
            id: milestone.id,
            input: { name: trimmed, date: milestone.date },
          });
          return true;
        }}
      />
      <Input
        type="date"
        value={milestone.date ?? ''}
        aria-label={`Date of ${milestone.name}`}
        className="w-40"
        onChange={(event) =>
          update.mutate({
            id: milestone.id,
            input: { name: milestone.name, date: event.target.value || null },
          })
        }
      />
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label={`Delete ${milestone.name}`}
        onClick={() => remove.mutate(milestone.id)}
        className="text-foreground/75"
      >
        <Trash2Icon />
      </Button>
    </li>
  );
}

export function MilestoneLabel({
  projectId,
  label,
  id,
}: {
  projectId: Id;
  label: string;
  id?: string;
}) {
  const setLabel = useSetMilestoneLabel();
  return (
    <AutosaveInput
      id={id}
      value={label}
      maxLength={40}
      className="max-w-48"
      onSave={(next) => {
        const trimmed = next.trim();
        if (!trimmed || trimmed === label) return false;
        setLabel.mutate({ id: projectId, label: trimmed });
        return true;
      }}
    />
  );
}

export function Templates({ project }: { project: Project }) {
  const save = useSavePreset();
  const [choosing, setChoosing] = useState(false);
  return (
    <div className="flex flex-wrap gap-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setChoosing(true)}
      >
        <LayoutTemplateIcon />
        Start from a template…
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() =>
          save.mutate(project.id, {
            onSuccess: (path) => toast(`Saved to ${path}`),
          })
        }
        className="text-foreground/75"
      >
        <DownloadIcon />
        Save this setup as a template
      </Button>
      <Dialog open={choosing} onOpenChange={setChoosing}>
        <DialogContent className="p-8 sm:max-w-xl">
          {choosing && (
            <TemplateForm project={project} onDone={() => setChoosing(false)} />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function TemplateForm({
  project,
  onDone,
}: {
  project: Project;
  onDone: () => void;
}) {
  const apply = useApplyPreset();
  const [preset, setPreset] = useState<Preset | null>(null);
  const usable = preset !== null && preset.key !== 'simple';
  return (
    <div className="grid gap-6">
      <div className="grid gap-1.5">
        <DialogTitle className="text-2xl font-light">
          Start from a template
        </DialogTitle>
        <DialogDescription>
          A template adds its item types, statuses, milestones and views to this
          project. Tasks and sections stay as they are.
        </DialogDescription>
      </div>
      <PresetPicker value={preset} onChange={setPreset} color={project.color} />
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button
          type="button"
          disabled={!usable || apply.isPending}
          onClick={() =>
            preset &&
            apply.mutate(
              { id: project.id, preset },
              {
                onSuccess: () => {
                  toast(`Applied ${preset.name}`);
                  onDone();
                },
              },
            )
          }
        >
          Apply template
        </Button>
      </div>
    </div>
  );
}
