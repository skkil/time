import {
  HankenGrotesk_200ExtraLight,
  HankenGrotesk_300Light,
  HankenGrotesk_400Regular,
  HankenGrotesk_500Medium,
  HankenGrotesk_600SemiBold,
  useFonts,
} from '@expo-google-fonts/hanken-grotesk';
import { QueryClientProvider, focusManager } from '@tanstack/react-query';
import { DarkTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { AppState } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { queryClient } from '@/core/api/query-client';
import { SessionProvider, useSession } from '@/core/auth/session';
import { useReminders } from '@/core/notifications/reminders';
import { useBlockLog } from '@/core/sync/use-block-log';
import { useSync } from '@/core/sync/use-sync';
import { useWidgets } from '@/core/widgets/use-widgets';
import { useAccountChoice } from '@/features/account/account-choice';
import { SelectionProvider } from '@/features/tasks/selection';
import { ConnectionNotice } from '@/ui/ConnectionNotice';
import { ink } from '@/ui/theme';

void SplashScreen.preventAutoHideAsync();

AppState.addEventListener('change', (status) =>
  focusManager.setFocused(status === 'active'),
);

const NAVIGATION_THEME = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: '#0b1220',
    card: 'transparent',
    text: ink.full,
    border: 'transparent',
  },
};

export const unstable_settings = { anchor: '(tabs)' };

const WINDOW = {
  presentation: 'transparentModal',
  animation: 'fade',
  contentStyle: { backgroundColor: 'transparent' },
} as const;

function Routes() {
  const { session, loading } = useSession();
  const [fontsLoaded, fontError] = useFonts({
    HankenGrotesk_200ExtraLight,
    HankenGrotesk_300Light,
    HankenGrotesk_400Regular,
    HankenGrotesk_500Medium,
    HankenGrotesk_600SemiBold,
  });
  const ready = !loading && (fontsLoaded || fontError !== null);
  useSync(session !== null);
  useAccountChoice();
  useReminders(session !== null);
  useBlockLog(session !== null);
  useWidgets(loading ? null : session !== null);
  useEffect(() => {
    if (ready) void SplashScreen.hideAsync();
  }, [ready]);
  if (!ready) return null;

  return (
    <ThemeProvider value={NAVIGATION_THEME}>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Protected guard={session !== null} redirectTo="/sign-in">
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="project/[id]" />
          <Stack.Screen name="settings" />
          <Stack.Screen name="task/[id]" options={WINDOW} />
          <Stack.Screen name="add" options={WINDOW} />
          <Stack.Screen name="focus" options={WINDOW} />
          <Stack.Screen name="habits" options={WINDOW} />
          <Stack.Screen name="earlier" options={WINDOW} />
        </Stack.Protected>
        <Stack.Protected guard={session === null} redirectTo="/">
          <Stack.Screen name="sign-in" />
        </Stack.Protected>
      </Stack>
      {session && <ConnectionNotice />}
    </ThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <SessionProvider>
            <SelectionProvider>
              <Routes />
            </SelectionProvider>
          </SessionProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
