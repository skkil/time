import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { isDown, subscribeConnection } from '@/core/realtime/connection-status';
import { radius, spacing, type } from '@/ui/theme';

export function ConnectionNotice() {
  const insets = useSafeAreaInsets();
  const [unreachable, setUnreachable] = useState(isDown);
  useEffect(() => subscribeConnection(setUnreachable), []);
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
