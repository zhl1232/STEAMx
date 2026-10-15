import { describe, expect, it } from 'vitest'
import { exampleCircuit, solveCircuit } from './circuit'
describe('ideal DC node solver', () => {
  it.each([['simple', .06], ['series', .03], ['parallel', .12], ['switch', 0]] as const)('%s obeys Ohm and Kirchhoff laws', (mode, current) => {
    const r = solveCircuit(exampleCircuit(mode)); expect(r.current).toBeCloseTo(current)
    if (mode === 'series') expect(r.readings.lamp1.voltage).toBeCloseTo(3)
    if (mode === 'parallel') expect(r.readings.extra.voltage).toBeCloseTo(6)
  })
  it('closes switch and suppresses ideal short readings', () => {
    const c = exampleCircuit('switch'); c.parts[2].closed = true
    expect(solveCircuit(c).current).toBeCloseTo(.06)
    c.wires.push({ a: 'battery:a', b: 'battery:b' })
    expect(solveCircuit(c)).toMatchObject({ status: 'short', current: null, readings: { lamp1: { power: null } } })
  })
  it('handles floating, dangling, and bypassed loads', () => {
    const c = exampleCircuit(); c.wires = []
    expect(solveCircuit(c).readings.lamp1).toEqual({ voltage: null, current: 0, power: 0 })
    c.wires.push({ a: 'battery:a', b: 'lamp1:a' })
    expect(solveCircuit(c).readings.lamp1.voltage).toBeCloseTo(0)
    c.wires.push({ a: 'lamp1:a', b: 'lamp1:b' })
    expect(solveCircuit(c).readings.lamp1.current).toBe(0)
  })
  it('solves unequal series resistances and duplicate wires', () => {
    const c = exampleCircuit('series'); c.parts[2].value = 200; c.wires.push(c.wires[0])
    const r = solveCircuit(c); expect(r.current).toBeCloseTo(.02); expect(r.readings.extra.voltage).toBeCloseTo(4)
  })
  it('solves a balanced bridge independently of wire count', () => {
    const c = exampleCircuit('parallel')
    c.parts.push({ id: 'r3', kind: 'resistor', value: 100, x: 0, y: 0 }, { id: 'r4', kind: 'resistor', value: 100, x: 0, y: 0 }, { id: 'bridge', kind: 'resistor', value: 37, x: 0, y: 0 })
    c.wires = [{ a: 'battery:a', b: 'lamp1:a' }, { a: 'battery:a', b: 'extra:a' }, { a: 'lamp1:b', b: 'r3:a' }, { a: 'extra:b', b: 'r4:a' }, { a: 'r3:b', b: 'battery:b' }, { a: 'r4:b', b: 'battery:b' }, { a: 'bridge:a', b: 'lamp1:b' }, { a: 'bridge:b', b: 'extra:b' }]
    const r = solveCircuit(c)
    expect(r.current).toBeCloseTo(.06)
    expect(r.readings.bridge.current).toBeCloseTo(0)
    expect(r.readings.lamp1.voltage).toBeCloseTo(3)
  })
  it('rejects invalid values, terminals and multiple sources', () => {
    const c = exampleCircuit(); c.parts[0].value = NaN; expect(solveCircuit(c).status).toBe('invalid')
    c.parts[0].value = 6; c.wires.push({ a: 'missing', b: 'battery:a' }); expect(solveCircuit(c).status).toBe('invalid')
    c.wires = []; c.parts[1].kind = 'battery'; c.parts[1].value = 6; expect(solveCircuit(c).status).toBe('invalid')
    expect(solveCircuit({ parts: [], wires: [] }).status).toBe('empty')
  })
})
