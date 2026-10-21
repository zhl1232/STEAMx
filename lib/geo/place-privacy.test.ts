import { describe, expect, it, vi } from 'vitest'

import { applyPublicPlaceConfirmation, classifyPlace, resolvePlacePrivacy } from './place-privacy'

describe('classifyPlace', () => {
  it('公园/植物园/湿地 → 公共场所', () => {
    expect(classifyPlace({ locationName: '玉渊潭公园', candidates: [{ name: '玉渊潭公园', typecode: '110101', distance: 0 }] })).toBe('public_place')
    expect(classifyPlace({ locationName: '湿地', candidates: [{ name: '某湿地', typecode: '110200', distance: 80 }] })).toBe('public_place')
  })
  it('小区/学校附近 → 家附近，优先于公园', () => {
    expect(classifyPlace({ locationName: '大同恒大绿洲', candidates: [{ name: '恒大绿洲', typecode: '120302', distance: 20 }, { name: '某公园', typecode: '110101', distance: 100 }] })).toBe('private_area')
    expect(classifyPlace({ locationName: '实验小学', candidates: [] })).toBe('private_area')
    expect(classifyPlace({ locationName: 'x', candidates: [{ name: '第一中学', typecode: '141202', distance: 250 }] })).toBe('private_area')
  })
  it('查不到类型 → unknown；只有提交者确认才能升为公开，家附近不能被覆盖', () => {
    expect(classifyPlace({ locationName: '河边', candidates: [{ name: '某公司', typecode: '170200', distance: 30 }] })).toBe('unknown')
    expect(applyPublicPlaceConfirmation('unknown', true)).toBe('public_place')
    expect(applyPublicPlaceConfirmation('private_area', true)).toBe('private_area')
    expect(applyPublicPlaceConfirmation('unknown', false)).toBe('unknown')
  })
})

describe('resolvePlacePrivacy', () => {
  it('从高德逆地理编码取区县和 POI 类型', async () => {
    process.env.AMAP_WEB_SERVICE_KEY = 'k'
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({
      status: '1',
      regeocode: { addressComponent: { district: '海淀区' }, pois: [{ name: '某小区', typecode: '120302', distance: '40' }] },
    }))) as unknown as typeof fetch
    await expect(resolvePlacePrivacy({ latitude: 39.99, longitude: 116.3, fetchImpl })).resolves.toEqual({ category: 'private_area', district: '海淀区' })
  })
  it('接口失败按 unknown 处理', async () => {
    process.env.AMAP_WEB_SERVICE_KEY = 'k'
    const fetchImpl = vi.fn(async () => { throw new Error('net') }) as unknown as typeof fetch
    await expect(resolvePlacePrivacy({ latitude: 39.99, longitude: 116.3, fetchImpl })).resolves.toEqual({ category: 'unknown', district: null })
  })
})

describe('回填脚本与服务端规则一致', () => {
  it('同样的输入得到同样的分级', async () => {
    const script = (await import('../../scripts/backfill-observation-location-privacy.mjs')) as unknown as {
      classifyPlace: typeof classifyPlace
    }
    const samples = [
      { locationName: '玉渊潭公园', candidates: [{ name: '玉渊潭公园', typecode: '110101', distance: 0 }] },
      { locationName: '大同恒大绿洲', candidates: [] },
      { locationName: 'x', candidates: [{ name: '第一中学', typecode: '141202', distance: 250 }] },
      { locationName: '河边', candidates: [{ name: '某公司', typecode: '170200', distance: 30 }] },
    ]
    for (const sample of samples) expect(script.classifyPlace(sample)).toBe(classifyPlace(sample))
  })
})
