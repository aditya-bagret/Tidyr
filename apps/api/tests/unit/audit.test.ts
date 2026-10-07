import { describe, expect, it } from 'vitest';
import { diff, type AuditValue } from '../../src/modules/audit/audit.service';

describe('audit diff', () => {
  const before: Record<'name' | 'status' | 'startDate' | 'endDate', AuditValue> = {
    name: 'Web',
    status: 'NOT_STARTED',
    startDate: null,
    endDate: '2026-10-01',
  };

  it('lists only the listed fields that changed', () => {
    const after = {
      ...before,
      status: 'IN_PROGRESS',
      startDate: '2026-09-01',
      endDate: '2026-10-01',
    };
    expect(diff(before, after, ['name', 'status', 'startDate', 'endDate'])).toEqual({
      status: { from: 'NOT_STARTED', to: 'IN_PROGRESS' },
      startDate: { from: null, to: '2026-09-01' },
    });
  });

  it('ignores fields that are not listed', () => {
    expect(diff(before, { ...before, name: 'App' }, ['status'])).toBeNull();
  });

  it('returns null when nothing changed', () => {
    expect(diff(before, { ...before }, ['name', 'status', 'startDate', 'endDate'])).toBeNull();
  });

  it('compares full values but records strings truncated to 200 characters', () => {
    const long = 'x'.repeat(200);
    const changes = diff({ text: `${long}a` }, { text: `${long}b` }, ['text']);
    expect(changes).toEqual({ text: { from: long, to: long } });
    expect(diff({ text: 'short' }, { text: null }, ['text'])).toEqual({
      text: { from: 'short', to: null },
    });
  });
});
