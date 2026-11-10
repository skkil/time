import type { NotificationPrefs } from '@skkil-time/client/types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Constants from 'expo-constants';
import * as WebBrowser from 'expo-web-browser';
import { Alert, StyleSheet, Switch, Text, View } from 'react-native';

import { deleteAccount, signOut } from '@/core/auth/account';
import { useSession } from '@/core/auth/session';
import { commands } from '@/core/local/backend';
import {
  disableReminders,
  enableReminders,
  remindersOn,
} from '@/core/notifications/reminders';
import { reschedule } from '@/core/notifications/schedule';
import { useSyncView } from '@/core/sync/use-sync';
import { SyncSettings } from '@/features/account/components/SyncSettings';
import { useDisplayName } from '@/features/account/profile';
import { Group } from '@/ui/Group';
import { Screen } from '@/ui/Screen';
import { Button } from '@/ui/States';
import { spacing, type, useTheme } from '@/ui/theme';

const REMINDERS_KEY = ['reminders'];
const PREFS_KEY = ['reminders', 'kinds'];

const KINDS = [
  {
    key: 'tasks',
    label: 'Tasks with a time',
    hint: 'When a task reaches its time.',
  },
  {
    key: 'blocks',
    label: 'Focus blocks',
    hint: 'When a planned focus block starts.',
  },
  {
    key: 'events',
    label: 'Events',
    hint: '10 minutes before an event starts.',
  },
] as const;

function SettingSwitch({
  label,
  hint,
  value,
  disabled,
  onChange,
}: {
  label: string;
  hint: string;
  value: boolean;
  disabled: boolean;
  onChange: (next: boolean) => void;
}) {
  const theme = useTheme();
  return (
    <View style={[styles.row, styles.setting]}>
      <View style={styles.label}>
        <Text style={[type.body, { color: theme.foreground }]}>{label}</Text>
        <Text style={[type.small, { color: theme['muted-foreground'] }]}>
          {hint}
        </Text>
      </View>
      <Switch
        accessibilityLabel={label}
        value={value}
        disabled={disabled}
        onValueChange={onChange}
      />
    </View>
  );
}

function Reminders() {
  const client = useQueryClient();
  const { data: on } = useQuery({
    queryKey: REMINDERS_KEY,
    queryFn: remindersOn,
  });
  const { data: prefs } = useQuery({
    queryKey: PREFS_KEY,
    queryFn: commands.getNotificationPrefs,
  });
  const toggle = useMutation({
    mutationFn: async (next: boolean) => {
      if (next && !(await enableReminders())) {
        Alert.alert(
          'Notifications are off',
          'Allow notifications for skkil time in your device settings, then turn reminders on again.',
        );
        return false;
      }
      if (!next) await disableReminders();
      return next;
    },
    onSuccess: (next) => {
      client.setQueryData(REMINDERS_KEY, next);
      void client.invalidateQueries({ queryKey: PREFS_KEY });
    },
    onError: () =>
      Alert.alert(
        'Couldn’t change reminders',
        'Nothing was changed. Try again.',
      ),
  });
  const choose = useMutation({
    mutationFn: async (next: NotificationPrefs) => {
      await commands.setNotificationPrefs(next);
      await reschedule();
      return next;
    },
    onSuccess: (next) => client.setQueryData(PREFS_KEY, next),
  });

  return (
    <>
      <SettingSwitch
        label="Reminders"
        hint="Notifies this phone about timed tasks, focus blocks and events, even offline."
        value={on ?? false}
        disabled={toggle.isPending}
        onChange={(next) => toggle.mutate(next)}
      />
      {on &&
        prefs &&
        KINDS.map((kind) => (
          <SettingSwitch
            key={kind.key}
            label={kind.label}
            hint={kind.hint}
            value={prefs[kind.key]}
            disabled={choose.isPending}
            onChange={(next) => choose.mutate({ ...prefs, [kind.key]: next })}
          />
        ))}
    </>
  );
}

const LEGAL_URL =
  process.env.EXPO_PUBLIC_LEGAL_URL ?? 'https://time.skkil.org/legal';

const signOutFailed = () =>
  Alert.alert('Couldn’t sign out', 'You’re still signed in. Try again.');

export function SettingsScreen() {
  const theme = useTheme();
  const { session } = useSession();
  const name = useDisplayName();
  const { pending } = useSyncView();

  const confirmSignOut = () => {
    if (pending === 0) return void signOut().catch(signOutFailed);
    Alert.alert(
      'Sign out?',
      pending === 1
        ? '1 change hasn’t synced yet. Signing out removes it from this device.'
        : `${pending} changes haven’t synced yet. Signing out removes them from this device.`,
      [
        { text: 'Stay signed in', style: 'cancel' },
        {
          text: 'Sign out',
          style: 'destructive',
          onPress: () => void signOut().catch(signOutFailed),
        },
      ],
    );
  };

  const confirmDelete = () =>
    Alert.alert(
      'Delete your account?',
      'Your account and every project, task, focus session, habit and review in it are removed for good.',
      [
        { text: 'Keep my account', style: 'cancel' },
        {
          text: 'Delete account',
          style: 'destructive',
          onPress: () =>
            void deleteAccount().catch(() =>
              Alert.alert(
                'Couldn’t delete the account',
                'Nothing was changed. Try again.',
              ),
            ),
        },
      ],
    );

  return (
    <Screen back title="Settings">
      <Group title="Account" held>
        <View style={[styles.row, styles.label]}>
          <Text style={[type.body, { color: theme.foreground }]}>
            {name || session?.email || 'Signed in'}
          </Text>
          {name && session?.email && (
            <Text style={[type.small, { color: theme['muted-foreground'] }]}>
              {session.email}
            </Text>
          )}
        </View>
        <View style={styles.row}>
          <Text style={[type.small, { color: theme['muted-foreground'] }]}>
            Your tasks, focus time and settings follow this account to every
            device you sign in on.
          </Text>
        </View>
      </Group>
      <SyncSettings />
      <Group title="Notifications" held>
        <Reminders />
      </Group>
      <View style={styles.buttons}>
        <Button label="Sign out" tone="secondary" onPress={confirmSignOut} />
        <Button
          label="Privacy and terms"
          tone="secondary"
          onPress={() => void WebBrowser.openBrowserAsync(LEGAL_URL)}
        />
        <Button
          label="Delete account"
          tone="destructive"
          onPress={confirmDelete}
        />
      </View>
      <Text
        style={[
          type.small,
          styles.version,
          { color: theme['muted-foreground'] },
        ]}
      >
        skkil time {Constants.expoConfig?.version}
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  buttons: { gap: spacing.sm },
  row: { padding: spacing.md },
  setting: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  label: { flex: 1, gap: 2 },
  version: { textAlign: 'center', marginTop: spacing.lg },
});
