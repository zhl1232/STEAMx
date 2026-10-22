import { describe, expect, it } from 'vitest'
import type { Project } from '@/lib/mappers/types'
import fixtures from '@/__tests__/fixtures/project-video-pilot.json'
import { getProjectVideoPresentationPilot } from './video-presentation-pilot'

const motor = fixtures[0] as Project

describe('project video presentation pilot', () => {
  it('recognizes only the reviewed motor source without changing stored content', () => {
    const original = structuredClone(motor)
    const pilot = getProjectVideoPresentationPilot(motor)!
    expect(pilot.chapters.map(chapter => chapter.seconds)).toEqual([3, 6, 49, 80, 94, 124])
    expect(pilot.materials).not.toContain(motor.materials![0])
    expect(pilot.reminder).toContain('一头半刮，另一头完全刮干净')
    expect(pilot.reminder).toContain('孔朝上')
    expect(pilot.durationLabel).toContain('不是制作耗时')
    expect(motor).toEqual(original)
    expect(getProjectVideoPresentationPilot({ ...motor, videoUrl: encodeURI(motor.videoUrl!) })).toEqual(pilot)
  })

  it.each([
    { id: 892 }, { id: 501 }, { title: '新标题' }, { category: '科学' },
    { videoUrl: 'https://example.org/replacement.mp4' }, { videoUrl: 'https://' },
    { videoUrl: null },
    { steps: [{ title: '绕线', description: '把线绕成线圈。' }] },
    { steps: [{ ...motor.steps![0], description: '新的操作说明' }] },
    { steps: [{ ...motor.steps![0], image_url: '/instruction.webp' }] },
    { steps: [...motor.steps!, { title: '绕线', description: '把线绕成线圈。' }] },
  ])('leaves other identities, sources and genuine instructions intact: %j', patch => {
    expect(getProjectVideoPresentationPilot({ ...motor, ...patch })).toBeNull()
  })

  it('leaves all four 892 actions, timings, reset and safety text untouched', () => {
    const project = structuredClone(fixtures[1]) as Project
    expect(getProjectVideoPresentationPilot(project)).toBeNull()
    expect(project).toEqual(fixtures[1])
    expect(project.steps).toHaveLength(4)
    expect(project.steps![1].description).toContain('10—16 秒')
    expect(project.steps![2].description).toContain('16—24 秒')
    expect(project.steps![0].description).toContain('不勒住手指')
    expect(project.steps![3].description).toContain('先松开复位')
  })
})
