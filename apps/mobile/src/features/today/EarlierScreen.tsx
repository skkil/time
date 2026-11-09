import { planDay } from '@skkil-time/rules/day';
import { formatDue } from '@skkil-time/rules/due';
import { shiftKey, todayKey } from '@skkil-time/rules/time';
import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useProjects } from '@/features/projects/hooks';
import { openTask } from '@/features/tasks/components/TaskRow';
import { useCompleteTask, useTasks } from '@/features/tasks/hooks';
import { useReschedule, useSetSomeday } from '@/features/week/hooks';
import { Window } from '@/ui/Window';
import { WindowHeader } from '@/ui/WindowHeader';
import { ink, radius, spacing, type } from '@/ui/theme';

/** Desktop's "From earlier days": give each one a day, park it, or skip a repeat. */
export function EarlierScreen() {
  const today = todayKey();
  const tomorrow = shiftKey(today, 1);
  const tasks = useTasks();
  const projects = useProjects();
  const reschedule = useReschedule();
  const someday = useSetSomeday();
  const skip = useCompleteTask();
  const earlier = useMemo(
    () => planDay(today, tasks.data ?? [], projects.data ?? [], []).earlier,
    [today, tasks.data, projects.data],
  );
  const names = new Map(
    (projects.data ?? []).map((project) => [project.id, project.name]),
  );

  return (
    <Window>
      <WindowHeader
        title="From earlier days"
        detail="Give each one a day, park it, or let it go."
      />
      <ScrollView contentContainerStyle={styles.list}>
        {earlier.length === 0 && (
          <Text style={type.small}>Nothing here. Clean slate.</Text>
        )}
        {earlier.map((task) => (
          <View key={task.id} style={styles.item}>
            <Pressable
              accessibilityRole="button"
              onPress={() => openTask(task.id)}
            >
              <Text numberOfLines={2} style={type.body}>
                {task.title}
              </Text>
              <Text style={type.small}>
                {[
                  (task.projectId && names.get(task.projectId)) || 'Inbox',
                  formatDue(task),
                  task.rolloverCount >= 2 && `moved ×${task.rolloverCount}`,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </Text>
            </Pressable>
            <View style={styles.actions}>
              <Chip
                label="Today"
                onPress={() =>
                  reschedule.mutate({ ids: [task.id], date: today })
                }
              />
              <Chip
                label="Tomorrow"
                onPress={() =>
                  reschedule.mutate({ ids: [task.id], date: tomorrow })
                }
              />
              {task.recurrence === null ? (
                <Chip
                  label="Someday"
                  onPress={() =>
                    someday.mutate({ ids: [task.id], someday: true })
                  }
                />
              ) : (
                <Chip
                  label="Skip"
                  onPress={() => skip.mutate({ id: task.id, completed: true })}
                />
              )}
            </View>
          </View>
        ))}
        {earlier.length > 1 && (
          <View style={styles.all}>
            <Text style={type.small}>All {earlier.length}:</Text>
            <Chip
              label="Today"
              onPress={() =>
                reschedule.mutate({
                  ids: earlier.map((task) => task.id),
                  date: today,
                })
              }
            />
          </View>
        )}
      </ScrollView>
    </Window>
  );
}

function Chip({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.chip, pressed && styles.pressed]}
    >
      <Text style={[type.small, { color: ink.full }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  list: { padding: spacing.xl, gap: spacing.lg },
  item: { gap: spacing.sm },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  all: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingTop: spacing.sm,
  },
  chip: {
    height: 36,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.18)',
    justifyContent: 'center',
  },
  pressed: { backgroundColor: 'rgba(255, 255, 255, 0.1)' },
});
