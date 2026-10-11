import { describe, expect, it } from 'vitest';
import { PROJECT_SUCCESSORS, RETIRED_PROJECT_IDS, getProjectSuccessorId, isRetiredProject } from './project-successors';

describe('project successors', () => {
  it('keeps an immutable retirement mapping', () => {
    expect(PROJECT_SUCCESSORS).toEqual({ 907: 1098, 997: 1098, 1010: 1098 });
    expect(Object.isFrozen(PROJECT_SUCCESSORS)).toBe(true);
    expect(RETIRED_PROJECT_IDS).toEqual([907, 997, 1010]);
    expect(Object.isFrozen(RETIRED_PROJECT_IDS)).toBe(true);
    expect(isRetiredProject(1098)).toBe(false);
  });

  it.each([907, 997, 1010])('resolves retired project %s to 1098', id => {
    expect(getProjectSuccessorId(id)).toBe(1098);
    expect(isRetiredProject(id)).toBe(true);
  });

  it.each([0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1, 1098, 999])('rejects invalid or unmapped id %s', id => {
    expect(getProjectSuccessorId(id)).toBeNull();
    expect(isRetiredProject(id)).toBe(false);
  });

  it.each([0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1, 907])('rejects invalid or self-referencing successor %s', id => {
    expect(getProjectSuccessorId(907, { 907: id })).toBeNull();
  });
});
