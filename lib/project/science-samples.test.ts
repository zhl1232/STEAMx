import { afterEach, expect, test, vi } from 'vitest'
import legacy from './science-samples.data.json'
import reviewed from './science-reviewed.data.json'
import type { Project } from '@/lib/mappers/types'
import { applyScienceSample, getScienceSample, getScienceSampleForProject, scienceSampleIds } from './science-samples'
import { buildProjectJsonLd } from '@/lib/seo/json-ld'
import { selectScienceResources, scienceResourceSummary } from '@/lib/seo/science-resources'
const project = (id = 1309): Project => ({ id, title: '牛顿摆', category: '科学', description: '材料与步骤见正文。', image: '', author: '', author_id: 'fixture', likes: 0, videoUrl: 'https://example.org/original.mp4', steps: [{ title: '观看实验视频', description: '请准备好对应实验材料包，跟随本页视频完成操作。' }] })
afterEach(() => vi.unstubAllEnvs())
test.each(['production', 'development'])('reviewed 1309 applies in %s without mutating the input', env => {
  const original = project()
  const sample = reviewed.find(item => item.id === 1309)!
  vi.stubEnv('NODE_ENV', env)
  expect(getScienceSample(1309)).toEqual(sample)
  expect(getScienceSampleForProject(original)).toEqual(sample)
  expect(scienceSampleIds()).toHaveLength(114)
  const result = applyScienceSample(original)
  expect(result).toMatchObject({ description: sample.description, materials: sample.materials, steps: sample.steps, faq: sample.faq, reflection: sample.principle })
  expect(result.steps!.length).toBeGreaterThan(1)
  expect(result.videoUrl).toBe(original.videoUrl)
  expect(original.steps).toHaveLength(1)
  expect(original.description).toBe('材料与步骤见正文。')
  expect(applyScienceSample({ ...original, title: '已改名' }).steps).toHaveLength(1)
  expect(applyScienceSample({ ...original, category: '积木' }).steps).toHaveLength(1)
})
test.each(['production', 'development'])('empty legacy leaves non-reviewed projects unchanged in %s', env => {
  vi.stubEnv('NODE_ENV', env)
  expect(legacy).toEqual([])
  const original = project(710)
  expect(getScienceSample(original.id)).toBeNull()
  expect(getScienceSampleForProject(original)).toBeNull()
  expect(applyScienceSample(original)).toBe(original)
  const draftIds = scienceSampleIds().slice(0, 6)
  expect(draftIds).toHaveLength(6)
  for (const id of draftIds) expect(getScienceSample(id)?.id).toBe(id)
})
test('placeholder-only steps do not create HowTo or a how-to FAQ', () => {
  const graph = JSON.stringify(buildProjectJsonLd({ ...project(), materials: ['（见实验说明）'] }))
  expect(graph).not.toContain('HowTo')
  expect(graph).not.toContain('怎么做')
  expect(graph).not.toContain('需要哪些材料')
})
test('mixed steps retain genuine instructions and consecutive positions', () => {
  const result = JSON.stringify(buildProjectJsonLd({ ...project(), steps: [...project().steps!, { title: '准备纸片', description: '将白纸剪成两条等宽的纸带。' }] }))
  expect(result).toContain('HowToStep')
  expect(result).toContain('"position":1')
  expect(result).not.toContain('观看实验视频')
  expect(result).toContain('将白纸剪成两条等宽的纸带')
})
test('all reviewed samples expose their actual step count and visible FAQ only', () => {
  vi.stubEnv('NODE_ENV', 'development')
  expect(scienceSampleIds()).toHaveLength(114)
  expect(new Set(scienceSampleIds()).size).toBe(114)
  expect(scienceSampleIds()).toEqual(expect.arrayContaining([1309, 1323, 1322, 1315, 1295]))
  for (const id of scienceSampleIds()) {
    const sample = getScienceSample(id)!
    const graph = JSON.stringify(buildProjectJsonLd(sample))
    if (sample.mode === 'preparation' || sample.mode === 'observation') expect(graph).not.toContain('HowTo')
    else expect(graph.match(/"@type":"HowToStep"/g)).toHaveLength(sample.steps.length)
    expect(graph.match(/"@type":"Question"/g)).toHaveLength(sample.faq.length)
    expect(graph).not.toContain('VideoObject')
    for (const faq of sample.faq) expect(graph).toContain(faq.answer)
  }
})
test('guide ranks real content ahead of recent placeholders and omits filler summaries', () => {
  const empty = project(500)
  const real = { ...project(501), description: '用纸带比较形状与承重。', steps: [{ title: '折纸带', description: '把纸带折成折扇形。' }] }
  expect(selectScienceResources([empty, real]).map(x => x.id)).toEqual([501, 500])
  expect(scienceResourceSummary(empty)).toBeUndefined()
  expect(scienceResourceSummary(real)).toBe(real.description)
})

test('production reviewed notes accept stale body but require matching title and category', () => {
  vi.stubEnv('NODE_ENV', 'production')
  const sample = reviewed.find(item => item.id === 1309)!
  const result = applyScienceSample(project())
  expect(getScienceSampleForProject(result)).toEqual(sample)
  expect(getScienceSampleForProject({ ...result, steps: result.steps!.slice(1) })).toEqual(sample)
  expect(getScienceSampleForProject({ ...result, materials: ['changed'] })).toEqual(sample)
  expect(getScienceSampleForProject({ ...result, title: '已改名' })).toBeNull()
  expect(getScienceSampleForProject({ ...result, category: '积木' })).toBeNull()
})
