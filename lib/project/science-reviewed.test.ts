import { afterEach, expect, test, vi } from 'vitest'
import reviewed from './science-reviewed.data.json'
import legacy from './science-samples.data.json'
import drafts from './science-extensions.dev.json'
import { applyScienceSample, getScienceSample, getScienceSampleForProject, scienceSampleIds } from './science-samples'
import { getScienceTutorContent } from '@/lib/ai/tutor/science-context'
import { buildProjectJsonLd } from '@/lib/seo/json-ld'
import type { Project } from '@/lib/mappers/types'
afterEach(() => vi.unstubAllEnvs())
const expectedIds = [478,552,586,617,624,642,657,675,700,717,738,745,763,772,792,810,812,813,822,843,847,867,869,876,891,893,903,907,925,930,949,957,964,977,979,985,1021,1040,1049,1100,1102,1116,1157,1175,1189,1195,1198,1213,1215,1220,1222,1249,1269,1285,1299]
test.each(['development', 'production'])('exact approved55 content and tutor agree in %s; other drafts stay out', env => {
 vi.stubEnv('NODE_ENV', env)
 expect(reviewed.map(row => row.id)).toEqual(expectedIds)
 expect(scienceSampleIds()).toHaveLength(114)
 const questions: string[] = []
 for (const item of reviewed) {
  const draft = env === 'development' ? drafts.find(row => row.id === item.id && row.title === item.title) : undefined
  const expected = draft ? {...item, extension:draft.extension, extensionQuestions:draft.extensionQuestions} : item
  const stale = {id:item.id, title:item.title, category:'科学', description:'OLD', materials:['OLD'], steps:[{title:'OLD',description:'OLD'}], faq:[{question:'OLD',answer:'OLD'}], reflection:'OLD', image:'cover.webp', videoUrl:'original.mp4'} as Project
  const result = applyScienceSample(stale)
  expect(result).toMatchObject({description:item.description, materials:item.materials, steps:item.steps, faq:item.faq, reflection:item.principle, image:stale.image, videoUrl:stale.videoUrl})
  expect(stale.description).toBe('OLD')
  expect(getScienceSampleForProject(result)).toEqual(expected)
  expect(applyScienceSample({...stale,title:'renamed'}).description).toBe('OLD')
  expect(applyScienceSample({...stale,category:'积木'}).description).toBe('OLD')
  const tutor = getScienceTutorContent(item.id,item.title,'科学')!
  expect(tutor).toMatchObject({description:result.description, materials:result.materials,steps:result.steps,extension:expected.extension,questions:expected.extensionQuestions,mode:item.mode ?? 'activity'})
  expect(tutor).not.toHaveProperty('instructionGap')
  expect(tutor).not.toHaveProperty('sources')
  expect(item.extension.split('\n\n')).toHaveLength(2)
  expect(item.extension.replaceAll('\n','').length).toBeGreaterThanOrEqual(120)
  expect(item.extension.replaceAll('\n','').length).toBeLessThanOrEqual(220)
  expect(item.extensionQuestions).toHaveLength(2)
  questions.push(...item.extensionQuestions)
  if (item.mode === 'observation' || item.mode === 'preparation') expect(JSON.stringify(buildProjectJsonLd({...result,mode:item.mode ?? 'activity'}))).not.toContain('HowTo')
 }
 expect(new Set(questions).size).toBe(110)
 for (const id of [710,733,781,787,844,987,580,713,786,983]) expect(getScienceSample(id)).toBeNull()
 for (const item of legacy) expect(getScienceSample(item.id)).toEqual(item)
})
test('public safety modes and static alternative remain explicit', () => {
 expect(reviewed.filter(x => (x.mode ?? 'activity') === 'activity')).toHaveLength(22)
 expect(reviewed.filter(x => x.mode === 'preparation')).toHaveLength(24)
 expect(reviewed.filter(x => x.mode === 'observation')).toHaveLength(9)
 expect(getScienceSample(1269)?.extension).toContain('不用身体尝试其他电路')
 expect(getScienceSample(1249)?.safety).toContain('不安排儿童制作')
 expect(getScienceSample(700)?.sourceRelation).toBe('alternative')
 expect(getScienceSample(700)?.safety).toContain('不抛掷')
})
