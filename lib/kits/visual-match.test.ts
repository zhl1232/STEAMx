import { describe, expect, it } from 'vitest'
import { hasKitVisualMatch, projectMaterialKitMatches } from './visual-match'
import type { ExperimentKit, KitProjectRelation } from './types'

const kit = { id: 'k1', revision: 2, cover_url: '/tree.jpg' } as ExperimentKit
const project = { id: '1215', title: '魔法开花树', videoUrl: 'https://assets.test/tree.mp4' }
const visualMatch = {
  projectTitle: project.title, videoUrl: project.videoUrl, videoSha256: 'a'.repeat(64),
  kitCoverUrl: kit.cover_url, kitImageSha256: 'b'.repeat(64), reviewedAt: '2026-10-30',
  scope: 'matching_core_structure', catalogTitle: '魔法圣诞树',
}
const relation = {
  kit_id: 'k1', project_id: 1215, status: 'candidate', kit_revision: 2,
  evidence: { visualMatch },
} as KitProjectRelation

describe('visual kit directory evidence', () => {
  it('recognizes a review tied to the current project video and kit version', () => {
    expect(hasKitVisualMatch(kit, relation, project)).toBe(true)
  })

  it.each([
    { kit_revision: 1 }, { status: 'excluded' }, { project_id: 99 }, { kit_id: 'another-kit' },
    { evidence: undefined }, { evidence: { visualMatch: {} } },
  ])('rejects unavailable or outdated relation evidence: %j', change => {
    expect(hasKitVisualMatch(kit, { ...relation, ...change } as KitProjectRelation, project)).toBe(false)
  })

  it.each([
    { videoUrl: 'https://assets.test/new.mp4' }, { projectTitle: '不同项目' },
    { kitCoverUrl: '/new-tree.jpg' }, { videoSha256: '' }, { kitImageSha256: 'invalid' },
    { reviewedAt: '' }, { scope: 'similar_principle' }, { catalogTitle: '' },
  ])('rejects a changed source or incomplete review: %j', change => {
    expect(hasKitVisualMatch(kit, { ...relation, evidence: { visualMatch: { ...visualMatch, ...change } } }, project)).toBe(false)
  })
})

describe('material links for science content modes', () => {
  const matches = [{ id: 'reviewed', visualMatch: true }, { id: 'candidate', visualMatch: false }]

  it('keeps only visually reviewed links for preparation content', () => {
    expect(projectMaterialKitMatches(matches, { mode: 'preparation' })).toEqual([matches[0]])
  })

  it.each([
    { mode: 'observation' }, { sourceRelation: 'alternative' },
    { mode: 'preparation', sourceRelation: 'alternative' },
  ])('omits links from observation or alternative content: %j', sample => {
    expect(projectMaterialKitMatches(matches, sample)).toEqual([])
  })

  it('preserves ordinary project matching', () => {
    expect(projectMaterialKitMatches(matches)).toBe(matches)
  })
})
