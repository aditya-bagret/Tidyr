import { describe, expect, it } from 'vitest';
import {
  fromDateOnly,
  fromDateOnlyOrNull,
  toDateOnly,
  toDateOnlyOrNull,
} from '../../src/lib/dates';

describe('lib/dates', () => {
  it('maps YYYY-MM-DD to UTC midnight and back', () => {
    const date = fromDateOnly('2028-02-29');
    expect(date.toISOString()).toBe('2028-02-29T00:00:00.000Z');
    expect(toDateOnly(date)).toBe('2028-02-29');
  });

  it.each(['2026-02-30', '2026-13-01', '26-1-1', '', '2026-02-28T00:00'])(
    'rejects invalid date-only value %j',
    (value) => {
      expect(() => fromDateOnly(value)).toThrow(RangeError);
    },
  );

  it('passes null through and keeps undefined (field not sent) as undefined', () => {
    expect(toDateOnlyOrNull(null)).toBeNull();
    expect(fromDateOnlyOrNull(null)).toBeNull();
    expect(fromDateOnlyOrNull(undefined)).toBeUndefined();
    expect(fromDateOnlyOrNull('2026-10-07')?.toISOString()).toBe('2026-10-07T00:00:00.000Z');
  });
});
