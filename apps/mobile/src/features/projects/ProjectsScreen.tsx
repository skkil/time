import Ionicons from '@expo/vector-icons/Ionicons';
import type { Id, Project } from '@skkil-time/client/types';
import { router } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useGroups, useProjects } from '@/features/projects/hooks';
import { SPACE_BAR_CLEARANCE } from '@/features/shell/SpaceBar';
import { SpaceControls } from '@/features/shell/SpaceControls';
import { useTasks } from '@/features/tasks/hooks';
import { Group } from '@/ui/Group';
import { Screen } from '@/ui/Screen';
import { Failed, Loading } from '@/ui/States';
import { ink, spacing, type, useProjectColor } from '@/ui/theme';

type Row = { project: Project; depth: number };

function flatten(projects: Project[], roots: Project[]): Row[] {
  const children = new Map<Id, Project[]>();
  for (const project of projects) {
    if (project.parentId === null) continue;
    const siblings = children.get(project.parentId) ?? [];
    siblings.push(project);
    children.set(project.parentId, siblings);
  }
  const walk = (list: Project[], depth: number): Row[] =>
    [...list]
      .sort((a, b) => a.position - b.position)
      .flatMap((project) => [
        { project, depth },
        ...walk(children.get(project.id) ?? [], depth + 1),
      ]);
  return walk(roots, 0);
}

const openProject = (id: string) =>
  router.push({ pathname: '/project/[id]', params: { id } });

/** Desktop's project drawer as a page: Inbox and Someday, then top-level projects under their groups. */
export function ProjectsScreen() {
  const projects = useProjects();
  const groups = useGroups();
  const tasks = useTasks();
  const active = useMemo(
    () =>
      (projects.data ?? []).filter(
        (project) => !project.archived && project.status === 'active',
      ),
    [projects.data],
  );
  const counts = useMemo(() => {
    const open = new Map<Id | 'inbox' | 'someday', number>();
    const bump = (key: Id | 'inbox' | 'someday') =>
      open.set(key, (open.get(key) ?? 0) + 1);
    for (const task of tasks.data ?? []) {
      if (task.completedAt !== null || task.parentId !== null) continue;
      if (task.someday) bump('someday');
      else bump(task.projectId ?? 'inbox');
    }
    return open;
  }, [tasks.data]);
  const sorted = [...(groups.data ?? [])].sort(
    (a, b) => a.position - b.position,
  );
  const topLevel = active.filter((project) => project.parentId === null);
  const sections = [
    {
      key: 'none',
      title: undefined,
      rows: flatten(
        active,
        topLevel.filter((project) => project.groupId === null),
      ),
    },
    ...sorted.map((group) => ({
      key: group.id,
      title: group.name,
      rows: flatten(
        active,
        topLevel.filter((project) => project.groupId === group.id),
      ),
    })),
  ].filter((section) => section.rows.length > 0);

  return (
    <Screen
      title="Projects"
      controls={<SpaceControls />}
      bottom={SPACE_BAR_CLEARANCE}
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
      ) : (
        <>
          <View>
            <Place
              icon="file-tray-outline"
              name="Inbox"
              count={counts.get('inbox')}
              onPress={() => openProject('inbox')}
            />
            <Place
              icon="cloud-outline"
              name="Someday"
              count={counts.get('someday')}
              onPress={() => openProject('someday')}
            />
          </View>
          {sections.map((section) => (
            <Group key={section.key} title={section.title}>
              {section.rows.map(({ project, depth }) => (
                <ProjectRow
                  key={project.id}
                  project={project}
                  depth={depth}
                  count={counts.get(project.id)}
                />
              ))}
            </Group>
          ))}
          {sections.length === 0 && (
            <Text style={type.small}>
              No projects yet. Create them on the web or desktop app.
            </Text>
          )}
        </>
      )}
    </Screen>
  );
}

function Place({
  icon,
  name,
  count,
  onPress,
}: {
  icon: 'file-tray-outline' | 'cloud-outline';
  name: string;
  count?: number;
  onPress: () => void;
}) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={styles.row}>
      <Ionicons name={icon} size={16} color={ink.secondary} />
      <Text style={[type.body, styles.name]}>{name}</Text>
      {count !== undefined && <Text style={type.small}>{count}</Text>}
    </Pressable>
  );
}

function ProjectRow({
  project,
  depth,
  count,
}: {
  project: Project;
  depth: number;
  count?: number;
}) {
  const colorOf = useProjectColor();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => openProject(project.id)}
      style={[styles.row, { paddingLeft: depth * spacing.xl }]}
    >
      <View style={styles.dotBox}>
        <View
          style={[styles.dot, { backgroundColor: colorOf(project.color) }]}
        />
      </View>
      <Text numberOfLines={1} style={[type.body, styles.name]}>
        {project.name}
      </Text>
      {count !== undefined && <Text style={type.small}>{count}</Text>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 44,
  },
  name: { flex: 1 },
  dotBox: { width: 16, alignItems: 'center' },
  dot: { width: 9, height: 9, borderRadius: 5 },
});
