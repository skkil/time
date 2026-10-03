import { router, useLocalSearchParams } from 'expo-router';

import { TaskDetail } from '@/components/TaskDetail';

export default function TaskScreen() {
  const id = Number(useLocalSearchParams<{ id: string }>().id);
  return <TaskDetail id={id} onClose={() => router.back()} />;
}
