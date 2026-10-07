import { describe, expect, it } from 'vitest';
import { toPageMeta, toSkipTake } from '../../src/lib/pagination';

describe('pagination', () => {
  it('maps page and limit to skip and take', () => {
    expect(toSkipTake({ page: 1, limit: 20 })).toEqual({ skip: 0, take: 20 });
    expect(toSkipTake({ page: 3, limit: 2 })).toEqual({ skip: 4, take: 2 });
  });

  it('computes totalPages from the total', () => {
    expect(toPageMeta({ page: 1, limit: 2 }, 5)).toEqual({
      page: 1,
      limit: 2,
      total: 5,
      totalPages: 3,
    });
    expect(toPageMeta({ page: 1, limit: 20 }, 20).totalPages).toBe(1);
    expect(toPageMeta({ page: 1, limit: 20 }, 0).totalPages).toBe(0);
    expect(toPageMeta({ page: 9, limit: 20 }, 21)).toEqual({
      page: 9,
      limit: 20,
      total: 21,
      totalPages: 2,
    });
  });
});
