import { afterEach, expect, test, vi } from 'vitest'
import drafts from './science-extensions.dev.json'
import reviewed from './science-reviewed.data.json'
import { getScienceSample } from './science-samples'
import { getScienceTutorContent } from '@/lib/ai/tutor/science-context'

const releasedSnapshot = JSON.stringify(reviewed)
const draftSnapshot = JSON.stringify(drafts)
afterEach(() => vi.unstubAllEnvs())

test('draft scope contains 20–30 unique released projects', () => {
  expect(drafts.length).toBeGreaterThanOrEqual(20)
  expect(drafts.length).toBeLessThanOrEqual(30)
  expect(new Set(drafts.map(item => item.id)).size).toBe(drafts.length)
  for (const draft of drafts) {
    expect(reviewed.find(item => item.id === draft.id)?.title).toBe(draft.title)
  }
})

test.each(drafts)('$id draft copy has two paragraphs and safe, unique new questions', draft => {
  const paragraphs = draft.extension.split('\n\n')
  expect(paragraphs).toHaveLength(2)
  expect(paragraphs.every(paragraph => paragraph.trim().length > 0)).toBe(true)
  expect(draft.extension.replaceAll('\n', '').length).toBeGreaterThanOrEqual(80)
  expect(draft.extension.replaceAll('\n', '').length).toBeLessThanOrEqual(220)
  expect(draft.extensionQuestions.length).toBeGreaterThanOrEqual(2)
  expect(draft.extensionQuestions.length).toBeLessThanOrEqual(3)
  const oldQuestions = reviewed.flatMap(item => item.extensionQuestions)
  const allQuestions = drafts.flatMap(item => item.extensionQuestions)
  for (const question of draft.extensionQuestions) {
    expect(question.trim()).not.toBe('')
    expect(allQuestions.filter(value => value === question)).toHaveLength(1)
    expect(oldQuestions).not.toContain(question)
  }
  for (const text of [draft.extension, ...draft.extensionQuestions]) {
    expect(text).not.toMatch(/点火|喝下|尝一尝|吃下/)
  }
})

test('every draft question contains a Chinese question mark and ends with a Chinese question mark or full stop', () => {
  expect(drafts.flatMap(item => item.extensionQuestions
    .filter(question => !question.includes('？') || !(question.endsWith('？') || question.endsWith('。')))
    .map(question => ({ id: item.id, question })))).toEqual([])
})

test.each(['development', 'production', 'test'])('only extension fields change in %s without mutating JSON', env => {
  vi.stubEnv('NODE_ENV', env)
  for (const item of reviewed) {
    const draft = drafts.find(row => row.id === item.id && row.title === item.title)
    const expected = env === 'development' && draft
      ? { ...item, extension: draft.extension, extensionQuestions: draft.extensionQuestions }
      : item
    const sample = getScienceSample(item.id)
    expect(sample).toEqual(expected)
    expect(getScienceSample(String(item.id))).toEqual(expected)
    if (env === 'development' && draft) {
      expect(sample).not.toBe(item)
      expect(sample!.extensionQuestions).not.toBe(draft.extensionQuestions)
    }
    expect(getScienceTutorContent(item.id, item.title, '科学')).toMatchObject({
      description: item.description, materials: item.materials, steps: item.steps,
      principle: item.principle, safety: item.safety,
      extension: expected.extension, questions: expected.extensionQuestions,
    })
  }
  expect(JSON.stringify(reviewed)).toBe(releasedSnapshot)
  expect(JSON.stringify(drafts)).toBe(draftSnapshot)
})
