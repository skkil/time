import { unwrap } from '#server/api';
import type { Commands } from '#server/backend';

export const calendar: Commands<
  'listCalendarSources' | 'listCalendarEvents' | 'setCalendarSourceVisible'
> = (api) => ({
  listCalendarSources: () => unwrap(api.GET('/api/v1/calendar/sources')),
  listCalendarEvents: (from, to) =>
    unwrap(
      api.GET('/api/v1/calendar/events', { params: { query: { from, to } } }),
    ),
  setCalendarSourceVisible: (id, visible) =>
    unwrap(
      api.PUT('/api/v1/calendar/sources/{id}/visible', {
        params: { path: { id } },
        body: { visible },
      }),
    ),
});
