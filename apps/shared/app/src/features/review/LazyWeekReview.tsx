import { Suspense, lazy } from 'react';

import type { DateKey } from '@/lib/time';

const WeekReview = lazy(() =>
  import('./WeekReview').then(({ WeekReview }) => ({ default: WeekReview })),
);

export function LazyWeekReview({ week }: { week: DateKey }) {
  return (
    <Suspense>
      <WeekReview week={week} />
    </Suspense>
  );
}
