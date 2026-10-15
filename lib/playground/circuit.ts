/** Ideal, single-source DC resistive network. Terminals a/b define signed readings. */
export type Part = { id: string; kind: 'battery' | 'switch' | 'lamp' | 'resistor'; value: number; closed?: boolean; x: number; y: number }
export type Wire = { a: string; b: string }
export type Circuit = { parts: Part[]; wires: Wire[] }
export const terminal = (id: string, side: 'a' | 'b') => `${id}:${side}`
export type Reading = { voltage: number | null; current: number | null; power: number | null }
export function solveCircuit({ parts, wires }: Circuit) {
  const readings: Record<string, Reading> = Object.fromEntries(parts.map(p => [p.id, { voltage: null, current: null, power: null }]))
  const result = (status: 'empty' | 'open' | 'closed' | 'short' | 'invalid', current: number | null = null) => ({ status, current, readings })
  if (parts.length > 24 || new Set(parts.map(p => p.id)).size !== parts.length) return result('invalid')
  const batteries = parts.filter(p => p.kind === 'battery')
  if (batteries.length > 1 || parts.some(p => !Number.isFinite(p.value) || (p.kind === 'battery' ? p.value < 1 || p.value > 12 : p.kind !== 'switch' && (p.value < 1 || p.value > 1000)))) return result('invalid')
  const parent = new Map<string, string>()
  parts.forEach(p => ['a', 'b'].forEach(s => parent.set(`${p.id}:${s}`, `${p.id}:${s}`)))
  const root = (n: string): string => { const p = parent.get(n)!; if (p === n) return n; const r = root(p); parent.set(n, r); return r }
  const join = (a: string, b: string) => parent.set(root(a), root(b))
  for (const w of wires) { if (!parent.has(w.a) || !parent.has(w.b)) return result('invalid'); join(w.a, w.b) }
  parts.filter(p => p.kind === 'switch' && p.closed).forEach(p => join(terminal(p.id, 'a'), terminal(p.id, 'b')))
  if (!batteries.length) return result('empty')
  const battery = batteries[0], positive = root(terminal(battery.id, 'a')), negative = root(terminal(battery.id, 'b'))
  if (positive === negative) return result('short') // Ideal short has no finite solution; never display Infinity.
  const edges = parts.filter(p => p.kind === 'lamp' || p.kind === 'resistor').map(p => ({ p, a: root(terminal(p.id, 'a')), b: root(terminal(p.id, 'b')) }))
  const reachable = new Set([positive, negative])
  let changed = true
  while (changed) { changed = false; for (const { a, b } of edges) if (reachable.has(a) || reachable.has(b)) for (const n of [a, b]) if (!reachable.has(n)) { reachable.add(n); changed = true } }
  const unknown = [...reachable].filter(n => n !== positive && n !== negative)
  const indices = new Map(unknown.map((n, i) => [n, i]))
  const voltage = new Map([[positive, battery.value], [negative, 0]])
  const matrix = unknown.map(() => Array(unknown.length + 1).fill(0) as number[])
  for (const { p, a, b } of edges) {
    if (a === b) continue
    for (const [n, other] of [[a, b], [b, a]]) {
      const i = indices.get(n); if (i === undefined) continue
      matrix[i][i] += 1 / p.value
      const j = indices.get(other)
      if (j !== undefined) matrix[i][j] -= 1 / p.value
      else matrix[i][unknown.length] += (voltage.get(other) ?? 0) / p.value
    }
  }
  for (let i = 0; i < unknown.length; i++) {
    let pivot = i
    for (let j = i + 1; j < unknown.length; j++) if (Math.abs(matrix[j][i]) > Math.abs(matrix[pivot][i])) pivot = j
    ;[matrix[i], matrix[pivot]] = [matrix[pivot], matrix[i]]
    const divisor = matrix[i][i]; if (Math.abs(divisor) < 1e-12) return result('invalid')
    for (let k = i; k <= unknown.length; k++) matrix[i][k] /= divisor
    for (let j = 0; j < unknown.length; j++) if (j !== i) { const factor = matrix[j][i]; for (let k = i; k <= unknown.length; k++) matrix[j][k] -= factor * matrix[i][k] }
  }
  unknown.forEach((n, i) => voltage.set(n, matrix[i][unknown.length]))
  let total = 0
  for (const { p, a, b } of edges) {
    const v = a === b ? 0 : voltage.has(a) && voltage.has(b) ? voltage.get(a)! - voltage.get(b)! : null
    const current = v === null ? 0 : v / p.value
    readings[p.id] = { voltage: v, current, power: v === null ? 0 : v * current }
    if (a === positive) total += current
    if (b === positive) total -= current
  }
  total = Math.max(0, total)
  readings[battery.id] = { voltage: battery.value, current: total, power: battery.value * total }
  parts.filter(p => p.kind === 'switch').forEach(p => {
    const a = root(terminal(p.id, 'a')), b = root(terminal(p.id, 'b'))
    readings[p.id] = { voltage: a === b ? 0 : voltage.has(a) && voltage.has(b) ? voltage.get(a)! - voltage.get(b)! : null, current: p.closed ? null : 0, power: 0 }
  })
  return result(total > 1e-9 ? 'closed' : 'open', total)
}
export function exampleCircuit(mode: 'simple' | 'series' | 'parallel' | 'switch' = 'simple'): Circuit {
  const parts: Part[] = [{ id: 'battery', kind: 'battery', value: 6, x: 12, y: 15 }, { id: 'lamp1', kind: 'lamp', value: 100, x: 58, y: 15 }]
  const wires: Wire[] = [{ a: 'battery:a', b: 'lamp1:a' }]
  if (mode === 'simple') wires.push({ a: 'lamp1:b', b: 'battery:b' })
  else {
    parts.push({ id: 'extra', kind: mode === 'switch' ? 'switch' : 'lamp', value: 100, closed: false, x: 58, y: 62 })
    if (mode === 'parallel') wires.push({ a: 'battery:a', b: 'extra:a' }, { a: 'battery:b', b: 'extra:b' }, { a: 'lamp1:b', b: 'battery:b' })
    else wires.push({ a: 'lamp1:b', b: 'extra:a' }, { a: 'extra:b', b: 'battery:b' })
  }
  return { parts, wires }
}
