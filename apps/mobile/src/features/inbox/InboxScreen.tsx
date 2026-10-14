import { useMemo } from 'react';

import { useSections } from '@/features/projects/hooks';
import { AddButton } from '@/features/tasks/components/AddButton';
import { TaskAside } from '@/features/tasks/components/TaskAside';
import { TaskList } from '@/features/tasks/components/TaskList';
import { useTasks } from '@/features/tasks/hooks';
import { Screen } from '@/ui/Screen';
import { Empty, Failed, Loading } from '@/ui/States';

export function InboxScreen() {
  const tasks = useTasks();
  const sections = useSections();
  const open = useMemo(
    () =>
      (tasks.data ?? [])
        .filter(
          (task) =>
            task.projectId === null &&
            task.parentId === null &&
            task.completedAt === null,
        )
        .sort((a, b) => a.position - b.position),
    [tasks.data],
  );
  const inboxSections = (sections.data ?? []).filter(
    (section) => section.projectId === null,
  );
  const loose = open.filter((task) => task.sectionId === null);

  return (
    <Screen
      aside={<TaskAside />}
      title="Inbox"
      action={<AddButton />}
      refreshing={tasks.isRefetching}
      onRefresh={() => void tasks.refetch()}
    >
      {tasks.isPending ? (
        <Loading />
      ) : tasks.isError ? (
        <Failed error={tasks.error} onRetry={() => void tasks.refetch()} />
      ) : open.length === 0 ? (
        <Empty
          title="Inbox zero"
          detail="Everything you capture lands here first."
        />
      ) : (
        <>
          <TaskList tasks={loose} projects={new Map()} />
          {inboxSections.map((section) => (
            <TaskList
              key={section.id}
              title={section.name}
              tasks={open.filter((task) => task.sectionId === section.id)}
              projects={new Map()}
            />
          ))}
        </>
      )}
    </Screen>
  );
}
