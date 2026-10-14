import { type Api, unwrap } from '@skkil-time/api';

import type { SharedPreferences } from '@/platform';

export const accountPreferences = (api: Api): SharedPreferences => ({
  load: async () => unwrap(api.GET('/api/v1/preferences')),
  save: async (changes) => {
    await unwrap(api.PATCH('/api/v1/preferences', { body: changes }));
  },
});
