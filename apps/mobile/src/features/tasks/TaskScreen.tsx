import { router, useLocalSearchParams } from 'expo-router';

import { TaskDetail } from '@/features/tasks/components/TaskDetail';
import { Window } from '@/ui/Window';

export function TaskScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <Window>
      <TaskDetail id={id} onClose={() => router.back()} />
    </Window>
  );
}
