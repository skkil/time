import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ink, spacing, type } from '@/ui/theme';

/** The top of a glass window: a grab handle, an optional title and a close button. */
export function WindowHeader({
  title,
  detail,
  children,
}: {
  title?: string;
  detail?: string;
  children?: ReactNode;
}) {
  return (
    <View style={styles.header}>
      <View style={styles.handle} />
      <View style={styles.row}>
        <View style={styles.titles}>
          {children}
          {title && (
            <Text accessibilityRole="header" style={type.heading}>
              {title}
            </Text>
          )}
          {detail && <Text style={type.small}>{detail}</Text>}
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close"
          hitSlop={8}
          onPress={() => router.back()}
          style={styles.close}
        >
          <Ionicons name="close" size={20} color={ink.secondary} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: spacing.xl, paddingTop: spacing.sm },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    marginBottom: spacing.md,
  },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  titles: { flex: 1, gap: 2 },
  close: {
    width: 36,
    height: 36,
    marginRight: -spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
