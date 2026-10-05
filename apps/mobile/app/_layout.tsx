import { QueryClientProvider, focusManager } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { AppState } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { SelectionProvider } from '@/layout';
import { useReminders } from '@/notifications';
import { queryClient } from '@/queries';
import { SessionProvider, useSession } from '@/session';
import { useTheme } from '@/theme';

void SplashScreen.preventAutoHideAsync();

AppState.addEventListener('change', (status) =>
  focusManager.setFocused(status === 'active'),
);

function Routes() {
  const theme = useTheme();
  const { session, loading } = useSession();
  useReminders(session !== null);
  useEffect(() => {
    if (!loading) void SplashScreen.hideAsync();
  }, [loading]);
  if (loading) return null;

  return (
    <>
      <StatusBar style={theme.scheme === 'dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerTintColor: theme.foreground,
          headerStyle: { backgroundColor: theme.background },
          headerShadowVisible: false,
          contentStyle: { backgroundColor: theme.background },
        }}
      >
        <Stack.Protected guard={session !== null}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen
            name="task/[id]"
            options={{ title: '', presentation: 'modal' }}
          />
          <Stack.Screen name="project/[id]" options={{ title: '' }} />
          <Stack.Screen
            name="add"
            options={{
              title: 'Add task',
              presentation: 'formSheet',
              sheetAllowedDetents: [0.5, 1],
            }}
          />
          <Stack.Screen name="settings" options={{ title: 'Settings' }} />
        </Stack.Protected>
        <Stack.Protected guard={session === null}>
          <Stack.Screen name="sign-in" options={{ headerShown: false }} />
        </Stack.Protected>
      </Stack>
    </>
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
