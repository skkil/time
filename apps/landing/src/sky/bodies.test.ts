import { describe, expect, it } from 'vitest';

import {
  moonDirection,
  nightAmount,
  phaseOf,
  sunDirection,
  sunlight,
  twilight,
} from './bodies';

describe('sun', () => {
  it('rises on the left, peaks at midday and sets on the right', () => {
    expect(sunDirection(6.5)[1]).toBeCloseTo(0);
    expect(sunDirection(6.5)[0]).toBeLessThan(0);
    expect(sunDirection(12.5)[1]).toBeGreaterThan(0.7);
    expect(sunDirection(18.5)[0]).toBeGreaterThan(0);
  });

  it('is below the horizon at night, when the moon is up', () => {
    expect(sunDirection(0)[1]).toBeLessThan(0);
    expect(moonDirection(0)[1]).toBeGreaterThan(0.5);
    expect(nightAmount(sunDirection(0))).toBe(1);
    expect(nightAmount(sunDirection(12))).toBe(0);
  });

  it('reddens near the horizon', () => {
    const [r, g, b] = sunlight(sunDirection(18.3));
    expect(r).toBeGreaterThan(g);
    expect(g).toBeGreaterThan(b);
    expect(sunlight(sunDirection(0))).toEqual([0, 0, 0]);
  });
});

describe('twilight', () => {
  it('cools the sky only while the sun is near the horizon', () => {
    expect(twilight(sunDirection(12))).toBe(0);
    expect(twilight(sunDirection(18.5))).toBeCloseTo(1);
    expect(twilight(sunDirection(23))).toBe(0);
  });
});

describe('labels', () => {
  it('names the time of day', () => {
    expect(phaseOf(6)).toBe('Dawn');
    expect(phaseOf(18.6)).toBe('Sunset');
    expect(phaseOf(23)).toBe('Night');
  });
});
