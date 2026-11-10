import { type Api, unwrap } from '@skkil-time/client/server';

import type { Calendars } from '@/platform';

/**
 * Calendars connected to the account. Consent opens in a new tab, opened
 * before the server answers so the browser doesn't block it.
 */
export const accountCalendars = (api: Api): Calendars => ({
  status: async () => ({
    signedIn: true,
    ...(await unwrap(api.GET('/api/v1/calendar'))),
  }),
  connect: async () => {
    const tab = window.open('', '_blank');
    if (tab) tab.opener = null;
    try {
      const { url } = await unwrap(api.POST('/api/v1/calendar/google/connect'));
      if (tab) tab.location.href = url;
      else window.location.assign(url);
    } catch (error) {
      tab?.close();
      throw error;
    }
  },
  disconnect: async (id) => {
    await unwrap(
      api.DELETE('/api/v1/calendar/accounts/{id}', {
        params: { path: { id } },
      }),
    );
  },
});
