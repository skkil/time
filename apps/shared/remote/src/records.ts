import type { Commands } from '#backend';
import { unwrap } from '@skkil-time/api';

const byId = (id: number) => ({ params: { path: { id } } });

export const records: Commands<
  | 'listRecordPhases'
  | 'setRecordPhaseNotes'
  | 'setTaskPhase'
  | 'createPhaseTask'
> = (api) => ({
  listRecordPhases: (taskId) =>
    unwrap(api.GET('/api/v1/tasks/{id}/phases', byId(taskId))),
  setRecordPhaseNotes: (taskId, statusId, notes) =>
    unwrap(
      api.PUT('/api/v1/tasks/{id}/phases/{statusId}/notes', {
        params: { path: { id: taskId, statusId } },
        body: { notes },
      }),
    ),
  setTaskPhase: (id, phaseId) =>
    unwrap(
      api.PUT('/api/v1/tasks/{id}/phase', { ...byId(id), body: { phaseId } }),
    ),
  createPhaseTask: (recordId, phaseId, title) =>
    unwrap(
      api.POST('/api/v1/tasks/{id}/phase-tasks', {
        ...byId(recordId),
        body: { phaseId, title },
      }),
    ),
});
