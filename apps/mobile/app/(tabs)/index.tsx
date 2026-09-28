import Ionicons from '@expo/vector-icons/Ionicons';
import { planDay } from '@skkil-time/domain/day';
import {
  formatDuration,
  mondayOf,
  shiftKey,
  todayKey,
} from '@skkil-time/domain/time';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Link } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { commands } from '@/backend';
import { AddButton } from '@/components/AddButton';
import { Screen } from '@/components/Screen';
import { Empty, Failed, Loading } from '@/components/States';
import { TaskList } from '@/components/TaskList';
import { useProjects, useTasks } from '@/queries';
import { spacing, useTheme } from '@/theme';

export default function Today() {
  const theme = useTheme();
  const today = todayKey();
  const monday = mondayOf(today);
  const tasks = useTasks();
  const projects = useProjects();
  const blocks = useQuery({
    queryKey: ['blocks', monday],
    queryFn: () => commands.listBlocks(monday, shiftKey(monday, 7)),
  });
  const plan = useMemo(
    () =>
      planDay(today, tasks.data ?? [], projects.data ?? [], blocks.data ?? []),
    [today, tasks.data, projects.data, blocks.data],
  );
  const byId = useMemo(
    () =>
      new Map((projects.data ?? []).map((project) => [project.id, project])),
    [projects.data],
  );
  const planned = new Set(plan.blocks.map((block) => block.taskId));
  const blockedTasks = (tasks.data ?? []).filter(
    (task) => planned.has(task.id) && task.completedAt === null,
  );
  const nothing =
    plan.musts.length +
      plan.due.length +
      plan.earlier.length +
      blockedTasks.length ===
    0;

  return (
    <Screen
      title="Today"
      subtitle={format(new Date(), 'EEEE d MMMM')}
      refreshing={tasks.isRefetching}
      onRefresh={() =>
        void Promise.all([
          tasks.refetch(),
          projects.refetch(),
          blocks.refetch(),
        ])
      }
      action={
        <View style={styles.actions}>
          <Link href="/settings" asChild>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Settings"
              hitSlop={8}
            >
              <Ionicons
                name="settings-outline"
                size={22}
                color={theme['muted-foreground']}
              />
            </Pressable>
          </Link>
          <AddButton />
        </View>
      }
    >
      {tasks.isPending ? (
        <Loading />
      ) : tasks.isError ? (
        <Failed error={tasks.error} onRetry={() => void tasks.refetch()} />
      ) : nothing ? (
        <Empty
          title={
            plan.doneToday.length ? 'All done for today' : 'Nothing due today'
          }
          detail={
            plan.doneToday.length
              ? `${plan.doneToday.length} finished.`
              : 'Add a task or pick one from a project.'
          }
        />
      ) : (
        <>
          <TaskList title="Musts" tasks={plan.musts} projects={byId} />
          <TaskList
            title="Planned"
            tasks={blockedTasks}
            projects={byId}
            trailing={
              plan.plannedSeconds
                ? formatDuration(plan.plannedSeconds)
                : undefined
            }
          />
          <TaskList title="Due today" tasks={plan.due} projects={byId} />
          <TaskList
            title="From earlier days"
            tasks={plan.earlier}
            projects={byId}
          />
          <TaskList
            title="Up next in projects"
            tasks={plan.nextActions.slice(0, 5).map(({ task }) => task)}
            projects={byId}
          />
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
});
