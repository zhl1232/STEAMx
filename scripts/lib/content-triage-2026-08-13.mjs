/**
 * 2026-08-13 站长内容分诊（zhl1232）。
 *
 * 硬删除迁移、OSS 清理脚本、漂移测试共用的权威 ID 列表。
 * 不要重新 seed TRIAGED_PROJECT_IDS_TO_DELETE。
 *
 * 保留（合并胜出 / 仍待处理、仍然上线）：52、73、119、120、177、352，
 * 以及删除名单以外的所有已审核项目。
 */

export const CONTENT_TRIAGE_DATE = '2026-08-13'

export const TRIAGED_PROJECT_IDS_TO_KEEP = Object.freeze([
  52, 73, 119, 120, 177, 352,
])

export const TRIAGED_PROJECT_IDS_TO_DELETE = Object.freeze([
  30, 34, 35, 37, 49, 80, 100, 103, 123, 130, 131, 135, 136, 137, 138, 139,
  140, 141, 142, 143, 144, 145, 146, 147, 148, 161, 162, 163, 164, 165, 167,
  168, 181, 182, 185, 186, 188, 189, 190, 191, 192, 193, 194, 195, 196, 197,
  198, 199, 200, 201, 202, 203, 204, 206, 207, 221, 230, 234, 236, 238, 239,
  241, 242, 244, 248, 252, 265, 275, 282, 287, 304, 305, 306, 324, 325, 327,
  329, 330, 344, 347, 367, 368, 370, 371, 372, 377, 382, 384, 391, 393, 394,
  396, 397, 398, 399, 403, 404, 405, 406, 408, 409, 410, 424, 457, 461,
])

/** 全站 /projects 共用封面：即使分诊行指向它们，也一律不删。 */
export const SHARED_PROJECT_COVER_KEYS = Object.freeze([
  'projects/default-cover.webp',
  'projects/science_physics.webp',
  'projects/tech_programming.webp',
  'projects/eng_mechanical.webp',
  'projects/art_painting.webp',
  'projects/sensory_box.webp',
])

const SHARED_COVER_SET = new Set(SHARED_PROJECT_COVER_KEYS)

const PROTECTED_PREFIXES = Object.freeze([
  'birds/',
  'insects/',
  'trees/',
  'fruits/',
  'courses/',
  'scratch/',
  'avatars/',
  'xiaodi/',
  'xiaodi-ai/',
  'assets/',
  'gomoku-rapfi/',
])

const PROJECT_OWN_PREFIXES = Object.freeze([
  'projects/generated/',
  'projects/steps/',
])

export function sqlIntegerList(ids) {
  return ids.join(', ')
}

export function parseIdsFromSqlIntegerList(sql) {
  return sql
    .split(',')
    .map((part) => Number.parseInt(part.trim(), 10))
    .filter((id) => Number.isInteger(id) && id > 0)
}

/**
 * 把库里存的图片 URL 转成 Aliyun OSS object key。
 * 不是 OSS / 公开项目路径时返回 null（Supabase Storage、data URL、空值等）。
 */
export function ossKeyFromImageUrl(rawUrl, assetsBaseUrl = '') {
  if (typeof rawUrl !== 'string') return null
  const trimmed = rawUrl.trim()
  if (!trimmed) return null

  let pathname = trimmed
  const base = String(assetsBaseUrl || '').trim().replace(/\/+$/, '')

  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const parsed = new URL(trimmed)
      if (parsed.pathname.includes('/storage/v1/')) return null
      pathname = parsed.pathname
      if (base) {
        const expected = new URL(base)
        if (parsed.hostname !== expected.hostname) return null
      }
    } catch {
      return null
    }
  } else if (trimmed.startsWith('projects/')) {
    return trimmed.split('?')[0]
  } else if (!trimmed.startsWith('/')) {
    return null
  } else {
    pathname = trimmed.split('?')[0]
  }

  pathname = pathname.split('?')[0]
  if (pathname.startsWith('/api/assets/')) {
    pathname = pathname.slice('/api/assets'.length)
  }
  if (!pathname.startsWith('/')) return null

  return pathname.replace(/^\/+/, '')
}

export function isProtectedOssKey(key) {
  if (!key) return true
  if (SHARED_COVER_SET.has(key)) return true
  if (PROTECTED_PREFIXES.some((prefix) => key === prefix.slice(0, -1) || key.startsWith(prefix))) {
    return true
  }
  if (key === 'projects/default-cover.webp') return true
  return false
}

/**
 * 只认项目自己的目录上传：OSS `projects/` 下的 generated 封面和步骤图。
 * 根层 `/projects/*.webp` 分类图和默认封面一律跳过。
 */
export function isProjectOwnedOssKey(key) {
  if (!key || isProtectedOssKey(key)) return false
  return PROJECT_OWN_PREFIXES.some((prefix) => key.startsWith(prefix))
}
