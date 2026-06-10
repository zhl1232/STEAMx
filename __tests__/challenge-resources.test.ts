import { describe, it, expect } from 'vitest'

import { normalizeChallengeResources } from '@/lib/mappers/types'
import { validateChallengeResources } from '@/lib/api/challenge-resources'
import { ValidationError } from '@/lib/api/validation'

describe('normalizeChallengeResources', () => {
  it('保留新三分类 type 与 description', () => {
    const result = normalizeChallengeResources([
      { title: '示例项目', url: '/project/1', type: 'project', description: '学方法' },
      { title: '技能课', url: '/resources/2', type: 'skill' },
      { title: '资料', url: '/resources/3', type: 'reference' },
    ])

    expect(result).toEqual([
      { title: '示例项目', url: '/project/1', type: 'project', description: '学方法' },
      { title: '技能课', url: '/resources/2', type: 'skill' },
      { title: '资料', url: '/resources/3', type: 'reference' },
    ])
  })

  it('将旧 type（link/guide/article/video/pdf）归一化为 reference', () => {
    const result = normalizeChallengeResources([
      { title: 'A', url: 'https://a.com', type: 'link' },
      { title: 'B', url: 'https://b.com', type: 'guide' },
      { title: 'C', url: 'https://c.com', type: 'article' },
      { title: 'D', url: 'https://d.com', type: 'video' },
      { title: 'E', url: 'https://e.com', type: 'pdf' },
    ])

    expect(result?.map(r => r.type)).toEqual(['reference', 'reference', 'reference', 'reference', 'reference'])
  })

  it('剔除 CTA 型条目（template/entry/internal）与脏数据', () => {
    const result = normalizeChallengeResources([
      { title: '提交作品', url: '/share?challenge=1', type: 'template' },
      { title: '回到创造营', url: '/create', type: 'entry' },
      { title: '', url: '/x', type: 'reference' },
      { title: '正常资料', url: '/resources/1', type: 'reference' },
    ])

    expect(result).toEqual([{ title: '正常资料', url: '/resources/1', type: 'reference' }])
  })

  it('非数组或全部被剔除时返回 undefined', () => {
    expect(normalizeChallengeResources(null)).toBeUndefined()
    expect(normalizeChallengeResources('x')).toBeUndefined()
    expect(normalizeChallengeResources([{ title: 'CTA', url: '/create', type: 'entry' }])).toBeUndefined()
  })
})

describe('validateChallengeResources', () => {
  it('通过合法数据并裁剪空白', () => {
    const result = validateChallengeResources([
      { title: ' 资料 ', url: ' /resources/1 ', type: 'reference', description: ' 何时查 ' },
    ])

    expect(result).toEqual([
      { title: '资料', url: '/resources/1', type: 'reference', description: '何时查' },
    ])
  })

  it('空值返回空数组', () => {
    expect(validateChallengeResources(undefined)).toEqual([])
    expect(validateChallengeResources(null)).toEqual([])
  })

  it('拒绝非法 type 与缺失字段', () => {
    expect(() => validateChallengeResources([{ title: 'A', url: '/a', type: 'link' }])).toThrow(ValidationError)
    expect(() => validateChallengeResources([{ title: '', url: '/a', type: 'reference' }])).toThrow(ValidationError)
    expect(() => validateChallengeResources([{ title: 'A', url: '', type: 'reference' }])).toThrow(ValidationError)
    expect(() => validateChallengeResources('not-array')).toThrow(ValidationError)
  })
})
