import { describe, expect, it } from "vitest";

import { COURSE_SUCCESSORS, getCourseSuccessorId } from "./successors";

describe("course successors", () => {
  it("maps the retired Scratch course #1 to the original curriculum #8", () => {
    expect(COURSE_SUCCESSORS).toEqual({ 1: 8 });
    expect(getCourseSuccessorId(1)).toBe(8);
  });

  it("returns null for courses without a successor", () => {
    expect(getCourseSuccessorId(8)).toBeNull();
    expect(getCourseSuccessorId(3)).toBeNull();
  });

  it("ignores invalid ids and self/invalid mappings", () => {
    expect(getCourseSuccessorId(Number.NaN)).toBeNull();
    expect(getCourseSuccessorId(0)).toBeNull();
    expect(getCourseSuccessorId(-1)).toBeNull();
    expect(getCourseSuccessorId(2, { 2: 2 })).toBeNull();
    expect(getCourseSuccessorId(2, { 2: 0 })).toBeNull();
    expect(getCourseSuccessorId(2, { 2: 9 })).toBe(9);
  });
});
