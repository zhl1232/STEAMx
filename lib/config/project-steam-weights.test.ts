import { describe, expect, it } from 'vitest'

import { inferProjectSteamWeights } from './project-steam-weights'
import { getSteamWeights } from './subcategory-steam-weights'

describe('inferProjectSteamWeights', () => {
  it('falls back to the subcategory defaults when the project has no strong extra signal', () => {
    const weights = inferProjectSteamWeights({
      title: '太阳系比例海报',
      description: '用卡纸制作一张太阳系比例海报，认识八大行星的大小关系和排列顺序。',
      category: '科学',
      subCategory: '地球与天空',
    })

    expect(weights).toEqual(getSteamWeights('地球与天空', '科学'))
  })

  it('raises science and engineering for science-heavy craft projects', () => {
    const base = getSteamWeights('手工', '艺术')
    const weights = inferProjectSteamWeights({
      title: '纸杯电话',
      description: '用两个纸杯和一根棉线制作简易电话，体验声音通过振动传播的神奇，并理解声波沿固体传导的科学原理。',
      category: '艺术',
      subCategory: '手工',
    })

    expect(weights.S).toBeGreaterThan(base.S)
    expect(weights.E).toBeGreaterThan(base.E)
    expect(weights.A).toBeLessThan(base.A)
  })

  it('rebalances creative programming projects toward art and math', () => {
    const base = getSteamWeights('编程入门', '技术')
    const weights = inferProjectSteamWeights({
      title: 'Scratch 画笔绘图',
      description: '使用 Scratch 画笔功能编程绘制各种几何图案，从简单的正方形到复杂的万花筒。',
      category: '技术',
      subCategory: '编程入门',
    })

    expect(weights.A).toBeGreaterThan(base.A)
    expect(weights.M).toBeGreaterThan(base.M)
    expect(weights.T).toBeLessThan(base.T)
  })

  it('gives logic puzzle projects more spatial and artistic weight than the old default', () => {
    const base = getSteamWeights('逻辑谜题', '数学')
    const weights = inferProjectSteamWeights({
      title: '七巧板几何挑战',
      description: '用七块简单的几何板拼出各种有趣的图形，锻炼空间想象力和几何直觉。',
      category: '数学',
      subCategory: '逻辑谜题',
    })

    expect(weights.E).toBeGreaterThan(base.E)
    expect(weights.A).toBeGreaterThan(base.A)
    expect(weights.T).toBe(base.T)
  })
})
