import { isApiError } from '@skkil-time/api';
import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { OUTLINE_PILL, PRIMARY_PILL } from '@/ui/surfaces';
import { ink, spacing, type, useTheme } from '@/ui/theme';

export function Empty({ title, detail }: { title: string; detail?: string }) {
  return (
    <View style={styles.center}>
      <Text style={[type.heading, styles.text]}>{title}</Text>
      {detail && <Text style={[type.small, styles.text]}>{detail}</Text>}
    </View>
  );
}

export function Loading() {
  return (
    <View style={styles.center}>
      <ActivityIndicator color={ink.secondary} />
    </View>
  );
}

export function Failed({
  error,
  onRetry,
}: {
  error: unknown;
  onRetry: () => void;
}) {
  const message = isApiError(error) ? error.message : 'Something went wrong.';
  return (
    <View style={styles.center}>
      <Text style={[type.body, styles.text]}>{message}</Text>
      <Button label="Try again" tone="secondary" onPress={onRetry} />
    </View>
  );
}

/** A pill: `primary` is the one filled button on a surface, the rest are outlined. */
export function Button({
  label,
  onPress,
  tone = 'primary',
  disabled,
  icon,
}: {
  label: string;
  onPress: () => void;
  tone?: 'primary' | 'secondary' | 'destructive';
  disabled?: boolean;
  icon?: ReactNode;
}) {
  const theme = useTheme();
  const color =
    tone === 'primary'
      ? ink.onPrimary
      : tone === 'destructive'
        ? theme.destructive
        : ink.full;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        tone === 'primary' ? PRIMARY_PILL : OUTLINE_PILL,
        tone === 'destructive' && { borderColor: 'rgba(255, 107, 94, 0.45)' },
        { opacity: disabled ? 0.45 : pressed ? 0.75 : 1 },
      ]}
    >
      {icon}
      <Text style={[type.label, { color }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  center: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxl,
    gap: spacing.md,
  },
  text: { textAlign: 'center' },
});
