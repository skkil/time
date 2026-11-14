import { unwrap } from '#server/api';
import type { Commands } from '#server/backend';
import type { Id } from '#types/bindings';

const byId = (id: Id) => ({ params: { path: { id } } });

export const places: Commands<
  'listPlaces' | 'createPlace' | 'renamePlace' | 'deletePlace' | 'setTaskPlace'
> = (api) => ({
  listPlaces: () => unwrap(api.GET('/api/v1/places')),
  createPlace: (name) => unwrap(api.POST('/api/v1/places', { body: { name } })),
  renamePlace: (id, name) =>
    unwrap(api.PUT('/api/v1/places/{id}', { ...byId(id), body: { name } })),
  deletePlace: (id) => unwrap(api.DELETE('/api/v1/places/{id}', byId(id))),
  setTaskPlace: (id, placeId) =>
    unwrap(
      api.PUT('/api/v1/tasks/{id}/place', { ...byId(id), body: { placeId } }),
    ),
});
