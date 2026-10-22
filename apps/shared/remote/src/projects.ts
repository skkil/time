import type { Commands } from '#backend';
import { unwrap } from '@skkil-time/api';
import type { Id } from '@skkil-time/contract';

const byId = (id: Id) => ({ params: { path: { id } } });

export const projects: Commands<
  | 'listProjects'
  | 'createProject'
  | 'updateProject'
  | 'setProjectArchived'
  | 'setProjectView'
  | 'updateProjectSettings'
  | 'markProjectReviewed'
  | 'deleteProject'
  | 'listGroups'
  | 'createGroup'
  | 'renameGroup'
  | 'deleteGroup'
  | 'getProjectCanvas'
  | 'saveProjectCanvas'
  | 'listSections'
  | 'createSection'
  | 'renameSection'
  | 'setSectionCollapsed'
  | 'reorderSection'
  | 'deleteSection'
> = (api) => ({
  listProjects: () => unwrap(api.GET('/api/v1/projects')),
  createProject: (input) =>
    unwrap(api.POST('/api/v1/projects', { body: input })),
  updateProject: (id, input) =>
    unwrap(api.PUT('/api/v1/projects/{id}', { ...byId(id), body: input })),
  setProjectArchived: (id, archived) =>
    unwrap(
      api.PUT('/api/v1/projects/{id}/archived', {
        ...byId(id),
        body: { archived },
      }),
    ),
  setProjectView: (id, view) =>
    unwrap(
      api.PUT('/api/v1/projects/{id}/view', { ...byId(id), body: { view } }),
    ),
  updateProjectSettings: (id, settings) =>
    unwrap(
      api.PUT('/api/v1/projects/{id}/settings', {
        ...byId(id),
        body: settings,
      }),
    ),
  markProjectReviewed: (id) =>
    unwrap(api.POST('/api/v1/projects/{id}/review', byId(id))),
  deleteProject: (id) => unwrap(api.DELETE('/api/v1/projects/{id}', byId(id))),
  listGroups: () => unwrap(api.GET('/api/v1/groups')),
  createGroup: (name) => unwrap(api.POST('/api/v1/groups', { body: { name } })),
  renameGroup: (id, name) =>
    unwrap(api.PUT('/api/v1/groups/{id}', { ...byId(id), body: { name } })),
  deleteGroup: (id) => unwrap(api.DELETE('/api/v1/groups/{id}', byId(id))),
  getProjectCanvas: (projectId) =>
    unwrap(api.GET('/api/v1/projects/{id}/canvas', byId(projectId))),
  saveProjectCanvas: (projectId, content) =>
    unwrap(
      api.PUT('/api/v1/projects/{id}/canvas', {
        ...byId(projectId),
        body: { content },
      }),
    ),
  listSections: () => unwrap(api.GET('/api/v1/sections')),
  createSection: (projectId, name, before) =>
    unwrap(api.POST('/api/v1/sections', { body: { projectId, name, before } })),
  renameSection: (id, name) =>
    unwrap(
      api.PUT('/api/v1/sections/{id}/name', { ...byId(id), body: { name } }),
    ),
  setSectionCollapsed: (id, collapsed) =>
    unwrap(
      api.PUT('/api/v1/sections/{id}/collapsed', {
        ...byId(id),
        body: { collapsed },
      }),
    ),
  reorderSection: (id, before) =>
    unwrap(
      api.PUT('/api/v1/sections/{id}/position', {
        ...byId(id),
        body: { before },
      }),
    ),
  deleteSection: (id) => unwrap(api.DELETE('/api/v1/sections/{id}', byId(id))),
});
