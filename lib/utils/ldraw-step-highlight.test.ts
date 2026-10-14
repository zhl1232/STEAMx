import { describe, expect, it, vi } from 'vitest'
import type { Material } from 'three'
import { Color, BoxGeometry, BufferAttribute, BufferGeometry, Group, LineBasicMaterial, LineSegments, Mesh, MeshStandardMaterial } from 'three'
import { LDrawConditionalLineMaterial } from 'three/examples/jsm/materials/LDrawConditionalLineMaterial.js'
import { createLdrawStepHighlight, stepEdgePulseColor } from './ldraw-step-highlight'
import { createLdrawEdgeRenderer } from './ldraw-edges'

function makeStep<T extends Material = LineBasicMaterial>(edge: T = new LineBasicMaterial({ color: '#334155', opacity: 0.7, transparent: true }) as unknown as T) {
  const step = new Group()
  const face = new MeshStandardMaterial({ color: '#1e5aa8' })
  const geometry = new BoxGeometry()
  const mesh = new Mesh(geometry, face)
  const line = new LineSegments(geometry, edge)
  step.add(mesh, line)
  return { step, face, mesh, geometry, line, edge }
}

describe('LDraw current-step edge hint', () => {
  it('keeps current edges native and reuses softened earlier edges without changing faces, geometry or batches', () => {
    const sharedEdge = new LineBasicMaterial({ color: '#334155', opacity: 0.7, transparent: true })
    const first = makeStep(sharedEdge)
    const second = makeStep(sharedEdge)
    const faceBefore = first.face.toJSON()
    const edgeBefore = sharedEdge.toJSON()
    const clone = vi.spyOn(sharedEdge, 'clone')
    first.step.position.set(1, 2, 3)
    first.step.rotation.set(0.2, 0.4, 0.6)
    const transform = first.step.quaternion.clone()
    const hint = createLdrawStepHighlight({ reducedMotion: true })
    hint.registerStep(0, first.step)
    hint.registerStep(1, second.step)

    hint.setStep(1)
    const muted = first.line.material as LineBasicMaterial
    expect(muted).not.toBe(sharedEdge)
    expect(muted.color.getHexString()).toBe(sharedEdge.color.getHexString())
    expect(muted.opacity).toBeCloseTo(sharedEdge.opacity * 0.25)
    expect(muted.transparent).toBe(true)
    expect(muted.depthWrite).toBe(false)
    expect(muted.depthTest).toBe(sharedEdge.depthTest)
    expect(muted.toneMapped).toBe(sharedEdge.toneMapped)
    expect(second.line.material).toBe(sharedEdge)
    expect(first.face.toJSON()).toEqual(faceBefore)
    expect(sharedEdge.toJSON()).toEqual(edgeBefore)
    expect(first.mesh.material).toBe(first.face)
    expect(first.line.geometry).toBe(first.geometry)
    expect(first.step.children).toEqual([first.mesh, first.line])
    expect(first.step.position.toArray()).toEqual([1, 2, 3])
    expect(first.step.quaternion.equals(transform)).toBe(true)

    hint.setStep(0)
    expect(first.line.material).toBe(sharedEdge)
    expect(second.line.material).toBe(sharedEdge)
    hint.setStep(1)
    expect(first.line.material).toBe(muted)
    expect(second.line.material).toBe(sharedEdge)
    expect(clone).toHaveBeenCalledOnce()
    hint.dispose()
  })

  it('keeps the latest requested step through late loads and clears hints on empty or out-of-model pages', () => {
    const first = makeStep()
    const last = makeStep()
    const hint = createLdrawStepHighlight({ reducedMotion: true })
    hint.setStep(2)
    hint.registerStep(0, first.step)
    expect(first.line.material).toBe(first.edge)

    hint.registerStep(2, last.step)
    expect(last.line.material).toBe(last.edge)
    expect(first.line.material).not.toBe(first.edge)

    const intermediate = makeStep()
    intermediate.step.visible = false
    hint.registerStep(1, intermediate.step)
    expect(intermediate.line.material).not.toBe(intermediate.edge)
    expect((intermediate.line.material as LineBasicMaterial).opacity).toBeCloseTo(intermediate.edge.opacity * 0.25)
    expect(intermediate.step.visible).toBe(false)
    expect(first.line.material).not.toBe(first.edge)

    const future = makeStep()
    future.step.visible = false
    hint.registerStep(4, future.step)
    expect(future.line.material).toBe(future.edge)
    expect(future.step.visible).toBe(false)
    hint.setStep(0)
    expect(first.line.material).toBe(first.edge)
    expect(intermediate.line.material).toBe(intermediate.edge)
    expect(last.line.material).toBe(last.edge)
    hint.setStep(2)
    expect(first.line.material).not.toBe(first.edge)

    hint.registerStep(3, new Group())
    hint.setStep(3)
    expect(first.line.material).toBe(first.edge)
    expect(intermediate.line.material).toBe(intermediate.edge)
    hint.setStep(12)
    expect(last.line.material).toBe(last.edge)
    hint.dispose()
  })

  it('softens conditional lines through their own opacity uniform while retaining colour, geometry and shader', () => {
    const source = new LDrawConditionalLineMaterial()
    source.opacity = 0.6
    source.transparent = true
    source.depthWrite = false
    const geometry = new BufferGeometry()
    for (const name of ['position', 'control0', 'control1', 'direction']) {
      geometry.setAttribute(name, new BufferAttribute(new Float32Array([0, 0, 0, 1, 1, 1]), 3))
    }
    const originalAttributes = { ...geometry.attributes }
    const line = new LineSegments(geometry, source)
    Object.assign(line, { isConditionalLine: true })
    const step = new Group()
    step.add(line)
    const hint = createLdrawStepHighlight({ reducedMotion: true })
    hint.registerStep(0, step)
    hint.registerStep(1, makeStep().step)
    hint.setStep(1)

    expect(line.material).toBeInstanceOf(LDrawConditionalLineMaterial)
    expect(line.material).not.toBe(source)
    const muted = line.material as LDrawConditionalLineMaterial
    expect(muted.uniforms.diffuse.value.getHexString()).toBe(source.uniforms.diffuse.value.getHexString())
    expect(source.uniforms.diffuse.value.getHexString()).toBe('ffffff')
    expect(muted.uniforms).not.toBe(source.uniforms)
    expect(muted.uniforms.diffuse.value).not.toBe(source.uniforms.diffuse.value)
    expect(muted.vertexShader).toBe(source.vertexShader)
    expect(muted.fragmentShader).toBe(source.fragmentShader)
    expect(muted.opacity).toBeCloseTo(0.15)
    expect(muted.uniforms.opacity.value).toBe(muted.opacity)
    expect(source.opacity).toBe(0.6)
    expect(muted.transparent).toBe(true)
    expect(muted.depthWrite).toBe(false)
    expect(geometry.attributes).toEqual(originalAttributes)
    expect(line.geometry).toBe(geometry)
    hint.setStep(null)
    expect(line.material).toBe(source)
    hint.dispose()
  })

  it('restores multi-material arrays and releases only owned hint materials once', () => {
    const a = new LineBasicMaterial({ color: '#111111' })
    const b = new LineBasicMaterial({ color: '#777777' })
    const source = [a, b]
    const geometry = new BoxGeometry()
    const line = new LineSegments(geometry, source)
    const step = new Group()
    step.add(line)
    const hint = createLdrawStepHighlight({ reducedMotion: true })
    hint.registerStep(0, step)
    hint.registerStep(1, makeStep().step)
    hint.setStep(1)
    const variants = line.material as LineBasicMaterial[]
    const disposeVariants = variants.map((material) => vi.spyOn(material, 'dispose'))
    const disposeSource = [vi.spyOn(a, 'dispose'), vi.spyOn(b, 'dispose')]
    const disposeGeometry = vi.spyOn(geometry, 'dispose')

    hint.dispose()
    hint.dispose()
    expect(line.material).toBe(source)
    for (const spy of disposeVariants) expect(spy).toHaveBeenCalledOnce()
    for (const spy of disposeSource) expect(spy).not.toHaveBeenCalled()
    expect(disposeGeometry).not.toHaveBeenCalled()
    hint.registerStep(1, step)
    hint.setStep(1)
    expect(line.material).toBe(source)
  })

  it('restores a replaced earlier model and softens the replacement', () => {
    const oldStep = makeStep()
    const replacement = makeStep()
    const hint = createLdrawStepHighlight({ reducedMotion: true })
    hint.registerStep(0, oldStep.step)
    hint.registerStep(1, makeStep().step)
    hint.setStep(1)
    hint.registerStep(0, replacement.step)
    expect(oldStep.line.material).toBe(oldStep.edge)
    expect(replacement.line.material).not.toBe(replacement.edge)
    hint.dispose()
    expect(replacement.line.material).toBe(replacement.edge)
  })

  it.each([
    ['4268', '71', '#9ba19d', '#333333'],
    ['3811', '0', '#1b2a34', '#808080'],
  ])('retains plate %s native stud edges after batching so its surface still reads as its real colour', (partId, code, color, edgeColor) => {
    const step = new Group()
    const plate = new Group()
    plate.userData.fileName = `parts/${partId}.dat`
    const geometry = new BoxGeometry(160, 8, 160)
    const face = new MeshStandardMaterial({ color })
    const edge = new LineBasicMaterial({ color: edgeColor })
    edge.userData.code = code
    const faceBefore = face.toJSON()
    const edgeBefore = edge.toJSON()
    plate.add(new Mesh(geometry, face), new LineSegments(geometry, edge))
    step.add(plate)
    const edgeRenderer = createLdrawEdgeRenderer(() => face)
    edgeRenderer.prepare(step)
    const batched = step.children.find(object => (object as LineSegments).isLineSegments) as LineSegments
    expect(batched.material).toBe(edge)

    const previous = makeStep()
    const hint = createLdrawStepHighlight({ reducedMotion: true })
    hint.registerStep(0, previous.step)
    hint.registerStep(1, step)
    hint.setStep(1)
    expect(batched.material).toBe(edge)
    expect(edge.toJSON()).toEqual(edgeBefore)
    expect(face.toJSON()).toEqual(faceBefore)
    expect(previous.line.material).not.toBe(previous.edge)
    hint.dispose()
    edgeRenderer.dispose()
  })
})

