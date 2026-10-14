import Ionicons from '@expo/vector-icons/Ionicons';
import type { Habit, HabitDay } from '@skkil-time/contract';
import { todayKey } from '@skkil-time/domain/time';
import * as Haptics from 'expo-haptics';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import {
  useAddHabitValue,
  useHabitDays,
  useHabits,
  useSetHabitStatus,
} from '@/features/habits/hooks';
import { Group } from '@/ui/Group';
import { Screen } from '@/ui/Screen';
import { Empty, Failed, Loading } from '@/ui/States';
import { spacing, type, useTheme } from '@/ui/theme';

const counted = (habit: Habit) =>
  habit.kind !== 'build' || habit.unit === 'minutes' || (habit.goal ?? 1) > 1;

export function HabitsScreen() {
  const theme = useTheme();
  const today = todayKey();
  const habits = useHabits();
  const days = useHabitDays(today, today);
  const setStatus = useSetHabitStatus();
  const addValue = useAddHabitValue();
  const byHabit = useMemo(
    () => new Map((days.data ?? []).map((day) => [day.habitId, day])),
    [days.data],
  );
  const due = (habits.data ?? []).filter((habit) => {
    const day = byHabit.get(habit.id);
    return day !== undefined && day.status !== 'off';
  });

  const toggle = (habit: Habit, day: HabitDay) => {
    void Haptics.selectionAsync();
    const next =
      day.status === 'done' ? null : habit.kind === 'build' ? 'done' : 'failed';
    setStatus.mutate({ habitId: habit.id, date: today, status: next });
  };

  return (
    <Screen
      title="Habits"
      subtitle="Today"
      refreshing={days.isRefetching}
      onRefresh={() => void days.refetch()}
    >
      {habits.isPending || days.isPending ? (
        <Loading />
      ) : habits.isError ? (
        <Failed error={habits.error} onRetry={() => void habits.refetch()} />
      ) : due.length === 0 ? (
        <Empty
          title="No habits today"
          detail="Habits you set up on the web or desktop show up here on their days."
        />
      ) : (
        <Group>
          {due.map((habit, index) => {
            const day = byHabit.get(habit.id)!;
            const done = day.status === 'done';
            const step = habit.unit === 'minutes' ? 5 : 1;
            return (
              <View
                key={habit.id}
                style={[
                  styles.row,
                  index < due.length - 1 && {
                    borderBottomColor: theme.border,
                    borderBottomWidth: StyleSheet.hairlineWidth,
                  },
                ]}
              >
                <Pressable
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: done }}
                  accessibilityLabel={habit.name}
                  onPress={() => toggle(habit, day)}
                  onLongPress={() =>
                    setStatus.mutate({
                      habitId: habit.id,
                      date: today,
                      status: 'skipped',
                    })
                  }
                  style={styles.main}
                >
                  <Ionicons
                    name={
                      done
                        ? 'checkmark-circle'
                        : day.status === 'skipped'
                          ? 'remove-circle-outline'
                          : 'ellipse-outline'
                    }
                    size={24}
                    color={
                      done ? theme['due-today'] : theme['muted-foreground']
                    }
                  />
                  <View style={styles.text}>
                    <Text style={[type.body, { color: theme.foreground }]}>
                      {habit.name}
                    </Text>
                    <Text
                      style={[type.small, { color: theme['muted-foreground'] }]}
                    >
                      {habit.doneDays} of last {habit.dueDays} days
                      {counted(habit) &&
                        ` · ${day.value ?? 0}${habit.goal ? ` / ${habit.goal}` : ''} ${habit.unit}`}
                    </Text>
                  </View>
                </Pressable>
                {counted(habit) && (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Add ${step} ${habit.unit} to ${habit.name}`}
                    hitSlop={8}
                    onPress={() =>
                      addValue.mutate({
                        habitId: habit.id,
                        date: today,
                        delta: step,
                      })
                    }
                  >
                    <Ionicons
                      name="add-circle-outline"
                      size={26}
                      color={theme.primary}
                    />
                  </Pressable>
                )}
              </View>
            );
          })}
        </Group>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    gap: spacing.md,
  },
  main: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  text: { flex: 1, gap: 2 },
});
