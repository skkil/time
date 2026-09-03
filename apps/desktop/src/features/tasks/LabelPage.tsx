import { getRouteApi } from '@tanstack/react-router';
import { TagIcon } from 'lucide-react';
import { useMemo } from 'react';

import {
  EmptyState,
  Page,
  PageBody,
  PageHeader,
  Stat,
} from '@/components/page';

import { AddTaskRow, FlatTaskList } from './TaskList';
import { useLabels, useTasks } from './api';
import { byDayOrder } from './order';

const route = getRouteApi('/labels/$labelId');

export function LabelPage() {
  const { labelId } = route.useParams();
  const { data: labels, isPending } = useLabels();
  const { data: tasks } = useTasks();
  const label = labels?.find((candidate) => candidate.id === labelId);
  const tagged = useMemo(
    () =>
      (tasks ?? [])
        .filter(
          (task) =>
            task.completedAt === null && task.labelIds.includes(labelId),
        )
        .sort(
          (a, b) =>
            (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999') ||
            byDayOrder(a, b),
        ),
    [tasks, labelId],
  );

  if (!label && !isPending)
    return (
      <Page>
        <PageBody>
          <EmptyState title="This label doesn't exist anymore." />
        </PageBody>
      </Page>
    );

  return (
    <Page>
      <PageHeader
        title={
          <span className="flex items-center gap-2">
            <TagIcon className="size-5 text-muted-foreground" />
            {label?.name}
          </span>
        }
        meta={<Stat value={String(tagged.length)} label="open" />}
      />
      <PageBody>
        <div className="mx-auto max-w-3xl">
          <FlatTaskList tasks={tagged} />
          <AddTaskRow defaults={{ labelIds: [labelId] }} />
        </div>
      </PageBody>
    </Page>
  );
}
