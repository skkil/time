import Ionicons from '@expo/vector-icons/Ionicons';
import type { RunningTimer, Task } from '@skkil-time/contract';
import { planDay } from '@skkil-time/rules/day';
import {
  formatClockTime,
  formatDuration,
  formatStopwatch,
  shiftKey,
  todayKey,
} from '@skkil-time/rules/time';
import { focusedSeconds } from '@skkil-time/rules/timer';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import {
  useNow,
  useTimeEntries,
  useTimer,
  useTimerActions,
} from '@/features/focus/hooks';
import { useProjects } from '@/features/projects/hooks';
import { useTasks } from '@/features/tasks/hooks';
import { Group } from '@/ui/Group';
import { Button, Loading } from '@/ui/States';
import { Window } from '@/ui/Window';
import { WindowHeader } from '@/ui/WindowHeader';
import { font, ink, spacing, type, useProjectColor } from '@/ui/theme';

/** Desktop's focus panel as a window: what you're on, the clock, Break and Stop. */
export function FocusScreen() {
  const today = todayKey();
  const timer = useTimer();
  const tasks = useTasks();
  const projects = useProjects();
  const entries = useTimeEntries(today, shiftKey(today, 1));
  const titles = useMemo(
    () => new Map((tasks.data ?? []).map((task) => [task.id, task.title])),
    [tasks.data],
  );

  return (
    <Window>
      <WindowHeader />
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        {timer.isPending ? (
          <Loading />
        ) : timer.data ? (
          <Running
            key={`${timer.data.startedAt}-${timer.data.taskId}`}
            timer={timer.data}
            title={
              timer.data.taskId === null
                ? undefined
                : titles.get(timer.data.taskId)
            }
            project={
              projects.data?.find(
                (project) => project.id === timer.data?.projectId,
              ) ?? undefined
            }
          />
        ) : (
          <Idle tasks={tasks.data ?? []} />
        )}
        {(entries.data ?? []).length > 0 && (
          <Group title="Today">
            {(entries.data ?? []).map((entry) => (
              <View key={entry.id} style={styles.entry}>
                <Text style={[type.small, styles.time]}>
                  {formatClockTime(entry.startedAt)}
                </Text>
                <Text numberOfLines={1} style={[type.body, styles.fill]}>
                  {(entry.taskId && titles.get(entry.taskId)) ||
                    entry.description ||
                    'Focus'}
                </Text>
                <Text style={type.small}>
                  {formatDuration(entry.endedAt - entry.startedAt)}
                </Text>
              </View>
            ))}
          </Group>
        )}
      </ScrollView>
    </Window>
  );
}

function Running({
  timer,
  title,
  project,
}: {
  timer: RunningTimer;
  title?: string;
  project?: { name: string; color: string };
}) {
  const colorOf = useProjectColor();
  const actions = useTimerActions();
  const now = useNow(timer.pausedAt === null);
  const [description, setDescription] = useState(timer.description);
  const paused = timer.pausedAt !== null;

  const saveDescription = () => {
    if (description.trim() !== timer.description)
      actions.edit.mutate({
        description: description.trim(),
        projectId: timer.projectId,
        taskId: timer.taskId,
      });
  };

  return (
    <View style={styles.running}>
      <Text style={type.small}>{paused ? 'On a break' : 'Focusing'}</Text>
      {title ? (
        <Text style={type.title}>{title}</Text>
      ) : (
        <TextInput
          value={description}
          onChangeText={setDescription}
          onEndEditing={saveDescription}
          placeholder="What are you on?"
          placeholderTextColor={ink.faint}
          accessibilityLabel="What are you on?"
          returnKeyType="done"
          style={[type.title, styles.input]}
        />
      )}
      <View style={styles.facts}>
        {project && (
          <View style={styles.project}>
            <View
              style={[styles.dot, { backgroundColor: colorOf(project.color) }]}
            />
            <Text style={type.small}>{project.name}</Text>
          </View>
        )}
        <Text style={type.small}>
          Started {formatClockTime(timer.startedAt)}
        </Text>
      </View>
      <Text accessibilityRole="timer" style={styles.clock}>
        {formatStopwatch(focusedSeconds(timer, now))}
      </Text>
      <View style={styles.controls}>
        <Button
          label="Stop"
          icon={<Ionicons name="square" size={12} color={ink.onPrimary} />}
          onPress={() => {
            void Haptics.notificationAsync(
              Haptics.NotificationFeedbackType.Success,
            );
            saveDescription();
            actions.stop.mutate();
            router.back();
          }}
        />
        <Button
          label={paused ? 'Resume' : 'Break'}
          tone="secondary"
          onPress={() =>
            paused ? actions.resume.mutate() : actions.pause.mutate()
          }
        />
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            actions.discard.mutate();
            router.back();
          }}
          style={styles.discard}
        >
          <Text style={type.small}>Discard</Text>
        </Pressable>
      </View>
    </View>
  );
}

function Idle({ tasks }: { tasks: Task[] }) {
  const today = todayKey();
  const projects = useProjects();
  const { start } = useTimerActions();
  const candidates = useMemo(() => {
    const plan = planDay(today, tasks, projects.data ?? [], []);
    return [...plan.musts, ...plan.due, ...plan.earlier].slice(0, 8);
  }, [today, tasks, projects.data]);

  const begin = (task: Task | null) => {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    start.mutate({
      taskId: task?.id ?? null,
      projectId: task?.projectId ?? null,
      description: '',
    });
  };

  return (
    <View style={styles.running}>
      <Text style={type.title}>Ready when you are</Text>
      <View style={styles.controls}>
        <Button
          label="Start focus"
          icon={<Ionicons name="play" size={13} color={ink.onPrimary} />}
          onPress={() => begin(null)}
        />
      </View>
      {candidates.length > 0 && (
        <Group title="Or focus on">
          {candidates.map((task) => (
            <Pressable
              key={task.id}
              accessibilityRole="button"
              accessibilityLabel={`Start focus on ${task.title}`}
              onPress={() => begin(task)}
              style={styles.entry}
            >
              <Ionicons name="play-outline" size={16} color={ink.secondary} />
              <Text numberOfLines={1} style={[type.body, styles.fill]}>
                {task.title}
              </Text>
            </Pressable>
          ))}
        </Group>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxl,
    gap: spacing.xxl,
  },
  running: { gap: spacing.md },
  input: { padding: 0 },
  facts: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.lg },
  project: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  clock: {
    ...type.display,
    fontFamily: font.extraLight,
    fontSize: 64,
    marginTop: spacing.lg,
  },
  controls: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  discard: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 8 },
  entry: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 44,
  },
  time: { width: 44 },
  fill: { flex: 1 },
});
