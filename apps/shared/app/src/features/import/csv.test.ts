import { describe, expect, it } from 'vitest';

import { parseCsv } from './csv';

describe('parseCsv', () => {
  it('reads quoted fields with commas, quotes and line breaks', () => {
    const text = 'a,b\r\n"x, y","say ""hi""\nthere"\n';
    expect(parseCsv(text)).toEqual([
      ['a', 'b'],
      ['x, y', 'say "hi"\nthere'],
    ]);
  });

  it('keeps empty rows so blank lines can be skipped later', () => {
    expect(parseCsv('a\n\nb')).toEqual([['a'], [''], ['b']]);
  });
});
