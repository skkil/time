import Ionicons from '@expo/vector-icons/Ionicons';
import type { Task, TimeEntry } from '@skkil-time/contract';
import { planDay } from '@skkil-time/rules/day';
import {
  dayStart,
  formatDuration,
  mondayOf,
  secondsWithin,
  shiftKey,
  todayKey,
} from '@skkil-time/rules/time';
import { liveEntry } from '@skkil-time/rules/timer';
import { format } from 'date-fns';
import { router } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import {
  useNow,
  useTimeEntries,
  useTimer,
  useTimerActions,
} from '@/features/focus/hooks';
import { useProjects } from '@/features/projects/hooks';
import { SPACE_BAR_CLEARANCE } from '@/features/shell/SpaceBar';
import { SpaceControls } from '@/features/shell/SpaceControls';
import { TaskAside } from '@/features/tasks/components/TaskAside';
import { useTasks } from '@/features/tasks/hooks';
import { AnyTime } from '@/features/today/AnyTime';
import { DayThread, type Moment } from '@/features/today/DayThread';
import { useBlocks, useEvents } from '@/features/week/hooks';
import { Screen } from '@/ui/Screen';
import { Failed, Loading } from '@/ui/States';
import { PRIMARY_PILL } from '@/ui/surfaces';
import { ink, spacing, type } from '@/ui/theme';

const isTimed = (task: Task) => task.dueTime !== null;

/** Desktop's Day: where you are now, with your fixed points marked. */
export function DayScreen() {
  const today = todayKey();
  const tomorrow = shiftKey(today, 1);
  const tasks = useTasks();
  const projects = useProjects();
  const blocks = useBlocks(mondayOf(today));
  const { data: events = [] } = useEvents(today, tomorrow);
  const { data: timer = null } = useTimer();
  const { data: logged = [] } = useTimeEntries(today, tomorrow);
  const now = useNow(true, 30_000);

  const plan = useMemo(
    () =>
      planDay(today, tasks.data ?? [], projects.data ?? [], blocks.data ?? []),
    [today, tasks.data, projects.data, blocks.data],
  );
  const byId = useMemo(
    () =>
      new Map((projects.data ?? []).map((project) => [project.id, project])),
    [projects.data],
  );
  const titles = useMemo(
    () => new Map((tasks.data ?? []).map((task) => [task.id, task.title])),
    [tasks.data],
  );
  const entries = useMemo<TimeEntry[]>(() => {
    const live = liveEntry(timer, now);
    return live ? [...logged, live] : logged;
  }, [logged, timer, now]);
  const tracked = entries.reduce(
    (sum, entry) => sum + secondsWithin(entry, today, tomorrow),
    0,
  );

  const moments = useMemo<Moment[]>(() => {
    const timed = plan.blocks.map((block) => ({
      key: `block-${block.id}`,
      taskId: block.taskId,
      title: block.title,
      projectId: block.projectId,
      start: block.startAt,
      end: block.endAt,
      showEnd: true,
      kind: 'block' as const,
      done: block.completed,
    }));
    const anchors = events.map((event) => ({
      key: `event-${event.taskId}-${event.startAt}`,
      taskId: event.taskId,
      title: event.title,
      projectId: event.projectId,
      start: event.startAt,
      end: event.endAt,
      showEnd: true,
      kind: 'event' as const,
      done: false,
    }));
    const finishedHere = plan.doneToday.filter(
      (task) => task.dueDate === today,
    );
    const due = [...plan.musts, ...plan.due, ...finishedHere]
      .filter(isTimed)
      .map((task) => {
        const start = dayStart(today) + task.dueTime! * 60;
        return {
          key: `due-${task.id}`,
          taskId: task.id,
          title: task.title,
          projectId: task.projectId,
          start,
          end: start + (task.estimateMinutes ?? 0) * 60,
          showEnd: task.estimateMinutes !== null,
          kind: 'due' as const,
          done: task.completedAt !== null,
        };
      });
    return [...timed, ...anchors, ...due].sort((a, b) => a.start - b.start);
  }, [plan, events, today]);

  const blocked = new Set(plan.blocks.map((block) => block.taskId));
  const anyTime = [...plan.musts, ...plan.due].filter((task) => !isTimed(task));
  const finished = plan.doneToday.filter(
    (task) =>
      !blocked.has(task.id) && !(isTimed(task) && task.dueDate === today),
  );
  const date = new Date();

  return (
    <Screen
      scroll={false}
      controls={<SpaceControls />}
      aside={<TaskAside />}
      bottom={SPACE_BAR_CLEARANCE}
    >
      <View style={styles.page}>
        <View style={styles.head}>
          <Text accessibilityRole="header" style={type.display}>
            {format(date, 'EEEE')}
          </Text>
          <Text style={[type.small, styles.dateLine]}>
            {[
              format(date, 'd MMMM'),
              tracked >= 60 && `${formatDuration(tracked)} focused`,
            ]
              .filter(Boolean)
              .join(' · ')}
          </Text>
        </View>
        <View style={styles.controls}>
          <StartFocus />
        </View>
        {tasks.isPending ? (
          <Loading />
        ) : tasks.isError ? (
          <Failed error={tasks.error} onRetry={() => void tasks.refetch()} />
        ) : (
          <>
            <View style={styles.anyTime}>
              <AnyTime
                tasks={anyTime}
                finished={finished}
                runningId={timer?.taskId ?? null}
                projects={byId}
              />
              {plan.earlier.length > 0 && (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => router.push('/earlier')}
                  style={styles.earlier}
                >
                  <Text style={[type.small, styles.link]}>
                    {plan.earlier.length === 1
                      ? '1 task from earlier days'
                      : `${plan.earlier.length} tasks from earlier days`}
                  </Text>
                </Pressable>
              )}
            </View>
            <DayThread
              moments={moments}
              entries={entries}
              now={now}
              runningId={timer?.taskId ?? null}
              projects={byId}
              titles={titles}
            />
          </>
        )}
      </View>
    </Screen>
  );
}

/** The one filled pill on Day; while a timer runs it opens the focus window. */
function StartFocus() {
  const { data: timer } = useTimer();
  const { start } = useTimerActions();
  if (timer) return null;
  return (
    <Pressable
      accessibilityRole="button"
      disabled={start.isPending}
      onPress={() =>
        start.mutate(
          { taskId: null, projectId: null, description: '' },
          { onSuccess: () => router.push('/focus') },
        )
      }
      style={({ pressed }) => [PRIMARY_PILL, { opacity: pressed ? 0.8 : 1 }]}
    >
      <Ionicons name="play" size={13} color={ink.onPrimary} />
      <Text style={[type.label, { color: ink.onPrimary }]}>Start focus</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, gap: spacing.lg },
  head: { gap: 2 },
  dateLine: { fontSize: 15 },
  controls: { flexDirection: 'row', gap: spacing.sm },
  anyTime: { gap: spacing.xs },
  earlier: { minHeight: 32, justifyContent: 'center' },
  link: { color: 'rgba(241, 241, 238, 0.85)', textDecorationLine: 'underline' },
});
