import { unwrap } from '#server/api';
import type { Commands } from '#server/backend';
import type { Id } from '#types/bindings';

const byId = (id: Id) => ({ params: { path: { id } } });

const onDay = (id: Id, date: string) => ({
  params: { path: { id, date } },
});

export const habits: Commands<
  | 'listHabits'
  | 'createHabit'
  | 'updateHabit'
  | 'archiveHabit'
  | 'listHabitDays'
  | 'setHabitStatus'
  | 'addHabitValue'
  | 'syncHabits'
  | 'recordHabitMeasurements'
> = (api) => ({
  listHabits: () => unwrap(api.GET('/api/v1/habits')),
  createHabit: (input) => unwrap(api.POST('/api/v1/habits', { body: input })),
  updateHabit: (id, input) =>
    unwrap(api.PUT('/api/v1/habits/{id}', { ...byId(id), body: input })),
  archiveHabit: (id) =>
    unwrap(api.POST('/api/v1/habits/{id}/archive', byId(id))),
  listHabitDays: (from, to) =>
    unwrap(api.GET('/api/v1/habits/days', { params: { query: { from, to } } })),
  setHabitStatus: (habitId, date, status) =>
    unwrap(
      api.PUT('/api/v1/habits/{id}/days/{date}/status', {
        ...onDay(habitId, date),
        body: { status },
      }),
    ),
  addHabitValue: (habitId, date, delta) =>
    unwrap(
      api.POST('/api/v1/habits/{id}/days/{date}/value', {
        ...onDay(habitId, date),
        body: { delta },
      }),
    ),
  syncHabits: () => unwrap(api.POST('/api/v1/habits/sync')),
  recordHabitMeasurements: (measurements) =>
    unwrap(
      api.POST('/api/v1/habits/measurements', {
        body: measurements.flatMap(({ value, ...rest }) =>
          value === null ? [] : [{ ...rest, value }],
        ),
      }),
    ),
});