describe('current-step edge motion', () => {
  it('animates only new edges, keeps occlusion and original colours, then settles without more frames', () => {
    let time = 100
    const invalidate = vi.fn()
    const hint = createLdrawStepHighlight({ now: () => time, invalidate })
    const old = makeStep()
    const current = makeStep()
    const extra = makeStep()
    current.step.add(extra.step)
    const before = current.face.toJSON()
    hint.registerStep(0, old.step)
    hint.registerStep(1, current.step)
    hint.setStep(1)
    const animated = current.line.material as LineBasicMaterial
    expect(animated).not.toBe(current.edge)
    expect(animated.depthTest).toBe(true)
    expect(animated.depthWrite).toBe(false)
    expect(animated.color.equals(current.edge.color)).toBe(true)
    time += 600
    expect(hint.update()).toBe(true)
    expect(animated.opacity).toBeCloseTo(1)
    expect(animated.color.getHexString()).toBe('e54b38')
    expect((extra.line.material as LineBasicMaterial).opacity).toBeCloseTo(1)
    expect((old.line.material as LineBasicMaterial).opacity).toBeCloseTo(old.edge.opacity * 0.25)
    expect(current.face.toJSON()).toEqual(before)
    expect(current.mesh.material).toBe(current.face)
    time += 600
    expect(hint.update()).toBe(false)
    expect(current.line.material).toBe(current.edge)
    invalidate.mockClear()
    expect(hint.update()).toBe(false)
    expect(invalidate).not.toHaveBeenCalled()
    hint.dispose()
  })

  it('cancels rapid navigation and ignores late non-selected steps without restarting the current pulse', () => {
    let time = 0
    const hint = createLdrawStepHighlight({ now: () => time })
    const first = makeStep()
    const last = makeStep()
    hint.registerStep(0, first.step)
    hint.setStep(0)
    hint.setStep(3)
    expect(first.line.material).toBe(first.edge)
    expect(hint.update()).toBe(false)
    hint.registerStep(3, last.step)
    time = 600
    hint.registerStep(1, makeStep().step)
    hint.update()
    expect((last.line.material as LineBasicMaterial).opacity).toBeCloseTo(1)
    hint.setStep(0)
    expect(last.line.material).toBe(last.edge)
    hint.setStep(5)
    expect(first.line.material).toBe(first.edge)
    hint.registerStep(5, new Group())
    expect(hint.update()).toBe(false)
    hint.dispose()
  })

  it('immediately settles on reduced motion, restores on disposal and does not mutate shared conditional sources', () => {
    let time = 0
    const source = new LDrawConditionalLineMaterial()
    source.opacity = 0.8
    const first = makeStep(source)
    const second = makeStep(source)
    const hint = createLdrawStepHighlight({ now: () => time })
    hint.registerStep(0, first.step)
    hint.registerStep(1, second.step)
    hint.setStep(1)
    const animated = second.line.material as LDrawConditionalLineMaterial
    const dispose = vi.spyOn(animated, 'dispose')
    time = 600
    hint.update()
    expect(animated.uniforms.opacity.value).toBeCloseTo(1)
    expect(source.opacity).toBe(0.8)
    hint.setReducedMotion(true)
    expect(second.line.material).toBe(source)
    expect(hint.update()).toBe(false)
    hint.setStep(0)
    expect(first.line.material).toBe(source)
    expect(hint.update()).toBe(false)
    hint.dispose()
    hint.dispose()
    expect(dispose).toHaveBeenCalledOnce()
    expect(second.line.material).toBe(source)
    expect(hint.update()).toBe(false)
  })
})

