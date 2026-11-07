import { formatDate, formatDue } from '@skkil-time/domain/due';
import { parseQuickAdd } from '@skkil-time/domain/quick-add/parse';
import { EMPTY_TASK, taskFromParsed } from '@skkil-time/domain/quick-add/task';
import {
  formatEstimate,
  minutesIntoDay,
  nowSeconds,
  todayKey,
} from '@skkil-time/domain/time';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { useProjects, useSections } from '@/features/projects/hooks';
import { useCreateTask } from '@/features/tasks/hooks';
import { Button } from '@/ui/States';
import { radius, spacing, type, useTheme } from '@/ui/theme';

export function AddTaskScreen() {
  const theme = useTheme();
  const params = useLocalSearchParams<{ projectId?: string }>();
  const startProject = params.projectId || null;
  const projects = useProjects();
  const sections = useSections();
  const create = useCreateTask();
  const [text, setText] = useState('');

  const parsed = useMemo(
    () =>
      parseQuickAdd(text, {
        today: todayKey(),
        nowMinutes: minutesIntoDay(nowSeconds()),
        projects: (projects.data ?? []).filter((project) => !project.archived),
        sections: sections.data ?? [],
        projectId: startProject,
      }),
    [text, projects.data, sections.data, startProject],
  );
  const task = taskFromParsed(
    { ...EMPTY_TASK, projectId: startProject },
    parsed,
  );
  const project = projects.data?.find(
    (candidate) => candidate.id === task.projectId,
  );
  const understood = [
    project?.name ?? 'Inbox',
    task.dueDate && formatDue(task),
    task.recurrence,
    task.deadline && `deadline ${formatDate(task.deadline)}`,
    task.estimateMinutes && `about ${formatEstimate(task.estimateMinutes)}`,
    task.priority < 4 && `p${task.priority}`,
  ].filter(Boolean);

  const submitting = useRef(false);
  const submit = () => {
    if (!task.title.trim() || submitting.current) return;
    submitting.current = true;
    create.mutate(task, {
      onSuccess: () => router.back(),
      onError: () => {
        submitting.current = false;
      },
    });
  };

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      <TextInput
        autoFocus
        multiline
        value={text}
        onChangeText={setText}
        placeholder="What’s on your mind?"
        placeholderTextColor={theme['muted-foreground']}
        returnKeyType="done"
        submitBehavior="submit"
        onSubmitEditing={submit}
        accessibilityLabel="Task"
        style={[
          styles.input,
          type.heading,
          {
            color: theme.foreground,
            borderColor: theme.border,
            backgroundColor: theme.card,
          },
        ]}
      />
      <Text style={[type.small, { color: theme['muted-foreground'] }]}>
        {understood.join(' · ')}
      </Text>
      <Text style={[type.small, { color: theme['muted-foreground'] }]}>
        Try “Call dentist tomorrow 9am p1 #Health” or “Review every friday for
        30m”.
      </Text>
      {create.isError && (
        <Text
          accessibilityRole="alert"
          style={[type.small, { color: theme.destructive }]}
        >
          Couldn’t add the task. Try again.
        </Text>
      )}
      <Button
        label="Add task"
        disabled={!task.title.trim() || create.isPending}
        onPress={submit}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, padding: spacing.lg, gap: spacing.md },
  input: {
    minHeight: 72,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
});
