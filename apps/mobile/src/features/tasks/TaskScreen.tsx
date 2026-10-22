import { router, useLocalSearchParams } from 'expo-router';

import { TaskDetail } from '@/features/tasks/components/TaskDetail';

export function TaskScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <TaskDetail id={id} onClose={() => router.back()} />;
}
