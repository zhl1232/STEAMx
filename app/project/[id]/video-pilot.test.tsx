import { isValidElement, type ReactElement, type ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/api/explore-data', () => ({
  getProjectById: vi.fn(),
  getProjectCompletions: vi.fn().mockResolvedValue([{ id: 77, projectId: 1301, title: '旧完成记录' }]),
  getProjectCompletionsCount: vi.fn().mockResolvedValue(1),
  getProjectCollectionsCount: vi.fn().mockResolvedValue(2),
  getProjectTotalCoinsReceived: vi.fn().mockResolvedValue(0),
  getRelatedProjects: vi.fn().mockResolvedValue([]),
}))
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({ auth: { getUser: async () => ({ data: { user: null } }) } }),
}))
vi.mock('@/lib/store/service', () => ({ listStoreProductsForContext: vi.fn().mockResolvedValue([]) }))
vi.mock('@/lib/api/courses', () => ({ getCourseLessonByWorksProjectId: vi.fn().mockResolvedValue(null) }))

import ProjectDetailPage, { generateMetadata } from './page'
import { getProjectById, getProjectCompletions } from '@/lib/api/explore-data'
import type { Project } from '@/lib/mappers/types'
import fixtures from '@/__tests__/fixtures/project-video-pilot.json'
import { ProjectDemoVideo } from '@/components/features/project/project-demo-video'
import { ProjectHeroGallery } from '@/components/features/project/project-hero-gallery'
import { MobileProjectSteps } from '@/components/features/project/mobile-project-steps'
import { ProjectExplorationRecordsBlock } from '@/components/features/project/project-exploration-records'
import { ProjectInteractions } from '@/components/features/project-interactions'
import { getScienceSample, scienceSampleIds } from '@/lib/project/science-samples'
import { ScienceProjectNotes } from '@/components/features/project/science-project-notes'
import { ProjectFaq } from '@/components/features/project/project-faq'
import { JsonLd } from '@/components/seo/json-ld'
import fanSource from '@/__tests__/fixtures/project-210.json'
import { applyProjectContentRevision } from '@/lib/project/content-revisions'
import { applyProjectImageReview, RUBBER_BAND_FAN_DIAGRAM } from '@/lib/project/image-presentation'

function elements(node: ReactNode): ReactElement<Record<string, unknown>>[] {
  if (Array.isArray(node)) return node.flatMap(elements)
  if (!isValidElement<Record<string, unknown>>(node)) return []
  return [node, ...elements(node.props.children as ReactNode)]
}

async function pageFor(project: Project) {
  vi.mocked(getProjectById).mockResolvedValue({ ...project, author_id: '', author: '' })
  return elements(await ProjectDetailPage({ params: Promise.resolve({ id: String(project.id) }) }))
}

