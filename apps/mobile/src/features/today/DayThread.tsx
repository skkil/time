import type { Id, Project, TimeEntry } from '@skkil-time/client/types';
import {
  dayStart,
  formatClockTime,
  formatMinutesOfDay,
  minutesIntoDay,
  todayKey,
} from '@skkil-time/rules/time';
import { useMemo, useRef, useState } from 'react';
import {
  Pressable,
  ScrollView,
  type ScrollViewInstance,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { openTask } from '@/features/tasks/components/TaskRow';
import { useCompleteTask } from '@/features/tasks/hooks';
import { Check } from '@/ui/Check';
import { GoogleMark, openCalendarEvent } from '@/ui/GoogleMark';
import { ink, spacing, type, useProjectColor } from '@/ui/theme';

export type Moment = {
  key: string;
  kind: 'block' | 'event' | 'due' | 'calendar';
  taskId: Id;
  title: string;
  projectId: Id | null;
  start: number;
  end: number;
  showEnd: boolean;
  done: boolean;
  calendar?: { source: string; color: string; link: string | null };
};

const WINDOW_HOURS = 6;
const ROW = 50;
const PAD = 14;
const LINE_X = 54;
const TRACKED_LANE = 84;

/** Today as a line of hours: planned blocks, events and timed tasks, with tracked time behind them. */
export function DayThread({
  moments,
  entries,
  now,
  runningId,
  projects,
  titles,
}: {
  moments: Moment[];
  entries: TimeEntry[];
  now: number;
  runningId: Id | null;
  projects: Map<Id, Project>;
  titles: Map<Id, string>;
}) {
  const complete = useCompleteTask();
  const colorOf = useProjectColor();
  const today = todayKey();
  const dayOpen = dayStart(today);
  const scroller = useRef<ScrollViewInstance>(null);
  const placed = useRef(false);
  const [viewport, setViewport] = useState(0);
  const hourHeight = Math.max(48, viewport / WINDOW_HOURS);
  const top = (minute: number) => PAD + (minute / 60) * hourHeight;
  const nowTop = top(minutesIntoDay(now));

  const rows = useMemo(() => {
    const laid: { moment: Moment; start: number; end: number; y: number }[] =
      [];
    for (const moment of moments) {
      const start =
        PAD + (Math.max(0, (moment.start - dayOpen) / 60) / 60) * hourHeight;
      const end =
        PAD +
        (Math.min(24 * 60, (moment.end - dayOpen) / 60) / 60) * hourHeight;
      const previous = laid.at(-1);
      const y = previous ? Math.max(start, previous.y + ROW) : start;
      laid.push({ moment, start, end, y });
    }
    return laid;
  }, [moments, dayOpen, hourHeight]);

  return (
    <ScrollView
      ref={scroller}
      style={styles.fill}
      showsVerticalScrollIndicator={false}
      onLayout={(event) => setViewport(event.nativeEvent.layout.height)}
      onContentSizeChange={() => {
        if (placed.current || viewport === 0) return;
        placed.current = true;
        scroller.current?.scrollTo({
          y: Math.max(0, nowTop - hourHeight),
          animated: false,
        });
      }}
    >
      <View style={{ height: top(24 * 60) + PAD }}>
        {Array.from({ length: 25 }, (_, hour) => (
          <Text
            key={hour}
            style={[type.tiny, styles.mark, { top: top(hour * 60) - 7 }]}
          >
            {formatMinutesOfDay(hour * 60)}
          </Text>
        ))}
        <View style={styles.line} />
        {rows.map(({ moment, start, end }) => (
          <View
            key={`span-${moment.key}`}
            style={[
              styles.span,
              {
                top: start,
                height: Math.max(end - start, 3),
                backgroundColor:
                  moment.done || moment.end <= now
                    ? 'rgba(255, 255, 255, 0.3)'
                    : 'rgba(255, 255, 255, 0.7)',
              },
            ]}
          />
        ))}
        {entries.map((entry) => {
          const from = Math.max(0, (entry.startedAt - dayOpen) / 60);
          const to = Math.min(24 * 60, (entry.endedAt - dayOpen) / 60);
          if (to <= from) return null;
          const tall = ((to - from) / 60) * hourHeight;
          const project =
            entry.projectId === null
              ? undefined
              : projects.get(entry.projectId);
          const label =
            (entry.taskId !== null && titles.get(entry.taskId)) ||
            entry.description ||
            project?.name ||
            'Focus';
          const tint = project
            ? `${colorOf(project.color)}52`
            : 'rgba(241, 241, 238, 0.22)';
          return (
            <Pressable
              key={entry.id}
              accessibilityLabel={`${label}, ${formatClockTime(entry.startedAt)} to ${formatClockTime(entry.endedAt)}`}
              disabled={entry.taskId === null}
              onPress={() => entry.taskId && openTask(entry.taskId)}
              style={[
                styles.entry,
                {
                  top: top(from),
                  height: Math.max(tall - 1, 4),
                  backgroundColor: tint,
                },
              ]}
            >
              {tall >= 22 && (
                <Text numberOfLines={1} style={[type.tiny, styles.entryText]}>
                  {label}
                </Text>
              )}
            </Pressable>
          );
        })}
        <View pointerEvents="none" style={[styles.now, { top: nowTop - 4 }]}>
          <View style={styles.nowDot} />
          <View style={styles.nowLine} />
        </View>
        {rows.map(({ moment, y }) => {
          const past = moment.end <= now;
          const live =
            moment.kind === 'block' &&
            (moment.taskId === runningId ||
              (moment.start <= now && moment.end > now));
          const project =
            moment.projectId === null
              ? undefined
              : projects.get(moment.projectId);
          return (
            <View key={moment.key} style={[styles.row, { top: y - 12 }]}>
              <View style={styles.marker}>
                {moment.calendar ? (
                  <GoogleMark dim={past} />
                ) : moment.kind === 'event' ? (
                  <View
                    accessibilityLabel="Event"
                    style={[
                      styles.diamond,
                      {
                        backgroundColor: past
                          ? 'rgba(255, 255, 255, 0.35)'
                          : 'rgba(255, 255, 255, 0.85)',
                      },
                    ]}
                  />
                ) : (
                  <Check
                    size={18}
                    checked={moment.done}
                    lit={live}
                    label={`Mark ${moment.title} ${moment.done ? 'not done' : 'done'}`}
                    onToggle={() =>
                      complete.mutate({
                        id: moment.taskId,
                        completed: !moment.done,
                      })
                    }
                  />
                )}
              </View>
              <Pressable
                accessibilityRole="button"
                onPress={() =>
                  moment.calendar
                    ? openCalendarEvent(moment.calendar.link)
                    : openTask(moment.taskId)
                }
                style={styles.rowBody}
              >
                <Text
                  numberOfLines={1}
                  style={[
                    type.body,
                    moment.done
                      ? styles.done
                      : past
                        ? { color: ink.secondary }
                        : null,
                  ]}
                >
                  {moment.title}
                </Text>
                <View style={styles.meta}>
                  <Text style={type.tiny}>
                    {moment.showEnd
                      ? `${formatClockTime(moment.start)} – ${formatClockTime(moment.end)}`
                      : formatClockTime(moment.start)}
                  </Text>
                  {project && (
                    <>
                      <View
                        style={[
                          styles.dot,
                          { backgroundColor: colorOf(project.color) },
                        ]}
                      />
                      <Text numberOfLines={1} style={[type.tiny, styles.fill]}>
                        {project.name}
                      </Text>
                    </>
                  )}
                  {moment.calendar && (
                    <>
                      <View
                        style={[
                          styles.dot,
                          { backgroundColor: moment.calendar.color },
                        ]}
                      />
                      <Text numberOfLines={1} style={[type.tiny, styles.fill]}>
                        {moment.calendar.source}
                      </Text>
                    </>
                  )}
                </View>
              </Pressable>
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  mark: { position: 'absolute', left: 0, width: 40 },
  line: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: LINE_X,
    width: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  span: { position: 'absolute', left: LINE_X - 1, width: 3, borderRadius: 2 },
  entry: {
    position: 'absolute',
    left: LINE_X + 10,
    right: 0,
    borderRadius: 6,
    paddingHorizontal: spacing.sm,
    alignItems: 'flex-end',
  },
  entryText: { color: ink.full, paddingTop: 3, maxWidth: TRACKED_LANE },
  now: {
    position: 'absolute',
    left: LINE_X - 4,
    right: 0,
    height: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  nowDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ffffff',
  },
  nowLine: {
    flex: 1,
    height: 1,
    backgroundImage:
      'linear-gradient(90deg, rgba(255, 255, 255, 0.7), rgba(255, 255, 255, 0))',
  },
  row: {
    position: 'absolute',
    left: LINE_X - 9,
    right: TRACKED_LANE,
    flexDirection: 'row',
    gap: spacing.md,
  },
  marker: { width: 18, height: 22, alignItems: 'center', paddingTop: 2 },
  diamond: {
    width: 11,
    height: 11,
    marginTop: 4,
    borderRadius: 2,
    transform: [{ rotate: '45deg' }],
  },
  rowBody: { flex: 1, minHeight: 44 },
  done: { color: ink.secondary, textDecorationLine: 'line-through' },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 6, height: 6, borderRadius: 3 },
});
