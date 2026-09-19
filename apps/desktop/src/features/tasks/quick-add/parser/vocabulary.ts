export const WORD_START = String.raw`(?<![\p{L}\p{N}])`;
export const WORD_END = String.raw`(?![\p{L}\p{N}])`;

export const DAY = String.raw`(?:monday|mon|tuesday|tues|tue|wednesday|wed|thursday|thurs|thur|thu|friday|fri|saturday|sat|sunday|sun)`;
export const MONTH = String.raw`(?:january|jan|february|feb|march|mar|april|apr|may|june|jun|july|jul|august|aug|september|sept|sep|october|oct|november|nov|december|dec)\.?`;
export const ORDINAL = String.raw`\d{1,2}(?:st|nd|rd|th)`;
export const NTH = String.raw`(?:1st|2nd|3rd|4th|5th|first|second|third|fourth|fifth|last)`;

const DAY_TYPOS: Record<string, string> = {
  munday: 'mon',
  mondy: 'mon',
  tuseday: 'tue',
  teusday: 'tue',
  tusday: 'tue',
  wensday: 'wed',
  wendsday: 'wed',
  wednsday: 'wed',
  wednesay: 'wed',
  thrusday: 'thu',
  thursay: 'thu',
  thirsday: 'thu',
  fryday: 'fri',
  firday: 'fri',
  fridy: 'fri',
  saterday: 'sat',
  saturay: 'sat',
  sundey: 'sun',
};

export const LOOSE_DAY = `(?:${DAY}|${Object.keys(DAY_TYPOS).join('|')})`;

const WEEKDAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const MONTHS = [
  'jan',
  'feb',
  'mar',
  'apr',
  'may',
  'jun',
  'jul',
  'aug',
  'sep',
  'oct',
  'nov',
  'dec',
];
const NTH_WORDS = ['first', 'second', 'third', 'fourth', 'fifth'];

export function weekdayIndex(word: string) {
  const text = word.toLowerCase();
  return WEEKDAYS.indexOf(DAY_TYPOS[text] ?? text.slice(0, 3));
}

export const monthIndex = (word: string) =>
  MONTHS.indexOf(word.slice(0, 3).toLowerCase());

export function nthIndex(word: string): number | 'last' {
  const text = word.toLowerCase();
  if (text === 'last') return 'last';
  const position = NTH_WORDS.indexOf(text);
  return position >= 0 ? position + 1 : Number.parseInt(text, 10);
}
