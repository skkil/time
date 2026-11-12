import { format } from 'date-fns';

export type DateOrder = 'dayFirst' | 'monthFirst';

export const DATE_ORDERS: DateOrder[] = ['dayFirst', 'monthFirst'];

export type DateStyle =
  | 'dayMonth'
  | 'dayMonthYear'
  | 'dayLongMonth'
  | 'dayLongMonthYear'
  | 'weekdayDayMonth'
  | 'weekdayDayMonthYear';

const PATTERNS: Record<DateOrder, Record<DateStyle, string>> = {
  dayFirst: {
    dayMonth: 'd MMM',
    dayMonthYear: 'd MMM yyyy',
    dayLongMonth: 'd MMMM',
    dayLongMonthYear: 'd MMMM yyyy',
    weekdayDayMonth: 'EEE d MMM',
    weekdayDayMonthYear: 'EEE d MMM yyyy',
  },
  monthFirst: {
    dayMonth: 'MMM d',
    dayMonthYear: 'MMM d, yyyy',
    dayLongMonth: 'MMMM d',
    dayLongMonthYear: 'MMMM d, yyyy',
    weekdayDayMonth: 'EEE, MMM d',
    weekdayDayMonthYear: 'EEE, MMM d, yyyy',
  },
};

let current: DateOrder = 'dayFirst';

/** Like date-fns' default options: set once from the user's preference. */
export function setDateOrder(order: DateOrder) {
  current = DATE_ORDERS.includes(order) ? order : 'dayFirst';
}

export const dateOrder = () => current;

export const formatDay = (date: Date, style: DateStyle) =>
  format(date, PATTERNS[current][style]);
