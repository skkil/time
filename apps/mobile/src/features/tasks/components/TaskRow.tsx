import type { Project, Task } from '@skkil-time/contract';
import { formatDue, isOverdue } from '@skkil-time/domain/due';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useCompleteTask } from '@/features/tasks/hooks';
import { useSelection } from '@/features/tasks/selection';
import { useWide } from '@/ui/responsive';
import { spacing, type, useProjectColor, useTheme } from '@/ui/theme';

export function TaskRow({
  task,
  project,
  last,
}: {
  task: Task;
  project?: Project;
  last?: boolean;
}) {
  const theme = useTheme();
  const colorOf = useProjectColor();
  const complete = useCompleteTask();
  const wide = useWide();
  const { selected, select } = useSelection();
  const done = task.completedAt !== null;
  const ring =
    task.priority < 4
      ? theme[`p${task.priority}` as 'p1']
      : theme['muted-foreground'];
  const due = formatDue(task);
  const overdue = isOverdue(task);

  return (
    <View
      style={[
        styles.row,
        !last && {
          borderBottomColor: theme.border,
          borderBottomWidth: StyleSheet.hairlineWidth,
        },
      ]}
    >
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: done }}
        accessibilityLabel={
          done ? `Reopen ${task.title}` : `Complete ${task.title}`
        }
        hitSlop={12}
        onPress={() => {
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          complete.mutate({ id: task.id, completed: !done });
        }}
        style={[
          styles.check,
          { borderColor: ring, backgroundColor: done ? ring : 'transparent' },
        ]}
      />
      <Pressable
        style={[styles.body, selected === task.id && wide && { opacity: 0.7 }]}
        accessibilityRole="button"
        accessibilityState={{ selected: wide && selected === task.id }}
        onPress={() =>
          wide
            ? select(task.id)
            : router.push({ pathname: '/task/[id]', params: { id: task.id } })
        }
      >
        <Text
          numberOfLines={2}
          style={[
            type.body,
            { color: done ? theme['muted-foreground'] : theme.foreground },
            done && styles.done,
          ]}
        >
          {task.title}
        </Text>
        {(due || project || task.recurrence) && (
          <View style={styles.meta}>
            {due !== '' && (
              <Text
                style={[
                  type.small,
                  { color: overdue ? theme.p1 : theme['muted-foreground'] },
                ]}
              >
                {due}
              </Text>
            )}
            {task.recurrence && (
              <Text style={[type.small, { color: theme['muted-foreground'] }]}>
                ↻ {task.recurrence}
              </Text>
            )}
            {project && (
              <View style={styles.project}>
                <View
                  style={[
                    styles.dot,
                    { backgroundColor: colorOf(project.color) },
                  ]}
                />
                <Text
                  style={[type.small, { color: theme['muted-foreground'] }]}
                  numberOfLines={1}
                >
                  {project.name}
                </Text>
              </View>
            )}
          </View>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    gap: spacing.md,
  },
  check: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    marginTop: 1,
  },
  body: { flex: 1, gap: 4 },
  done: { textDecorationLine: 'line-through' },
  meta: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  project: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexShrink: 1,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
});
