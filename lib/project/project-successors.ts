import successors from './project-successors.json';

/**
 * 旧项目保留数据，仅通过 projects.moderation_state='hidden' 隐藏，
 * 并由 next.config.mjs 将旧项目地址 301 到继任项目。
 * 回滚：删除映射并恢复 moderation_state。数据库状态由人工维护。
 */
export const PROJECT_SUCCESSORS: Readonly<Record<number, number>> = Object.freeze(successors);

export function getProjectSuccessorId(
  projectId: number,
  mapping: Readonly<Record<number, number>> = PROJECT_SUCCESSORS,
): number | null {
  if (!Number.isSafeInteger(projectId) || projectId <= 0) return null;
  const successorId = mapping[projectId];
  if (!Number.isSafeInteger(successorId) || successorId <= 0 || successorId === projectId) return null;
  return successorId;
}

export const RETIRED_PROJECT_IDS: readonly number[] = Object.freeze(
  Object.keys(PROJECT_SUCCESSORS).map(Number).filter(id => getProjectSuccessorId(id) !== null),
);

export function isRetiredProject(projectId: number): boolean {
  return getProjectSuccessorId(projectId) !== null;
}
