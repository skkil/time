import Constants from 'expo-constants';
import * as WebBrowser from 'expo-web-browser';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';

import { auth, deleteAccount } from '@/backend';
import { Group } from '@/components/Group';
import { Button } from '@/components/States';
import { useSession } from '@/session';
import { spacing, type, useTheme } from '@/theme';

const LEGAL_URL =
  process.env.EXPO_PUBLIC_LEGAL_URL ?? 'https://time.skkil.org/legal';

export default function Settings() {
  const theme = useTheme();
  const { session } = useSession();

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
    <ScrollView
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={styles.content}
    >
      <Group title="Account">
        <View style={styles.row}>
          <Text style={[type.body, { color: theme.foreground }]}>
            {session?.email ?? session?.name ?? 'Signed in'}
          </Text>
        </View>
      </Group>
      <Button
        label="Sign out"
        tone="secondary"
        onPress={() => void auth.signOut()}
      />
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
      <Text
        style={[
          type.small,
          styles.version,
          { color: theme['muted-foreground'] },
        ]}
      >
        skkil time {Constants.expoConfig?.version}
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.md },
  row: { padding: spacing.md },
  version: { textAlign: 'center', marginTop: spacing.lg },
});
