import type { Project, Task } from '@skkil-time/contract';
import { formatDue, isOverdue } from '@skkil-time/rules/due';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useCompleteTask } from '@/features/tasks/hooks';
import { useSelection } from '@/features/tasks/selection';
import { Check } from '@/ui/Check';
import { useWide } from '@/ui/responsive';
import { ink, spacing, type, useProjectColor, useTheme } from '@/ui/theme';

export const openTask = (id: string) =>
  router.push({ pathname: '/task/[id]', params: { id } });

export function TaskRow({
  task,
  project,
  lit = false,
  showDue = true,
}: {
  task: Task;
  project?: Project;
  lit?: boolean;
  /** Off where the list already says the day, like Day's "Any time today". */
  showDue?: boolean;
}) {
  const theme = useTheme();
  const colorOf = useProjectColor();
  const complete = useCompleteTask();
  const wide = useWide();
  const { selected, select } = useSelection();
  const done = task.completedAt !== null;
  const open = wide && selected === task.id;
  const due = showDue ? formatDue(task) : '';
  const meta = due !== '' || project || task.recurrence;

  return (
    <View style={styles.row}>
      <View style={styles.check}>
        <Check
          checked={done}
          lit={lit || open}
          label={done ? `Reopen ${task.title}` : `Complete ${task.title}`}
          onToggle={() => complete.mutate({ id: task.id, completed: !done })}
        />
      </View>
      <Pressable
        style={styles.body}
        accessibilityRole="button"
        accessibilityState={{ selected: open }}
        onPress={() => (wide ? select(task.id) : openTask(task.id))}
      >
        <Text
          numberOfLines={2}
          style={[
            type.body,
            done && styles.done,
            !done && !open && !lit && { color: 'rgba(241, 241, 238, 0.9)' },
          ]}
        >
          {task.title}
        </Text>
        {meta && (
          <View style={styles.meta}>
            {due !== '' && (
              <Text
                style={[type.small, isOverdue(task) && { color: theme.p1 }]}
              >
                {due}
              </Text>
            )}
            {task.recurrence && (
              <Text style={type.small}>↻ {task.recurrence}</Text>
            )}
            {project && (
              <View style={styles.project}>
                <View
                  style={[
                    styles.dot,
                    { backgroundColor: colorOf(project.color) },
                  ]}
                />
                <Text style={type.small} numberOfLines={1}>
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
    paddingVertical: spacing.sm + 2,
    gap: spacing.md,
    minHeight: 44,
  },
  check: { paddingTop: 1 },
  body: { flex: 1, gap: 2 },
  done: { color: ink.secondary, textDecorationLine: 'line-through' },
  meta: { flexDirection: 'row', flexWrap: 'wrap', columnGap: spacing.md },
  project: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 1,
  },
  dot: { width: 7, height: 7, borderRadius: 4 },
});
