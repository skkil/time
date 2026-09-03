import { getRouteApi } from '@tanstack/react-router';

import { WeekView } from '@/features/planner/WeekView';
import { TodayPage } from '@/features/tasks/TodayPage';

const route = getRouteApi('/');

export function MainPage() {
  const { view, week } = route.useSearch();
  return view === 'week' ? <WeekView week={week} /> : <TodayPage />;
}
