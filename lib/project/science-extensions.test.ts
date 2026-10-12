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

const thirdBatch = [
  { id: 1176, title: '小丑走钢丝' },
  { id: 1177, title: '食物链' },
  { id: 1178, title: '磁铁走迷宫' },
  { id: 1179, title: '不倒翁' },
  { id: 1180, title: '变大变小' },
  { id: 1181, title: '3D眼镜' },
  { id: 1183, title: '荷塘月色' },
  { id: 1184, title: '颜色变变变' },
  { id: 1187, title: '种子发芽' },
  { id: 1188, title: '土电话' },
  { id: 1190, title: '人体骨骼' },
  { id: 1191, title: '百变小树' },
  { id: 1192, title: '大气压力' },
  { id: 1193, title: '悬浮飞球' },
  { id: 1194, title: '望远镜' },
  { id: 1200, title: '平衡鹰' },
  { id: 1201, title: '水往玻璃上爬' },
  { id: 1202, title: '橡皮筋吉他' },
  { id: 1204, title: '磁悬浮' },
  { id: 1205, title: '日地月模型' },
  { id: 1206, title: '跷跷板' },
  { id: 1207, title: '人体消化系统' },
  { id: 1210, title: '哈哈镜' },
  { id: 1211, title: '潜望镜' },
  { id: 1212, title: '旋转陀螺' },
  { id: 1214, title: '空气炮' },
  { id: 1216, title: '小蝌蚪长大了' },
  { id: 1217, title: '恐龙蛋' },
  { id: 1218, title: '地球的结构' },
] as const

const fourthBatch = [
  { id: 1219, title: '笼中鸟（塑料）' },
  { id: 1227, title: '简易天平' },
  { id: 1228, title: '月相成因' },
  { id: 1230, title: '自制温度计' },
  { id: 1231, title: '摩擦起电' },
  { id: 1232, title: '肺活量测量袋' },
  { id: 1233, title: '指南针' },
  { id: 1236, title: '风向标' },
  { id: 1239, title: '平衡鹰' },
  { id: 1244, title: '双轨怪坡' },
  { id: 1246, title: '铅笔导电' },
  { id: 1248, title: '翻跟斗胶囊' },
  { id: 1254, title: '胡克滚轮' },
  { id: 1257, title: '风向标' },
  { id: 1259, title: '平面镜光' },
  { id: 1262, title: '谁开的花早' },
  { id: 1277, title: '静电飞雪' },
  { id: 1281, title: '飞舞的蝴蝶' },
  { id: 1283, title: '日晷' },
  { id: 1284, title: '穿越火线' },
  { id: 1286, title: '幻影灯' },
  { id: 1293, title: '全息投影' },
  { id: 1295, title: '磁铁指南针' },
  { id: 1307, title: '费纳奇镜' },
  { id: 1308, title: '三球仪' },
  { id: 1309, title: '牛顿摆' },
  { id: 1315, title: '天文望远镜' },
  { id: 1321, title: '木质显微镜' },
  { id: 1322, title: '万有引力' },
  { id: 1323, title: '轨道卫星' },
] as const

const releasedSnapshot = JSON.stringify(reviewed)
afterEach(() => vi.unstubAllEnvs())

test('four batches cover 114 unique projects, including second-, third- and fourth-batch IDs and titles', () => {
  expect(secondBatch).toHaveLength(28)
  expect(new Set(secondBatch.map(item => item.id)).size).toBe(28)
  expect(reviewed).toHaveLength(114)
  expect(new Set(reviewed.map(item => item.id)).size).toBe(114)
  expect(thirdBatch).toHaveLength(29)
  expect(new Set(thirdBatch.map(item => item.id)).size).toBe(29)
  expect(fourthBatch).toHaveLength(30)
  expect(new Set(fourthBatch.map(item => item.id)).size).toBe(30)
  for (const item of [...secondBatch, ...thirdBatch, ...fourthBatch]) {
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

test('all 342 extension questions are unique across four batches', () => {
  const questions = reviewed.flatMap(item => item.extensionQuestions)
  expect(questions).toHaveLength(342)
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

test.each([
  { id: 1188, title: '土电话' },
  { id: 1214, title: '空气炮' },
])('third-batch $id $title reaches the page and tutor in production', ({ id, title }) => {
  vi.stubEnv('NODE_ENV', 'production')
  const sample = reviewed.find(item => item.id === id)!
  expect(sample.title).toBe(title)
  expect(getScienceSample(id)).toEqual(sample)
  expect(getScienceTutorContent(id, title, '科学')).toMatchObject({
    extension: sample.extension, questions: sample.extensionQuestions,
  })
})

test.each([
  { id: 1246, title: '铅笔导电' },
  { id: 1323, title: '轨道卫星' },
])('fourth-batch $id $title reaches the page and tutor in production', ({ id, title }) => {
  vi.stubEnv('NODE_ENV', 'production')
  const sample = reviewed.find(item => item.id === id)!
  expect(sample.title).toBe(title)
  expect(getScienceSample(id)).toEqual(sample)
  expect(getScienceTutorContent(id, title, '科学')).toMatchObject({
    extension: sample.extension, questions: sample.extensionQuestions,
  })
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
