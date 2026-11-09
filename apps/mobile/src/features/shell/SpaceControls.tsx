import Ionicons from '@expo/vector-icons/Ionicons';
import { formatStopwatch } from '@skkil-time/rules/time';
import { focusedSeconds } from '@skkil-time/rules/timer';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useSession } from '@/core/auth/session';
import { initialOf, useDisplayName } from '@/features/account/profile';
import { useNow, useTimer } from '@/features/focus/hooks';
import { PRIMARY_PILL } from '@/ui/surfaces';
import { ink, spacing, type } from '@/ui/theme';

/** Top-right of every space, as on desktop: the running timer, Add and the profile circle. */
export function SpaceControls({ projectId }: { projectId?: string }) {
  const name = useDisplayName();
  const initial = initialOf(name, useSession().session?.email ?? null);
  return (
    <View style={styles.controls}>
      <TimerChip />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Add task"
        hitSlop={4}
        onPress={() =>
          router.push({
            pathname: '/add',
            params: projectId ? { projectId } : {},
          })
        }
        style={styles.circle}
      >
        <Ionicons name="add" size={22} color={ink.full} />
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={name ? `Settings for ${name}` : 'Settings'}
        hitSlop={4}
        onPress={() => router.push('/settings')}
        style={styles.circle}
      >
        {initial ? (
          <Text style={[type.label, { color: ink.full }]}>{initial}</Text>
        ) : (
          <Ionicons name="person-outline" size={18} color={ink.full} />
        )}
      </Pressable>
    </View>
  );
}

function TimerChip() {
  const { data: timer } = useTimer();
  const now = useNow(Boolean(timer) && !timer?.pausedAt);
  if (!timer) return null;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Open focus"
      onPress={() => router.push('/focus')}
      style={[PRIMARY_PILL, styles.chip]}
    >
      <View style={styles.dot} />
      <Text style={[type.label, { color: ink.onPrimary }]}>
        {timer.pausedAt
          ? 'On a break'
          : formatStopwatch(focusedSeconds(timer, now))}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  controls: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  circle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.14)',
  },
  chip: { height: 40, paddingHorizontal: 14 },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: ink.onPrimary,
  },
});
