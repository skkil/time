import type { Id } from '@/bindings';
import { type DateKey, fromDateKey, shiftKey } from '@/lib/time';

export type RitualKind =
  'morning' | 'evening' | 'wind_down' | 'session' | 'weekly';

export type StepKey =
  | 'feel'
  | 'what_moved'
  | 'leftovers'
  | 'pick_musts'
  | 'timeblock'
  | 'one_line_note'
  | 'habit_check'
  | 'breathing_pause'
  | 'next_step_note'
  | 'did_it_move'
  | 'brain_dump'
  | 'device_away'
  | 'weekly_review';

export const RITUALS: Record<
  RitualKind,
  { label: string; description: string; minutes: string }
> = {
  morning: {
    label: 'Morning start',
    description: 'Sort yesterday’s leftovers and pick what today is for.',
    minutes: '2–5 min',
  },
  evening: {
    label: 'Evening shutdown',
    description: 'See what moved, clear the deck, and set up tomorrow.',
    minutes: '3–7 min',
  },
  wind_down: {
    label: 'Wind-down',
    description: 'Empty your head before bed, then put the device away.',
    minutes: '≤5 min',
  },
  session: {
    label: 'Session close',
    description: 'After a long timer: did it move, and where to pick up.',
    minutes: '≤1 min',
  },
  weekly: {
    label: 'Weekly review',
    description: 'Judge last week’s outcomes, clear the deck, plan the next.',
    minutes: '~10 min',
  },
};

export const STEPS: Record<
  Exclude<StepKey, 'weekly_review'>,
  { label: string; hint: string }
> = {
  feel: { label: 'Feel', hint: 'One tap for how the day felt' },
  what_moved: { label: 'What moved', hint: 'Finished tasks and tracked time' },
  leftovers: {
    label: 'Leftovers',
    hint: 'Give unfinished tasks a day or let go',
  },
  pick_musts: { label: 'Pick musts', hint: 'Up to three things that matter' },
  timeblock: { label: 'Time-block', hint: 'Give each must a time' },
  one_line_note: { label: 'One line', hint: 'A sentence to remember the day' },
  habit_check: { label: 'Habits', hint: 'Tick off today’s habits' },
  breathing_pause: { label: 'Breathe', hint: 'Thirty quiet seconds' },
  next_step_note: { label: 'Next step', hint: 'Where to pick up next time' },
  did_it_move: { label: 'Did it move?', hint: 'Done, partly, or not yet' },
  brain_dump: {
    label: 'Brain dump',
    hint: 'Everything on your mind, to Inbox',
  },
  device_away: { label: 'Device away', hint: 'A closing screen' },
};

export const MAX_MUSTS = 3;

export type RitualContext = {
  kind: RitualKind;
  date: DateKey;
  target: DateKey;
  taskId: Id | null;
};

export function contextFor(
  kind: RitualKind,
  today: DateKey,
  taskId: Id | null,
): RitualContext {
  const morning = kind === 'morning';
  return {
    kind,
    date: morning ? shiftKey(today, -1) : today,
    target: morning ? today : shiftKey(today, 1),
    taskId,
  };
}

const PROMPTS = {
  feel: [
    'How did {day} feel?',
    'Looking back at {day}: how was it?',
    'One tap: how was {day}?',
    'Gut check on {day}.',
    'How would you rate {day}?',
  ],
  one_line_note: [
    'One line to remember today by.',
    'What would you tell tomorrow-you?',
    'What drained you, and what gave you energy?',
    'What’s one thing you learned today?',
    'What are you glad you did today?',
  ],
  what_moved: [
    'Here’s what moved.',
    'What actually happened.',
    'Today, in finished work.',
    'The day, as it went.',
    'What got done.',
  ],
};

export function prompt(
  key: keyof typeof PROMPTS,
  date: DateKey,
  day = 'today',
): string {
  const pool = PROMPTS[key];
  const daysSinceEpoch = Math.floor(fromDateKey(date).getTime() / 86_400_000);
  return pool[daysSinceEpoch % pool.length].replace('{day}', day);
}
