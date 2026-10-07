import { describe, expect, it } from 'vitest';
import { formatTaskKey, parseTaskKey } from '../../src/modules/tasks/taskKey';

describe('formatTaskKey', () => {
  it('joins the project key and number with a dash', () => {
    expect(formatTaskKey('WEB', 12)).toBe('WEB-12');
  });
});

describe('parseTaskKey', () => {
  it('parses a key in any case into the stored uppercase key and the number', () => {
    expect(parseTaskKey('web-2')).toEqual({ projectKey: 'WEB', number: 2 });
    expect(parseTaskKey('Mob2-007')).toEqual({ projectKey: 'MOB2', number: 7 });
    expect(parseTaskKey('ABCDEFGHIJ-1')).toEqual({ projectKey: 'ABCDEFGHIJ', number: 1 });
  });

  it.each(['web', 'web-', '-2', 'w-2', '2web-2', 'web-2a', 'we b-2', 'ABCDEFGHIJK-1', 'web--2'])(
    'returns null for %j, which is not a task key',
    (text) => {
      expect(parseTaskKey(text)).toBeNull();
    },
  );

  it('returns null for a number no task can have (beyond int4)', () => {
    expect(parseTaskKey('web-2147483647')).toEqual({ projectKey: 'WEB', number: 2147483647 });
    expect(parseTaskKey('web-2147483648')).toBeNull();
    expect(parseTaskKey(`web-${'9'.repeat(400)}`)).toBeNull();
  });
});
