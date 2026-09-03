import { getRouteApi } from '@tanstack/react-router';

import { DayView } from '@/features/day/DayView';
import { WeekView } from '@/features/planner/WeekView';

const route = getRouteApi('/');

export function MainPage() {
  const { view, week } = route.useSearch();
  return view === 'week' ? <WeekView week={week} /> : <DayView />;
}
