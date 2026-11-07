import Ionicons from '@expo/vector-icons/Ionicons';
import type { Outcome } from '@skkil-time/contract';
import { type DateKey, formatDuration } from '@skkil-time/domain/time';
import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { useOutcomeActions, useWeek } from '@/features/week/hooks';
import { Check } from '@/ui/Check';
import { Group } from '@/ui/Group';
import { ink, spacing, type } from '@/ui/theme';

const MAX_OUTCOMES = 3;

/** The week's three outcomes at most, as on desktop's planning rail. */
export function Outcomes({
  week,
  editable,
}: {
  week: DateKey;
  editable: boolean;
}) {
  const { data } = useWeek(week);
  const outcomes = (data?.outcomes ?? []).filter(
    (outcome) => outcome.status !== 'dropped',
  );
  const open = outcomes.filter((outcome) => outcome.status === 'open').length;
  if (!editable && outcomes.length === 0) return null;

  return (
    <Group title="Outcomes">
      {outcomes.map((outcome) => (
        <OutcomeRow key={outcome.id} outcome={outcome} editable={editable} />
      ))}
      {editable && open < MAX_OUTCOMES && <AddOutcome week={week} />}
    </Group>
  );
}

function OutcomeRow({
  outcome,
  editable,
}: {
  outcome: Outcome;
  editable: boolean;
}) {
  const { setStatus } = useOutcomeActions();
  const achieved = outcome.status === 'achieved';
  return (
    <View style={styles.row}>
      <View style={styles.check}>
        <Check
          size={18}
          checked={achieved}
          label={
            achieved
              ? `Reopen ${outcome.title}`
              : `Mark ${outcome.title} achieved`
          }
          onToggle={() =>
            editable &&
            outcome.status !== 'carried' &&
            setStatus.mutate({
              id: outcome.id,
              status: achieved ? 'open' : 'achieved',
            })
          }
        />
      </View>
      <View style={styles.body}>
        <Text style={[type.body, achieved && { color: ink.secondary }]}>
          {outcome.title}
        </Text>
        <Text style={type.small}>
          {[
            outcome.tasksTotal
              ? `${outcome.tasksDone} of ${outcome.tasksTotal}`
              : 'no tasks linked',
            outcome.trackedSeconds > 0 &&
              formatDuration(outcome.trackedSeconds),
            outcome.timesCarried > 0 && `carried ×${outcome.timesCarried}`,
            outcome.status === 'carried' && 'moved to next week',
          ]
            .filter(Boolean)
            .join(' · ')}
        </Text>
      </View>
    </View>
  );
}

function AddOutcome({ week }: { week: DateKey }) {
  const { create } = useOutcomeActions();
  const [title, setTitle] = useState('');
  const submit = () => {
    if (!title.trim()) return;
    create.mutate({ week, title: title.trim() });
    setTitle('');
  };
  return (
    <View style={styles.row}>
      <View style={styles.check}>
        <Ionicons name="add" size={18} color={ink.secondary} />
      </View>
      <TextInput
        value={title}
        onChangeText={setTitle}
        onSubmitEditing={submit}
        maxLength={200}
        returnKeyType="done"
        placeholder="Add an outcome"
        placeholderTextColor={ink.faint}
        accessibilityLabel="New outcome"
        style={[type.body, styles.input]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  check: { width: 20, alignItems: 'center', paddingTop: 1 },
  body: { flex: 1, gap: 2 },
  input: { flex: 1, padding: 0, minHeight: 28 },
});
