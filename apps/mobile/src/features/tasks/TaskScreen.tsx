import { router, useLocalSearchParams } from 'expo-router';

import { TaskDetail } from '@/features/tasks/components/TaskDetail';

export function TaskScreen() {
  const id = Number(useLocalSearchParams<{ id: string }>().id);
  return <TaskDetail id={id} onClose={() => router.back()} />;
}
