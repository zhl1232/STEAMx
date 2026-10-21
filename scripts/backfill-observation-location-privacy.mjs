#!/usr/bin/env node
/**
 * 回填历史自然观察的位置隐私分级（第 15 条）。**默认只读预览，不写库。**
 *
 * 依赖迁移 20261021130000_observation_location_privacy.sql 已上线。
 * 对每条 observation_events（place_category='unknown' 且 public_district 为空）：
 *   1. 用高德逆地理编码（extensions=all）取区县与附近 POI/AOI 类型；
 *   2. 按 lib/geo/place-privacy.ts 同一规则分级（public_place / private_area / unknown）；
 *   3. --apply 时以 service_role 写回 place_category、public_district，
 *      由数据库触发器重算 public_location_name / public_latitude / public_longitude。
 * 不修改 location_name / latitude / longitude 等原始列。
 *
 * 用法（需人工确认后才执行写入）：
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... AMAP_WEB_SERVICE_KEY=... \
 *     node scripts/backfill-observation-location-privacy.mjs            # 预览
 *   CONFIRM_PROD_WRITE=observation-location-privacy \
 *     node scripts/backfill-observation-location-privacy.mjs --apply    # 写入
 *
 * 不读取 .env 文件，不启动子进程。
 */

const PUBLIC_TYPECODE_PREFIXES = ['1101', '1102']
const PRIVATE_TYPECODE_PREFIXES = ['1203', '1412']
const PUBLIC_NAME_PATTERN = /(公园|植物园|动物园|湿地|保护区|森林公园|风景区|景区|自然保护|郊野)/
const PRIVATE_NAME_PATTERN = /(小区|花园[一二三四五六七八九十\d]*期|家园|公寓|宿舍|新村|苑|府|学校|小学|中学|幼儿园|大学|学院|附中|附小|我家|家里|家门口|楼下)/
const PUBLIC_RADIUS_M = 150
const PRIVATE_RADIUS_M = 300

const distanceOf = (item) => (Number.isFinite(Number(item.distance)) ? Number(item.distance) : 0)
const codesOf = (item) => String(item.typecode ?? '').split('|').filter(Boolean)
const isPublic = (item) => codesOf(item).some((code) => PUBLIC_TYPECODE_PREFIXES.some((p) => code.startsWith(p))) || PUBLIC_NAME_PATTERN.test(item.name ?? '')
const isPrivate = (item) => codesOf(item).some((code) => PRIVATE_TYPECODE_PREFIXES.some((p) => code.startsWith(p))) || /住宅|学校|宿舍/.test(item.type ?? '')

export function classifyPlace({ locationName, candidates = [] }) {
  const name = String(locationName ?? '').trim()
  if (PRIVATE_NAME_PATTERN.test(name) && !PUBLIC_NAME_PATTERN.test(name)) return 'private_area'
  if (candidates.some((item) => distanceOf(item) <= PRIVATE_RADIUS_M && isPrivate(item))) return 'private_area'
  if (candidates.some((item) => distanceOf(item) <= PUBLIC_RADIUS_M && isPublic(item))) return 'public_place'
  if (candidates.length === 0 && PUBLIC_NAME_PATTERN.test(name)) return 'public_place'
  return 'unknown'
}

async function regeo(key, lat, lng) {
  const url = new URL('https://restapi.amap.com/v3/geocode/regeo')
  url.searchParams.set('key', key)
  url.searchParams.set('location', `${lng},${lat}`)
  url.searchParams.set('extensions', 'all')
  url.searchParams.set('radius', String(PRIVATE_RADIUS_M))
  const response = await fetch(url)
  const data = await response.json()
  if (data.status !== '1' || !data.regeocode) return { district: null, candidates: [] }
  const c = data.regeocode.addressComponent ?? {}
  const pick = (v) => (typeof v === 'string' && v.trim() ? v.trim() : null)
  return {
    district: pick(c.district) ?? pick(c.city) ?? pick(c.province),
    candidates: [...(data.regeocode.aois ?? []).map((a) => ({ ...a, distance: a.distance ?? 0 })), ...(data.regeocode.pois ?? [])],
  }
}

async function main() {
  const apply = process.argv.includes('--apply')
  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, AMAP_WEB_SERVICE_KEY, CONFIRM_PROD_WRITE } = process.env
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !AMAP_WEB_SERVICE_KEY) {
    console.error('缺少 SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / AMAP_WEB_SERVICE_KEY')
    process.exitCode = 1
    return
  }
  if (apply && CONFIRM_PROD_WRITE !== 'observation-location-privacy') {
    console.error('写入需要 CONFIRM_PROD_WRITE=observation-location-privacy')
    process.exitCode = 1
    return
  }
  const headers = { apikey: SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json' }
  const listUrl = `${SUPABASE_URL}/rest/v1/observation_events?select=id,location_name,latitude,longitude,location_precision&place_category=eq.unknown&public_district=is.null&order=id.asc&limit=1000`
  const rows = await (await fetch(listUrl, { headers })).json()
  if (!Array.isArray(rows)) throw new Error(`读取失败：${JSON.stringify(rows)}`)

  const summary = { public_place: 0, private_area: 0, unknown: 0 }
  for (const row of rows) {
    const located = row.latitude != null && row.longitude != null
    const geo = located ? await regeo(AMAP_WEB_SERVICE_KEY, row.latitude, row.longitude) : { district: null, candidates: [] }
    const category = classifyPlace({ locationName: row.location_name, candidates: geo.candidates })
    summary[category] += 1
    console.log(`#${row.id}\t${category}\t${geo.district ?? '-'}`)
    if (apply) {
      const response = await fetch(`${SUPABASE_URL}/rest/v1/observation_events?id=eq.${row.id}`, {
        method: 'PATCH',
        headers: { ...headers, Prefer: 'return=minimal' },
        body: JSON.stringify({ place_category: category, public_district: geo.district }),
      })
      if (!response.ok) console.error(`#${row.id} 写入失败 ${response.status}`)
    }
    await new Promise((resolve) => setTimeout(resolve, 120)) // 高德 QPS
  }
  console.log(`${apply ? '已写入' : '预览（未写入）'}：共 ${rows.length} 条`, summary)
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
}
