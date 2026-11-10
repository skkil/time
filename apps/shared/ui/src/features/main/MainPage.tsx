import { getRouteApi } from '@tanstack/react-router';

import { DayCanvas } from '@/features/day/DayCanvas';
import { WeekView } from '@/features/planner/WeekView';

const route = getRouteApi('/');

export function MainPage() {
  const { view, week, earlier } = route.useSearch();
  const navigate = route.useNavigate();
  if (view === 'week') return <WeekView week={week} />;
  return (
    <DayCanvas
      triage={earlier === true}
      onTriageClose={() =>
        void navigate({
          search: (previous) => ({ ...previous, earlier: undefined }),
          replace: true,
        })
      }
    />
  );
}
