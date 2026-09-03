import {
  createHashHistory,
  createRootRoute,
  createRoute,
  createRouter,
  redirect,
} from '@tanstack/react-router';

import { HabitsPage } from '@/features/habits/HabitsPage';
import { MainPage } from '@/features/main/MainPage';
import { ReportsPage } from '@/features/reports/ReportsPage';
import { ReviewHome } from '@/features/review/ReviewHome';
import { WeekReview } from '@/features/review/WeekReview';
import { ProjectView } from '@/features/tasks/ProjectView';
import { SomedayPage } from '@/features/tasks/SomedayPage';
import { UpcomingPage } from '@/features/tasks/UpcomingPage';
import { TimePage } from '@/features/time/TimePage';
import { type DateKey, mondayOf, todayKey } from '@/lib/time';

import { AppShell } from './AppShell';
import { RouteError } from './RouteError';

type WeekSearch = { week: DateKey };
export type MainView = 'day' | 'week';
type MainSearch = { view: MainView; week: DateKey };

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

function validateWeek(search: Record<string, unknown>): WeekSearch {
  const week =
    typeof search.week === 'string' && DATE_KEY.test(search.week)
      ? search.week
      : todayKey();
  return { week: mondayOf(week) };
}

const rootRoute = createRootRoute({ component: AppShell });

export const mainRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  validateSearch: (search: Record<string, unknown>): MainSearch => ({
    view: search.view === 'week' ? 'week' : 'day',
    ...validateWeek(search),
  }),
  component: MainPage,
});

const plannerRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/planner',
  beforeLoad: () => {
    throw redirect({
      to: '/',
      search: { view: 'week', week: mondayOf(todayKey()) },
    });
  },
});

const inboxRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/inbox',
  component: () => <ProjectView projectId={null} />,
});

const todayRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/today',
  beforeLoad: () => {
    throw redirect({
      to: '/',
      search: { view: 'day', week: mondayOf(todayKey()) },
    });
  },
});

const somedayRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/someday',
  component: SomedayPage,
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

export const reportsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/reports',
  component: ReportsPage,
});

const reportsIndexRoute = createRoute({
  getParentRoute: () => reportsRoute,
  path: '/',
  beforeLoad: () => {
    throw redirect({ to: '/reports/reviews' });
  },
});

export const timeRoute = createRoute({
  getParentRoute: () => reportsRoute,
  path: '/time',
  validateSearch: validateWeek,
  component: TimePage,
});

export const habitsRoute = createRoute({
  getParentRoute: () => reportsRoute,
  path: '/habits',
  validateSearch: validateWeek,
  component: HabitsPage,
});

const reviewsRoute = createRoute({
  getParentRoute: () => reportsRoute,
  path: '/reviews',
  component: ReviewHome,
});

const legacyRoutes = (['time', 'habits', 'review'] as const).map((page) =>
  createRoute({
    getParentRoute: () => rootRoute,
    path: `/${page}`,
    beforeLoad: () => {
      throw redirect(
        page === 'review'
          ? { to: '/reports/reviews' }
          : {
              to: page === 'time' ? '/reports/time' : '/reports/habits',
              search: { week: mondayOf(todayKey()) },
            },
      );
    },
  }),
);

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
  mainRoute,
  inboxRoute,
  todayRoute,
  upcomingRoute,
  somedayRoute,
  plannerRoute,
  projectRoute,
  reportsRoute.addChildren([
    reportsIndexRoute,
    timeRoute,
    habitsRoute,
    reviewsRoute,
  ]),
  ...legacyRoutes,
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
