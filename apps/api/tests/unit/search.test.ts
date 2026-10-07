import { describe, expect, it } from 'vitest';
import { escapeLikePattern } from '../../src/lib/search';

describe('escapeLikePattern', () => {
  it('escapes LIKE wildcards and the escape character', () => {
    expect(escapeLikePattern('100%_done\\x')).toBe('100\\%\\_done\\\\x');
  });

  it('leaves ordinary text alone', () => {
    expect(escapeLikePattern('Website Redesign')).toBe('Website Redesign');
  });
});
