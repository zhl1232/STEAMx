import { afterEach, describe, expect, it, vi } from 'vitest'
import source from '@/__tests__/fixtures/project-210.json'
import { mapDbProject } from '@/lib/mappers/types'
import { mapProject, mapProjectWithDetails, type DbProject } from '@/lib/mappers/project'
import imageReviews from './image-reviews.data.json'
import { collectHeroGalleryImages } from './hero-gallery'
import { applyProjectImageReview, getProjectCoverPresentation, RUBBER_BAND_FAN_DIAGRAM } from './image-presentation'

afterEach(() => vi.unstubAllEnvs())

describe('reviewed project images', () => {
  it('has unique project identities and exact reviewed asset paths', () => {
    expect(imageReviews).toHaveLength(190)
    expect(new Set(imageReviews.map(review => review.id)).size).toBe(imageReviews.length)
    for (const review of imageReviews) {
      expect(review.covers.length).toBeGreaterThan(0)
      expect(review.replacementCover).not.toBe('')
      expect(review.title).not.toBe('')
      expect(review.category).not.toBe('')
      for (const retained of review.retainedStepImages ?? []) expect(review.stepImages).not.toContain(retained)
    }
  })

  it.each(imageReviews)('replaces only registered cover and step paths for $id', review => {
    for (const image of review.covers) {
      const project = { id: review.id, title: review.title, category: review.category, image,
        steps: review.stepImages.map(image_url => ({ title: '原步骤', description: '原文', image_url })) }
      const snapshot = structuredClone(project)
      const revised = applyProjectImageReview(project)
      expect(revised.image).toBe(review.replacementCover)
      expect(revised.steps.every(step => !step.image_url)).toBe(true)
      expect(project).toEqual(snapshot)
      expect(applyProjectImageReview(revised)).toBe(revised)
      expect(mapDbProject({ id: review.id, title: review.title, category: review.category, image_url: image } as Parameters<typeof mapDbProject>[0]).image).toBe(review.replacementCover)
      const dbProject = { id: review.id, title: review.title, category: review.category, image_url: image } as DbProject
      expect(mapProject(dbProject).image).toBe(review.replacementCover)
      expect(mapProjectWithDetails(dbProject).image).toBe(review.replacementCover)
      expect(applyProjectImageReview({ ...project, id: -1 }).image).toBe(image)
      expect(applyProjectImageReview({ ...project, title: '新标题' }).image).toBe(image)
      expect(applyProjectImageReview({ ...project, category: '新分类' }).image).toBe(image)
      const newPhotos = { ...project, image: '/uploads/new-cover.png', steps: [{ title: '新步骤', description: '新原文', image_url: '/uploads/new-step.png' }] }
      expect(applyProjectImageReview(newPhotos)).toBe(newPhotos)
    }
    if (review.replacementCover !== RUBBER_BAND_FAN_DIAGRAM) {
      expect(getProjectCoverPresentation(review.replacementCover)).toEqual({ notice: '步骤概览，具体操作见下方说明。', fit: 'contain' })
    }
  })

  it('replaces the misleading cover and prevents the inconsistent step set from becoming fallback media', () => {
    const reviewed = applyProjectImageReview(source)
    expect(reviewed.image).toBe(RUBBER_BAND_FAN_DIAGRAM)
    expect(reviewed.steps.every(step => !step.image_url)).toBe(true)
    expect(collectHeroGalleryImages(reviewed.image, reviewed.steps)).toEqual([{ url: RUBBER_BAND_FAN_DIAGRAM }])
    expect(source.steps.every(step => step.image_url)).toBe(true)
    expect(applyProjectImageReview(reviewed)).toBe(reviewed)
  })

  it('retains reviewed diagrams even when adjacent photo illustrations are retired', () => {
    for (const review of imageReviews.filter(entry => entry.retainedStepImages?.length)) {
      const kept = review.retainedStepImages!.map(image_url => ({ title: '原理图', description: '按图核对', image_url }))
      const removed = review.stepImages.map(image_url => ({ title: '旧配图', description: '操作说明', image_url }))
      const project = { ...review, image: review.covers[0], steps: [...kept, ...removed] }
      const revised = applyProjectImageReview(project)
      expect(revised.steps.filter(step => step.image_url)).toEqual(kept)
      expect(revised.image).toBe(review.replacementCover)
    }
  })

  it('applies the same reviewed cover to mapped list cards and detail content', () => {
    const row = { id: source.id, title: source.title, category: source.category, image_url: source.image }
    expect(mapDbProject(row as Parameters<typeof mapDbProject>[0]).image).toBe(RUBBER_BAND_FAN_DIAGRAM)
  })

  it.each([{ id: 211 }, { title: '新的项目' }, { category: '科学' }])('does not guess ownership from filenames: %j', patch => {
    const other = { ...source, ...patch }
    expect(applyProjectImageReview(other)).toBe(other)
  })

  it('preserves replacement photos and untouched steps, including when a video is added', () => {
    const replacement = { ...source, image: '/uploads/fan.webp', videoUrl: '/fan.mp4', steps: [{ title: '固定端', description: '新说明', image_url: '/uploads/anchor.webp' }] }
    expect(applyProjectImageReview(replacement)).toBe(replacement)
    const mixed = applyProjectImageReview({ ...replacement, steps: [source.steps[0], replacement.steps[0]] })
    expect(mixed.image).toBe(replacement.image)
    expect(mixed.steps[0].image_url).toBeUndefined()
    expect(mixed.steps[1]).toEqual(replacement.steps[0])
  })

  it.each([
    { id: 343, title: '几何印章肥皂雕刻', category: '艺术', image: '/projects/corrections/20260915-project-343-stamp.png', stepImages: [] },
    { id: 378, title: '数字黑洞 6174', category: '数学', image: '/projects/corrections/20260915-project-378-kaprekar-four-digit.png', stepImages: ['/projects/corrections/20260915-project-378-kaprekar-four-digit.png', '/projects/corrections/20260915-project-378-kaprekar-three-digit.png'] },
    { id: 158, title: '光控小夜灯', category: '技术', image: '/uploads/new-cover.png', stepImages: ['/projects/corrections/20260915-project-158-circuit.png'] },
    { id: 149, title: 'LED 发光贺卡', category: '技术', image: '/uploads/new-cover.png', stepImages: ['/assets/projects/led-card-slider.svg'] },
  ])('keeps existing corrected PNG/SVG images for $id', ({ stepImages, ...identity }) => {
    const project = { ...identity, steps: stepImages.map(image_url => ({ title: '已修正', description: '说明', image_url })) }
    expect(applyProjectImageReview(project)).toBe(project)
  })

  it('recognizes proxy and configured CDN forms without touching an unrelated origin', () => {
    vi.stubEnv('ASSETS_BASE_URL', 'https://assets.example.test/library')
    const proxied = applyProjectImageReview({ ...source, image: `/api/assets${source.image}?v=1` })
    expect(proxied.image).toBe(RUBBER_BAND_FAN_DIAGRAM)
    const cdn = applyProjectImageReview({ ...source, image: `https://assets.example.test/library${source.image}` })
    expect(cdn.image).toBe(RUBBER_BAND_FAN_DIAGRAM)
    const uploaded = `https://uploads.example.test${source.image}`
    expect(applyProjectImageReview({ ...source, image: uploaded }).image).toBe(uploaded)
  })

  it('labels generated covers and keeps the principle diagram uncropped', () => {
    expect(getProjectCoverPresentation(source.image).notice).toContain('生成示意图')
    expect(getProjectCoverPresentation(RUBBER_BAND_FAN_DIAGRAM)).toEqual({ notice: '原理示意图，不是装配图。连接结构仍需核对。', fit: 'contain' })
    expect(getProjectCoverPresentation('/uploads/real-photo.jpg')).toEqual({ fit: 'cover' })
  })
})
