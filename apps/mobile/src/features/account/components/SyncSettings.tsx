import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { sync } from '@/core/sync/sync';
import { useSyncView } from '@/core/sync/use-sync';
import {
  ACCOUNT_CHOICE,
  chooseAccountData,
} from '@/features/account/account-choice';
import { summarize } from '@/features/account/sync-summary';
import { Group } from '@/ui/Group';
import { Button } from '@/ui/States';
import { spacing, type, useTheme } from '@/ui/theme';

const issuesKey = (count: number) => ['sync-issues', count];
const TICK_MS = 30_000;

function useNow() {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(id);
  }, []);
  return now;
}

function TextButton({
  label,
  onPress,
  disabled,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      hitSlop={8}
      onPress={onPress}
      style={({ pressed }) => ({ opacity: disabled ? 0.4 : pressed ? 0.6 : 1 })}
    >
      <Text style={[type.body, { color: theme.primary }]}>{label}</Text>
    </Pressable>
  );
}

function Issues({ count }: { count: number }) {
  const theme = useTheme();
  const client = useQueryClient();
  const { data: issues = [] } = useQuery({
    queryKey: issuesKey(count),
    queryFn: () => sync.issues(),
    enabled: count > 0,
  });
  const dismiss = useMutation({
    mutationFn: (id: number) => sync.dismissIssue(id),
    onSettled: () => client.invalidateQueries({ queryKey: ['sync-issues'] }),
  });
  if (count === 0 || issues.length === 0) return null;

  return (
    <Group title="Couldn’t sync" held>
      {issues.map((issue, index) => (
        <View
          key={issue.id}
          style={[
            styles.row,
            styles.line,
            index > 0 && {
              borderTopWidth: StyleSheet.hairlineWidth,
              borderTopColor: theme.border,
            },
          ]}
        >
          <View style={styles.label}>
            <Text style={[type.body, { color: theme.foreground }]}>
              {issue.subject ?? issue.name}
            </Text>
            <Text style={[type.small, { color: theme['muted-foreground'] }]}>
              {issue.reason}
            </Text>
          </View>
          <TextButton
            label="Dismiss"
            disabled={dismiss.isPending}
            onPress={() => dismiss.mutate(issue.id)}
          />
        </View>
      ))}
    </Group>
  );
}

/** Sync in Settings: where it stands, Sync now, and the changes the server refused. */
export function SyncSettings() {
  const theme = useTheme();
  const view = useSyncView();
  const { status, detail } = summarize(view, useNow());
  const syncNow = useMutation({ mutationFn: () => sync.syncNow() });

  return (
    <>
      <Group title="Sync" held>
        <View style={[styles.row, styles.line]}>
          <View style={styles.label}>
            <Text style={[type.body, { color: theme.foreground }]}>
              {status}
            </Text>
            <Text style={[type.small, { color: theme['muted-foreground'] }]}>
              {detail}
            </Text>
            {syncNow.isError && view.error && (
              <Text style={[type.small, { color: theme.destructive }]}>
                {view.error}
              </Text>
            )}
          </View>
          {view.phase !== 'needsChoice' && (
            <TextButton
              label="Sync now"
              disabled={syncNow.isPending || view.phase === 'connecting'}
              onPress={() => syncNow.mutate()}
            />
          )}
        </View>
        {view.phase === 'needsChoice' && (
          <View style={[styles.row, styles.choice]}>
            <Text style={[type.small, { color: theme['muted-foreground'] }]}>
              {ACCOUNT_CHOICE.message}
            </Text>
            <Button
              label={ACCOUNT_CHOICE.keepLocal}
              onPress={() => chooseAccountData('keepLocal')}
            />
            <Button
              label={ACCOUNT_CHOICE.startFresh}
              tone="secondary"
              onPress={() => chooseAccountData('startFresh')}
            />
          </View>
        )}
      </Group>
      <Issues count={view.issues} />
    </>
  );
}

const styles = StyleSheet.create({
  row: { padding: spacing.md },
  line: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  label: { flex: 1, gap: 2 },
  choice: { gap: spacing.sm },
});
