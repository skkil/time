import type { Scanner } from './scanner';
import type { TokenKind } from './types';

function longestName<T extends { name: string }>(
  candidates: T[],
  text: string,
  from: number,
): T | undefined {
  const rest = text.slice(from).toLowerCase();
  return candidates
    .filter((candidate) => {
      const name = candidate.name.toLowerCase();
      if (!rest.startsWith(name)) return false;
      const next = rest.charAt(name.length);
      return next === '' || /\s/.test(next);
    })
    .sort((a, b) => b.name.length - a.name.length)[0];
}

export function claimEntity<T extends { name: string }>(
  scanner: Scanner,
  sigil: string,
  kind: TokenKind,
  candidates: T[],
): T | undefined {
  const { text } = scanner;
  const marker = new RegExp(`(?<=^|\\s)\\${sigil}`, 'g');
  for (const match of text.matchAll(marker)) {
    const entity = longestName(candidates, text, match.index + 1);
    if (!entity) continue;
    const end = match.index + 1 + entity.name.length;
    if (scanner.take(kind, match.index, end)) return entity;
  }
  return undefined;
}

export function unclaimedName(scanner: Scanner, sigil: string) {
  const { text, tokens } = scanner;
  const marker = new RegExp(`(?<=^|\\s)\\${sigil}(\\S+)`, 'g');
  for (const match of text.matchAll(marker)) {
    const claimed = tokens.some(
      (token) => match.index >= token.start && match.index < token.end,
    );
    if (!claimed) return match[1];
  }
  return undefined;
}
