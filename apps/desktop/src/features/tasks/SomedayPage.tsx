import { useMemo } from 'react';

import { EmptyState, Page, PageBody, PageHeader } from '@/components/page';

import { FlatTaskList } from './TaskList';
import { useTasks } from './api';

export function SomedayPage() {
  const { data: tasks, isPending } = useTasks();
  const someday = useMemo(
    () =>
      (tasks ?? []).filter((task) => task.someday && task.completedAt === null),
    [tasks],
  );

  return (
    <Page>
      <PageHeader
        title="Someday"
        meta="Parked on purpose. Nothing here shows up in your day."
      />
      <PageBody>
        <div className="mx-auto max-w-3xl">
          <FlatTaskList tasks={someday} />
          {someday.length === 0 && !isPending && (
            <EmptyState title="Nothing parked.">
              When a task can wait without a date, send it here from the task
              menu or a review.
            </EmptyState>
          )}
        </div>
      </PageBody>
    </Page>
  );
}