it('uses a light warm edge on red faces and coral on pale faces without changing the source', () => {
  const face = new Color('#b40000')
  expect(stepEdgePulseColor(face)).toBe('#ffe3c4')
  expect(stepEdgePulseColor(new Color('#720012'))).toBe('#ffe3c4')
  expect(stepEdgePulseColor(new Color('#ffffff'))).toBe('#e54b38')
  let time = 0
  const current = makeStep()
  current.edge.userData.code = '4'
  const original = current.edge.color.clone()
  const hint = createLdrawStepHighlight({ now: () => time, getFaceColor: code => code === '4' ? face : undefined })
  hint.registerStep(0, current.step)
  hint.setStep(0)
  time = 600
  hint.update()
  expect((current.line.material as LineBasicMaterial).color.getHexString()).toBe('ffe3c4')
  expect(current.edge.color.equals(original)).toBe(true)
  expect(face.getHexString()).toBe('b40000')
  time = 1200
  expect(hint.update()).toBe(false)
  expect(current.line.material).toBe(current.edge)
  hint.dispose()
})

it('keeps face colour identity on generated fallback edges for red-part contrast', () => {
  const face = new MeshStandardMaterial({ color: '#b40000' })
  face.userData.code = '4'
  const step = new Group()
  step.add(new Mesh(new BoxGeometry(), face))
  const renderer = createLdrawEdgeRenderer(() => face)
  renderer.prepare(step)
  let time = 0
  const hint = createLdrawStepHighlight({now: () => time, getFaceColor: code => code === '4' ? face.color : undefined})
  hint.registerStep(0, step)
  hint.setStep(0)
  time = 600
  hint.update()
  const line = step.children.find(object => (object as LineSegments).isLineSegments) as LineSegments
  expect((line.material as LineBasicMaterial).color.getHexString()).toBe('ffe3c4')
  hint.dispose()
  renderer.dispose()
})
