import { afterEach, expect, test, vi } from 'vitest'
import { getScienceSample } from '@/lib/project/science-samples'
import { getScienceTutorContent } from './science-context'
afterEach(() => vi.unstubAllEnvs())
test('released context contains page content without internal editorial metadata', () => {
  vi.stubEnv('NODE_ENV', 'development')
  const sample = getScienceSample(1213)!
  const content = getScienceTutorContent(1213, sample.title, '科学')!
  expect(content.extension).toBe(sample.extension)
  expect(content.questions).toEqual(sample.extensionQuestions)
  expect(content.steps).toEqual(sample.steps)
  expect(content).not.toHaveProperty('instructionGap')
  expect(content.mode).toBe('preparation')
  expect(getScienceTutorContent(1213, '已改名', '科学')).toBeNull()
  expect(getScienceTutorContent(1213, sample.title, '其他')).toBeNull()
  vi.stubEnv('NODE_ENV', 'production')
  const released = getScienceSample(1213)!
  expect(released.extension).toContain('浮石')
  expect(getScienceTutorContent(1213, sample.title, '科学')).toEqual({ ...content, extension: released.extension, questions: released.extensionQuestions })
  expect(getScienceTutorContent(710, '高出杯沿的水', '科学')).toBeNull()
})
