import type { ReactNode } from 'react';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { TaskDetail } from '@/components/TaskDetail';
import { useSelection, useWide } from '@/layout';
import { spacing, type, useTheme } from '@/theme';

type ScreenProps = {
  title?: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
  scroll?: boolean;
  split?: boolean;
};

const LIST_WIDTH = 440;
const READING_WIDTH = 680;

export function Screen({
  title,
  subtitle,
  action,
  children,
  refreshing = false,
  onRefresh,
  scroll = true,
  split = false,
}: ScreenProps) {
  const theme = useTheme();
  const wide = useWide();
  const { selected, select } = useSelection();
  const twoPanes = wide && split;
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
  const width = twoPanes
    ? { width: LIST_WIDTH }
    : wide
      ? {
          width: '100%' as const,
          maxWidth: READING_WIDTH,
          alignSelf: 'center' as const,
        }
      : styles.fill;
  const list = scroll ? (
    <ScrollView
      style={width}
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
    <View style={[styles.content, styles.fill, width]}>
      {header}
      {children}
    </View>
  );

  return (
    <SafeAreaView
      edges={['top', 'left', 'right']}
      style={[styles.root, { backgroundColor: theme.background }]}
    >
      {twoPanes ? (
        <View style={styles.panes}>
          {list}
          <View
            style={[
              styles.detail,
              { borderLeftColor: theme.border, backgroundColor: theme.card },
            ]}
          >
            {selected === null ? (
              <View style={styles.placeholder}>
                <Text style={[type.body, { color: theme['muted-foreground'] }]}>
                  Pick a task to see it here.
                </Text>
              </View>
            ) : (
              <TaskDetail
                key={selected}
                id={selected}
                embedded
                onClose={() => select(null)}
              />
            )}
          </View>
        </View>
      ) : (
        list
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  fill: { flex: 1 },
  panes: { flex: 1, flexDirection: 'row' },
  detail: { flex: 1, borderLeftWidth: StyleSheet.hairlineWidth },
  placeholder: { flex: 1, alignItems: 'center', justifyContent: 'center' },
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
