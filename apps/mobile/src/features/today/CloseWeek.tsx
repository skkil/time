import { isoWeekNumber, todayKey } from '@skkil-time/rules/time';
import { useMutation, useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { commands } from '@/core/local/backend';
import { type } from '@/ui/theme';

/**
 * The weekly checkout on the review day, or the next morning's offer. The
 * review steps aren't on this device yet, so it points to the other apps.
 */
export function CloseWeek() {
  const evening = useQuery({
    queryKey: ['week-to-close', 'evening', todayKey()],
    queryFn: () => commands.weekToClose('evening'),
  });
  const morning = useQuery({
    queryKey: ['week-to-close', 'morning', todayKey()],
    queryFn: () => commands.weekToClose('morning'),
  });
  const decline = useMutation({
    mutationFn: async () => {
      const run = await commands.startRitual('weekly', null);
      await commands.skipRitual(run.id);
    },
  });
  const week = evening.data ?? morning.data;
  if (!week) return null;

  return (
    <View style={styles.note}>
      <Text style={[type.small, styles.text]}>
        {evening.data
          ? `It’s ${format(new Date(), 'EEEE')}, so let’s close the week.`
          : `Close week ${isoWeekNumber(week)}?`}{' '}
        The weekly review opens in skkil time on desktop or the web for now.
      </Text>
      {!evening.data && (
        <Pressable
          accessibilityRole="button"
          disabled={decline.isPending}
          onPress={() => decline.mutate()}
          style={styles.action}
        >
          <Text style={[type.small, styles.link]}>Not now</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  note: { gap: 2 },
  text: { color: 'rgba(241, 241, 238, 0.85)' },
  action: { minHeight: 32, justifyContent: 'center', alignSelf: 'flex-start' },
  link: { color: 'rgba(241, 241, 238, 0.85)', textDecorationLine: 'underline' },
});
