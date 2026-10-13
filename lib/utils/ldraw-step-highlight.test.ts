import { describe, expect, it, vi } from 'vitest'
import { BoxGeometry, BufferAttribute, BufferGeometry, Group, LineBasicMaterial, LineSegments, Mesh, MeshStandardMaterial } from 'three'
import { LDrawConditionalLineMaterial } from 'three/examples/jsm/materials/LDrawConditionalLineMaterial.js'
import { createLdrawStepHighlight } from './ldraw-step-highlight'
import { createLdrawEdgeRenderer } from './ldraw-edges'

function makeStep(edge = new LineBasicMaterial({ color: '#334155', opacity: 0.7, transparent: true })) {
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
    const hint = createLdrawStepHighlight()
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
    const hint = createLdrawStepHighlight()
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
    const hint = createLdrawStepHighlight()
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
    const hint = createLdrawStepHighlight()
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
    const hint = createLdrawStepHighlight()
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
    const hint = createLdrawStepHighlight()
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
