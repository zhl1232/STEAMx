export interface KitSelection { setNum: string; copies: number }
export function getDefaultKitsForCourse(courseId: number): KitSelection[] {
  const sets: Record<number, string[]> = { 5: ['9090-2', '9076-1'], 6: ['45002-1'], 7: ['9656-1'] }
  return (sets[courseId] ?? []).map(setNum => ({ setNum, copies: 1 }))
}
