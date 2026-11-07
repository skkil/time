import { router } from 'expo-router';
import type { ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useWide } from '@/ui/responsive';
import { WINDOW } from '@/ui/surfaces';
import { spacing } from '@/ui/theme';

/**
 * A glass window over the current page, as desktop opens tasks, focus and
 * habits: anchored to the bottom on phones, centred on wide screens. A tap on
 * the dimmed sky closes it.
 */
export function Window({
  children,
  fit = false,
}: {
  children: ReactNode;
  /** Size to the content instead of filling the screen. */
  fit?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const wide = useWide();
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[
        styles.root,
        wide ? styles.centred : styles.bottom,
        { paddingTop: insets.top + spacing.xxxl },
      ]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Close"
        onPress={() => router.back()}
        style={StyleSheet.absoluteFill}
      />
      <View
        style={[
          WINDOW,
          wide ? styles.wide : styles.phone,
          !fit && styles.fill,
          !wide && { paddingBottom: insets.bottom },
        ]}
      >
        {children}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.45)' },
  bottom: { justifyContent: 'flex-end' },
  centred: { justifyContent: 'center', alignItems: 'center' },
  phone: {
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    borderBottomWidth: 0,
    overflow: 'hidden',
  },
  wide: { width: 640, maxHeight: 680, overflow: 'hidden' },
  fill: { flexShrink: 1, minHeight: '60%' },
});
