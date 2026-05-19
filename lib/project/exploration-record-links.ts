export function getExplorationRecordHref(
  projectId: string | number,
  completionId: number,
) {
  return `/project/${projectId}/records?highlight=${completionId}`
}

export function parseHighlightCompletionId(value?: string | null): number | null {
  if (!value) return null
  const id = Number.parseInt(value, 10)
  return Number.isInteger(id) && id > 0 ? id : null
}

export function explorationRecordDomId(completionId: number) {
  return `exploration-record-${completionId}`
}
