import { describe, expect, it } from 'vitest';
import {
  MY_TASKS_SORT,
  PROJECT_TASKS_SORT,
  parseTaskListState,
  serializeTaskListState,
  toTaskListParams,
} from '@/features/tasks/list-params';

const parse = (query: string, defaults = PROJECT_TASKS_SORT) =>
  parseTaskListState(new URLSearchParams(query), defaults);

describe('task filters in the URL (T-WEB-04)', () => {
  it('reads every filter, sort and page from the query string', () => {
    expect(
      parse(
        'search=hero&status=PENDING,IN_PROGRESS&priority=HIGH&due=week&sort=dueDate&order=asc&page=3',
      ),
    ).toEqual({
      search: 'hero',
      status: ['PENDING', 'IN_PROGRESS'],
      priority: ['HIGH'],
      due: 'week',
      sort: 'dueDate',
      order: 'asc',
      page: 3,
      view: 'list',
    });
  });

  it('falls back field by field on hand-edited values instead of failing', () => {
    const state = parse('status=PENDING,FOO&priority=URGENT&sort=size&page=0&view=grid');
    expect(state.status).toEqual([]);
    expect(state.priority).toEqual([]);
    expect(state.sort).toBe(PROJECT_TASKS_SORT.sort);
    expect(state.page).toBe(1);
    expect(state.view).toBe('list');
  });

  it('round-trips a state through the URL', () => {
    const query = 'view=board&search=web-2&status=COMPLETED&priority=LOW,MEDIUM&due=overdue';
    expect(serializeTaskListState(parse(query), PROJECT_TASKS_SORT)).toBe(query);
  });

  it('leaves defaults out, so an unfiltered list has a plain URL', () => {
    expect(serializeTaskListState(parse(''), PROJECT_TASKS_SORT)).toBe('');
    expect(serializeTaskListState(parse('', MY_TASKS_SORT), MY_TASKS_SORT)).toBe('');
  });

  it('gives urgency a single direction', () => {
    const state = parse('sort=urgency&order=desc');
    expect(state.order).toBe('asc');
    expect(serializeTaskListState(state, PROJECT_TASKS_SORT)).toBe('sort=urgency');
  });

  it('loads the board as one page at the API maximum, ignoring the list page', () => {
    const params = toTaskListParams(parse('view=board&page=4'), {
      projectId: 'p1',
      today: '2026-10-08',
    });
    expect(params).toMatchObject({ projectId: 'p1', page: 1, limit: 100, today: '2026-10-08' });
  });
});
