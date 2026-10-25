import { mergeBackup, parseBackup } from '@/public/physics-lab/transfer.mjs'
import { validateScene } from '@/public/physics-lab/physics.mjs'
import type { Json } from '@/lib/supabase/types'

export const MAX_PHYSICS_STATE_BYTES = 8 * 1024 * 1024
export const PHYSICS_STORAGE_KEYS = [
  'steamx-physics-experiments-v1',
  'steamx-learning-notebook-v1',
  'steamx-topic-observations-v1',
] as const

type StoredRecord = { id: string; [key: string]: Json | undefined }
export type PhysicsBackup = {
  kind: 'steamx-physics-backup'
  version: 1
  exportedAt: string
  experiments: StoredRecord[]
  notebook: { version: 1; lastId: string | null; sessions: StoredRecord[] }
  observations: StoredRecord[]
}

export function emptyPhysicsBackup(): PhysicsBackup {
  return {
    kind: 'steamx-physics-backup', version: 1, exportedAt: new Date().toISOString(),
    experiments: [], notebook: { version: 1, lastId: null, sessions: [] }, observations: [],
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

/** Reuse the portable model validators, but never retain unrecognized root fields. */
export function parsePhysicsBackup(value: unknown): PhysicsBackup {
  if (!isRecord(value) || typeof value.exportedAt !== 'string' || !Number.isFinite(Date.parse(value.exportedAt))) {
    throw new Error('实验室备份时间或格式不正确')
  }
  const raw = JSON.stringify(value)
  if (new TextEncoder().encode(raw).byteLength > MAX_PHYSICS_STATE_BYTES) {
    throw new Error('实验室备份不能大于 8 MB')
  }
  // Portable restore intentionally discards an invalid draft. Server writes must
  // reject it instead, so a corrupt draft cannot silently replace a valid one.
  const notebook = value.notebook
  if (isRecord(notebook) && Array.isArray(notebook.sessions)) {
    for (const session of notebook.sessions) {
      if (isRecord(session) && session.workingScene != null) {
        const scene = validateScene(session.workingScene)
        if (scene.mode !== 'circuit') throw new Error('任务草稿必须是电路实验')
      }
    }
  }
  const parsed = parseBackup(raw)
  return {
    kind: 'steamx-physics-backup', version: 1, exportedAt: value.exportedAt,
    experiments: parsed.experiments, notebook: parsed.notebook, observations: parsed.observations,
  } as PhysicsBackup
}

export function physicsBackupFromValues(values: unknown): PhysicsBackup {
  if (!isRecord(values) || Object.keys(values).length !== PHYSICS_STORAGE_KEYS.length ||
    Object.keys(values).some(key => !(PHYSICS_STORAGE_KEYS as readonly string[]).includes(key)) ||
    PHYSICS_STORAGE_KEYS.some(key => !Object.hasOwn(values, key) || (values[key] !== null && typeof values[key] !== 'string'))) {
    throw new Error('实验室存储键或内容不正确')
  }
  if (PHYSICS_STORAGE_KEYS.reduce((size, key) => size + new TextEncoder().encode(values[key] as string ?? '').byteLength, 0) > MAX_PHYSICS_STATE_BYTES) {
    throw new Error('实验室备份不能大于 8 MB')
  }
  const read = (key: typeof PHYSICS_STORAGE_KEYS[number], fallback: unknown): unknown =>
    values[key] === null ? fallback : JSON.parse(values[key] as string)
  return parsePhysicsBackup({
    ...emptyPhysicsBackup(),
    experiments: read(PHYSICS_STORAGE_KEYS[0], []),
    notebook: read(PHYSICS_STORAGE_KEYS[1], { version: 1, lastId: null, sessions: [] }),
    observations: read(PHYSICS_STORAGE_KEYS[2], []),
  })
}

export function physicsBackupValues(backup: PhysicsBackup): Record<string, string | null> {
  const parsed = parsePhysicsBackup(backup)
  return {
    [PHYSICS_STORAGE_KEYS[0]]: JSON.stringify(parsed.experiments),
    [PHYSICS_STORAGE_KEYS[1]]: JSON.stringify(parsed.notebook),
    [PHYSICS_STORAGE_KEYS[2]]: JSON.stringify(parsed.observations),
  }
}

export function mergePhysicsBackups(current: PhysicsBackup, incoming: PhysicsBackup): PhysicsBackup {
  return parsePhysicsBackup(mergeBackup(parsePhysicsBackup(current), parsePhysicsBackup(incoming)))
}
