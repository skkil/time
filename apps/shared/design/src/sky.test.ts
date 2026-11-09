import { describe, expect, it } from 'vitest';

import { SKIES, skyAt } from './sky';

describe('skyAt', () => {
  it('returns each stop exactly at its hour', () => {
    for (const stop of SKIES) expect(skyAt(stop.hour)).toEqual(stop.sky);
  });

  it('blends between stops', () => {
    const noon = skyAt(13).top;
    const dusk = skyAt(17).top;
    const between = skyAt(15).top;
    between.forEach((value, i) =>
      expect(value).toBeGreaterThanOrEqual(Math.min(noon[i], dusk[i])),
    );
  });

  it('wraps from late night back to midnight', () => {
    expect(skyAt(24)).toEqual(skyAt(0));
    expect(skyAt(23.5).top).not.toEqual(skyAt(22).top);
  });
});
