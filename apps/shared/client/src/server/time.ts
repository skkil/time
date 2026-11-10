import { unwrap } from '#server/api';
import type { Commands } from '#server/backend';
import type { Id } from '#types/bindings';

const byId = (id: Id) => ({ params: { path: { id } } });

export const time: Commands<
  | 'listBlocks'
  | 'createBlock'
  | 'rescheduleBlock'
  | 'deleteBlock'
  | 'countEndedBlocks'
  | 'logEndedBlocks'
  | 'getAutoLogBlocks'
  | 'setAutoLogBlocks'
  | 'listTimeEntries'
  | 'listTaskEntries'
  | 'listProjectEntries'
  | 'createTimeEntry'
  | 'updateTimeEntry'
  | 'deleteTimeEntry'
  | 'getTimer'
  | 'startTimer'
  | 'editTimer'
  | 'stopTimer'
  | 'pauseTimer'
  | 'resumeTimer'
  | 'discardTimer'
  | 'restoreTimer'
> = (api) => ({
  listBlocks: (from, to) =>
    unwrap(api.GET('/api/v1/blocks', { params: { query: { from, to } } })),
  createBlock: (taskId, span) =>
    unwrap(
      api.POST('/api/v1/tasks/{id}/blocks', { ...byId(taskId), body: span }),
    ),
  rescheduleBlock: (id, span) =>
    unwrap(api.PUT('/api/v1/blocks/{id}', { ...byId(id), body: span })),
  deleteBlock: (id) => unwrap(api.DELETE('/api/v1/blocks/{id}', byId(id))),
  countEndedBlocks: () => unwrap(api.GET('/api/v1/blocks/ended')),
  logEndedBlocks: () => unwrap(api.POST('/api/v1/blocks/ended/log')),
  getAutoLogBlocks: () => unwrap(api.GET('/api/v1/settings/auto-log-blocks')),
  setAutoLogBlocks: (enabled) =>
    unwrap(api.PUT('/api/v1/settings/auto-log-blocks', { body: { enabled } })),
  listTimeEntries: (from, to) =>
    unwrap(
      api.GET('/api/v1/time-entries', { params: { query: { from, to } } }),
    ),
  listTaskEntries: (taskId) =>
    unwrap(api.GET('/api/v1/tasks/{id}/time-entries', byId(taskId))),
  listProjectEntries: (projectId) =>
    unwrap(api.GET('/api/v1/projects/{id}/time-entries', byId(projectId))),
  createTimeEntry: (input) =>
    unwrap(api.POST('/api/v1/time-entries', { body: input })),
  updateTimeEntry: (id, input) =>
    unwrap(api.PUT('/api/v1/time-entries/{id}', { ...byId(id), body: input })),
  deleteTimeEntry: (id) =>
    unwrap(api.DELETE('/api/v1/time-entries/{id}', byId(id))),
  getTimer: () => unwrap(api.GET('/api/v1/timer')),
  startTimer: (details) => unwrap(api.POST('/api/v1/timer', { body: details })),
  editTimer: (details) => unwrap(api.PUT('/api/v1/timer', { body: details })),
  stopTimer: () => unwrap(api.POST('/api/v1/timer/stop')),
  pauseTimer: () => unwrap(api.POST('/api/v1/timer/pause')),
  resumeTimer: () => unwrap(api.POST('/api/v1/timer/resume')),
  discardTimer: () => unwrap(api.DELETE('/api/v1/timer')),
  restoreTimer: (timer) =>
    unwrap(api.POST('/api/v1/timer/restore', { body: timer })),
});
