import { afterEach, expect, test, vi } from 'vitest'
import reviewed from './science-reviewed.data.json'
import legacy from './science-samples.data.json'
import { applyScienceSample, getScienceSample, getScienceSampleForProject, scienceSampleIds } from './science-samples'
import { getScienceTutorContent } from '@/lib/ai/tutor/science-context'
import { buildProjectJsonLd } from '@/lib/seo/json-ld'
import type { Project } from '@/lib/mappers/types'
afterEach(() => vi.unstubAllEnvs())
const expectedIds = [478,552,586,617,624,642,657,675,700,717,738,745,763,772,792,810,812,813,822,843,847,867,869,876,891,893,903,925,930,949,957,964,977,979,985,1021,1040,1049,1098,1100,1102,1116,1157,1175,1189,1195,1198,1213,1215,1220,1222,1249,1269,1285,1299]
test.each(['development', 'production', 'test'])('exact approved55 content and tutor agree in %s; other drafts stay out', env => {
 vi.stubEnv('NODE_ENV', env)
 expect(reviewed.map(row => row.id)).toEqual(expectedIds)
 expect(scienceSampleIds()).toHaveLength(114)
 const questions: string[] = []
 for (const item of reviewed) {
  const stale = {id:item.id, title:item.title, category:'科学', description:'OLD', materials:['OLD'], steps:[{title:'OLD',description:'OLD'}], faq:[{question:'OLD',answer:'OLD'}], reflection:'OLD', image:'cover.webp', videoUrl:'original.mp4'} as Project
  const result = applyScienceSample(stale)
  expect(result).toMatchObject({description:item.description, materials:item.materials, steps:item.steps, faq:item.faq, reflection:item.principle, image:stale.image, videoUrl:stale.videoUrl})
  expect(stale.description).toBe('OLD')
  expect(getScienceSampleForProject(result)).toEqual(item)
  expect(applyScienceSample({...stale,title:'renamed'}).description).toBe('OLD')
  expect(applyScienceSample({...stale,category:'积木'}).description).toBe('OLD')
  const tutor = getScienceTutorContent(item.id,item.title,'科学')!
  expect(tutor).toMatchObject({description:result.description, materials:result.materials,steps:result.steps,extension:item.extension,questions:item.extensionQuestions,mode:item.mode ?? 'activity'})
  expect(tutor).not.toHaveProperty('instructionGap')
  expect(tutor).not.toHaveProperty('sources')
  expect(item.extension.split('\n\n')).toHaveLength(2)
  expect(item.extension.replaceAll('\n','').length).toBeGreaterThanOrEqual(80)
  expect(item.extension.replaceAll('\n','').length).toBeLessThanOrEqual(220)
  expect(item.extensionQuestions.length).toBeGreaterThanOrEqual(2)
  expect(item.extensionQuestions.length).toBeLessThanOrEqual(3)
  expect(item.extension.split('\n\n').every(paragraph => paragraph.trim().length > 0)).toBe(true)
  for (const text of [item.extension, ...item.extensionQuestions]) expect(text).not.toMatch(/点火|喝下|尝一尝|吃下/)
  for (const question of item.extensionQuestions) {
   expect(question).toContain('？')
   expect(question).toMatch(/[？。]$/)
  }
  questions.push(...item.extensionQuestions)
  if (item.mode === 'observation' || item.mode === 'preparation') expect(JSON.stringify(buildProjectJsonLd({...result,mode:item.mode ?? 'activity'}))).not.toContain('HowTo')
 }
 expect(new Set(questions).size).toBe(questions.length)
 for (const id of [710,733,781,787,844,987,580,713,786,983]) expect(getScienceSample(id)).toBeNull()
 for (const item of legacy) expect(getScienceSample(item.id)).toEqual(item)
})
test('public safety modes and static alternative remain explicit', () => {
 expect(reviewed.filter(x => (x.mode ?? 'activity') === 'activity')).toHaveLength(35)
 expect(reviewed.filter(x => x.mode === 'preparation')).toHaveLength(11)
 expect(reviewed.filter(x => x.mode === 'observation')).toHaveLength(9)
 expect(getScienceSample(1269)?.extension).toContain('不用身体尝试其他电路')
 expect(getScienceSample(1249)?.safety).toContain('不安排儿童制作')
 expect(getScienceSample(700)?.sourceRelation).toBe('alternative')
 expect(getScienceSample(700)?.safety).toContain('不抛掷')
})

test('1098 exposes the verified straw activity and its four steps in HowTo', () => {
 const item = getScienceSample(1098)!
 expect(item.mode).toBe('activity')
 expect(item).not.toHaveProperty('instructionGap')
 expect(item.steps.map(step => step.title)).toEqual(['准备材料', '剪口并弯折', '插进水里吹', '上下移动听一听'])
 expect(item.steps[1].description).toContain('四分之三深，不要剪断')
 expect(item.steps[1].description).toContain('角度尽量接近直角')
 const project = applyScienceSample({ id: item.id, title: item.title, category: '科学' } as Project)
 const graph = buildProjectJsonLd({ ...project, mode: item.mode })['@graph'] ?? []
 expect(graph.find(node => node['@type'] === 'HowTo')).toMatchObject({
  step: item.steps.map((step, index) => ({ '@type': 'HowToStep', position: index + 1, name: step.title, text: step.description })),
 })
})

test('retired 907 has no reviewed override and 1098 uses self-supplied materials', () => {
 expect(getScienceSample(907)).toBeNull()
 const item = getScienceSample(1098)!
 expect(item).toMatchObject({ title: '吸管独奏', mode: 'activity' })
 expect(item.steps).toHaveLength(4)
 expect(item.steps[0]).toEqual({ title: '准备材料', description: '准备一根吸管和一个杯子，在杯子里倒满清水。' })
 expect(getScienceSampleForProject({ id: 1098, title: '吸管独奏', category: '科学' } as Project)).toEqual(item)
})
