import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { renderCss } from '#css';

describe('tokens.css', () => {
  it('matches colors.ts', () => {
    const file = readFileSync(
      new URL('../tokens.css', import.meta.url),
      'utf8',
    );
    expect(file).toBe(renderCss());
  });
});
