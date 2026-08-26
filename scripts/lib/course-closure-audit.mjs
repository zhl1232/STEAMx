export function normalizeAuditCount(value) {
  const count = Number(value ?? 0)
  return Number.isFinite(count) && count > 0 ? count : 0
}

export function summarizeCourseClosureAudit(rows) {
  const findings = (Array.isArray(rows) ? rows : [])
    .map((row) => ({
      ...row,
      count: normalizeAuditCount(row?.count),
      rows: Array.isArray(row?.rows) ? row.rows : [],
    }))
    .filter((row) => row.count > 0)

  const blockingCount = findings
    .filter((row) => row.severity === 'P1')
    .reduce((total, row) => total + row.count, 0)
  const advisoryCount = findings
    .filter((row) => row.severity !== 'P1')
    .reduce((total, row) => total + row.count, 0)

  return {
    healthy: blockingCount === 0,
    blockingCount,
    advisoryCount,
    findings,
  }
}
