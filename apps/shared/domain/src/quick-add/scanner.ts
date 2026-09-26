import type { Token, TokenKind } from './types';
import { WORD_END, WORD_START } from './vocabulary';

export type Scanner = ReturnType<typeof createScanner>;

export function createScanner(text: string, ignored?: ReadonlySet<string>) {
  const tokens: Token[] = [];

  const isOpen = (start: number, end: number) =>
    !ignored?.has(text.slice(start, end).toLowerCase()) &&
    tokens.every((token) => end <= token.start || start >= token.end);

  const take = (kind: TokenKind, start: number, end: number) => {
    if (!isOpen(start, end)) return false;
    tokens.push({ kind, start, end });
    return true;
  };

  const claim = (
    pattern: string,
    kind: TokenKind,
    handle: (match: RegExpExecArray) => boolean,
  ) => {
    const regex = new RegExp(`${WORD_START}(?:${pattern})${WORD_END}`, 'giu');
    for (const match of text.matchAll(regex)) {
      const start = match.index;
      const end = start + match[0].length;
      if (isOpen(start, end) && handle(match as RegExpExecArray)) {
        tokens.push({ kind, start, end });
        return;
      }
    }
  };

  const remainder = () => {
    tokens.sort((a, b) => a.start - b.start);
    let title = '';
    let cursor = 0;
    for (const token of tokens) {
      title += text.slice(cursor, token.start);
      cursor = token.end;
    }
    title += text.slice(cursor);
    return title.replace(/\s+/g, ' ').trim();
  };

  return { text, tokens, take, claim, remainder };
}
