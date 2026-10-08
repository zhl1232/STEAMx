import { describe, expect, it } from 'vitest'
import type { Project } from '@/lib/mappers/types'
import { applyLedCardContent } from './led-card'
import { buildProjectJsonLd } from '@/lib/seo/json-ld'

const original: Project = {
  id: 149,
  title: 'LED 发光贺卡',
  author: '原作者',
  author_id: 'author-149',
  image: '/projects/generated/project-0149-guide.webp',
  category: '工程',
  likes: 7,
  status: 'approved',
  moderation_state: 'approved',
  challenge_id: 31,
  createdAt: '2026-09-01T00:00:00Z',
  videoUrl: 'https://assets.example.com/old-led.mp4',
  materials: ['LED 2–3 颗', '裸露电池'],
  steps: [{ title: '原步骤', description: '用胶带固定电池', image_url: '/old-battery.webp' }],
}

describe('project 149 public content', () => {
  it('leaves every other project unchanged', () => {
    const other = { ...original, id: 150 }
    expect(applyLedCardContent(other)).toBe(other)
  })

  it('preserves identity, author, review gates and record/challenge metadata without mutating source content', () => {
    const before = structuredClone(original)
    const revised = applyLedCardContent(original)
    expect(original).toEqual(before)
    for (const key of ['id', 'title', 'author', 'author_id', 'category', 'likes', 'status', 'moderation_state', 'challenge_id', 'createdAt'] as const) {
      expect(revised[key]).toEqual(original[key])
    }
    expect(revised.steps?.map(step => step.title)).toEqual(['画图案', '贴电路', '装灯', '做开关', '测试装饰'])
    expect(revised.faq).toHaveLength(3)
    expect(revised.description).toContain('打开会亮、合上会灭')
    expect(revised.steps?.[3].description).toContain('铰接在左页')
    expect(revised.steps?.[3].description).toContain('盖条只粘两端')
    expect(revised.steps?.[3].description).toContain('调整条长和盖条松紧')
    expect(revised.steps?.[0].image_url).toBe('/projects/steps/project-0149-design-blue-20261008.webp')
    expect(revised.videoUrl).toBeNull()
    expect(revised.image).toBe('/projects/generated/project-0149-led-star-cover-20261008.webp')
    expect(revised.steps?.some(step => step.image_url === '/old-battery.webp')).toBe(false)
  })

  it('keeps HowTo and visible FAQ on the same revised data instead of old media and inferred answers', () => {
    const revised = applyLedCardContent(original)
    const jsonLd = buildProjectJsonLd(revised)
    const graph = jsonLd['@graph'] ?? []
    const howTo = graph.find(item => item['@type'] === 'HowTo')
    const faq = graph.find(item => item['@type'] === 'FAQPage')
    expect(howTo).toMatchObject({
      supply: revised.materials?.map(name => ({ '@type': 'HowToSupply', name })),
      step: revised.steps?.map((step, index) => ({ '@type': 'HowToStep', position: index + 1, name: step.title, text: [step.description, step.checkpoint].filter(Boolean).join('\n'), ...(step.image_url ? { image: expect.any(String) } : {}) })),
    })
    expect(faq).toMatchObject({
      mainEntity: revised.faq?.map(item => ({ '@type': 'Question', name: item.question, acceptedAnswer: { '@type': 'Answer', text: item.answer } })),
    })
    expect(JSON.stringify(jsonLd)).not.toContain('old-battery.webp')
    expect(JSON.stringify(jsonLd)).not.toContain('old-led.mp4')
  })
})
