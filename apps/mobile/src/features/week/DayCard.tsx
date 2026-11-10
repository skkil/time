import type {
  CalendarEvent,
  EventOccurrence,
  Id,
  Project,
  Task,
  TimeBlock,
} from '@skkil-time/client/types';
import { coversDay } from '@skkil-time/rules/calendar';
import {
  type DateKey,
  formatClockTime,
  formatDuration,
  formatMinutesOfDay,
  fromDateKey,
} from '@skkil-time/rules/time';
import { format } from 'date-fns';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { openTask } from '@/features/tasks/components/TaskRow';
import { useCompleteTask } from '@/features/tasks/hooks';
import { Check } from '@/ui/Check';
import { GoogleMark, openCalendarEvent } from '@/ui/GoogleMark';
import { HELD } from '@/ui/surfaces';
import { ink, spacing, type, useProjectColor, useTheme } from '@/ui/theme';

type Item = {
  key: string;
  taskId: Id;
  title: string;
  projectId: Id | null;
  when: string;
  sort: number;
  kind: 'block' | 'event' | 'due' | 'calendar';
  done: boolean;
  link?: string | null;
  source?: string;
};

/** One day of the week on glass: blocks, events and due work in time order, tracked time in the corner. */
export function DayCard({
  date,
  today,
  blocks,
  events,
  calendar,
  due,
  tracked,
  projects,
}: {
  date: DateKey;
  today: DateKey;
  blocks: TimeBlock[];
  events: EventOccurrence[];
  calendar: CalendarEvent[];
  due: Task[];
  tracked: number;
  projects: Map<Id, Project>;
}) {
  const theme = useTheme();
  const colorOf = useProjectColor();
  const complete = useCompleteTask();
  const isToday = date === today;
  const past = date < today;
  const items: Item[] = [
    ...blocks.map((block) => ({
      key: `block-${block.id}`,
      taskId: block.taskId,
      title: block.title,
      projectId: block.projectId,
      when: `${formatClockTime(block.startAt)} – ${formatClockTime(block.endAt)}`,
      sort: block.startAt,
      kind: 'block' as const,
      done: block.completed,
    })),
    ...events.map((event) => ({
      key: `event-${event.taskId}-${event.startAt}`,
      taskId: event.taskId,
      title: event.title,
      projectId: event.projectId,
      when: formatClockTime(event.startAt),
      sort: event.startAt,
      kind: 'event' as const,
      done: false,
    })),
    ...calendar.map((event) => ({
      key: `calendar-${event.id}`,
      taskId: event.id,
      title: event.title,
      projectId: null,
      when: coversDay(event, date)
        ? 'All day'
        : `${formatClockTime(event.startAt)} – ${formatClockTime(event.endAt)}`,
      sort: coversDay(event, date) ? -Infinity : event.startAt,
      kind: 'calendar' as const,
      done: false,
      link: event.link,
      source: event.sourceName,
    })),
    ...due.map((task) => ({
      key: `due-${task.id}`,
      taskId: task.id,
      title: task.title,
      projectId: task.projectId,
      when: task.dueTime === null ? '' : formatMinutesOfDay(task.dueTime),
      sort: task.dueTime === null ? Infinity : task.dueTime,
      kind: 'due' as const,
      done: task.completedAt !== null,
    })),
  ].sort((a, b) => a.sort - b.sort);

  return (
    <View style={[HELD, styles.card, isToday && styles.today]}>
      <View style={styles.head}>
        <View style={styles.day}>
          {isToday && (
            <View style={[styles.todayDot, { backgroundColor: theme.today }]} />
          )}
          <Text
            style={[
              type.label,
              { color: past && !isToday ? ink.secondary : ink.full },
            ]}
          >
            {isToday ? 'Today' : format(fromDateKey(date), 'EEEE')}
          </Text>
          <Text style={type.small}>{format(fromDateKey(date), 'd MMM')}</Text>
        </View>
        {tracked >= 60 && (
          <Text style={type.small}>{formatDuration(tracked)} focused</Text>
        )}
      </View>
      {items.length === 0 ? (
        <Text style={[type.small, { color: ink.faint }]}>Nothing planned</Text>
      ) : (
        items.map((item) => {
          const project =
            item.projectId === null ? undefined : projects.get(item.projectId);
          return (
            <View key={item.key} style={styles.item}>
              <View style={styles.marker}>
                {item.kind === 'calendar' ? (
                  <GoogleMark />
                ) : item.kind === 'event' ? (
                  <View style={styles.diamond} />
                ) : item.kind === 'block' ? (
                  <View
                    style={[
                      styles.bar,
                      {
                        backgroundColor: project
                          ? colorOf(project.color)
                          : ink.secondary,
                      },
                    ]}
                  />
                ) : (
                  <Check
                    size={16}
                    checked={item.done}
                    label={`Mark ${item.title} ${item.done ? 'not done' : 'done'}`}
                    onToggle={() =>
                      complete.mutate({
                        id: item.taskId,
                        completed: !item.done,
                      })
                    }
                  />
                )}
              </View>
              <Pressable
                accessibilityRole="button"
                onPress={() =>
                  item.kind === 'calendar'
                    ? openCalendarEvent(item.link ?? null)
                    : openTask(item.taskId)
                }
                style={styles.itemBody}
              >
                <Text
                  numberOfLines={1}
                  style={[type.body, item.done && styles.done]}
                >
                  {item.title}
                </Text>
                {(item.when !== '' || project || item.source) && (
                  <Text numberOfLines={1} style={type.tiny}>
                    {[item.when, project?.name ?? item.source]
                      .filter(Boolean)
                      .join(' · ')}
                  </Text>
                )}
              </Pressable>
            </View>
          );
        })
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { padding: spacing.lg, gap: spacing.sm },
  today: { borderColor: 'rgba(255, 255, 255, 0.18)' },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  day: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  todayDot: { width: 6, height: 6, borderRadius: 3 },
  item: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    minHeight: 40,
  },
  marker: { width: 16, alignItems: 'center', paddingTop: 3 },
  diamond: {
    width: 9,
    height: 9,
    marginTop: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    transform: [{ rotate: '45deg' }],
  },
  bar: { width: 3, height: 32, borderRadius: 2 },
  itemBody: { flex: 1 },
  done: { color: ink.secondary, textDecorationLine: 'line-through' },
});
