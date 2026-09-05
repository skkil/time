import { getRouteApi } from '@tanstack/react-router';

import { DayCanvas } from '@/features/day/DayCanvas';
import { WeekView } from '@/features/planner/WeekView';

const route = getRouteApi('/');

export function MainPage() {
  const { view, week } = route.useSearch();
  return view === 'week' ? <WeekView week={week} /> : <DayCanvas />;
}
