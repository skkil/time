import {
  createHashHistory,
  createRootRoute,
  createRoute,
  createRouter,
  redirect,
} from '@tanstack/react-router';

import { MainPage } from '@/features/main/MainPage';
import { ProjectsSpace } from '@/features/projects/ProjectsSpace';
import { WeekReview } from '@/features/review/WeekReview';
import { ProjectView } from '@/features/tasks/ProjectView';
import { SomedayPage } from '@/features/tasks/SomedayPage';
import {
  type DateKey,
  mondayOf,
  shiftKey,
  todayKey,
  weekStartOf,
} from '@/lib/time';

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
  return { week: weekStartOf(week) };
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
      search: { view: 'week', week: weekStartOf(todayKey()) },
    });
  },
});

const inboxRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/inbox',
  beforeLoad: () => {
    throw redirect({ to: '/projects' });
  },
});

const todayRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/today',
  beforeLoad: () => {
    throw redirect({
      to: '/',
      search: { view: 'day', week: weekStartOf(todayKey()) },
    });
  },
});

const somedayRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/someday',
  beforeLoad: () => {
    throw redirect({ to: '/projects/someday' });
  },
});

const upcomingRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/upcoming',
  beforeLoad: () => {
    throw redirect({
      to: '/',
      search: { view: 'week', week: weekStartOf(todayKey()) },
    });
  },
});

export const projectsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/projects',
  component: ProjectsSpace,
});

const projectsInboxRoute = createRoute({
  getParentRoute: () => projectsRoute,
  path: '/',
  component: () => <ProjectView projectId={null} />,
});

const projectsSomedayRoute = createRoute({
  getParentRoute: () => projectsRoute,
  path: '/someday',
  component: SomedayPage,
});

export const projectRoute = createRoute({
  getParentRoute: () => projectsRoute,
  path: '/$projectId',
  params: {
    parse: (params) => ({ projectId: Number(params.projectId) }),
    stringify: (params) => ({ projectId: String(params.projectId) }),
  },
  component: function ProjectRoute() {
    const { projectId } = projectRoute.useParams();
    return <ProjectView key={projectId} projectId={projectId} />;
  },
});

const weekOf = (week: DateKey) => ({ view: 'week' as const, week });

const legacyWeekRoutes = [
  ...['/reports', '/reports/weeks', '/reports/reviews', '/review'].map((path) =>
    createRoute({
      getParentRoute: () => rootRoute,
      path,
      beforeLoad: () => {
        throw redirect({ to: '/', search: weekOf(weekStartOf(todayKey())) });
      },
    }),
  ),
  ...['/reports/time', '/reports/habits', '/time', '/habits'].map((path) =>
    createRoute({
      getParentRoute: () => rootRoute,
      path,
      beforeLoad: () => {
        throw redirect({
          to: '/',
          search: weekOf(shiftKey(weekStartOf(todayKey()), -7)),
        });
      },
    }),
  ),
  ...['/reports/week/$week', '/reports/quarter/$week'].map((path) =>
    createRoute({
      getParentRoute: () => rootRoute,
      path,
      beforeLoad: ({ params }) => {
        const { week } = params as { week: string };
        throw redirect({
          to: '/',
          search: weekOf(weekStartOf(DATE_KEY.test(week) ? week : todayKey())),
        });
      },
    }),
  ),
];

const weekParams = {
  parse: (params: { week: string }) => ({
    week: mondayOf(DATE_KEY.test(params.week) ? params.week : todayKey()),
  }),
  stringify: (params: { week: DateKey }) => ({ week: params.week }),
};

export const weekReviewRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/review/$week',
  params: weekParams,
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
  projectsRoute.addChildren([
    projectsInboxRoute,
    projectsSomedayRoute,
    projectRoute,
  ]),
  ...legacyWeekRoutes,
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
