import Ionicons from '@expo/vector-icons/Ionicons';
import type { Id, Project, Task } from '@skkil-time/contract';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { TaskRow } from '@/features/tasks/components/TaskRow';
import { ink, spacing, type } from '@/ui/theme';

const VISIBLE_ROWS = 3;
const ROW_HEIGHT = 46;

/** Today's untimed work, as on desktop: a short list that folds away. */
export function AnyTime({
  tasks,
  finished,
  runningId,
  projects,
}: {
  tasks: Task[];
  finished: Task[];
  runningId: Id | null;
  projects: Map<Id, Project>;
}) {
  const [open, setOpen] = useState(true);
  const [showFinished, setShowFinished] = useState(false);
  const rows = showFinished ? [...tasks, ...finished] : tasks;

  return (
    <View>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen(!open)}
        style={styles.toggle}
      >
        <Ionicons
          name={open ? 'chevron-down' : 'chevron-forward'}
          size={14}
          color={ink.secondary}
        />
        <Text style={type.small}>
          Any time today{tasks.length > 0 && ` · ${tasks.length}`}
        </Text>
      </Pressable>
      {open && (
        <>
          <ScrollView
            nestedScrollEnabled
            style={{ maxHeight: VISIBLE_ROWS * ROW_HEIGHT }}
          >
            {rows.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                lit={task.id === runningId}
                showDue={false}
                project={
                  task.projectId === null
                    ? undefined
                    : projects.get(task.projectId)
                }
              />
            ))}
          </ScrollView>
          {rows.length === 0 && (
            <Text style={[type.small, styles.empty]}>
              Nothing planned for today.
            </Text>
          )}
          <View style={styles.actions}>
            <Pressable
              accessibilityRole="button"
              onPress={() =>
                router.push({ pathname: '/add', params: { today: '1' } })
              }
              style={styles.action}
            >
              <Ionicons name="add" size={16} color={ink.secondary} />
              <Text style={type.small}>
                {rows.length === 0 ? 'Add a task for today' : 'Add'}
              </Text>
            </Pressable>
            {finished.length > 0 && (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ expanded: showFinished }}
                onPress={() => setShowFinished(!showFinished)}
                style={styles.action}
              >
                <Text style={type.small}>{finished.length} done today</Text>
              </Pressable>
            )}
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  toggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minHeight: 32,
  },
  empty: { paddingVertical: spacing.xs },
  actions: { flexDirection: 'row', gap: spacing.lg },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minHeight: 36,
  },
});
