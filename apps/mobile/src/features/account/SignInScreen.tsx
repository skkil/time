import icon from '@assets/icon.png';
import { useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { auth } from '@/core/api/client';
import { Sky } from '@/ui/Sky';
import { Button } from '@/ui/States';
import { spacing, type } from '@/ui/theme';

export function SignInScreen() {
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
    <View style={styles.fill}>
      <Sky />
      <SafeAreaView style={styles.root}>
        <View style={styles.brand}>
          <Image
            source={icon}
            style={styles.icon}
            accessibilityIgnoresInvertColors
          />
          <Text style={type.display}>skkil time</Text>
          <Text
            style={[
              type.body,
              styles.tagline,
              { color: 'rgba(255,255,255,0.75)' },
            ]}
          >
            Plan your week, block your time and see where it went.
          </Text>
        </View>
        <View style={styles.actions}>
          <Button
            label={busy ? 'Signing in…' : 'Sign in'}
            disabled={busy}
            onPress={signIn}
          />
          <Text
            style={[
              type.small,
              styles.hint,
              { color: 'rgba(255,255,255,0.6)' },
            ]}
          >
            New here? You can create an account on the next screen.
          </Text>
          {error && (
            <Text
              accessibilityRole="alert"
              style={[
                type.small,
                styles.tagline,
                { color: 'rgba(255,255,255,0.75)' },
              ]}
            >
              {error}
            </Text>
          )}
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: '#0b1220' },
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
  hint: { textAlign: 'center' },
});
