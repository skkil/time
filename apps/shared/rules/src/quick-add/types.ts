import type { DateKey } from '#time';
import type { Id } from '@skkil-time/client/types';

export type TokenKind =
  | 'date'
  | 'time'
  | 'repeat'
  | 'deadline'
  | 'duration'
  | 'priority'
  | 'project'
  | 'section'
  | 'type';

export type Token = { kind: TokenKind; start: number; end: number };

export type ParseContext = {
  today: DateKey;
  nowMinutes: number;
  projects: { id: Id; name: string }[];
  sections: { id: Id; name: string; projectId: Id | null }[];
  types?: { id: Id; name: string; projectId: Id }[];
  projectId: Id | null;
  ignored?: ReadonlySet<string>;
};

export type Parsed = {
  title: string;
  tokens: Token[];
  dueDate?: DateKey;
  dueTime?: number;
  recurrence?: string;
  deadline?: DateKey;
  estimate?: number;
  priority?: number;
  projectId?: Id | null;
  unknownProject?: string;
  sectionId?: Id;
  typeId?: Id;
};
