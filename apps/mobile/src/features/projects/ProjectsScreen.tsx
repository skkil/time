import Ionicons from '@expo/vector-icons/Ionicons';
import type { Project } from '@skkil-time/contract';
import { Link } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useProjects } from '@/features/projects/hooks';
import { useTasks } from '@/features/tasks/hooks';
import { Group } from '@/ui/Group';
import { Screen } from '@/ui/Screen';
import { Empty, Failed, Loading } from '@/ui/States';
import { spacing, type, useProjectColor, useTheme } from '@/ui/theme';

type Row = { project: Project; depth: number };

function flatten(projects: Project[]): Row[] {
  const children = new Map<number | null, Project[]>();
  for (const project of projects) {
    const siblings = children.get(project.parentId) ?? [];
    siblings.push(project);
    children.set(project.parentId, siblings);
  }
  const walk = (parent: number | null, depth: number): Row[] =>
    (children.get(parent) ?? [])
      .sort((a, b) => a.position - b.position)
      .flatMap((project) => [
        { project, depth },
        ...walk(project.id, depth + 1),
      ]);
  return walk(null, 0);
}

export function ProjectsScreen() {
  const theme = useTheme();
  const colorOf = useProjectColor();
  const projects = useProjects();
  const tasks = useTasks();
  const rows = useMemo(
    () =>
      flatten(
        (projects.data ?? []).filter(
          (project) => !project.archived && project.status === 'active',
        ),
      ),
    [projects.data],
  );
  const openCount = useMemo(() => {
    const counts = new Map<number, number>();
    for (const task of tasks.data ?? []) {
      if (
        task.projectId !== null &&
        task.completedAt === null &&
        task.parentId === null
      )
        counts.set(task.projectId, (counts.get(task.projectId) ?? 0) + 1);
    }
    return counts;
  }, [tasks.data]);

  return (
    <Screen
      title="Projects"
      refreshing={projects.isRefetching}
      onRefresh={() => void projects.refetch()}
    >
      {projects.isPending ? (
        <Loading />
      ) : projects.isError ? (
        <Failed
          error={projects.error}
          onRetry={() => void projects.refetch()}
        />
      ) : rows.length === 0 ? (
        <Empty
          title="No projects yet"
          detail="Create projects on the web or desktop app."
        />
      ) : (
        <Group>
          {rows.map(({ project, depth }, index) => (
            <Link
              key={project.id}
              href={{ pathname: '/project/[id]', params: { id: project.id } }}
              asChild
            >
              <Pressable
                accessibilityRole="button"
                style={[
                  styles.row,
                  { paddingLeft: spacing.md + depth * spacing.lg },
                  index < rows.length - 1 && {
                    borderBottomColor: theme.border,
                    borderBottomWidth: StyleSheet.hairlineWidth,
                  },
                ]}
              >
                <View
                  style={[
                    styles.dot,
                    { backgroundColor: colorOf(project.color) },
                  ]}
                />
                <Text
                  style={[type.body, styles.name, { color: theme.foreground }]}
                  numberOfLines={1}
                >
                  {project.name}
                </Text>
                <Text
                  style={[type.small, { color: theme['muted-foreground'] }]}
                >
                  {openCount.get(project.id) ?? ''}
                </Text>
                <Ionicons
                  name="chevron-forward"
                  size={16}
                  color={theme['muted-foreground']}
                />
              </Pressable>
            </Link>
          ))}
        </Group>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingRight: spacing.md,
    paddingVertical: spacing.md,
  },
  dot: { width: 10, height: 10, borderRadius: 5 },
  name: { flex: 1 },
});
