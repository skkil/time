import { unwrap } from '#server/api';
import type { Commands } from '#server/backend';
import { fromWire, toWire } from '#server/snapshot';
import type { Id } from '#types/bindings';

const byId = (id: Id) => ({ params: { path: { id } } });

export const tasks: Commands<
  | 'listTasks'
  | 'getTask'
  | 'createTask'
  | 'updateTask'
  | 'moveTask'
  | 'rescheduleTasks'
  | 'setTaskCompleted'
  | 'setTaskOutcome'
  | 'setTasksSomeday'
  | 'setTaskMust'
  | 'setTaskNextStep'
  | 'deleteTasks'
  | 'deleteTask'
  | 'captureTasks'
  | 'restoreTasks'
  | 'addTaskDependency'
  | 'removeTaskDependency'
> = (api) => ({
  listTasks: () => unwrap(api.GET('/api/v1/tasks')),
  getTask: (id) => unwrap(api.GET('/api/v1/tasks/{id}', byId(id))),
  createTask: (input) => unwrap(api.POST('/api/v1/tasks', { body: input })),
  updateTask: (id, input) =>
    unwrap(api.PUT('/api/v1/tasks/{id}', { ...byId(id), body: input })),
  moveTask: (id, placement) =>
    unwrap(
      api.POST('/api/v1/tasks/{id}/move', { ...byId(id), body: placement }),
    ),
  rescheduleTasks: (ids, dueDate) =>
    unwrap(api.POST('/api/v1/tasks/reschedule', { body: { ids, dueDate } })),
  setTaskCompleted: (id, completed) =>
    unwrap(
      api.PUT('/api/v1/tasks/{id}/completed', {
        ...byId(id),
        body: { completed },
      }),
    ),
  setTaskOutcome: (id, outcomeId) =>
    unwrap(
      api.PUT('/api/v1/tasks/{id}/outcome', {
        ...byId(id),
        body: { outcomeId },
      }),
    ),
  setTasksSomeday: (ids, someday) =>
    unwrap(api.POST('/api/v1/tasks/someday', { body: { ids, someday } })),
  setTaskMust: (id, mustOn) =>
    unwrap(
      api.PUT('/api/v1/tasks/{id}/must', { ...byId(id), body: { mustOn } }),
    ),
  setTaskNextStep: (id, nextStep) =>
    unwrap(
      api.PUT('/api/v1/tasks/{id}/next-step', {
        ...byId(id),
        body: { nextStep },
      }),
    ),
  deleteTasks: (ids) =>
    unwrap(api.POST('/api/v1/tasks/delete', { body: { ids } })),
  deleteTask: (id) => unwrap(api.DELETE('/api/v1/tasks/{id}', byId(id))),
  captureTasks: async (ids) =>
    fromWire(await unwrap(api.POST('/api/v1/undo/capture', { body: { ids } }))),
  restoreTasks: (snapshot) =>
    unwrap(api.POST('/api/v1/undo/restore', { body: toWire(snapshot) })),
  addTaskDependency: (taskId, blockedById) =>
    unwrap(
      api.POST('/api/v1/tasks/{id}/dependencies', {
        ...byId(taskId),
        body: { blockedById },
      }),
    ),
  removeTaskDependency: (taskId, blockedById) =>
    unwrap(
      api.DELETE('/api/v1/tasks/{id}/dependencies/{blockedById}', {
        params: { path: { id: taskId, blockedById } },
      }),
    ),
});
