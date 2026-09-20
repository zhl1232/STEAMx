import { FUNCTION_WARS_LEVELS } from '@/lib/playground/function-wars-levels'

export function getFunctionWarsMaxUnlockedIndex(solved: ReadonlySet<string>, unlockAll = false): number {
  if (unlockAll) return FUNCTION_WARS_LEVELS.length - 1
  let contiguousSolved = 0
  for (const level of FUNCTION_WARS_LEVELS) {
    if (!solved.has(level.id)) break
    contiguousSolved += 1
  }
  return Math.min(FUNCTION_WARS_LEVELS.length - 1, contiguousSolved)
}
