import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useSyncView } from '@/core/sync/use-sync';
import { radius, spacing, type } from '@/ui/theme';

const SHOW_AFTER_MS = 5_000;

/** Says so, calmly, when sync has been offline for a while with changes waiting. */
export function ConnectionNotice() {
  const insets = useSafeAreaInsets();
  const { phase, pending } = useSyncView();
  const offline = phase === 'offline' && pending > 0;
  const [lasting, setLasting] = useState(false);
  useEffect(() => {
    if (!offline) return;
    const timer = setTimeout(() => setLasting(true), SHOW_AFTER_MS);
    return () => {
      clearTimeout(timer);
      setLasting(false);
    };
  }, [offline]);
  if (!offline || !lasting) return null;

  return (
    <View
      accessibilityRole="alert"
      pointerEvents="none"
      style={[styles.notice, { bottom: insets.bottom + 72 }]}
    >
      <Ionicons name="cloud-offline-outline" size={16} color="#fff" />
      <Text style={[type.small, styles.text]}>
        Offline. Your changes are saved on this phone and sync when you’re back
        online.
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
