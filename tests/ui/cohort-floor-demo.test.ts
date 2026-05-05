// M01 cohort-floor demo widget — verdict-flip computation tests (cp-j0gw.11).

import { describe, expect, it } from 'vitest';
import {
  FLOOR_MIN,
  FLOOR_MAX,
  FLOOR_DEFAULT,
  SAMPLE_PROGRAMS,
  computeVerdict,
  summarizeAt,
  detectFlips,
} from '../../web/widgets/cohort-floor-demo.js';

describe('cohort-floor-demo: constants', () => {
  it('floor range is 16–30 inclusive', () => {
    expect(FLOOR_MIN).toBe(16);
    expect(FLOOR_MAX).toBe(30);
    expect(FLOOR_DEFAULT).toBe(30);
  });

  it('illustrative dataset has at least one program at every interesting boundary', () => {
    const ns = SAMPLE_PROGRAMS.map((p) => p.n);
    expect(Math.max(...ns)).toBeGreaterThanOrEqual(30);
    expect(Math.min(...ns)).toBeLessThan(16);
    expect(ns.some((n) => n >= 16 && n < 30)).toBe(true);
  });
});

describe('cohort-floor-demo: computeVerdict', () => {
  it('MEASURED when n >= floor', () => {
    expect(computeVerdict({ n: 30, ahead_published: false }, 30)).toBe('MEASURED');
    expect(computeVerdict({ n: 100, ahead_published: false }, 30)).toBe('MEASURED');
    expect(computeVerdict({ n: 16, ahead_published: false }, 16)).toBe('MEASURED');
  });

  it('NOT_MEASURED when n < floor and no AHEAD override', () => {
    expect(computeVerdict({ n: 22, ahead_published: false }, 30)).toBe('NOT_MEASURED');
    expect(computeVerdict({ n: 15, ahead_published: false }, 16)).toBe('NOT_MEASURED');
  });

  it('MEASURED_OVERRIDE when n in [16, floor) and AHEAD published', () => {
    expect(computeVerdict({ n: 22, ahead_published: true }, 30)).toBe('MEASURED_OVERRIDE');
    expect(computeVerdict({ n: 16, ahead_published: true }, 30)).toBe('MEASURED_OVERRIDE');
  });

  it('AHEAD override does not apply below n=16', () => {
    expect(computeVerdict({ n: 15, ahead_published: true }, 30)).toBe('NOT_MEASURED');
    expect(computeVerdict({ n: 7, ahead_published: true }, 30)).toBe('NOT_MEASURED');
  });

  it('NOT_MEASURED for invalid n', () => {
    expect(computeVerdict({ ahead_published: true }, 30)).toBe('NOT_MEASURED');
    expect(computeVerdict({ n: NaN, ahead_published: true }, 30)).toBe('NOT_MEASURED');
  });
});

describe('cohort-floor-demo: summarizeAt', () => {
  const programs = [
    { id: 'a', n: 38, ahead_published: true },
    { id: 'b', n: 22, ahead_published: true },
    { id: 'c', n: 22, ahead_published: false },
    { id: 'd', n: 7, ahead_published: false },
  ];

  it('partitions programs at floor=30', () => {
    const s = summarizeAt(programs, 30);
    expect(s.measured.map((p) => p.id)).toEqual(['a']);
    expect(s.override.map((p) => p.id)).toEqual(['b']);
    expect(s.notMeasured.map((p) => p.id)).toEqual(['c', 'd']);
  });

  it('partitions programs at floor=16', () => {
    const s = summarizeAt(programs, 16);
    expect(s.measured.map((p) => p.id)).toEqual(['a', 'b', 'c']);
    expect(s.override).toEqual([]);
    expect(s.notMeasured.map((p) => p.id)).toEqual(['d']);
  });
});

describe('cohort-floor-demo: detectFlips', () => {
  it('detects programs that flip MEASURED → NOT_MEASURED as the floor rises', () => {
    const programs = [
      { id: 'stable-high', n: 38, ahead_published: false },
      { id: 'flips', n: 22, ahead_published: false },
      { id: 'override-stable', n: 22, ahead_published: true },
      { id: 'stable-low', n: 7, ahead_published: false },
    ];
    const flips = detectFlips(programs, 16, 30);
    expect(flips).toHaveLength(2);
    const idsByFlip = new Map(flips.map((f) => [f.program.id, f]));
    expect(idsByFlip.get('flips')).toMatchObject({ from: 'MEASURED', to: 'NOT_MEASURED' });
    expect(idsByFlip.get('override-stable')).toMatchObject({
      from: 'MEASURED',
      to: 'MEASURED_OVERRIDE',
    });
  });

  it('returns empty when no programs flip', () => {
    const programs = [
      { id: 'high', n: 38, ahead_published: false },
      { id: 'low', n: 5, ahead_published: false },
    ];
    expect(detectFlips(programs, 20, 25)).toEqual([]);
  });

  it('flip set on the SAMPLE_PROGRAMS between floor=16 and floor=30 is non-empty', () => {
    const flips = detectFlips(SAMPLE_PROGRAMS, 16, 30);
    expect(flips.length).toBeGreaterThan(0);
    for (const f of flips) {
      expect(f.from).not.toBe(f.to);
    }
  });
});
