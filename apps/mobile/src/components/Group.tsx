import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { radius, spacing, type, useTheme } from '@/theme';

export function Group({
  title,
  children,
  trailing,
}: {
  title?: string;
  children: ReactNode;
  trailing?: string;
}) {
  const theme = useTheme();
  return (
    <View style={styles.group}>
      {title && (
        <View style={styles.heading}>
          <Text
            style={[
              type.small,
              styles.title,
              { color: theme['muted-foreground'] },
            ]}
          >
            {title}
          </Text>
          {trailing && (
            <Text style={[type.small, { color: theme['muted-foreground'] }]}>
              {trailing}
            </Text>
          )}
        </View>
      )}
      <View
        style={[
          styles.card,
          { backgroundColor: theme.card, borderColor: theme.border },
        ]}
      >
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  group: { gap: spacing.sm },
  heading: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xs,
  },
  title: { fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.6 },
  card: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
});
