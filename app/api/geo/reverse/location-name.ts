interface AmapNamedLocation {
  name?: string
  type?: string
  distance?: string | number
}

interface AmapAddressComponent {
  province?: string
  city?: string | string[]
  district?: string
  township?: string
  streetNumber?: {
    street?: string
    number?: string
  }
}

export interface AmapRegeoCode {
  formatted_address?: string
  addressComponent?: AmapAddressComponent
  pois?: AmapNamedLocation[]
  aois?: AmapNamedLocation[]
}

const PLACE_KEYWORDS = [
  '公园',
  '湿地',
  '景区',
  '风景',
  '植物园',
  '动物园',
  '保护区',
  '自然',
  '森林',
  '湖',
  '山',
  '广场',
  '博物馆',
  '图书馆',
  '科技馆',
  '学校',
  '校区',
  '大学',
  '中学',
  '小学',
  '幼儿园',
  '体育',
  '场馆',
  '园区',
  '社区',
  '小区',
]

const ROAD_SUFFIXES = ['路', '街', '道', '大街', '大道', '桥', '巷', '胡同', '高速', '环路', '立交']

export function pickReadableLocationName(regeocode: AmapRegeoCode) {
  const nearbyPlace = pickBestNamedLocation(
    [...(regeocode.aois ?? []), ...(regeocode.pois ?? [])],
    { allowRoad: false },
  )
  if (nearbyPlace) return nearbyPlace

  const componentName = buildAdministrativeName(regeocode.addressComponent)
  if (componentName) return componentName

  const roadPoi = pickBestNamedLocation(regeocode.pois, { allowRoad: true })
  if (roadPoi) return roadPoi

  return cleanName(regeocode.formatted_address)
}

function pickBestNamedLocation(items: AmapNamedLocation[] | undefined, options: { allowRoad: boolean }) {
  if (!items?.length) return null

  const candidates = items
    .map((item) => ({
      name: cleanName(item.name),
      type: cleanName(item.type) || '',
      distance: parseDistance(item.distance),
    }))
    .filter((item): item is { name: string; type: string; distance: number } => Boolean(item.name))
    .filter((item) => options.allowRoad || !isRoadLike(item.name))
    .sort(compareNamedLocations)

  return candidates[0]?.name ?? null
}

function compareNamedLocations(
  left: { name: string; type: string; distance: number },
  right: { name: string; type: string; distance: number },
) {
  const leftHasDistance = Number.isFinite(left.distance)
  const rightHasDistance = Number.isFinite(right.distance)

  if (leftHasDistance || rightHasDistance) {
    if (!leftHasDistance) return 1
    if (!rightHasDistance) return -1
    const distanceDelta = left.distance - right.distance
    if (Math.abs(distanceDelta) > 120) return distanceDelta
  }

  const leftPlaceScore = isPlaceLike(`${left.name}${left.type}`) ? 1 : 0
  const rightPlaceScore = isPlaceLike(`${right.name}${right.type}`) ? 1 : 0
  if (leftPlaceScore !== rightPlaceScore) return rightPlaceScore - leftPlaceScore

  return left.distance - right.distance
}

function buildAdministrativeName(component: AmapAddressComponent | undefined) {
  if (!component) return null
  const city = Array.isArray(component.city) ? '' : cleanName(component.city)
  const district = cleanName(component.district)
  const township = cleanName(component.township)
  if (district && township) return `${district}${township}`
  if (district) return district
  if (city) return city
  return cleanName(component.province)
}

function isPlaceLike(value: string) {
  return PLACE_KEYWORDS.some((keyword) => value.includes(keyword))
}

function isRoadLike(value: string) {
  return ROAD_SUFFIXES.some((suffix) => value.endsWith(suffix))
}

function cleanName(value: unknown) {
  if (typeof value !== 'string') return null
  const normalized = value.trim()
  if (!normalized || normalized === '[]') return null
  return normalized
}

function parseDistance(value: unknown) {
  if (typeof value !== 'string' && typeof value !== 'number') return Number.POSITIVE_INFINITY
  const distance = Number(value)
  return Number.isFinite(distance) ? distance : Number.POSITIVE_INFINITY
}
