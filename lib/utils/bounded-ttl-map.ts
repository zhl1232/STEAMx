/**
 * Small in-process TTL cache with an explicit entry limit.
 *
 * This is intentionally backed by a Map instead of a timer. A timer per cache
 * entry would keep the process alive and create another source of retained
 * closures; expired entries are removed on reads and writes instead.
 */
export class BoundedTtlMap<K, V> {
  private readonly entries = new Map<K, { value: V; expiresAt: number }>()
  private nextPruneAt = 0

  constructor(
    private readonly maxEntries: number,
    private readonly pruneIntervalMs = 60_000,
  ) {
    if (!Number.isInteger(maxEntries) || maxEntries < 1) {
      throw new RangeError('maxEntries must be a positive integer')
    }
    if (!Number.isFinite(pruneIntervalMs) || pruneIntervalMs < 0) {
      throw new RangeError('pruneIntervalMs must be a non-negative number')
    }
  }

  get size() {
    return this.entries.size
  }

  get(key: K, now = Date.now()): V | undefined {
    const entry = this.entries.get(key)
    if (!entry) return undefined

    if (entry.expiresAt <= now) {
      this.entries.delete(key)
      return undefined
    }

    // Keep frequently used entries warm while retaining a deterministic cap.
    this.entries.delete(key)
    this.entries.set(key, entry)
    return entry.value
  }

  set(key: K, value: V, expiresAt: number, now = Date.now()) {
    if (now >= this.nextPruneAt) {
      this.pruneExpired(now)
      this.nextPruneAt = now + this.pruneIntervalMs
    }
    this.entries.delete(key)

    while (this.entries.size >= this.maxEntries) {
      const oldestKey = this.entries.keys().next().value
      if (oldestKey === undefined) break
      this.entries.delete(oldestKey)
    }

    this.entries.set(key, { value, expiresAt })
  }

  delete(key: K) {
    return this.entries.delete(key)
  }

  clear() {
    this.entries.clear()
    this.nextPruneAt = 0
  }

  pruneExpired(now = Date.now()) {
    for (const [key, entry] of this.entries) {
      if (entry.expiresAt <= now) this.entries.delete(key)
    }
  }
}
