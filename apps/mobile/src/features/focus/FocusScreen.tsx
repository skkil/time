import Ionicons from '@expo/vector-icons/Ionicons';
import type { Task } from '@skkil-time/contract';
import { planDay } from '@skkil-time/domain/day';
import {
  formatClockTime,
  formatDuration,
  formatStopwatch,
  nowSeconds,
  secondsWithin,
  shiftKey,
  todayKey,
} from '@skkil-time/domain/time';
import { focusedSeconds } from '@skkil-time/domain/timer';
import * as Haptics from 'expo-haptics';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import {
  useTimeEntries,
  useTimer,
  useTimerActions,
} from '@/features/focus/hooks';
import { useProjects } from '@/features/projects/hooks';
import { useTasks } from '@/features/tasks/hooks';
import { Group } from '@/ui/Group';
import { Screen } from '@/ui/Screen';
import { Button, Empty, Loading } from '@/ui/States';
import { radius, spacing, type, useTheme } from '@/ui/theme';

function useNow(active: boolean) {
  const [now, setNow] = useState(nowSeconds);
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setNow(nowSeconds()), 1000);
    return () => clearInterval(id);
  }, [active]);
  return now;
}

export function FocusScreen() {
  const theme = useTheme();
  const today = todayKey();
  const timer = useTimer();
  const tasks = useTasks();
  const projects = useProjects();
  const entries = useTimeEntries(today, shiftKey(today, 1));
  const actions = useTimerActions();
  const running = timer.data ?? null;
  const now = useNow(running !== null && running.pausedAt === null);
  const task = running?.taskId
    ? tasks.data?.find((candidate) => candidate.id === running.taskId)
    : undefined;
  const candidates = useMemo(() => {
    const plan = planDay(today, tasks.data ?? [], projects.data ?? [], []);
    return [...plan.musts, ...plan.due, ...plan.earlier].slice(0, 8);
  }, [today, tasks.data, projects.data]);
  const titles = new Map(
    (tasks.data ?? []).map((item) => [item.id, item.title]),
  );
  const tracked = (entries.data ?? []).reduce(
    (sum, entry) => sum + secondsWithin(entry, today, shiftKey(today, 1)),
    0,
  );

  const begin = (item: Task | null) => {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    actions.start.mutate({
      taskId: item?.id ?? null,
      projectId: item?.projectId ?? null,
      description: '',
    });
  };

  return (
    <Screen
      title="Focus"
      subtitle={tracked ? `${formatDuration(tracked)} today` : undefined}
    >
      {timer.isPending ? (
        <Loading />
      ) : running ? (
        <View style={[styles.timer, { backgroundColor: theme.chrome }]}>
          <Text style={[type.small, { color: theme['chrome-muted'] }]}>
            {running.pausedAt ? 'On a break' : 'Focusing on'}
          </Text>
          <Text
            style={[
              type.heading,
              styles.center,
              { color: theme['chrome-foreground'] },
            ]}
            numberOfLines={2}
          >
            {task?.title ?? (running.description || 'Free focus')}
          </Text>
          <Text
            accessibilityRole="timer"
            style={[styles.clock, { color: theme['chrome-foreground'] }]}
          >
            {formatStopwatch(focusedSeconds(running, now))}
          </Text>
          <View style={styles.controls}>
            <Button
              label={running.pausedAt ? 'Resume' : 'Break'}
              tone="secondary"
              onPress={() =>
                running.pausedAt
                  ? actions.resume.mutate()
                  : actions.pause.mutate()
              }
            />
            <Button
              label="Stop"
              tone="primary"
              onPress={() => actions.stop.mutate()}
            />
          </View>
        </View>
      ) : (
        <>
          <Button label="Start free focus" onPress={() => begin(null)} />
          {candidates.length > 0 ? (
            <Group title="Focus on">
              {candidates.map((item, index) => (
                <Pressable
                  key={item.id}
                  accessibilityRole="button"
                  accessibilityLabel={`Start focus on ${item.title}`}
                  onPress={() => begin(item)}
                  style={[
                    styles.row,
                    index < candidates.length - 1 && {
                      borderBottomColor: theme.border,
                      borderBottomWidth: StyleSheet.hairlineWidth,
                    },
                  ]}
                >
                  <Ionicons
                    name="play-circle-outline"
                    size={22}
                    color={theme.primary}
                  />
                  <Text
                    style={[
                      type.body,
                      styles.fill,
                      { color: theme.foreground },
                    ]}
                    numberOfLines={1}
                  >
                    {item.title}
                  </Text>
                </Pressable>
              ))}
            </Group>
          ) : (
            <Empty
              title="Nothing lined up"
              detail="Tasks due today show up here."
            />
          )}
        </>
      )}
      {(entries.data ?? []).length > 0 && (
        <Group title="Today">
          {(entries.data ?? []).map((entry, index, all) => (
            <View
              key={entry.id}
              style={[
                styles.row,
                index < all.length - 1 && {
                  borderBottomColor: theme.border,
                  borderBottomWidth: StyleSheet.hairlineWidth,
                },
              ]}
            >
              <Text
                style={[
                  type.small,
                  styles.time,
                  { color: theme['muted-foreground'] },
                ]}
              >
                {formatClockTime(entry.startedAt)}
              </Text>
              <Text
                style={[type.body, styles.fill, { color: theme.foreground }]}
                numberOfLines={1}
              >
                {(entry.taskId && titles.get(entry.taskId)) ||
                  entry.description ||
                  'Focus'}
              </Text>
              <Text style={[type.small, { color: theme['muted-foreground'] }]}>
                {formatDuration(entry.endedAt - entry.startedAt)}
              </Text>
            </View>
          ))}
        </Group>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  timer: {
    borderRadius: radius.lg,
    padding: spacing.xl,
    alignItems: 'center',
    gap: spacing.md,
  },
  center: { textAlign: 'center' },
  clock: { fontSize: 56, fontWeight: '300', fontVariant: ['tabular-nums'] },
  controls: { flexDirection: 'row', gap: spacing.md },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
  },
  fill: { flex: 1 },
  time: { width: 48, fontVariant: ['tabular-nums'] },
});
