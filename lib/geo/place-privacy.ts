/**
 * 观察地点隐私分级（第 15 条）。
 *
 * 地图服务是高德：逆地理编码（/v3/geocode/regeo, extensions=all）返回附近 POI / AOI 的
 * typecode 与 type。按高德 POI 分类编码判断：
 *   公共场所（公开名称 + 精确点）：1101xx 公园广场（公园、动物园、植物园、水族馆、城市广场），
 *     1102xx 风景名胜，以及名称含 公园/植物园/湿地/保护区/森林公园/风景区 的 AOI/POI。
 *   家附近（只公开区县 + 约 500m 模糊点）：1203xx 住宅区（别墅、住宅小区、宿舍、社区中心），
 *     1412xx 学校（高校、中小学、幼儿园、职校等）。
 *   其他/查询失败：unknown，按家附近处理，可由提交者确认「这是公共场所」后改为公开。
 * 结果只在服务端计算，最终的模糊坐标由数据库触发器生成。
 */
export type PlaceCategory = 'public_place' | 'private_area' | 'unknown'

export interface AmapPlaceCandidate {
  name?: string
  type?: string
  typecode?: string
  distance?: string | number
}

export interface PlacePrivacyResult {
  category: PlaceCategory
  /** 街道/乡镇（高德 township） */
  township: string | null
  /** 区县 */
  district: string | null
  /** 城市（直辖市取省名） */
  city: string | null
}

/** 对外显示的地点文字：街道/乡镇附近 → 区县附近 → 城市 → 大概区域（与数据库触发器一致）。 */
export function publicAreaLabel(place: Partial<Pick<PlacePrivacyResult, 'township' | 'district' | 'city'>> | null | undefined) {
  const t = place?.township?.trim(); if (t) return `${t}附近`
  const d = place?.district?.trim(); if (d) return `${d}附近`
  const c = place?.city?.trim(); if (c) return c
  return '大概区域'
}

const PUBLIC_TYPECODE_PREFIXES = ['1101', '1102']
const PRIVATE_TYPECODE_PREFIXES = ['1203', '1412']
const PUBLIC_NAME_PATTERN = /(公园|植物园|动物园|湿地|保护区|森林公园|风景区|景区|自然保护|郊野)/
const PRIVATE_NAME_PATTERN = /(小区|花园[一二三四五六七八九十\d]*期|家园|公寓|宿舍|新村|苑|府|学校|小学|中学|幼儿园|大学|学院|附中|附小|我家|家里|家门口|楼下)/
/** 判定用的半径：公共场所要求点就在里面或很近，家附近的范围放宽。 */
const PUBLIC_RADIUS_M = 150
const PRIVATE_RADIUS_M = 300

function distanceOf(candidate: AmapPlaceCandidate) {
  const value = Number(candidate.distance)
  return Number.isFinite(value) ? value : 0
}

function codesOf(candidate: AmapPlaceCandidate) {
  return String(candidate.typecode ?? '').split('|').filter(Boolean)
}

function isPublicCandidate(candidate: AmapPlaceCandidate) {
  return codesOf(candidate).some((code) => PUBLIC_TYPECODE_PREFIXES.some((prefix) => code.startsWith(prefix)))
    || PUBLIC_NAME_PATTERN.test(candidate.name ?? '')
}

function isPrivateCandidate(candidate: AmapPlaceCandidate) {
  return codesOf(candidate).some((code) => PRIVATE_TYPECODE_PREFIXES.some((prefix) => code.startsWith(prefix)))
    || /住宅|学校|宿舍/.test(candidate.type ?? '')
}

/**
 * 判定地点类型。家附近优先：只要附近 300m 内有住宅/学校、或填写的名称像小区/学校，就不公开精确点。
 */
export function classifyPlace(input: {
  locationName?: string | null
  candidates?: AmapPlaceCandidate[]
}): PlaceCategory {
  const name = (input.locationName ?? '').trim()
  const candidates = input.candidates ?? []

  if (PRIVATE_NAME_PATTERN.test(name) && !PUBLIC_NAME_PATTERN.test(name)) return 'private_area'
  if (candidates.some((item) => distanceOf(item) <= PRIVATE_RADIUS_M && isPrivateCandidate(item))) return 'private_area'

  const nearPublic = candidates.some((item) => distanceOf(item) <= PUBLIC_RADIUS_M && isPublicCandidate(item))
  if (nearPublic) return 'public_place'
  if (candidates.length === 0 && PUBLIC_NAME_PATTERN.test(name)) return 'public_place'
  return 'unknown'
}

/** 提交者确认「这是公园等公共场所」：只能把 unknown 升为公开，家附近不能被覆盖。 */
export function applyPublicPlaceConfirmation(category: PlaceCategory, confirmed: boolean | undefined): PlaceCategory {
  return category === 'unknown' && confirmed === true ? 'public_place' : category
}

interface AmapRegeoResponse {
  status?: string
  regeocode?: {
    addressComponent?: { city?: string | string[]; district?: string | string[]; township?: string | string[]; province?: string | string[] }
    pois?: AmapPlaceCandidate[]
    aois?: AmapPlaceCandidate[]
  }
}

function text(value: string | string[] | undefined) {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

/** 服务端调用高德逆地理编码，拿区县名和附近 POI/AOI 做分级。失败返回 unknown（按家附近处理）。 */
export async function resolvePlacePrivacy(input: {
  latitude: number | null | undefined
  longitude: number | null | undefined
  locationName?: string | null
  coordinateSystem?: string | null
  fetchImpl?: typeof fetch
  timeoutMs?: number
}): Promise<PlacePrivacyResult> {
  const key = process.env.AMAP_WEB_SERVICE_KEY || process.env.GAODE_WEB_SERVICE_KEY
  const { latitude, longitude } = input
  if (!key || latitude == null || longitude == null || !Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return { category: classifyPlace({ locationName: input.locationName }) === 'private_area' ? 'private_area' : 'unknown', township: null, district: null, city: null }
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), input.timeoutMs ?? 3000)
  try {
    const url = new URL('https://restapi.amap.com/v3/geocode/regeo')
    url.searchParams.set('key', key)
    url.searchParams.set('location', `${longitude},${latitude}`)
    url.searchParams.set('extensions', 'all')
    url.searchParams.set('radius', String(PRIVATE_RADIUS_M))
    url.searchParams.set('output', 'json')
    const response = await (input.fetchImpl ?? fetch)(url, { signal: controller.signal })
    if (!response.ok) return { category: 'unknown', township: null, district: null, city: null }
    const data = (await response.json()) as AmapRegeoResponse
    if (data.status !== '1' || !data.regeocode) return { category: 'unknown', township: null, district: null, city: null }
    const component = data.regeocode.addressComponent ?? {}
    const township = text(component.township)
    const district = text(component.district)
    const city = text(component.city) ?? text(component.province)
    const candidates = [
      ...(data.regeocode.aois ?? []).map((item) => ({ ...item, distance: item.distance ?? 0 })),
      ...(data.regeocode.pois ?? []),
    ]
    return { category: classifyPlace({ locationName: input.locationName, candidates }), township, district, city }
  } catch {
    return { category: 'unknown', township: null, district: null, city: null }
  } finally {
    clearTimeout(timer)
  }
}
