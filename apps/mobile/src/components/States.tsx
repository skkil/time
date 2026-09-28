import { isApiError } from '@skkil-time/api';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { radius, spacing, type, useTheme } from '@/theme';

export function Empty({ title, detail }: { title: string; detail?: string }) {
  const theme = useTheme();
  return (
    <View style={styles.center}>
      <Text style={[type.heading, { color: theme.foreground }]}>{title}</Text>
      {detail && (
        <Text
          style={[
            type.small,
            styles.text,
            { color: theme['muted-foreground'] },
          ]}
        >
          {detail}
        </Text>
      )}
    </View>
  );
}

export function Loading() {
  const theme = useTheme();
  return (
    <View style={styles.center}>
      <ActivityIndicator color={theme.primary} />
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
  const theme = useTheme();
  const message = isApiError(error) ? error.message : 'Something went wrong.';
  return (
    <View style={styles.center}>
      <Text style={[type.body, styles.text, { color: theme.foreground }]}>
        {message}
      </Text>
      <Button label="Try again" onPress={onRetry} />
    </View>
  );
}

export function Button({
  label,
  onPress,
  tone = 'primary',
  disabled,
}: {
  label: string;
  onPress: () => void;
  tone?: 'primary' | 'secondary' | 'destructive';
  disabled?: boolean;
}) {
  const theme = useTheme();
  const background =
    tone === 'primary'
      ? theme.primary
      : tone === 'destructive'
        ? theme.destructive
        : theme.secondary;
  const color =
    tone === 'primary'
      ? theme['primary-foreground']
      : tone === 'destructive'
        ? '#ffffff'
        : theme.foreground;
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: background,
          opacity: disabled ? 0.5 : pressed ? 0.8 : 1,
        },
      ]}
    >
      <Text style={[type.body, styles.label, { color }]}>{label}</Text>
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
  button: {
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  label: { fontWeight: '600' },
});
