import { setDateOrder } from '@skkil-time/rules/date-order';

import { getPreference, subscribePreferences } from '@/lib/preferences';

export function syncDateOrder() {
  const apply = () => setDateOrder(getPreference('dateOrder'));
  apply();
  return subscribePreferences(apply);
}
