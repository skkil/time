import type { Task } from '@skkil-time/contract';
import { formatDate } from '@skkil-time/domain/due';
import { nextUp } from '@skkil-time/domain/next';
import {
  formatDuration,
  mondayOf,
  secondsWithin,
  shiftKey,
  todayKey,
} from '@skkil-time/domain/time';
import { useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useTimeEntries } from '@/features/focus/hooks';
import {
  useCanvas,
  useGroups,
  useProjects,
  useSections,
} from '@/features/projects/hooks';
import { SpaceControls } from '@/features/shell/SpaceControls';
import { TaskAside } from '@/features/tasks/components/TaskAside';
import { TaskList } from '@/features/tasks/components/TaskList';
import { openTask } from '@/features/tasks/components/TaskRow';
import { useTasks } from '@/features/tasks/hooks';
import { Screen } from '@/ui/Screen';
import { Empty, Failed, Loading } from '@/ui/States';
import { ink, spacing, type, useProjectColor } from '@/ui/theme';

type Tab = 'tasks' | 'notes';

const NOTE_BREAKS = /<\/(p|h[1-6]|li|blockquote|pre)>|<br\s*\/?>/gi;

const plainText = (html: string) =>
  html
    .replace(NOTE_BREAKS, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

/** A project, the Inbox (`inbox`) or Someday (`someday`): header, Next, then tasks by section. */
export function ProjectScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const place = id === 'inbox' || id === 'someday' ? id : null;
  const projectId = place ? null : id;
  const colorOf = useProjectColor();
  const projects = useProjects();
  const groups = useGroups();
  const sections = useSections();
  const tasks = useTasks();
  const canvas = useCanvas(projectId);
  const today = todayKey();
  const monday = mondayOf(today);
  const { data: entries = [] } = useTimeEntries(monday, shiftKey(monday, 7));
  const [tab, setTab] = useState<Tab>('tasks');
  const project = projects.data?.find((candidate) => candidate.id === id);
  const parent = projects.data?.find(
    (candidate) => candidate.id === project?.parentId,
  );
  const group = groups.data?.find(
    (candidate) => candidate.id === (parent ?? project)?.groupId,
  );

  const own = useMemo(
    () =>
      (tasks.data ?? []).filter((task) =>
        place === 'someday'
          ? task.someday
          : task.projectId === projectId && !task.someday,
      ),
    [tasks.data, place, projectId],
  );
  const open = own
    .filter((task) => task.parentId === null && task.completedAt === null)
    .sort((a, b) => a.position - b.position);
  const next = place === 'someday' ? undefined : nextUp(own, today);
  const tracked = entries
    .filter((entry) => projectId !== null && entry.projectId === projectId)
    .reduce(
      (sum, entry) => sum + secondsWithin(entry, monday, shiftKey(monday, 7)),
      0,
    );
  const lines = plainText(canvas.data?.content ?? '');
  const ownSections = (sections.data ?? [])
    .filter((section) => place !== 'someday' && section.projectId === projectId)
    .sort((a, b) => a.position - b.position);
  const byId = new Map((projects.data ?? []).map((each) => [each.id, each]));

  const title =
    place === 'inbox'
      ? 'Inbox'
      : place === 'someday'
        ? 'Someday'
        : (project?.name ?? '');
  const meta = [
    `${open.length} open`,
    project?.targetDate && `target ${formatDate(project.targetDate)}`,
    tracked >= 60 && `${formatDuration(tracked)} this week`,
  ]
    .filter(Boolean)
    .join(' · ');
  const crumbs = [group?.name, parent?.name].filter(Boolean);

  return (
    <Screen
      back
      controls={<SpaceControls projectId={projectId ?? undefined} />}
      aside={<TaskAside />}
      refreshing={tasks.isRefetching}
      onRefresh={() => void tasks.refetch()}
    >
      <View style={styles.head}>
        {crumbs.length > 0 && (
          <Text style={type.small}>{crumbs.join(' / ')}</Text>
        )}
        <View style={styles.titleRow}>
          {project && (
            <View
              style={[styles.dot, { backgroundColor: colorOf(project.color) }]}
            />
          )}
          <Text accessibilityRole="header" style={[type.title, styles.fill]}>
            {title}
          </Text>
        </View>
        <Text style={type.small}>{meta}</Text>
        {next && <NextLine task={next} />}
      </View>
      {projectId !== null && (
        <View accessibilityRole="tablist" style={styles.tabs}>
          {(['tasks', 'notes'] as const).map((each) => (
            <Pressable
              key={each}
              accessibilityRole="tab"
              accessibilityState={{ selected: tab === each }}
              onPress={() => setTab(each)}
              style={[styles.tab, tab === each && styles.selected]}
            >
              <Text
                style={[
                  type.label,
                  { color: tab === each ? ink.full : ink.secondary },
                ]}
              >
                {each === 'tasks' ? 'Tasks' : 'Notes'}
              </Text>
            </Pressable>
          ))}
        </View>
      )}
      {tab === 'notes' && projectId !== null ? (
        lines.length === 0 ? (
          <Text style={type.small}>
            No notes yet. Write them on the web or desktop app.
          </Text>
        ) : (
          <View style={styles.notes}>
            {lines.map((line, index) => (
              <Text key={index} style={type.body}>
                {line}
              </Text>
            ))}
          </View>
        )
      ) : tasks.isPending || projects.isPending ? (
        <Loading />
      ) : tasks.isError ? (
        <Failed error={tasks.error} onRetry={() => void tasks.refetch()} />
      ) : open.length === 0 ? (
        <Empty
          title="No open tasks"
          detail={
            place === 'inbox'
              ? 'Everything you capture lands here first.'
              : undefined
          }
        />
      ) : (
        <>
          <TaskList
            tasks={open.filter(
              (task) =>
                place === 'someday' ||
                task.sectionId === null ||
                !ownSections.some((section) => section.id === task.sectionId),
            )}
            projects={place === 'someday' ? byId : new Map()}
          />
          {ownSections.map((section) => (
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

function NextLine({ task }: { task: Task }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => openTask(task.id)}
      style={styles.next}
    >
      <Text style={type.small}>Next:</Text>
      <Text numberOfLines={1} style={[type.small, styles.nextTitle]}>
        {task.title}
        {task.dueDate && `, ${formatDate(task.dueDate)}`}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  head: { gap: spacing.xs },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  dot: { width: 12, height: 12, borderRadius: 6 },
  fill: { flex: 1 },
  next: {
    flexDirection: 'row',
    gap: spacing.xs,
    minHeight: 32,
    alignItems: 'center',
  },
  nextTitle: { flex: 1, color: ink.full },
  tabs: {
    flexDirection: 'row',
    gap: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: ink.hairline,
  },
  tab: {
    minHeight: 40,
    justifyContent: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  selected: { borderBottomColor: ink.full },
  notes: { gap: spacing.sm },
});
