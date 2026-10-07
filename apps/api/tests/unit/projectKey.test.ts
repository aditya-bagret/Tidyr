import { describe, expect, it } from 'vitest';
import { firstFreeKey } from '../../src/modules/projects/projectKey';

describe('firstFreeKey', () => {
  it('uses the base when it is free', () => {
    expect(firstFreeKey('WR', new Set(['WEB', 'WR2']))).toBe('WR');
  });

  it('adds the first free number suffix, starting at 2', () => {
    expect(firstFreeKey('WR', new Set(['WR']))).toBe('WR2');
    expect(firstFreeKey('WR', new Set(['WR', 'WR2', 'WR4']))).toBe('WR3');
    expect(firstFreeKey('PRJ', new Set(['PRJ', 'PRJ2', 'PRJ3']))).toBe('PRJ4');
  });
});
