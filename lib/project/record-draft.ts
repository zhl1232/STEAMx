// Text only, tab-scoped recovery. Never persist files, media URLs or published records.
const PREFIX = 'steamx:record-draft:'
const OWNER = `${PREFIX}owner`
export function syncRecordDraftOwner(userId: string | null) {
  try {
    if (sessionStorage.getItem(OWNER) !== userId) {
      for (const key of Object.keys(sessionStorage)) if (key.startsWith(PREFIX)) sessionStorage.removeItem(key)
    }
    if (userId) sessionStorage.setItem(OWNER, userId)
  } catch { /* Storage unavailable: recovery UI reports write failures. */ }
}
export function recordDraftKey(userId: string, projectId: string | number) { return `${PREFIX}${userId}:${projectId}` }
export function readRecordDraft(key: string) { try { return sessionStorage.getItem(key) || '' } catch { return '' } }
export function writeRecordDraft(key: string, text: string) {
  try { if (text) sessionStorage.setItem(key, text); else sessionStorage.removeItem(key); return true } catch { return false }
}
