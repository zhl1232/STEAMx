/** @vitest-environment node */

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

import {
  TRIAGED_PROJECT_IDS_TO_DELETE,
  TRIAGED_PROJECT_IDS_TO_KEEP,
  isProjectOwnedOssKey,
  ossKeyFromImageUrl,
  parseIdsFromSqlIntegerList,
  sqlIntegerList,
} from '../scripts/lib/content-triage-2026-08-13.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const MIGRATION_PATH = join(
  ROOT,
  'supabase/migrations/20260813090000_hard_delete_triaged_projects.sql',
)

const EXPECTED_DELETE_IDS = [
  30, 34, 35, 37, 49, 80, 100, 103, 123, 130, 131, 135, 136, 137, 138, 139,
  140, 141, 142, 143, 144, 145, 146, 147, 148, 161, 162, 163, 164, 165, 167,
  168, 181, 182, 185, 186, 188, 189, 190, 191, 192, 193, 194, 195, 196, 197,
  198, 199, 200, 201, 202, 203, 204, 206, 207, 221, 230, 234, 236, 238, 239,
  241, 242, 244, 248, 252, 265, 275, 282, 287, 304, 305, 306, 324, 325, 327,
  329, 330, 344, 347, 367, 368, 370, 371, 372, 377, 382, 384, 391, 393, 394,
  396, 397, 398, 399, 403, 404, 405, 406, 408, 409, 410, 424, 457, 461,
]

describe('2026-08-13 内容分诊 ID 名单', () => {
  it('恰好 105 个互不相同的删除 ID，并保留合并胜出项', () => {
    expect(TRIAGED_PROJECT_IDS_TO_DELETE).toHaveLength(105)
    expect(new Set(TRIAGED_PROJECT_IDS_TO_DELETE).size).toBe(105)
    expect([...TRIAGED_PROJECT_IDS_TO_DELETE]).toEqual(EXPECTED_DELETE_IDS)
    expect(TRIAGED_PROJECT_IDS_TO_KEEP).toEqual([52, 73, 119, 120, 177, 352])

    const deleteSet = new Set(TRIAGED_PROJECT_IDS_TO_DELETE)
    for (const id of TRIAGED_PROJECT_IDS_TO_KEEP) {
      expect(deleteSet.has(id)).toBe(false)
    }
  })

  it('SQL 迁移中的 ID 列表与 JS 模块保持一致', () => {
    const sql = readFileSync(MIGRATION_PATH, 'utf8')
    const insertMatch = sql.match(
      /INSERT INTO triaged_project_ids \(id\) VALUES([\s\S]*?);/,
    )
    expect(insertMatch?.[1]).toBeTruthy()
    const insertBlock = insertMatch?.[1] ?? ''

    const sqlIds = [...insertBlock.matchAll(/\((\d+)\)/g)].map((match) => Number(match[1]))
    expect(sqlIds).toEqual([...TRIAGED_PROJECT_IDS_TO_DELETE])
    expect(sql).toContain('硬删除')
    expect(sql).toContain('孩子+家长')
    expect(sqlIntegerList(TRIAGED_PROJECT_IDS_TO_DELETE)).toContain('461')
    expect(parseIdsFromSqlIntegerList('30, 34, 352')).toEqual([30, 34, 352])
  })
})

describe('分诊 OSS key 过滤', () => {
  const assetsBase = 'https://assets.example.com'

  it('把 generated / steps 目录 URL 映射成 OSS key', () => {
    expect(ossKeyFromImageUrl('/projects/generated/project-0030.webp')).toBe(
      'projects/generated/project-0030.webp',
    )
    expect(
      ossKeyFromImageUrl(`${assetsBase}/projects/steps/foo.webp`, assetsBase),
    ).toBe('projects/steps/foo.webp')
    expect(
      ossKeyFromImageUrl('/api/assets/projects/generated/project-0142.webp'),
    ).toBe('projects/generated/project-0142.webp')
    expect(ossKeyFromImageUrl('projects/generated/project-0030.webp')).toBe(
      'projects/generated/project-0030.webp',
    )
    expect(isProjectOwnedOssKey('projects/generated/project-0030.webp')).toBe(true)
    expect(isProjectOwnedOssKey('projects/steps/demo.webp')).toBe(true)
  })

  it('跳过共用封面、物种图、课件、Scratch 和 Supabase Storage', () => {
    expect(isProjectOwnedOssKey('projects/default-cover.webp')).toBe(false)
    expect(isProjectOwnedOssKey('projects/science_physics.webp')).toBe(false)
    expect(isProjectOwnedOssKey('courses/eiffel-tower/slides/slide-01.webp')).toBe(false)
    expect(isProjectOwnedOssKey('scratch/assets/abc.png')).toBe(false)
    expect(isProjectOwnedOssKey('birds/images/turdus-merula-1.webp')).toBe(false)
    expect(
      ossKeyFromImageUrl(
        'https://example.supabase.co/storage/v1/object/public/project-images/covers/user/file.webp',
      ),
    ).toBeNull()
  })
})
