import { StyleSheet, Text, View } from 'react-native';

import { TaskDetail } from '@/features/tasks/components/TaskDetail';
import { useSelection } from '@/features/tasks/selection';
import { type, useTheme } from '@/ui/theme';

/** The selected task beside a list on wide screens. */
export function TaskAside() {
  const theme = useTheme();
  const { selected, select } = useSelection();
  if (selected === null)
    return (
      <View style={styles.placeholder}>
        <Text style={[type.body, { color: theme['muted-foreground'] }]}>
          Pick a task to see it here.
        </Text>
      </View>
    );
  return (
    <TaskDetail
      key={selected}
      id={selected}
      embedded
      onClose={() => select(null)}
    />
  );
}

const styles = StyleSheet.create({
  placeholder: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
