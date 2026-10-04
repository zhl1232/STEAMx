/**
 * Replacement ("successor") courses for retired courses that stay reachable by
 * historical links. Keys are the old course id, values the new course id.
 *
 * Old courses keep their learning records and are only hidden from discovery
 * (`is_listed = false`); their pages show a 「新版课程」 entry pointing here.
 * See docs/SCRATCH_CURRICULUM_ROLLOUT.md for the Scratch #1 → #8 replacement.
 */
export const COURSE_SUCCESSORS: Readonly<Record<number, number>> = Object.freeze({
  1: 8,
});

export function getCourseSuccessorId(
  courseId: number,
  successors: Readonly<Record<number, number>> = COURSE_SUCCESSORS,
): number | null {
  if (!Number.isSafeInteger(courseId) || courseId <= 0) return null;
  const successorId = successors[courseId];
  if (!Number.isSafeInteger(successorId) || successorId <= 0 || successorId === courseId) return null;
  return successorId;
}
