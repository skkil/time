import type { Task, TaskInput } from '@skkil-time/contract';
import { PRIORITIES, formatDue } from '@skkil-time/domain/due';
import { parseDatePhrase } from '@skkil-time/domain/quick-add/dates';
import { todayKey } from '@skkil-time/domain/time';
import { useQuery } from '@tanstack/react-query';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { commands } from '@/backend';
import { Button, Failed, Loading } from '@/components/States';
import {
  useCompleteTask,
  useDeleteTask,
  useProjects,
  useTasks,
  useTimerActions,
  useUpdateTask,
} from '@/queries';
import { radius, spacing, type, useTheme } from '@/theme';

const inputOf = (task: Task): TaskInput => ({
  title: task.title,
  notes: task.notes,
  projectId: task.projectId,
  sectionId: task.sectionId,
  parentId: task.parentId,
  priority: task.priority,
  dueDate: task.dueDate,
  dueTime: task.dueTime,
  deadline: task.deadline,
  recurrence: task.recurrence,
  estimateMinutes: task.estimateMinutes,
});

export default function TaskScreen() {
  const id = Number(useLocalSearchParams<{ id: string }>().id);
  const tasks = useTasks();
  const listed = tasks.data?.find((task) => task.id === id);
  const fetched = useQuery({
    queryKey: ['task', id],
    queryFn: () => commands.getTask(id),
    enabled: !tasks.isPending && listed === undefined,
  });
  const task = listed ?? fetched.data;
  if (fetched.isError)
    return (
      <Failed error={fetched.error} onRetry={() => void fetched.refetch()} />
    );
  if (!task) return <Loading />;
  return <TaskEditor key={task.id} task={task} />;
}

function TaskEditor({ task }: { task: Task }) {
  const theme = useTheme();
  const projects = useProjects();
  const update = useUpdateTask();
  const complete = useCompleteTask();
  const remove = useDeleteTask();
  const timer = useTimerActions();
  const [title, setTitle] = useState(task.title);
  const [notes, setNotes] = useState(task.notes);
  const [due, setDue] = useState('');
  const project = projects.data?.find(
    (candidate) => candidate.id === task.projectId,
  );
  const done = task.completedAt !== null;

  const save = (changes: Partial<TaskInput>) =>
    update.mutate({ id: task.id, input: { ...inputOf(task), ...changes } });

  const saveDue = () => {
    const phrase = due.trim().toLowerCase();
    if (!phrase) return;
    const date = ['none', 'no date', 'clear'].includes(phrase)
      ? null
      : parseDatePhrase(phrase, todayKey());
    if (date === undefined) {
      Alert.alert(
        'Date not understood',
        'Try “tomorrow”, “fri”, “next week” or “12 dec”.',
      );
      return;
    }
    save({
      dueDate: date,
      dueTime: date ? task.dueTime : null,
      recurrence: date ? task.recurrence : null,
    });
    setDue('');
  };

  const confirmDelete = () =>
    Alert.alert(
      'Delete task?',
      `“${task.title}” and its sub-tasks are deleted.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () =>
            remove.mutate(task.id, { onSuccess: () => router.back() }),
        },
      ],
    );

  const field = [
    styles.field,
    {
      color: theme.foreground,
      backgroundColor: theme.card,
      borderColor: theme.border,
    },
  ];
  const label = [
    type.small,
    styles.label,
    { color: theme['muted-foreground'] },
  ];

  return (
    <ScrollView
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={styles.content}
    >
      <Stack.Screen options={{ title: project?.name ?? 'Inbox' }} />
      <TextInput
        value={title}
        onChangeText={setTitle}
        onEndEditing={() =>
          title.trim() && title !== task.title && save({ title: title.trim() })
        }
        multiline
        accessibilityLabel="Title"
        style={[
          type.title,
          { color: done ? theme['muted-foreground'] : theme.foreground },
        ]}
      />
      <View style={styles.actions}>
        <Button
          label={done ? 'Reopen' : 'Complete'}
          tone={done ? 'secondary' : 'primary'}
          onPress={() => complete.mutate({ id: task.id, completed: !done })}
        />
        {!done && (
          <Button
            label="Focus"
            tone="secondary"
            onPress={() =>
              timer.start.mutate(
                { taskId: task.id, projectId: task.projectId, description: '' },
                { onSuccess: () => router.navigate('/focus') },
              )
            }
          />
        )}
      </View>

      <Text style={label}>Due</Text>
      <TextInput
        value={due}
        onChangeText={setDue}
        onSubmitEditing={saveDue}
        onEndEditing={saveDue}
        placeholder={
          task.dueDate ? formatDue(task) : 'No date — try “tomorrow”'
        }
        placeholderTextColor={theme['muted-foreground']}
        returnKeyType="done"
        accessibilityLabel="Due date"
        style={field}
      />
      {task.recurrence && (
        <Text style={[type.small, { color: theme['muted-foreground'] }]}>
          Repeats {task.recurrence}
        </Text>
      )}

      <Text style={label}>Priority</Text>
      <View style={styles.priorities}>
        {PRIORITIES.map((priority) => {
          const selected = task.priority === priority;
          const color =
            priority < 4
              ? theme[`p${priority}` as 'p1']
              : theme['muted-foreground'];
          return (
            <Pressable
              key={priority}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              accessibilityLabel={`Priority ${priority}`}
              onPress={() => save({ priority })}
              style={[
                styles.priority,
                {
                  borderColor: color,
                  backgroundColor: selected ? color : 'transparent',
                },
              ]}
            >
              <Text
                style={[
                  type.small,
                  { color: selected ? '#ffffff' : color, fontWeight: '600' },
                ]}
              >
                P{priority}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={label}>Notes</Text>
      <TextInput
        value={notes}
        onChangeText={setNotes}
        onEndEditing={() => notes !== task.notes && save({ notes })}
        multiline
        placeholder="Add notes"
        placeholderTextColor={theme['muted-foreground']}
        accessibilityLabel="Notes"
        style={[field, styles.notes]}
      />

      {update.isError && (
        <Text
          accessibilityRole="alert"
          style={[type.small, { color: theme.destructive }]}
        >
          Couldn’t save the change.
        </Text>
      )}
      <Button label="Delete task" tone="destructive" onPress={confirmDelete} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.sm, paddingBottom: spacing.xxl },
  actions: {
    flexDirection: 'row',
    gap: spacing.md,
    marginVertical: spacing.md,
  },
  label: {
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginTop: spacing.md,
  },
  field: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    padding: spacing.md,
    fontSize: 16,
  },
  notes: { minHeight: 120, textAlignVertical: 'top' },
  priorities: { flexDirection: 'row', gap: spacing.sm },
  priority: {
    borderWidth: 1.5,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
});
