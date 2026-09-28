import icon from '@assets/icon.png';
import { useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { auth } from '@/backend';
import { Button } from '@/components/States';
import { spacing, type, useTheme } from '@/theme';

export default function SignIn() {
  const theme = useTheme();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const signIn = async () => {
    setBusy(true);
    setError(null);
    try {
      await auth.signIn();
    } catch {
      setError('Sign-in didn’t finish. Try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: theme.chrome }]}>
      <View style={styles.brand}>
        <Image
          source={icon}
          style={styles.icon}
          accessibilityIgnoresInvertColors
        />
        <Text style={[type.title, { color: theme['chrome-foreground'] }]}>
          skkil time
        </Text>
        <Text
          style={[type.body, styles.tagline, { color: theme['chrome-muted'] }]}
        >
          Plan your week, block your time and see where it went.
        </Text>
      </View>
      <View style={styles.actions}>
        <Button
          label={busy ? 'Signing in…' : 'Sign in'}
          tone="secondary"
          disabled={busy}
          onPress={signIn}
        />
        {error && (
          <Text
            accessibilityRole="alert"
            style={[
              type.small,
              styles.tagline,
              { color: theme['chrome-muted'] },
            ]}
          >
            {error}
          </Text>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'space-between', padding: spacing.xl },
  brand: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  icon: { width: 72, height: 72, borderRadius: 16 },
  tagline: { textAlign: 'center', maxWidth: 300 },
  actions: { gap: spacing.md },
});
