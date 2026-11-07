import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import type { ReactNode } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Sky } from '@/ui/Sky';
import { useWide } from '@/ui/responsive';
import { WINDOW } from '@/ui/surfaces';
import { ink, spacing, type } from '@/ui/theme';

type ScreenProps = {
  title?: string;
  subtitle?: string;
  /** Sits above the title, like desktop's breadcrumb. */
  eyebrow?: ReactNode;
  /** Top-right controls, level with the back button. */
  controls?: ReactNode;
  back?: boolean;
  children: ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
  scroll?: boolean;
  /** Shown beside the content when the screen is wide enough for two panes. */
  aside?: ReactNode;
  /** Space kept free at the bottom, e.g. for the floating space bar. */
  bottom?: number;
};

const LIST_WIDTH = 440;
const READING_WIDTH = 680;

/** A page on the sky: no bars, type straight on the canvas. */
export function Screen({
  title,
  subtitle,
  eyebrow,
  controls,
  back = false,
  children,
  refreshing = false,
  onRefresh,
  scroll = true,
  aside,
  bottom = spacing.xxxl,
}: ScreenProps) {
  const wide = useWide();
  const twoPanes = wide && aside !== undefined;
  const top = (back || controls) && (
    <View style={styles.top}>
      {back ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          hitSlop={8}
          onPress={() => router.back()}
          style={styles.back}
        >
          <Ionicons name="chevron-back" size={22} color={ink.full} />
        </Pressable>
      ) : (
        <View />
      )}
      {controls}
    </View>
  );
  const header = (title || eyebrow) && (
    <View style={styles.titles}>
      {eyebrow}
      {title && (
        <Text accessibilityRole="header" style={type.title}>
          {title}
        </Text>
      )}
      {subtitle && <Text style={type.small}>{subtitle}</Text>}
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
      contentContainerStyle={[styles.content, { paddingBottom: bottom }]}
      refreshControl={
        onRefresh && (
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={ink.secondary}
          />
        )
      }
    >
      {header}
      {children}
    </ScrollView>
  ) : (
    <View
      style={[styles.content, styles.fill, width, { paddingBottom: bottom }]}
    >
      {header}
      {children}
    </View>
  );

  return (
    <View style={styles.root}>
      <Sky />
      <SafeAreaView edges={['top', 'left', 'right']} style={styles.fill}>
        {top}
        {twoPanes ? (
          <View style={styles.panes}>
            {list}
            <View style={[WINDOW, styles.detail]}>{aside}</View>
          </View>
        ) : (
          list
        )}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0b1220' },
  fill: { flex: 1 },
  panes: { flex: 1, flexDirection: 'row' },
  detail: { flex: 1, margin: spacing.lg, marginTop: 0, overflow: 'hidden' },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    minHeight: 52,
  },
  back: {
    width: 40,
    height: 40,
    marginLeft: -spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    paddingHorizontal: spacing.lg,
    gap: spacing.xl,
  },
  titles: { gap: spacing.xs, paddingTop: spacing.sm },
});
