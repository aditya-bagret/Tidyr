import { describe, expect, it } from 'vitest';
import {
  addDays,
  formatDate,
  formatDue,
  isOverdue,
  isValidDateOnly,
  suggestProjectKey,
  todayLocal,
  todayUtc,
} from '../src';

describe('suggestProjectKey (T-SH-08)', () => {
  it.each([
    ['Website Redesign', 'WR'],
    ['Mobile', 'MOB'],
    ['a', 'PRJ'],
    ['123 !!', 'PRJ'],
    ['Q4 marketing site refresh plan', 'QMSR'],
    ['  internal   tools  ', 'IT'],
    ['Go', 'GO'],
  ])('%j → %s', (name, key) => {
    expect(suggestProjectKey(name)).toBe(key);
  });
});

describe('isOverdue (T-SH-09)', () => {
  const today = '2026-10-07';

  it('is true when due before today and not completed', () => {
    expect(isOverdue({ dueDate: '2026-10-06', status: 'PENDING' }, today)).toBe(true);
    expect(isOverdue({ dueDate: '2025-12-31', status: 'IN_PROGRESS' }, today)).toBe(true);
  });

  it('is false when completed, with no due date, or due today', () => {
    expect(isOverdue({ dueDate: '2026-10-01', status: 'COMPLETED' }, today)).toBe(false);
    expect(isOverdue({ dueDate: null, status: 'PENDING' }, today)).toBe(false);
    expect(isOverdue({ dueDate: today, status: 'PENDING' }, today)).toBe(false);
  });
});

describe('date utils', () => {
  it('isValidDateOnly handles leap years', () => {
    expect(isValidDateOnly('2028-02-29')).toBe(true);
    expect(isValidDateOnly('2100-02-29')).toBe(false);
  });

  it('addDays crosses month, year and leap-day boundaries', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(addDays('2026-10-07', 6)).toBe('2026-10-13');
  });

  it('addDays rejects a malformed date', () => {
    expect(() => addDays('2026/10/07', 1)).toThrow(RangeError);
  });

  it('todayLocal uses local calendar parts and todayUtc the UTC ones', () => {
    const now = new Date(2026, 0, 5, 23, 30);
    expect(todayLocal(now)).toBe('2026-01-05');
    expect(todayUtc(new Date(Date.UTC(2026, 9, 7, 23, 59)))).toBe('2026-10-07');
  });

  it('formatDate omits the year only for the current year', () => {
    expect(formatDate('2026-10-20', '2026-10-07')).toBe('Oct 20');
    expect(formatDate('2027-01-02', '2026-10-07')).toBe('Jan 2, 2027');
  });

  it('formatDue uses Today and Tomorrow', () => {
    expect(formatDue('2026-10-07', '2026-10-07')).toBe('Today');
    expect(formatDue('2026-10-08', '2026-10-07')).toBe('Tomorrow');
    expect(formatDue('2027-01-01', '2026-12-31')).toBe('Tomorrow');
    expect(formatDue('2026-10-02', '2026-10-07')).toBe('Oct 2');
  });
});
