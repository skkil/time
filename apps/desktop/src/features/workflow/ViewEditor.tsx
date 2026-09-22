import { type FormEvent, useState } from 'react';

import type { Id, SavedView, ViewInput } from '@/bindings';
import { cn } from '@/lib/utils';

import {
  type ProjectWorkflow,
  useCreateView,
  useDeleteView,
  useUpdateView,
} from './api';
import { parseFilter } from './views';

const LAYOUTS = [
  { value: 'list', label: 'List' },
  { value: 'board', label: 'Board' },
  { value: 'calendar', label: 'Calendar' },
  { value: 'table', label: 'Table' },
];

const SORTS = [
  { value: 'manual', label: 'Your order' },
  { value: 'date', label: 'Date' },
  { value: 'deadline', label: 'Deadline' },
  { value: 'priority', label: 'Priority' },
  { value: 'title', label: 'Name' },
  { value: 'created', label: 'Newest' },
];

function Choice({
  options,
  value,
  onChange,
  label,
}: {
  options: { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
  label: string;
}) {
  return (
    <div className="grid gap-1.5">
      <span className="text-xs text-foreground/75">{label}</span>
      <div
        role="radiogroup"
        aria-label={label}
        className="flex flex-wrap gap-1"
      >
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={value === option.value}
            onClick={() => onChange(option.value)}
            className={cn(
              'rounded-full px-3 py-1 text-sm transition-colors',
              value === option.value
                ? 'bg-white/85 text-[#0b1a22]'
                : 'text-foreground/70 ring-1 ring-white/15 hover:bg-white/10',
            )}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function ViewEditor({
  projectId,
  workflow,
  view,
  onDone,
}: {
  projectId: Id;
  workflow: ProjectWorkflow;
  view?: SavedView;
  onDone: (id?: Id) => void;
}) {
  const create = useCreateView();
  const update = useUpdateView();
  const remove = useDeleteView();
  const initial = view ? parseFilter(view.filter) : {};
  const [name, setName] = useState(view?.name ?? '');
  const [layout, setLayout] = useState(view?.layout ?? 'list');
  const [groupBy, setGroupBy] = useState(view?.groupBy ?? 'section');
  const [sort, setSort] = useState(view?.sort ?? 'manual');
  const [hideDone, setHideDone] = useState(initial.hideDone ?? false);
  const [hideBacklog, setHideBacklog] = useState(initial.hideBacklog ?? false);
  const [hideWaiting, setHideWaiting] = useState(initial.hideWaiting ?? false);

  const groups = [
    { value: 'section', label: 'Section' },
    ...(workflow.statuses.length ? [{ value: 'status', label: 'Status' }] : []),
    ...(workflow.types.length ? [{ value: 'type', label: 'Type' }] : []),
    ...(workflow.milestoneLabel
      ? [{ value: 'milestone', label: workflow.milestoneLabel }]
      : []),
    { value: 'date', label: 'Date' },
    { value: 'none', label: 'Nothing' },
  ];
  const hasBacklog = workflow.statuses.some((s) => s.category === 'backlog');

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const input: ViewInput = {
      name: name.trim() || LAYOUTS.find((l) => l.value === layout)!.label,
      layout,
      groupBy,
      sort,
      filter: JSON.stringify({
        ...initial,
        hideDone: hideDone || undefined,
        hideBacklog: hideBacklog || undefined,
        hideWaiting: hideWaiting || undefined,
      }),
    };
    if (view)
      update.mutate(
        { id: view.id, input },
        { onSuccess: () => onDone(view.id) },
      );
    else create.mutate({ projectId, input }, { onSuccess: (id) => onDone(id) });
  };

  return (
    <form onSubmit={submit} className="grid gap-4">
      <input
        autoFocus
        value={name}
        maxLength={40}
        aria-label="View name"
        placeholder="View name"
        className="bg-transparent text-lg outline-none placeholder:text-foreground/35"
        onChange={(event) => setName(event.target.value)}
      />
      <Choice
        label="Layout"
        options={LAYOUTS}
        value={layout}
        onChange={setLayout}
      />
      {layout !== 'calendar' && (
        <Choice
          label={layout === 'board' ? 'Columns' : 'Group by'}
          options={groups}
          value={groupBy}
          onChange={setGroupBy}
        />
      )}
      <Choice label="Sort" options={SORTS} value={sort} onChange={setSort} />
      <div className="grid gap-1.5 text-sm">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={hideDone}
            onChange={(event) => setHideDone(event.target.checked)}
          />
          Hide finished items
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={hideWaiting}
            onChange={(event) => setHideWaiting(event.target.checked)}
          />
          Hide tasks still waiting on others
        </label>
        {hasBacklog && (
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={hideBacklog}
              onChange={(event) => setHideBacklog(event.target.checked)}
            />
            Hide the backlog
          </label>
        )}
      </div>
      <div className="flex items-center gap-2">
        {view && (
          <button
            type="button"
            onClick={() =>
              remove.mutate(view.id, { onSuccess: () => onDone() })
            }
            className="text-sm text-foreground/75 hover:text-foreground hover:underline"
          >
            Delete view
          </button>
        )}
        <button
          type="submit"
          className="ml-auto rounded-full bg-white/90 px-4 py-1.5 text-sm font-medium text-[#0b1a22] hover:bg-white"
        >
          {view ? 'Save' : 'Add view'}
        </button>
      </div>
    </form>
  );
}
