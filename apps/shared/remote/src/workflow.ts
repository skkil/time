import type { Commands } from '#backend';
import { unwrap } from '@skkil-time/api';

const byId = (id: number) => ({ params: { path: { id } } });

const replacing = (id: number, replacement: number | null) => ({
  params: { path: { id }, query: { replacement: replacement ?? undefined } },
});

export const workflow: Commands<
  | 'getWorkflow'
  | 'listPresets'
  | 'createItemType'
  | 'updateItemType'
  | 'deleteItemType'
  | 'createItemStatus'
  | 'updateItemStatus'
  | 'reorderItemStatus'
  | 'deleteItemStatus'
  | 'createProjectMilestone'
  | 'updateProjectMilestone'
  | 'deleteProjectMilestone'
  | 'setProjectMilestoneLabel'
  | 'createSavedView'
  | 'updateSavedView'
  | 'deleteSavedView'
  | 'applyProjectPreset'
  | 'readPreset'
  | 'setTaskTypeId'
  | 'setTaskStatusId'
  | 'setTaskMilestoneId'
  | 'setTaskEventDetails'
  | 'listEvents'
  | 'listTimeByType'
> = (api) => ({
  getWorkflow: () => unwrap(api.GET('/api/v1/workflow')),
  listPresets: () => unwrap(api.GET('/api/v1/presets')),
  createItemType: (projectId, input) =>
    unwrap(
      api.POST('/api/v1/projects/{id}/item-types', {
        ...byId(projectId),
        body: input,
      }),
    ),
  updateItemType: (id, input) =>
    unwrap(api.PUT('/api/v1/item-types/{id}', { ...byId(id), body: input })),
  deleteItemType: (id, replacement) =>
    unwrap(api.DELETE('/api/v1/item-types/{id}', replacing(id, replacement))),
  createItemStatus: (projectId, input) =>
    unwrap(
      api.POST('/api/v1/projects/{id}/item-statuses', {
        ...byId(projectId),
        body: input,
      }),
    ),
  updateItemStatus: (id, input) =>
    unwrap(api.PUT('/api/v1/item-statuses/{id}', { ...byId(id), body: input })),
  reorderItemStatus: (id, before) =>
    unwrap(
      api.PUT('/api/v1/item-statuses/{id}/position', {
        ...byId(id),
        body: { before },
      }),
    ),
  deleteItemStatus: (id, replacement) =>
    unwrap(
      api.DELETE('/api/v1/item-statuses/{id}', replacing(id, replacement)),
    ),
  createProjectMilestone: (projectId, input) =>
    unwrap(
      api.POST('/api/v1/projects/{id}/milestones', {
        ...byId(projectId),
        body: input,
      }),
    ),
  updateProjectMilestone: (id, input) =>
    unwrap(api.PUT('/api/v1/milestones/{id}', { ...byId(id), body: input })),
  deleteProjectMilestone: (id) =>
    unwrap(api.DELETE('/api/v1/milestones/{id}', byId(id))),
  setProjectMilestoneLabel: (id, label) =>
    unwrap(
      api.PUT('/api/v1/projects/{id}/milestone-label', {
        ...byId(id),
        body: { label },
      }),
    ),
  createSavedView: (projectId, input) =>
    unwrap(
      api.POST('/api/v1/projects/{id}/saved-views', {
        ...byId(projectId),
        body: input,
      }),
    ),
  updateSavedView: (id, input) =>
    unwrap(api.PUT('/api/v1/saved-views/{id}', { ...byId(id), body: input })),
  deleteSavedView: (id) =>
    unwrap(api.DELETE('/api/v1/saved-views/{id}', byId(id))),
  applyProjectPreset: (id, preset) =>
    unwrap(
      api.PUT('/api/v1/projects/{id}/preset', { ...byId(id), body: preset }),
    ),
  readPreset: (text) =>
    unwrap(api.POST('/api/v1/presets/read', { body: { text } })),
  setTaskTypeId: (id, typeId) =>
    unwrap(
      api.PUT('/api/v1/tasks/{id}/type', { ...byId(id), body: { typeId } }),
    ),
  setTaskStatusId: (id, statusId) =>
    unwrap(
      api.PUT('/api/v1/tasks/{id}/status', {
        ...byId(id),
        body: { statusId },
      }),
    ),
  setTaskMilestoneId: (id, milestoneId) =>
    unwrap(
      api.PUT('/api/v1/tasks/{id}/milestone', {
        ...byId(id),
        body: { milestoneId },
      }),
    ),
  setTaskEventDetails: (id, location, countsAsTime) =>
    unwrap(
      api.PUT('/api/v1/tasks/{id}/event-details', {
        ...byId(id),
        body: { location, countsAsTime },
      }),
    ),
  listEvents: (from, to) =>
    unwrap(api.GET('/api/v1/events', { params: { query: { from, to } } })),
  listTimeByType: (from, to) =>
    unwrap(
      api.GET('/api/v1/time-by-type', { params: { query: { from, to } } }),
    ),
});
