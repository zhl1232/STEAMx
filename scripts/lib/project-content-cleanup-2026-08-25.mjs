/**
 * 2026-08-25 项目目录清理迁移的权威项目 ID 列表。
 *
 * 数据库硬删除使用同一组 ID；资源清理脚本通过 --scope=2026-08-25
 * 选择本批，默认仍使用 2026-08-13 的旧分诊名单。
 */

export const PROJECT_CONTENT_CLEANUP_DATE = '2026-08-25'

export const PROJECT_CONTENT_CLEANUP_PROJECT_IDS = Object.freeze([
  422, 423, 126, 127, 128, 129, 132, 133, 134, 308,
  57, 59, 60, 61, 63, 64, 68, 75, 77, 78, 79,
  101, 104, 187, 205, 297, 301, 387, 388, 390, 401, 421, 451,
  229, 231, 232, 235, 237, 240, 245, 246, 247,
  106, 115, 122, 270, 278, 279, 280, 281, 283, 284, 285, 288, 335,
  208, 345, 349, 350,
])

export const PROJECT_CONTENT_CLEANUP_CHALLENGE_IDS = Object.freeze([4])
