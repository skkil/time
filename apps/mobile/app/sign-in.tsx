import icon from '@assets/icon.png';
import { rgb, skyAt } from '@skkil-time/tokens/sky';
import { useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { auth } from '@/backend';
import { Button } from '@/components/States';
import { spacing, type } from '@/theme';

export default function SignIn() {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const now = new Date();
  const sky = skyAt(now.getHours() + now.getMinutes() / 60);

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
    <SafeAreaView style={[styles.root, { backgroundColor: rgb(sky.top) }]}>
      <View
        pointerEvents="none"
        style={[styles.horizon, { backgroundColor: rgb(sky.bottom) }]}
      />
      <View
        pointerEvents="none"
        style={[styles.glow, { backgroundColor: rgb(sky.glows[1], 0.35) }]}
      />
      <View style={styles.brand}>
        <Image
          source={icon}
          style={styles.icon}
          accessibilityIgnoresInvertColors
        />
        <Text style={[type.title, { color: '#fff' }]}>skkil time</Text>
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
          tone="secondary"
          disabled={busy}
          onPress={signIn}
        />
        <Text
          style={[type.small, styles.hint, { color: 'rgba(255,255,255,0.6)' }]}
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
  horizon: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '45%',
    opacity: 0.85,
  },
  glow: {
    position: 'absolute',
    width: 520,
    height: 520,
    borderRadius: 260,
    top: -160,
    right: -200,
  },
  hint: { textAlign: 'center' },
});
