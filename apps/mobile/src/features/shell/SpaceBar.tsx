import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ink, radius, spacing, type } from '@/ui/theme';

export const SPACES = [
  { name: 'index', label: 'Day' },
  { name: 'week', label: 'Week' },
  { name: 'projects', label: 'Projects' },
] as const;

/** Desktop's Day · Week · Projects pill, moved to the bottom where a thumb reaches it. */
export function SpaceBar({
  active,
  onPick,
}: {
  active: string;
  onPick: (name: string) => void;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View
      style={[
        styles.bar,
        { paddingBottom: Math.max(insets.bottom, spacing.md) },
      ]}
    >
      <View accessibilityRole="tablist" style={styles.pill}>
        {SPACES.map((space) => {
          const selected = space.name === active;
          return (
            <Pressable
              key={space.name}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              onPress={() => onPick(space.name)}
              style={[styles.tab, selected && styles.selected]}
            >
              <Text
                style={[
                  type.label,
                  { color: selected ? ink.full : ink.secondary },
                ]}
              >
                {space.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    paddingTop: spacing.sm,
  },
  pill: {
    flexDirection: 'row',
    padding: 4,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(10, 18, 32, 0.82)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  tab: {
    height: 40,
    minWidth: 88,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selected: { backgroundColor: 'rgba(255, 255, 255, 0.14)' },
});

/** Room the floating bar takes at the bottom of a space. */
export const SPACE_BAR_CLEARANCE = 88;
