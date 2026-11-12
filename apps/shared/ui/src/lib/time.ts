import {
  type DateKey,
  weekOfMonday as weekOfMondayOn,
  weekStartOf as weekStartOn,
} from '@skkil-time/rules/time';

import { getPreference } from '@/lib/preferences';

export * from '@skkil-time/rules/time';
export { type DateStyle, formatDay } from '@skkil-time/rules/date-order';

export const weekStartOf = (
  key: DateKey,
  startsOn = getPreference('weekStartsOn'),
): DateKey => weekStartOn(key, startsOn);

export const weekOfMonday = (
  monday: DateKey,
  startsOn = getPreference('weekStartsOn'),
): DateKey => weekOfMondayOn(monday, startsOn);
