import {
  createHashHistory,
  createRootRoute,
  createRoute,
  createRouter,
  redirect,
} from '@tanstack/react-router';

import { HabitsPage } from '@/features/habits/HabitsPage';
import { PlannerPage } from '@/features/planner/PlannerPage';
import { ReviewHome } from '@/features/review/ReviewHome';
import { WeekReview } from '@/features/review/WeekReview';
import { LabelPage } from '@/features/tasks/LabelPage';
import { ProjectView } from '@/features/tasks/ProjectView';
import { TodayPage } from '@/features/tasks/TodayPage';
import { UpcomingPage } from '@/features/tasks/UpcomingPage';
import { TimePage } from '@/features/time/TimePage';
import { type DateKey, mondayOf, todayKey } from '@/lib/time';

import { AppShell } from './AppShell';
import { RouteError } from './RouteError';

type WeekSearch = { week: DateKey };

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

function validateWeek(search: Record<string, unknown>): WeekSearch {
  const week =
    typeof search.week === 'string' && DATE_KEY.test(search.week)
      ? search.week
      : todayKey();
  return { week: mondayOf(week) };
}

const rootRoute = createRootRoute({ component: AppShell });

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  beforeLoad: () => {
    throw redirect({ to: '/today' });
  },
});

export const plannerRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/planner',
  validateSearch: validateWeek,
  component: PlannerPage,
});

const inboxRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/inbox',
  component: () => <ProjectView projectId={null} />,
});

const todayRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/today',
  component: TodayPage,
});

export const upcomingRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/upcoming',
  validateSearch: (search: Record<string, unknown>): { from: DateKey } => ({
    from:
      typeof search.from === 'string' && DATE_KEY.test(search.from)
        ? search.from
        : todayKey(),
  }),
  component: UpcomingPage,
});

export const projectRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/projects/$projectId',
  params: {
    parse: (params) => ({ projectId: Number(params.projectId) }),
    stringify: (params) => ({ projectId: String(params.projectId) }),
  },
  component: function ProjectRoute() {
    const { projectId } = projectRoute.useParams();
    return <ProjectView key={projectId} projectId={projectId} />;
  },
});

export const labelRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/labels/$labelId',
  params: {
    parse: (params) => ({ labelId: Number(params.labelId) }),
    stringify: (params) => ({ labelId: String(params.labelId) }),
  },
  component: LabelPage,
});

export const timeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/time',
  validateSearch: validateWeek,
  component: TimePage,
});

export const habitsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/habits',
  validateSearch: validateWeek,
  component: HabitsPage,
});

const reviewRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/review',
  component: ReviewHome,
});

export const weekReviewRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/review/$week',
  params: {
    parse: (params) => ({
      week: mondayOf(DATE_KEY.test(params.week) ? params.week : todayKey()),
    }),
    stringify: (params) => ({ week: params.week }),
  },
  component: function WeekReviewRoute() {
    const { week } = weekReviewRoute.useParams();
    return <WeekReview week={week} />;
  },
});

const routeTree = rootRoute.addChildren([
  indexRoute,
  inboxRoute,
  todayRoute,
  upcomingRoute,
  plannerRoute,
  projectRoute,
  labelRoute,
  timeRoute,
  habitsRoute,
  reviewRoute,
  weekReviewRoute,
]);

export const router = createRouter({
  routeTree,
  history: createHashHistory(),
  defaultErrorComponent: RouteError,
});

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
