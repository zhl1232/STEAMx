import { afterEach, expect, test, vi } from 'vitest'
import reviewed from './science-reviewed.data.json'
import { getScienceSample } from './science-samples'
import { getScienceTutorContent } from '@/lib/ai/tutor/science-context'

const secondBatch = [
  { id: 869, title: '耦合共振' },
  { id: 891, title: '摩擦自锁' },
  { id: 893, title: '帕洛马结' },
  { id: 930, title: '欹器满覆' },
  { id: 949, title: '四两拨千斤' },
  { id: 964, title: '掌中悬浮术' },
  { id: 1220, title: '造雪实验' },
  { id: 1222, title: '小孔成像' },
  { id: 738, title: '彩虹爬爬爬' },
  { id: 822, title: '魔力滚筒' },
  { id: 977, title: '检测食物中的淀粉' },
  { id: 979, title: '受热一定会膨胀吗？' },
  { id: 985, title: '磁场的干扰' },
  { id: 1021, title: '团结的钉子' },
  { id: 1040, title: '非牛顿流体' },
  { id: 1049, title: '纸杯里的悄悄话' },
  { id: 1249, title: '火药' },
  { id: 772, title: '蜡烛的两种形态' },
  { id: 843, title: '杯中云海' },
  { id: 876, title: '小火柴大力量' },
  { id: 1098, title: '吸管独奏' },
  { id: 1100, title: '爬坡的玻璃珠' },
  { id: 1102, title: '晃不倒的瓶子' },
  { id: 1116, title: '站立的铁棒' },
  { id: 1157, title: '神奇的牛奶灯' },
  { id: 1269, title: '人体导电' },
  { id: 1285, title: '酸碱认知' },
  { id: 1299, title: '茶水变色' },
] as const

const releasedSnapshot = JSON.stringify(reviewed)
afterEach(() => vi.unstubAllEnvs())

test('both batches cover 55 unique projects, including all 28 second-batch IDs and titles', () => {
  expect(secondBatch).toHaveLength(28)
  expect(new Set(secondBatch.map(item => item.id)).size).toBe(28)
  expect(reviewed).toHaveLength(55)
  expect(new Set(reviewed.map(item => item.id)).size).toBe(55)
  for (const item of secondBatch) {
    expect(reviewed.find(sample => sample.id === item.id)).toMatchObject(item)
    expect(getScienceSample(item.id)).toMatchObject(item)
  }
})

test.each(reviewed)('$id $title has two nonempty paragraphs and an 80–220 character extension', item => {
  const paragraphs = item.extension.split('\n\n')
  expect(paragraphs).toHaveLength(2)
  for (const paragraph of paragraphs) expect(paragraph.trim()).not.toBe('')
  const length = item.extension.replace(/\r?\n/g, '').length
  expect(length).toBeGreaterThanOrEqual(80)
  expect(length).toBeLessThanOrEqual(220)
})

test.each(reviewed)('$id $title has three nonempty questions with Chinese question punctuation', item => {
  expect(item.extensionQuestions).toHaveLength(3)
  for (const question of item.extensionQuestions) {
    expect(question.trim()).not.toBe('')
    expect(question).toContain('？')
    expect(question).toMatch(/[？。]$/)
  }
})

test('all 165 extension questions are unique across both batches', () => {
  const questions = reviewed.flatMap(item => item.extensionQuestions)
  expect(questions).toHaveLength(165)
  expect(new Set(questions).size).toBe(questions.length)
})

test.each(reviewed)('$id $title extension and questions exclude unsafe or placeholder wording', item => {
  for (const text of [item.extension, ...item.extensionQuestions]) {
    expect(text).not.toMatch(/点火|喝下|尝一尝|吃下|按说明书|暂不能直接跟做|尚未完善/)
  }
})

test('second-batch examples reach the page and tutor', () => {
  expect(getScienceSample(869)?.extension).toContain('传球')
  expect(getScienceSample(1098)?.extensionQuestions?.some(question => question.includes('插得越深'))).toBe(true)
  const sample = reviewed.find(item => item.id === 1249)!
  expect(getScienceTutorContent(1249, '火药', '科学')?.questions).toEqual(sample.extensionQuestions)
})

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
