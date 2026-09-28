import type { ReactNode } from 'react';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { spacing, type, useTheme } from '@/theme';

type ScreenProps = {
  title?: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
  scroll?: boolean;
};

export function Screen({
  title,
  subtitle,
  action,
  children,
  refreshing = false,
  onRefresh,
  scroll = true,
}: ScreenProps) {
  const theme = useTheme();
  const header = title && (
    <View style={styles.header}>
      <View style={styles.titles}>
        <Text
          accessibilityRole="header"
          style={[type.title, { color: theme.foreground }]}
        >
          {title}
        </Text>
        {subtitle && (
          <Text style={[type.small, { color: theme['muted-foreground'] }]}>
            {subtitle}
          </Text>
        )}
      </View>
      {action}
    </View>
  );
  return (
    <SafeAreaView
      edges={['top', 'left', 'right']}
      style={[styles.root, { backgroundColor: theme.background }]}
    >
      {scroll ? (
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={
            onRefresh && (
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
            )
          }
        >
          {header}
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.content, styles.fill]}>
          {header}
          {children}
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  fill: { flex: 1 },
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
    gap: spacing.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: spacing.md,
    gap: spacing.md,
  },
  titles: { flex: 1, gap: 2 },
});
