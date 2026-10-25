import { describe, expect, it } from 'vitest'
import { emptyPhysicsBackup, MAX_PHYSICS_STATE_BYTES, mergePhysicsBackups, parsePhysicsBackup, PHYSICS_STORAGE_KEYS, physicsBackupFromValues, physicsBackupValues } from './state'

const scene = { version: 1, mode: 'circuit', components: [], wires: [] }
const experiment = (id: string) => ({ id, name: id, date: '', scene })

describe('physics account backup contract', () => {
  it('round trips only the three portable storage keys', () => {
    const backup = emptyPhysicsBackup()
    backup.experiments.push(experiment('one'))
    const values = physicsBackupValues(backup)
    expect(Object.keys(values)).toEqual([...PHYSICS_STORAGE_KEYS])
    expect(physicsBackupFromValues(values)).toEqual({ ...backup, exportedAt: expect.any(String) })
    expect(physicsBackupFromValues(Object.fromEntries(PHYSICS_STORAGE_KEYS.map(key => [key, null]))).experiments).toEqual([])
  })

  it('rejects unknown, missing, nonstring keys and corrupt JSON instead of discarding records', () => {
    const values = physicsBackupValues(emptyPhysicsBackup())
    for (const invalid of [{ ...values, extra: '[]' }, {}, { ...values, [PHYSICS_STORAGE_KEYS[0]]: [] }, { ...values, [PHYSICS_STORAGE_KEYS[0]]: '{' }]) {
      expect(() => physicsBackupFromValues(invalid)).toThrow()
    }
  })

  it('strips arbitrary root fields and rejects missing export metadata', () => {
    const backup = emptyPhysicsBackup()
    expect(parsePhysicsBackup({ ...backup, admin: true })).toEqual(backup)
    expect(() => parsePhysicsBackup({ ...backup, exportedAt: null })).toThrow()
  })

  it('validates scene models and notebook reading counts', () => {
    const backup = emptyPhysicsBackup()
    expect(() => parsePhysicsBackup({ ...backup, experiments: [{ ...experiment('bad'), scene: { ...scene, mode: 'unknown' } }] })).toThrow()
    expect(() => parsePhysicsBackup({ ...backup, notebook: { version: 1, sessions: [{ id: 's', lessonId: null, records: Array.from({ length: 21 }, () => ({ id: 'r', scene })), workingScene: scene }] } })).toThrow()
    expect(() => parsePhysicsBackup({ ...backup, notebook: { version: 1, sessions: [{ id: 's', lessonId: null, records: [], workingScene: {} }] } })).toThrow()
    expect(() => parsePhysicsBackup({ ...backup, observations: [{ id: 'bad', experiment: 'missing', params: {}, time: 0 }] })).toThrow()
  })

  it('rejects overflow records and UTF-8 bytes even below the character cap', () => {
    const backup = emptyPhysicsBackup()
    expect(() => parsePhysicsBackup({ ...backup, experiments: Array.from({ length: 31 }, (_, i) => experiment(String(i))) })).toThrow()
    expect(() => parsePhysicsBackup({ ...backup, padding: '界'.repeat(Math.ceil(MAX_PHYSICS_STATE_BYTES / 3)) })).toThrow()
  })

  it('merges without overwriting ID collisions and deduplicates repeated merges', () => {
    const current = emptyPhysicsBackup()
    current.experiments.push(experiment('one'))
    const incoming = emptyPhysicsBackup()
    incoming.experiments.push({ ...experiment('one'), name: 'different' })
    const merged = mergePhysicsBackups(current, incoming)
    expect(merged.experiments.map(x => x.id)).toEqual(['one', 'one-import-1'])
    expect(mergePhysicsBackups(merged, incoming)).toEqual(merged)
    expect(current.experiments).toHaveLength(1)
  })
})