describe('project detail pilot integration', () => {
  it('shows the no-video fan as structure checks, with consistent media and no HowTo claim', async () => {
    const project = applyProjectContentRevision(applyProjectImageReview(fanSource as Project))
    const nodes = await pageFor({ ...project, status: 'approved', moderation_state: 'approved' })
    const galleries = nodes.filter(node => node.type === ProjectHeroGallery)
    expect(galleries).toHaveLength(2)
    for (const gallery of galleries) {
      expect(gallery.props.images).toEqual([RUBBER_BAND_FAN_DIAGRAM])
      expect(gallery.props.imageFit).toBe('contain')
      expect(gallery.props.videoSrc).toBeFalsy()
      expect(gallery.props.captions).toEqual(['原理示意图，不是装配图。连接结构仍需核对。'])
    }
    const mobileSteps = nodes.find(node => node.type === MobileProjectSteps)!
    expect(mobileSteps.props.title).toBe('结构核对')
    expect(mobileSteps.props.practicePending).toBe(true)
    expect(mobileSteps.props.steps).toEqual(project.steps)
    expect(nodes.some(node => String(node.props.title).startsWith('结构核对（共 4 项）'))).toBe(true)
    const jsonLd = JSON.stringify(nodes.find(node => node.type === JsonLd)!.props.data)
    expect(jsonLd).not.toContain('HowTo')
    expect(jsonLd).not.toContain('step-333')
    expect(jsonLd).toContain(RUBBER_BAND_FAN_DIAGRAM)
    expect(nodes.filter(node => node.type === ProjectExplorationRecordsBlock).every(node => node.props.projectId === 210)).toBe(true)
  })

  it('keeps unrelated no-video instructions and labels only their generated cover', async () => {
    const project = {
      ...fixtures[1], id: 503, title: '纸带折叠', videoUrl: null,
      image: '/projects/generated/project-0503-guide.webp', description: '把纸带来回折叠。',
      steps: [{ title: '折叠纸带', description: '沿折线来回折叠纸带。', image_url: '/uploads/paper-step.webp' }],
    } as Project
    const nodes = await pageFor(project)
    const galleries = nodes.filter(node => node.type === ProjectHeroGallery)
    expect(galleries.every(node => node.props.videoSrc == null)).toBe(true)
    expect(galleries.every(node => (node.props.captions as string[])[0] === '封面为生成示意图，不代表实物验证。')).toBe(true)
    expect(nodes.find(node => node.type === MobileProjectSteps)?.props.steps).toEqual(project.steps)
    const jsonLd = JSON.stringify(nodes.find(node => node.type === JsonLd)!.props.data)
    expect(jsonLd).toContain('HowToStep')
    expect(jsonLd).toContain('/uploads/paper-step.webp')
  })

  it('places preparation before the tutorial in both layouts and removes only the placeholder shell', async () => {
    const nodes = await pageFor(fixtures[0] as Project)
    expect(nodes.filter(node => node.type === MobileProjectSteps)).toHaveLength(0)
    expect(nodes.filter(node => node.type === ProjectHeroGallery).every(node => node.props.videoSrc === null)).toBe(true)
    const players = nodes.filter(node => node.type === ProjectDemoVideo)
    expect(players).toHaveLength(2)
    expect(players.every(node => node.props.videoLabel === '制作视频')).toBe(true)
    for (const suffix of ['-mobile', '']) {
      const materials = nodes.findIndex(node => node.props.id === `project-materials${suffix}`)
      const video = nodes.findIndex(node => node.props.id === `project-steps${suffix}`)
      expect(materials).toBeGreaterThan(-1)
      expect(video).toBeGreaterThan(materials)
    }
    const jsonLd = JSON.stringify(nodes.find(node => node.type === JsonLd)!.props.data)
    expect(jsonLd).not.toContain('观看实验视频')
    expect(jsonLd).not.toContain('HowToStep')
    expect(jsonLd).toContain('泡沫底板')
    expect(jsonLd).not.toContain('对应实验材料包')
    const metadata = await generateMetadata({ params: Promise.resolve({ id: '1301' }) })
    expect(metadata.description).toContain('制作视频')
    expect(metadata.description).not.toContain('演示视频')
  })

  it('keeps historical records and interaction targets on the original project', async () => {
    const nodes = await pageFor(fixtures[0] as Project)
    expect(getProjectCompletions).toHaveBeenCalledWith(1301, 8, { onePerUser: true })
    const records = nodes.filter(node => node.type === ProjectExplorationRecordsBlock)
    expect(records).toHaveLength(2)
    for (const record of records) {
      expect(record.props.projectId).toBe(1301)
      expect(record.props.completions).toEqual([{ id: 77, projectId: 1301, title: '旧完成记录' }])
      expect(record.props.viewingGuide).toBe(false)
    }
    expect(nodes.find(node => node.type === ProjectInteractions)!.props.projectId).toBe(1301)
  })

  it.each([
    fixtures[1] as Project,
    { ...fixtures[0], id: 501, title: '单步骤项目', steps: [{ title: '折纸带', description: '把纸带折成折扇形。' }] } as Project,
    { ...fixtures[0], id: 502, title: '其他占位项目' } as Project,
  ])('retains normal video and steps for $title', async project => {
    const nodes = await pageFor(project)
    expect(nodes.filter(node => node.type === ProjectDemoVideo)).toHaveLength(0)
    expect(nodes.filter(node => node.type === ProjectHeroGallery).every(node => Boolean(node.props.videoSrc))).toBe(true)
    const steps = nodes.find(node => node.type === MobileProjectSteps)!.props.steps
    expect(steps).toEqual(project.steps)
    const jsonLd = JSON.stringify(nodes.find(node => node.type === JsonLd)!.props.data)
    if (Number(project.id) !== 502) expect(jsonLd).toContain('HowToStep')
  })
})

describe('project FAQ deduplication in both layouts', () => {
  const sample = getScienceSample(1219)!
  const project = { ...fixtures[0], ...sample, category: '科学' } as Project

  it('keeps bird-in-cage questions in science notes without a second FAQ section', async () => {
    const nodes = await pageFor(project)
    expect(nodes.filter(node => node.type === ScienceProjectNotes)).toHaveLength(2)
    expect(nodes.filter(node => node.type === ProjectFaq)).toHaveLength(0)
    expect(nodes.some(node => node.props.title === '常见问题')).toBe(false)
  })

  it('renders every science sample FAQ only in the notes on both layouts', async () => {
    for (const id of scienceSampleIds()) {
      const current = getScienceSample(id)!
      const nodes = await pageFor({ ...fixtures[0], ...current, category: '科学' } as Project)
      expect(nodes.filter(node => node.type === ScienceProjectNotes), current.title).toHaveLength(2)
      expect(nodes.filter(node => node.type === ProjectFaq), current.title).toHaveLength(0)
    }
  })

  it('preserves extra questions and different answers, ignoring surrounding whitespace for duplicates', async () => {
    const extra = { question: '额外的问题', answer: '额外的答案' }
    const differentAnswer = { ...sample.faq[0], answer: '另一种处理方法' }
    const nodes = await pageFor({ ...project, faq: [
      ...sample.faq.map(item => ({ question: ` ${item.question} `, answer: ` ${item.answer} ` })),
      extra, differentAnswer,
    ] })
    const sections = nodes.filter(node => node.type === ProjectFaq)
    expect(sections).toHaveLength(2)
    for (const section of sections) expect(section.props.items).toEqual([extra, differentAnswer])
  })

  it('keeps the FAQ for projects without science notes', async () => {
    const faq = [{ question: '怎么操作？', answer: '按步骤进行。' }]
    const nodes = await pageFor({ ...fixtures[1], faq } as Project)
    const sections = nodes.filter(node => node.type === ProjectFaq)
    expect(sections).toHaveLength(2)
    for (const section of sections) expect(section.props.items).toEqual(faq)
  })
})
