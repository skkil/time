import Ionicons from '@expo/vector-icons/Ionicons';
import type { RealtimeStatus } from '@skkil-time/api/realtime';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { radius, spacing, type } from '@/theme';

const UNREACHABLE_AFTER_MS = 5_000;
const listeners = new Set<(down: boolean) => void>();
let down = false;
let timer: ReturnType<typeof setTimeout> | undefined;

const publish = (next: boolean) => {
  if (next === down) return;
  down = next;
  listeners.forEach((listener) => listener(next));
};

/** Fed by the live connection: a socket that stays closed means the server can't be reached. */
export function reportRealtime(status: RealtimeStatus) {
  if (status === 'open') {
    clearTimeout(timer);
    timer = undefined;
    return publish(false);
  }
  if (status === 'closed' && timer === undefined)
    timer = setTimeout(() => publish(true), UNREACHABLE_AFTER_MS);
}

export function ConnectionNotice() {
  const insets = useSafeAreaInsets();
  const [unreachable, setUnreachable] = useState(down);
  useEffect(() => {
    listeners.add(setUnreachable);
    return () => {
      listeners.delete(setUnreachable);
    };
  }, []);
  if (!unreachable) return null;

  return (
    <View
      accessibilityRole="alert"
      pointerEvents="none"
      style={[styles.notice, { bottom: insets.bottom + 72 }]}
    >
      <Ionicons name="cloud-offline-outline" size={16} color="#fff" />
      <Text style={[type.small, styles.text]}>
        Can’t reach skkil time. Changes won’t save until you’re back online.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  notice: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: 'rgba(20,20,28,0.88)',
  },
  text: { flex: 1, color: '#fff' },
});
