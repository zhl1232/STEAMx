import { describe, expect, it } from 'vitest'
import { normalizeMaterialPresentation } from './material-presentation'
import revisions from './content-revisions.data.json'
import presentationRules from './material-presentation.data.json'
import { getMaterialMeta } from './material-meta'

describe('normalizeMaterialPresentation', () => {
  it('preserves every numeric requirement in the reviewed full-row split rules', () => {
    for (const rule of presentationRules.splitRows) {
      const result = normalizeMaterialPresentation([rule.source])
      const displayed = [...result.materials, ...result.preparationNotes].join(' ')
      for (const number of rule.source.match(/\d+(?:\.\d+)?/g) ?? []) {
        expect(displayed, rule.source).toContain(number)
      }
      expect(result.materials.every((row) => row.trim().length > 0), rule.source).toBe(true)
    }
  })

  it('moves reviewed environment conditions intact instead of counting them as materials', () => {
    for (const rule of presentationRules.preparationRows) {
      expect(normalizeMaterialPresentation([rule.source])).toEqual({ materials: [], preparationNotes: [rule.note] })
    }
  })

  it('keeps normalized names, quantities and specifications stable on repeated presentation', () => {
    const source = ['塑料瓶2个', '硬纸皮3张', '白纸或卡纸', '硬纸皮或木棒', '擦水布或纸巾', '红色黏土', '蓝色黏土', '剪刀（成人使用）']
    const once = normalizeMaterialPresentation(source)
    expect(normalizeMaterialPresentation(once.materials, once.preparationNotes)).toEqual(once)
    expect(once.materials.some((row) => row.includes('或'))).toBe(true)
    expect(once.materials.join(' ')).toContain('红色、蓝色')
  })

  it('keeps short taxonomy purposes stable when combined with source usage notes', () => {
    const once = normalizeMaterialPresentation(['接水盘（承接可能滴落的水）', '接水盘（教师演示时保持器材周围干燥）'])
    expect(once.materials).toHaveLength(2)
    expect(once.preparationNotes).toEqual([])
    expect(normalizeMaterialPresentation(once.materials, once.preparationNotes)).toEqual(once)
    expect(once.materials.join(' ')).toContain('教师演示时保持器材周围干燥')
  })

  it('consolidates reviewed quantities into the checklist without losing preparation conditions', () => {
    const oil = revisions.find(({ id }) => id === 808)!
    const result = normalizeMaterialPresentation(oil.materials!, oil.preparationNotes)
    expect(result.materials).toEqual(['色素（3种颜色）', '滴管', '量杯', '盘子', '瓶子（塑料瓶）', '食用油15毫升', '水约150毫升（清水）'])
    expect(result.preparationNotes).toEqual([])
    const bubbles = revisions.find(({ id }) => id === 39)!
    const bubbleResult = normalizeMaterialPresentation(bubbles.materials!, bubbles.preparationNotes)
    expect(bubbleResult.materials.map(getMaterialMeta)).toEqual(expect.arrayContaining([expect.objectContaining({ name: '水', amount: '500毫升' }), expect.objectContaining({ name: '洗洁精', amount: '3勺' }), expect.objectContaining({ name: '甘油或白糖 1勺' })]))
    expect(bubbleResult.preparationNotes).toContain('按勺量取，不换算为克。')
    const colors = revisions.find(({ id }) => id === 303)!
    expect(normalizeMaterialPresentation(colors.materials!, colors.preparationNotes).preparationNotes).toEqual(['配色需包含暖色和冷色。'])
  })

  it('does not remove preparation requirements when their supporting checklist changes', () => {
    const oil = revisions.find(({ id }) => id === 808)!
    const rows = oil.materials!.map((row) => row === '清水约150毫升' ? '清水约200毫升' : row)
    expect(normalizeMaterialPresentation(rows, oil.preparationNotes).preparationNotes).toEqual(oil.preparationNotes)
    const revisedNotes = ['清水约150毫升、食用油20毫升和3种色素。']
    expect(normalizeMaterialPresentation(oil.materials!, revisedNotes).preparationNotes).toEqual(revisedNotes)
  })
  it('expands supplied materials with quantities and nested specifications intact', () => {
    expect(normalizeMaterialPresentation(['自备（瓶子（玻璃瓶最好）、牙签2根、红色黏土、蓝色黏土）'])).toEqual({
      materials: ['瓶子（玻璃瓶最好）', '牙签2根', '黏土（红色、蓝色）'], preparationNotes: [],
    })
  })

  it('splits unambiguous conjunctions and moves shared purposes with their material names', () => {
    expect(normalizeMaterialPresentation(['剪刀和胶带', '画笔和调色盘', '硬纸板和胶带（组装展示板）'])).toEqual({
      materials: ['剪刀', '胶带', '画笔', '调色盘', '纸板（硬纸板；组装展示板）', '胶带（组装展示板）'],
      preparationNotes: [],
    })
  })

  it('retains optional, alternative and compound conditions without guessing', () => {
    const rows = ['硬纸板、纸巾筒或保鲜膜芯（三选一，制作轨道）', '红、蓝两种色素', '红、蓝两色卡纸', '剪刀、胶带（可选）', '颜料和画笔（可选上色时另备）', '研钵和研杵（或碗和勺子）', '竹条或细木条2根（约50厘米和40厘米）', '螺丝螺母和垫片若干', '透明玻璃罐/透明塑料罐']
    expect(normalizeMaterialPresentation(rows)).toEqual({ materials: rows, preparationNotes: [] })
  })

  it('separates environment and measurement instructions without discarding requirements', () => {
    expect(normalizeMaterialPresentation(['阳光（选择晴天进行）', '量取10×5厘米底盘所需直尺', '量取20毫升白醋的量具', '剪刀（成人使用）'])).toEqual({
      materials: ['直尺', '量具', '剪刀'],
      preparationNotes: ['环境要求：阳光，选择晴天进行。', '直尺：量取10×5厘米底盘。', '量具：量取20毫升白醋。', '剪刀：成人使用。'],
    })
  })

  it('keeps critical properties and quantities and never combines different clay types', () => {
    expect(normalizeMaterialPresentation(['水溶性水彩笔数色', '食用色素（红、黄、蓝）', '铝箔纸（15×15厘米）', '红色黏土', '蓝色超轻黏土', '红纸2张、蓝纸3张']).materials).toEqual([
      '彩笔数色（水溶性彩笔）', '食用色素（红、黄、蓝）', '铝箔纸（15×15厘米）', '黏土（红色）', '超轻黏土（蓝色）', '红纸2张、蓝纸3张',
    ])
  })

  it('keeps compound installation requirements together when moving adult instructions', () => {
    expect(normalizeMaterialPresentation(['与原螺丝、铰链配套的安装工具（成人使用）'])).toEqual({
      materials: ['与原螺丝、铰链配套的安装工具'],
      preparationNotes: ['与原螺丝、铰链配套的安装工具：成人使用。'],
    })
  })

  it('uses the same plain material identities as the picker while retaining counts', () => {
    expect(normalizeMaterialPresentation(['硬纸皮2张', '木棒3根', '积木块', '纸板箱1个', '塑料刀具', '彩笔4支']).materials).toEqual([
      '纸板2张（硬纸板）', '木棍3根', '积木', '纸盒1个（纸箱）', '塑料刀', '彩笔4支',
    ])
  })

  it('preserves unknown malformed rows and leaves source arrays untouched', () => {
    const rows = ['未知材料（需要配套零件', '纸皮', '彩笔']
    expect(normalizeMaterialPresentation(rows).materials).toEqual(['未知材料（需要配套零件', '纸板', '彩笔'])
    expect(rows).toEqual(['未知材料（需要配套零件', '纸皮', '彩笔'])
  })
})
