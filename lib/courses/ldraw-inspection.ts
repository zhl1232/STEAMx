import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

export type LdrawInspectionEntry = {
  revision: string
  status: 'needs-repair' | 'checked'
  issues: string[]
  notes?: string[]
}

export type LdrawInspectionStatus = 'unchecked' | 'needs-repair' | 'checked' | 'exempt'
export type LdrawInspectionReason = 'missing' | 'stale' | 'malformed' | 'needs-repair' | 'current'

export type LdrawInspectionResult = {
  status: LdrawInspectionStatus
  issues: string[]
  notes: string[]
  reason: LdrawInspectionReason
  revision: string | null
}

const INSPECTION_MANIFEST = resolve(process.cwd(), 'scripts/ldraw-inspections.json')

function isEntry(value: unknown): value is LdrawInspectionEntry {
  if (!value || typeof value !== 'object') return false
  const entry = value as Partial<LdrawInspectionEntry>
  return typeof entry.revision === 'string'
    && (entry.status === 'needs-repair' || entry.status === 'checked')
    && Array.isArray(entry.issues)
    && entry.issues.every((issue) => typeof issue === 'string')
    && (entry.notes === undefined || (Array.isArray(entry.notes) && entry.notes.every((note) => typeof note === 'string')))
}

/**
 * Read the version-bound inspection manifest. Any malformed manifest is treated
 * as empty so an unconfirmed model cannot accidentally become confirmable.
 */
export async function getLdrawInspectionRecords(): Promise<Record<string, LdrawInspectionEntry>> {
  try {
    const parsed: unknown = JSON.parse(await readFile(INSPECTION_MANIFEST, 'utf8'))
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    const entries = Object.entries(parsed)
    if (!entries.every(([, value]) => isEntry(value))) return {}
    return Object.fromEntries(entries) as Record<string, LdrawInspectionEntry>
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return {}
    return {}
  }
}

export function inspectionFor(
  fileName: string,
  revision: string,
  records: Record<string, LdrawInspectionEntry>,
  historicallyConfirmed: boolean,
): LdrawInspectionResult {
  if (historicallyConfirmed) {
    return { status: 'exempt', issues: [], notes: [], reason: 'current', revision: null }
  }

  const entry = records[fileName]
  if (!entry) {
    return { status: 'unchecked', issues: [], notes: [], reason: 'missing', revision: null }
  }
  if (entry.revision !== revision) {
    return { status: 'unchecked', issues: [], notes: [], reason: 'stale', revision: entry.revision }
  }
  if (entry.status === 'needs-repair') {
    return { status: 'needs-repair', issues: entry.issues, notes: entry.notes ?? [], reason: 'needs-repair', revision: entry.revision }
  }
  return { status: 'checked', issues: entry.issues, notes: entry.notes ?? [], reason: 'current', revision: entry.revision }
}
