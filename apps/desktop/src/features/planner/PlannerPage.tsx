import { getRouteApi, useNavigate } from '@tanstack/react-router';
import { useMemo } from 'react';

import { Page, PageHeader, Stat, WeekSwitcher } from '@/components/page';
import { useTimeEntries } from '@/features/time/api';
import {
  formatDuration,
  formatWeekRange,
  isoWeekNumber,
  shiftKey,
} from '@/lib/time';

import { ScheduleView } from './ScheduleView';
import { useBlocks } from './api';

const route = getRouteApi('/planner');

export function PlannerPage() {
  const { week } = route.useSearch();
  const navigate = useNavigate();
  const { data: blocks = [] } = useBlocks(week);
  const { data: entries = [] } = useTimeEntries(week, shiftKey(week, 7));

  const totals = useMemo(
    () => ({
      planned: blocks.reduce(
        (sum, block) => sum + block.endAt - block.startAt,
        0,
      ),
      tracked: entries.reduce(
        (sum, entry) => sum + entry.endedAt - entry.startedAt,
        0,
      ),
    }),
    [blocks, entries],
  );

  const go = (next: { week: string }) =>
    navigate({ to: '/planner', search: next });

  return (
    <Page>
      <PageHeader
        title={`Week ${isoWeekNumber(week)}`}
        meta={[
          formatWeekRange(week),
          <Stat value={formatDuration(totals.planned)} label="planned" />,
          <Stat value={formatDuration(totals.tracked)} label="tracked" />,
        ]}
        actions={
          <WeekSwitcher week={week} onChange={(next) => go({ week: next })} />
        }
      />
      <ScheduleView week={week} />
    </Page>
  );
}
