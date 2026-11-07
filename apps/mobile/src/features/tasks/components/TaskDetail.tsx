import type { Id, Task, TaskInput } from '@skkil-time/contract';
import { PRIORITIES, formatDue } from '@skkil-time/domain/due';
import { parseDatePhrase } from '@skkil-time/domain/quick-add/dates';
import { todayKey } from '@skkil-time/domain/time';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
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

import { commands } from '@/core/local/backend';
import { useTimerActions } from '@/features/focus/hooks';
import { useProjects } from '@/features/projects/hooks';
import {
  useCompleteTask,
  useDeleteTask,
  useTasks,
  useUpdateTask,
} from '@/features/tasks/hooks';
import { Button, Failed, Loading } from '@/ui/States';
import { WindowHeader } from '@/ui/WindowHeader';
import {
  ink,
  radius,
  spacing,
  type,
  useProjectColor,
  useTheme,
} from '@/ui/theme';

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

type DetailProps = { id: Id; onClose: () => void; embedded?: boolean };

/** A task's editor: a glass window on phones, the right-hand pane on tablets. */
export function TaskDetail({ id, onClose, embedded = false }: DetailProps) {
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
  return (
    <TaskEditor
      key={task.id}
      task={task}
      onClose={onClose}
      embedded={embedded}
    />
  );
}

function TaskEditor({
  task,
  onClose,
  embedded,
}: {
  task: Task;
  onClose: () => void;
  embedded: boolean;
}) {
  const theme = useTheme();
  const colorOf = useProjectColor();
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
          onPress: () => remove.mutate(task.id, { onSuccess: onClose }),
        },
      ],
    );

  const focus = () =>
    timer.start.mutate(
      { taskId: task.id, projectId: task.projectId, description: '' },
      {
        onSuccess: () =>
          embedded ? router.push('/focus') : router.replace('/focus'),
      },
    );

  const place = (
    <View style={styles.place}>
      <View
        style={[
          styles.dot,
          {
            backgroundColor: project ? colorOf(project.color) : ink.faint,
          },
        ]}
      />
      <Text style={type.small}>{project?.name ?? 'Inbox'}</Text>
    </View>
  );

  return (
    <>
      {embedded ? (
        <View style={styles.embeddedHead}>{place}</View>
      ) : (
        <WindowHeader>{place}</WindowHeader>
      )}
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <TextInput
          value={title}
          onChangeText={setTitle}
          onEndEditing={() =>
            title.trim() &&
            title !== task.title &&
            save({ title: title.trim() })
          }
          multiline
          accessibilityLabel="Title"
          style={[type.title, styles.title, done && { color: ink.secondary }]}
        />
        <View style={styles.actions}>
          <Button
            label={done ? 'Reopen' : 'Complete'}
            tone={done ? 'secondary' : 'primary'}
            onPress={() => complete.mutate({ id: task.id, completed: !done })}
          />
          {!done && <Button label="Focus" tone="secondary" onPress={focus} />}
        </View>

        <View style={styles.property}>
          <Text style={[type.small, styles.key]}>Date</Text>
          <TextInput
            value={due}
            onChangeText={setDue}
            onSubmitEditing={saveDue}
            onEndEditing={saveDue}
            placeholder={task.dueDate ? formatDue(task) : 'Try “tomorrow”'}
            placeholderTextColor={task.dueDate ? ink.full : ink.faint}
            returnKeyType="done"
            accessibilityLabel="Due date"
            style={[type.body, styles.value]}
          />
        </View>
        {task.recurrence && (
          <View style={styles.property}>
            <Text style={[type.small, styles.key]}>Repeats</Text>
            <Text style={[type.body, styles.value]}>{task.recurrence}</Text>
          </View>
        )}
        <View style={styles.property}>
          <Text style={[type.small, styles.key]}>Priority</Text>
          <View style={styles.priorities}>
            {PRIORITIES.map((priority) => {
              const selected = task.priority === priority;
              return (
                <Pressable
                  key={priority}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  accessibilityLabel={`Priority ${priority}`}
                  onPress={() => save({ priority })}
                  style={[styles.priority, selected && styles.chosen]}
                >
                  <Text
                    style={[
                      type.small,
                      { color: selected ? ink.onPrimary : ink.full },
                    ]}
                  >
                    P{priority}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <TextInput
          value={notes}
          onChangeText={setNotes}
          onEndEditing={() => notes !== task.notes && save({ notes })}
          multiline
          placeholder="Add notes"
          placeholderTextColor={ink.faint}
          accessibilityLabel="Notes"
          style={[type.body, styles.notes]}
        />

        {update.isError && (
          <Text
            accessibilityRole="alert"
            style={[type.small, { color: theme.destructive }]}
          >
            Couldn’t save the change.
          </Text>
        )}
        <Pressable
          accessibilityRole="button"
          onPress={confirmDelete}
          style={styles.delete}
        >
          <Text style={[type.small, { color: theme.destructive }]}>
            Delete task
          </Text>
        </Pressable>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xxl,
    gap: spacing.md,
  },
  embeddedHead: { paddingHorizontal: spacing.xl, paddingTop: spacing.xl },
  place: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  dot: { width: 8, height: 8, borderRadius: 4 },
  title: { fontSize: 26, padding: 0 },
  actions: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
  property: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 44,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: ink.hairline,
  },
  key: { width: 84 },
  value: { flex: 1, padding: 0 },
  priorities: { flexDirection: 'row', gap: spacing.sm },
  priority: {
    minWidth: 40,
    height: 30,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chosen: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderColor: 'transparent',
  },
  notes: {
    minHeight: 120,
    textAlignVertical: 'top',
    padding: 0,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: ink.hairline,
  },
  delete: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' },
});
