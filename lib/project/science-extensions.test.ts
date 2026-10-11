import { afterEach, expect, test, vi } from 'vitest'
import reviewed from './science-reviewed.data.json'
import { getScienceSample } from './science-samples'
import { getScienceTutorContent } from '@/lib/ai/tutor/science-context'

const releasedSnapshot = JSON.stringify(reviewed)
afterEach(() => vi.unstubAllEnvs())

test.each(['development', 'production', 'test'])('page and tutor share reviewed extensions in %s without mutating JSON', env => {
  vi.stubEnv('NODE_ENV', env)
  for (const item of reviewed) {
    expect(getScienceSample(item.id)).toEqual(item)
    expect(getScienceSample(String(item.id))).toEqual(item)
    expect(getScienceTutorContent(item.id, item.title, '科学')).toMatchObject({
      description: item.description, materials: item.materials, steps: item.steps,
      principle: item.principle, safety: item.safety,
      extension: item.extension, questions: item.extensionQuestions,
    })
  }
  expect(JSON.stringify(reviewed)).toBe(releasedSnapshot)
})

test.each(['development', 'production', 'test'])('first-batch content is released in %s and retired 907 stays excluded', env => {
  vi.stubEnv('NODE_ENV', env)
  const sample = getScienceSample(478)!
  expect(sample.extension).toContain('脾气不同的小朋友')
  expect(sample.extensionQuestions?.some(question => question.includes('蜂蜜'))).toBe(true)
  expect(getScienceTutorContent(478, sample.title, '科学')).toMatchObject({
    extension: sample.extension, questions: sample.extensionQuestions,
  })
  expect(getScienceSample(907)).toBeNull()
  expect(getScienceTutorContent(907, '欢叫的吸管', '科学')).toBeNull()
  expect(getScienceSample(1098)).toEqual(reviewed.find(item => item.id === 1098))
})
