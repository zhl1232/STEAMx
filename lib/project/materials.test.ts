import { describe, expect, it } from 'vitest'
import type { Project } from '@/lib/mappers/types'
import fixtures from '@/__tests__/fixtures/project-video-pilot.json'
import { applyScienceSample, getScienceSample } from './science-samples'
import { resolveProjectMaterials } from './materials'
import { getProjectVideoPresentationPilot } from './video-presentation-pilot'

const base: Project = { id: 586, title: '气球缆车', category: '科学', author: '', author_id: '', image: '', likes: 0 }

describe('resolveProjectMaterials', () => {
  it('retains quantities and optional materials while separating setup requirements', () => {
    const project = applyScienceSample(base)
    const original = [...project.materials!]
    const result = resolveProjectMaterials(project)
    expect(result.materials).toContain('气球1个')
    expect(result.materials).toContain('打气筒（建议使用）')
    expect(result.materials).not.toContain('两处稳固的绳端固定点')
    expect(result.preparationNotes).toEqual([expect.stringContaining('两把稳固椅子的椅背')])
    expect(project.materials).toEqual(original)
    expect(getScienceSample(586)!.materials).toContain('两处稳固的绳端固定点')
  })

  it('rejoins imported rows split within parentheses without dropping content', () => {
    expect(resolveProjectMaterials({ ...base, materials: ['色素', '自备（纯牛奶', '洗洁精', '盘子）', '滴管'] })).toEqual({
      materials: ['色素', '自备（纯牛奶、洗洁精、盘子）', '滴管'], preparationNotes: [],
    })
  })

  it('keeps the reviewed video pilot materials as the effective material source', () => {
    const motor = fixtures[0] as Project
    expect(resolveProjectMaterials(motor).materials).toEqual(getProjectVideoPresentationPilot(motor)!.materials)
    expect(resolveProjectMaterials({ ...motor, title: '已改名' }).materials).toEqual(motor.materials)
  })

  it('handles absent materials without inventing requirements', () => {
    expect(resolveProjectMaterials(base)).toEqual({ materials: [], preparationNotes: [] })
  })
})
