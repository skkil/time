import Ionicons from '@expo/vector-icons/Ionicons';
import { planDay } from '@skkil-time/rules/day';
import {
  dateKeyOf,
  formatDuration,
  formatWeekRange,
  isoWeekNumber,
  mondayOf,
  secondsWithin,
  shiftKey,
  todayKey,
  weekKeys,
} from '@skkil-time/rules/time';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useTimeEntries } from '@/features/focus/hooks';
import { useHabitDays } from '@/features/habits/hooks';
import { useProjects } from '@/features/projects/hooks';
import { SPACE_BAR_CLEARANCE } from '@/features/shell/SpaceBar';
import { SpaceControls } from '@/features/shell/SpaceControls';
import { useTasks } from '@/features/tasks/hooks';
import { DayCard } from '@/features/week/DayCard';
import { Outcomes } from '@/features/week/Outcomes';
import { useBlocks, useEvents } from '@/features/week/hooks';
import { Screen } from '@/ui/Screen';
import { Failed, Loading } from '@/ui/States';
import { ink, spacing, type } from '@/ui/theme';

/** Desktop's Week: what matters this week, and when you'll do it, as a column of days. */
export function WeekScreen() {
  const today = todayKey();
  const thisWeek = mondayOf(today);
  const [monday, setMonday] = useState(thisWeek);
  const end = shiftKey(monday, 7);
  const past = monday < thisWeek;
  const tasks = useTasks();
  const projects = useProjects();
  const blocks = useBlocks(monday);
  const { data: events = [] } = useEvents(monday, end);
  const { data: entries = [] } = useTimeEntries(monday, end);

  const byId = useMemo(
    () =>
      new Map((projects.data ?? []).map((project) => [project.id, project])),
    [projects.data],
  );
  const days = useMemo(
    () =>
      weekKeys(monday).map((date) => {
        const plan = planDay(
          date,
          tasks.data ?? [],
          projects.data ?? [],
          blocks.data ?? [],
        );
        return {
          date,
          blocks: plan.blocks,
          events: events.filter((event) => dateKeyOf(event.startAt) === date),
          due: [
            ...plan.musts,
            ...plan.due,
            ...plan.doneToday.filter(
              (task) =>
                task.dueDate === date &&
                !plan.blocks.some((block) => block.taskId === task.id),
            ),
          ],
          tracked: entries.reduce(
            (sum, entry) => sum + secondsWithin(entry, date, shiftKey(date, 1)),
            0,
          ),
        };
      }),
    [monday, tasks.data, projects.data, blocks.data, events, entries],
  );
  const planned = (blocks.data ?? []).reduce(
    (sum, block) => sum + (block.endAt - block.startAt),
    0,
  );
  const tracked = days.reduce((sum, day) => sum + day.tracked, 0);

  return (
    <Screen
      controls={<SpaceControls />}
      bottom={SPACE_BAR_CLEARANCE}
      refreshing={tasks.isRefetching}
      onRefresh={() => void Promise.all([tasks.refetch(), blocks.refetch()])}
    >
      <View style={styles.head}>
        <View style={styles.titleRow}>
          <Text accessibilityRole="header" style={type.display}>
            Week {isoWeekNumber(monday)}
          </Text>
          <View style={styles.switcher}>
            <Step
              icon="chevron-back"
              label="Previous week"
              onPress={() => setMonday(shiftKey(monday, -7))}
            />
            <Step
              icon="chevron-forward"
              label="Next week"
              onPress={() => setMonday(shiftKey(monday, 7))}
            />
          </View>
        </View>
        <Text style={[type.small, styles.meta]}>
          {[
            formatWeekRange(monday),
            planned > 0 && `${formatDuration(planned)} planned`,
            tracked >= 60 && `${formatDuration(tracked)} focused`,
          ]
            .filter(Boolean)
            .join(' · ')}
        </Text>
        {monday !== thisWeek && (
          <Pressable
            accessibilityRole="button"
            onPress={() => setMonday(thisWeek)}
            style={styles.back}
          >
            <Text style={[type.small, styles.link]}>Back to this week</Text>
          </Pressable>
        )}
      </View>
      <Outcomes week={monday} editable={!past} />
      {monday === thisWeek && <HabitsLine today={today} />}
      {tasks.isPending ? (
        <Loading />
      ) : tasks.isError ? (
        <Failed error={tasks.error} onRetry={() => void tasks.refetch()} />
      ) : (
        <View style={styles.days}>
          {days.map((day) => (
            <DayCard
              key={day.date}
              date={day.date}
              today={today}
              blocks={day.blocks}
              events={day.events}
              due={day.due}
              tracked={day.tracked}
              projects={byId}
            />
          ))}
        </View>
      )}
    </Screen>
  );
}

function Step({
  icon,
  label,
  onPress,
}: {
  icon: 'chevron-back' | 'chevron-forward';
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={styles.step}
    >
      <Ionicons name={icon} size={18} color={ink.full} />
    </Pressable>
  );
}

/** One line that opens the habits window, as on desktop's planning rail. */
function HabitsLine({ today }: { today: string }) {
  const { data: days = [] } = useHabitDays(today, today);
  const due = days.filter((day) => day.status !== 'off');
  if (due.length === 0) return null;
  const done = due.filter((day) => day.status === 'done').length;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => router.push('/habits')}
      style={styles.habits}
    >
      <Text style={type.small}>Habits</Text>
      <Text style={[type.body, styles.fill]}>
        {done} of {due.length} today
      </Text>
      <Ionicons name="chevron-forward" size={16} color={ink.secondary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  head: { gap: 2 },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  switcher: { flexDirection: 'row', gap: spacing.xs },
  step: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.16)',
  },
  meta: { fontSize: 15 },
  back: { minHeight: 32, justifyContent: 'center' },
  link: { color: 'rgba(241, 241, 238, 0.85)', textDecorationLine: 'underline' },
  days: { gap: spacing.md },
  habits: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 44,
  },
  fill: { flex: 1 },
});
