import { unwrap } from '#server/api';
import type { Commands } from '#server/backend';
import type { Id } from '#types/bindings';

const byId = (id: Id) => ({ params: { path: { id } } });

const byKind = (kind: string) => ({ params: { path: { kind } } });

export const rituals: Commands<
  | 'listRituals'
  | 'updateRitual'
  | 'getPlanningTime'
  | 'choosePlanningTime'
  | 'dueRitual'
  | 'listRitualRuns'
  | 'startRitual'
  | 'reachRitualStep'
  | 'finishRitual'
  | 'skipRitual'
  | 'snoozeRitual'
> = (api) => ({
  listRituals: () => unwrap(api.GET('/api/v1/rituals')),
  updateRitual: (kind, input) =>
    unwrap(api.PUT('/api/v1/rituals/{kind}', { ...byKind(kind), body: input })),
  getPlanningTime: () =>
    unwrap(api.GET('/api/v1/planning-time')).then(({ time }) => time),
  choosePlanningTime: (time) =>
    unwrap(api.PUT('/api/v1/planning-time', { body: { time } })),
  dueRitual: (event) =>
    unwrap(api.POST('/api/v1/rituals/due', { body: event })),
  listRitualRuns: (from, to) =>
    unwrap(api.GET('/api/v1/ritual-runs', { params: { query: { from, to } } })),
  startRitual: (kind, taskId) =>
    unwrap(
      api.POST('/api/v1/rituals/{kind}/runs', {
        ...byKind(kind),
        body: { taskId },
      }),
    ),
  reachRitualStep: (id, step) =>
    unwrap(
      api.PUT('/api/v1/ritual-runs/{id}/step', { ...byId(id), body: { step } }),
    ),
  finishRitual: (id) =>
    unwrap(api.POST('/api/v1/ritual-runs/{id}/finish', byId(id))),
  skipRitual: (id) =>
    unwrap(api.POST('/api/v1/ritual-runs/{id}/skip', byId(id))),
  snoozeRitual: (id) =>
    unwrap(api.POST('/api/v1/ritual-runs/{id}/snooze', byId(id))),
});
