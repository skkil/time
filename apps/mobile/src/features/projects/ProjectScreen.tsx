import { Stack, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';

import { useProjects, useSections } from '@/features/projects/hooks';
import { AddButton } from '@/features/tasks/components/AddButton';
import { TaskAside } from '@/features/tasks/components/TaskAside';
import { TaskList } from '@/features/tasks/components/TaskList';
import { useTasks } from '@/features/tasks/hooks';
import { Screen } from '@/ui/Screen';
import { Empty, Failed, Loading } from '@/ui/States';

export function ProjectScreen() {
  const id = Number(useLocalSearchParams<{ id: string }>().id);
  const projects = useProjects();
  const sections = useSections();
  const tasks = useTasks();
  const project = projects.data?.find((candidate) => candidate.id === id);
  const open = useMemo(
    () =>
      (tasks.data ?? [])
        .filter(
          (task) =>
            task.projectId === id &&
            task.parentId === null &&
            task.completedAt === null,
        )
        .sort((a, b) => a.position - b.position),
    [tasks.data, id],
  );
  const own = (sections.data ?? []).filter(
    (section) => section.projectId === id,
  );
  const none = new Map();

  return (
    <>
      <Stack.Screen
        options={{
          title: project?.name ?? '',
          headerRight: () => <AddButton projectId={id} />,
        }}
      />
      <Screen
        aside={<TaskAside />}
        refreshing={tasks.isRefetching}
        onRefresh={() => void tasks.refetch()}
      >
        {tasks.isPending || projects.isPending ? (
          <Loading />
        ) : tasks.isError ? (
          <Failed error={tasks.error} onRetry={() => void tasks.refetch()} />
        ) : open.length === 0 ? (
          <Empty title="No open tasks" detail={project?.outcome || undefined} />
        ) : (
          <>
            <TaskList
              tasks={open.filter((task) => task.sectionId === null)}
              projects={none}
            />
            {own.map((section) => (
              <TaskList
                key={section.id}
                title={section.name}
                tasks={open.filter((task) => task.sectionId === section.id)}
                projects={none}
              />
            ))}
          </>
        )}
      </Screen>
    </>
  );
}
