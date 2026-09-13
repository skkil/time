import { useLayoutEffect, useRef, useState } from 'react';

import type { ItemStatus, Task } from '@/bindings';
import { AddStepForm, StepRow } from '@/features/tasks/StepRow';
import { useTaskIndex } from '@/features/tasks/api';
import { useProjectWorkflow, useSetTaskStatus } from '@/features/workflow/api';
import { cn } from '@/lib/utils';

import { useCreatePhaseTask, useRecordPhases, useSetPhaseNotes } from './api';

type Page = { key: string; status: ItemStatus | null; items: Task[] };

export function PhasePager({ task }: { task: Task }) {
  const workflow = useProjectWorkflow(task.projectId);
  const tasks = useTaskIndex();
  const { data: phases } = useRecordPhases(task.id);
  const scroller = useRef<HTMLDivElement>(null);
  const pageRefs = useRef<(HTMLElement | null)[]>([]);

  const children = tasks.children.get(task.id) ?? [];
  const unphased = children.filter(
    (child) => !workflow.statuses.some((s) => s.id === child.phaseId),
  );
  const pages: Page[] = [
    ...workflow.statuses.map((status) => ({
      key: String(status.id),
      status,
      items: children.filter((child) => child.phaseId === status.id),
    })),
    ...(unphased.length > 0
      ? [{ key: 'none', status: null, items: unphased }]
      : []),
  ];

  const scrollTo = (index: number, behavior: ScrollBehavior = 'smooth') => {
    const page = pageRefs.current[index];
    if (page) scroller.current?.scrollTo({ top: page.offsetTop, behavior });
  };

  const current = workflow.statuses.findIndex((s) => s.id === task.statusId);
  const [visible, setVisible] = useState(Math.max(current, 0));
  const loaded = phases !== undefined;
  useLayoutEffect(() => {
    const page = pageRefs.current[current];
    if (loaded && page) scroller.current?.scrollTo({ top: page.offsetTop });
  }, [loaded, current]);

  const onScroll = () => {
    const area = scroller.current;
    if (!area) return;
    const line = area.scrollTop + area.clientHeight / 3;
    let index = 0;
    pageRefs.current.forEach((page, i) => {
      if (page && page.offsetTop <= line) index = i;
    });
    setVisible(index);
  };

  if (!loaded) return null;

  return (
    <section
      aria-label="Phases"
      className="grid grid-cols-[148px_minmax(0,1fr)] gap-6"
    >
      <nav aria-label="Phases" className="grid content-start">
        {pages.map((page, i) => {
          const finished = page.items.filter((t) => t.completedAt !== null);
          return (
            <button
              key={page.key}
              type="button"
              aria-current={i === visible ? 'step' : undefined}
              onClick={() => scrollTo(i)}
              className="flex items-center gap-2 border-l-2 border-white/10 py-1.5 pr-1 pl-3 text-left text-sm text-foreground/50 transition-colors outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-white/40 aria-[current=step]:border-white/80 aria-[current=step]:text-foreground"
            >
              <span className="min-w-0 flex-1 truncate">
                {page.status?.name ?? 'No phase'}
              </span>
              {page.status?.id === task.statusId && (
                <span
                  aria-label="Current phase"
                  className="size-1.5 shrink-0 rounded-full bg-today"
                />
              )}
              {page.items.length > 0 && (
                <span className="text-xs text-foreground/40 tabular-nums">
                  {finished.length}/{page.items.length}
                </span>
              )}
            </button>
          );
        })}
      </nav>
      <div
        ref={scroller}
        onScroll={onScroll}
        className="relative h-80 snap-y snap-mandatory overflow-y-auto overscroll-contain pr-2"
      >
        {pages.map((page, i) => (
          <PhasePage
            key={page.key}
            ref={(node) => {
              pageRefs.current[i] = node;
            }}
            record={task}
            page={page}
            notes={
              phases.find((p) => p.statusId === page.status?.id)?.notes ?? ''
            }
          />
        ))}
      </div>
    </section>
  );
}

function PhasePage({
  ref,
  record,
  page,
  notes: savedNotes,
}: {
  ref: (node: HTMLElement | null) => void;
  record: Task;
  page: Page;
  notes: string;
}) {
  const setNotes = useSetPhaseNotes(record.id);
  const setStatus = useSetTaskStatus();
  const create = useCreatePhaseTask();
  const [notes, setDraft] = useState(savedNotes);
  const { status } = page;
  const isCurrent = status !== null && status.id === record.statusId;

  return (
    <article
      ref={ref}
      aria-label={status?.name ?? 'No phase'}
      className="flex min-h-full snap-start flex-col pb-8"
    >
      <div className="flex items-baseline gap-3">
        <h3 className="text-xl font-light">{status?.name ?? 'No phase'}</h3>
        {isCurrent ? (
          <span className="text-xs text-foreground/45">Current phase</span>
        ) : (
          status && (
            <button
              type="button"
              onClick={() =>
                setStatus.mutate({ id: record.id, statusId: status.id })
              }
              className="rounded-md text-xs text-foreground/60 underline-offset-4 outline-none hover:text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-white/40"
            >
              Move to {status.name}
            </button>
          )
        )}
      </div>
      {status && (
        <textarea
          value={notes}
          aria-label={`Notes for ${status.name}`}
          placeholder={`Notes for ${status.name}`}
          className="mt-2 field-sizing-content min-h-8 resize-none bg-transparent text-[15px] leading-relaxed text-foreground/80 outline-none placeholder:text-foreground/30"
          onChange={(event) => setDraft(event.target.value)}
          onBlur={() =>
            notes !== savedNotes &&
            setNotes.mutate({ statusId: status.id, notes })
          }
        />
      )}
      <div className={cn('grid gap-1', status ? 'mt-3' : 'mt-2')}>
        {page.items.map((item) => (
          <StepRow key={item.id} step={item} />
        ))}
        {status && (
          <AddStepForm
            label={`Add a task for ${status.name}`}
            onAdd={(title) =>
              create.mutate({ recordId: record.id, phaseId: status.id, title })
            }
          />
        )}
      </div>
    </article>
  );
}
