import { useMemo } from 'react';

import { Page, PageBody, PageHeader } from '@/components/page';

import { FlatTaskList } from './TaskList';
import { useTasks } from './api';

export function SomedayPage() {
  const { data: tasks } = useTasks();
  const someday = useMemo(
    () =>
      (tasks ?? []).filter((task) => task.someday && task.completedAt === null),
    [tasks],
  );

  return (
    <Page>
      <PageHeader title="Someday" />
      <PageBody>
        <div className="mx-auto max-w-3xl">
          <FlatTaskList tasks={someday} />
        </div>
      </PageBody>
    </Page>
  );
}
