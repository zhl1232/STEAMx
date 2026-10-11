import { describe, expect, it, vi } from 'vitest'
import { BoxGeometry, Color, Group, LineBasicMaterial, LineSegments, Mesh, MeshStandardMaterial } from 'three'
import { LDrawConditionalLineMaterial } from 'three/examples/jsm/materials/LDrawConditionalLineMaterial.js'
import { createLdrawEdgeRenderer, ldrawEdgeColor } from './ldraw-edges'

describe('render-only LDraw edges', () => {
  it.each([
    ['0', '#1b2a34'], ['8', '#545955'], ['72', '#646464'], ['308', '#352100'],
  ])('gives near-black colour %s a 50%% lightened face tint', (code, color) => {
    const face = new Color(color)
    const before = face.clone()
    const edge = new Color(ldrawEdgeColor(face, undefined, code)).convertLinearToSRGB()
    const display = face.clone().convertLinearToSRGB()
    for (const channel of ['r', 'g', 'b'] as const) {
      expect(edge[channel]).toBeCloseTo((display[channel] + 1) / 2, 2)
    }
    expect(face).toEqual(before)
  })
  it('uses the linear luminance threshold for unlisted colours', () => {
    expect(ldrawEdgeColor(new Color(0.059, 0.059, 0.059), new Color('#123456'))).not.toBe('#123456')
    expect(ldrawEdgeColor(new Color(0.06, 0.06, 0.06), new Color('#123456'))).toBe('#123456')
  })
  it.each([
    ['1', '#1e5aa8', '#333333'], ['2', '#00852b', '#333333'],
    ['4', '#b40000', '#333333'], ['70', '#5f3109', '#808080'],
    ['14', '#f2cd37', '#333333'], ['15', '#ffffff', '#333333'],
  ])('preserves native EDGE and render settings for colour %s', (code, color, edge) => {
    const face = new MeshStandardMaterial({ color })
    const source = new LineBasicMaterial({ color: edge })
    source.userData.code = code
    const before = source.toJSON()
    const root = new Group()
    const ordinary = new LineSegments(new BoxGeometry(), source)
    const conditional = new LineSegments(new BoxGeometry(), source)
    Object.assign(conditional, { isConditionalLine: true })
    root.add(ordinary, conditional)
    const renderer = createLdrawEdgeRenderer(() => face)
    renderer.prepare(root)
    expect(ldrawEdgeColor(face.color, source.color, code)).toBe(edge)
    expect((root.children.at(-1) as LineSegments).material).toBe(source)
    expect(conditional.material).toBe(source)
    expect(source.toJSON()).toEqual(before)
    renderer.dispose()
  })
  it.each(['4268', '4196', '6490', '51262', '3811'])('keeps dense stud edges native on plate %s, including nested primitives', (partId) => {
    const root = new Group()
    const plate = new Group()
    plate.userData.fileName = `parts/${partId}.dat`
    const stud = new Group()
    const face = new MeshStandardMaterial({ color: '#1b2a34' })
    const source = new LineBasicMaterial({ color: '#808080' })
    source.userData.code = '0'
    const conditional = new LineSegments(new BoxGeometry(), source)
    Object.assign(conditional, { isConditionalLine: true })
    stud.add(new LineSegments(new BoxGeometry(), source), conditional)
    plate.add(stud)
    root.add(plate, new LineSegments(new BoxGeometry(), source))
    const renderer = createLdrawEdgeRenderer(() => face)
    renderer.prepare(root)
    const lines = root.children.filter((child) => (child as LineSegments).isLineSegments) as LineSegments[]
    expect(lines.map((line) => line.material)).toContain(source)
    expect(conditional.material).toBe(source)
    const brickEdge = lines.find((line) => line.material !== source)!.material as LineBasicMaterial
    expect(brickEdge.color.getHexString()).toBe(ldrawEdgeColor(face.color).slice(1))
    expect(brickEdge.opacity).toBe(0.7)
    renderer.dispose()
  })
  it.each([[160, false], [180, true]])('applies the >64-stud footprint rule to unlisted plates of width %s', (width, native) => {
    const root = new Group()
    const plate = new Group()
    plate.userData.category = 'Plate'
    const face = new MeshStandardMaterial({ color: '#000000' })
    const source = new LineBasicMaterial({ color: '#333333' })
    source.userData.code = '0'
    plate.add(new Mesh(new BoxGeometry(width, 8, 160), face), new LineSegments(new BoxGeometry(), source))
    root.add(plate)
    const renderer = createLdrawEdgeRenderer(() => face)
    renderer.prepare(root)
    expect((root.children.at(-1) as LineSegments).material === source).toBe(native)
    renderer.dispose()
  })
  it('keeps face materials and native geometry intact, merges translated edges and shares across steps', () => {
    const face = new MeshStandardMaterial({ color: '#05131d' })
    const original = face.toJSON()
    const source = new LineBasicMaterial({ color: '#111111' })
    source.userData.code = '0'
    const renderer = createLdrawEdgeRenderer(() => face)
    const make = () => {
      const root = new Group()
      for (const x of [0, 100]) {
        const part = new Group()
        part.position.x = x
        part.add(new Mesh(new BoxGeometry(), face), new LineSegments(new BoxGeometry(), source))
        root.add(part)
      }
      return root
    }
    const first = make(), second = make()
    renderer.prepare(first)
    renderer.prepare(second)
    const line = first.children.at(-1) as LineSegments
    expect(line.isLineSegments).toBe(true)
    expect(line.material).toBe((second.children.at(-1) as LineSegments).material)
    line.geometry.computeBoundingBox()
    expect(line.geometry.boundingBox!.max.x).toBe(100.5)
    expect(face.toJSON()).toEqual(original)
    expect(source.color.getHexString()).toBe('111111')
    expect((first.children[0].children[0] as Mesh).material).toBe(face)
    const dispose = vi.spyOn(line.material as LineBasicMaterial, 'dispose')
    renderer.dispose()
    expect(dispose).toHaveBeenCalledOnce()
  })
  it('adds a 30-degree fallback only to meshes without native lines', () => {
    const root = new Group()
    const face = new MeshStandardMaterial({ color: '#ffffff' })
    const mesh = new Mesh(new BoxGeometry(), face)
    root.add(mesh)
    const renderer = createLdrawEdgeRenderer(() => face)
    renderer.prepare(root)
    const edges = root.children[1] as LineSegments
    expect(edges.geometry.getAttribute('position').count / 2).toBe(12)
    expect(mesh.material).toBe(face)
    renderer.dispose()
  })
  it('preserves conditional attributes and uses a shared conditional shader', () => {
    const root = new Group()
    const source = new LDrawConditionalLineMaterial()
    source.userData.code = '0'
    const line = new LineSegments(new BoxGeometry(), source)
    Object.assign(line, { isConditionalLine: true })
    root.add(line)
    const geometry = line.geometry
    const renderer = createLdrawEdgeRenderer(() => new MeshStandardMaterial({ color: '#000000' }))
    renderer.prepare(root)
    expect(line.geometry).toBe(geometry)
    expect(line.material).toBeInstanceOf(LDrawConditionalLineMaterial)
    expect((line.material as LDrawConditionalLineMaterial & { color: Color }).color.getHexString()).toBe('808080')
    expect((source as LDrawConditionalLineMaterial & { color: Color }).color.getHexString()).toBe('ffffff')
    renderer.dispose()
  })
})
