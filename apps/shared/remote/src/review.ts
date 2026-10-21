import type { Commands } from '#backend';
import { unwrap } from '@skkil-time/api';
import type { Id } from '@skkil-time/contract';

const byId = (id: Id) => ({ params: { path: { id } } });

const byDate = (date: string) => ({ params: { path: { date } } });

const range = (from: string, to: string) => ({
  params: { query: { from, to } },
});

export const review: Commands<
  | 'listDays'
  | 'rateDay'
  | 'saveDayNote'
  | 'skipDayCheckIn'
  | 'getWeek'
  | 'listWeeks'
  | 'saveWeekNotes'
  | 'rateWeek'
  | 'reachReviewStep'
  | 'finishWeekReview'
  | 'createOutcome'
  | 'updateOutcome'
  | 'updateOutcomeStatus'
  | 'removeOutcome'
  | 'getQuarter'
  | 'upsertQuarter'
  | 'createPriority'
  | 'updatePriority'
  | 'removePriority'
> = (api) => ({
  listDays: (from, to) => unwrap(api.GET('/api/v1/days', range(from, to))),
  rateDay: (date, felt) =>
    unwrap(
      api.PUT('/api/v1/days/{date}/felt', { ...byDate(date), body: { felt } }),
    ),
  saveDayNote: (date, note) =>
    unwrap(
      api.PUT('/api/v1/days/{date}/note', { ...byDate(date), body: { note } }),
    ),
  skipDayCheckIn: (date) =>
    unwrap(api.POST('/api/v1/days/{date}/skip', byDate(date))),
  getWeek: (date) => unwrap(api.GET('/api/v1/weeks/{date}', byDate(date))),
  listWeeks: (from, to) => unwrap(api.GET('/api/v1/weeks', range(from, to))),
  saveWeekNotes: (date, notes) =>
    unwrap(
      api.PUT('/api/v1/weeks/{date}/notes', { ...byDate(date), body: notes }),
    ),
  rateWeek: (date, felt) =>
    unwrap(
      api.PUT('/api/v1/weeks/{date}/felt', { ...byDate(date), body: { felt } }),
    ),
  reachReviewStep: (date, step) =>
    unwrap(
      api.PUT('/api/v1/weeks/{date}/step', { ...byDate(date), body: { step } }),
    ),
  finishWeekReview: (date) =>
    unwrap(api.POST('/api/v1/weeks/{date}/finish', byDate(date))),
  createOutcome: (date, title, priorityId) =>
    unwrap(
      api.POST('/api/v1/weeks/{date}/outcomes', {
        ...byDate(date),
        body: { title, priorityId },
      }),
    ),
  updateOutcome: (id, title, priorityId) =>
    unwrap(
      api.PUT('/api/v1/outcomes/{id}', {
        ...byId(id),
        body: { title, priorityId },
      }),
    ),
  updateOutcomeStatus: (id, status) =>
    unwrap(
      api.PUT('/api/v1/outcomes/{id}/status', {
        ...byId(id),
        body: { status },
      }),
    ),
  removeOutcome: (id) => unwrap(api.DELETE('/api/v1/outcomes/{id}', byId(id))),
  getQuarter: (date) =>
    unwrap(api.GET('/api/v1/quarter', { params: { query: { date } } })),
  upsertQuarter: (id, label, startDate) =>
    unwrap(
      id === null
        ? api.POST('/api/v1/quarters', { body: { label, startDate } })
        : api.PUT('/api/v1/quarters/{id}', {
            ...byId(id),
            body: { label, startDate },
          }),
    ),
  createPriority: (quarterId, title) =>
    unwrap(
      api.POST('/api/v1/quarters/{id}/priorities', {
        ...byId(quarterId),
        body: { title },
      }),
    ),
  updatePriority: (id, title, note) =>
    unwrap(
      api.PUT('/api/v1/priorities/{id}', {
        ...byId(id),
        body: { title, note },
      }),
    ),
  removePriority: (id) =>
    unwrap(api.DELETE('/api/v1/priorities/{id}', byId(id))),
});
