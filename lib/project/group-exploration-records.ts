import type { ProjectCompletion } from "@/lib/mappers/types"
import { matchesRecordTypeFilter } from "@/lib/project/exploration-record-meta"

export type ExplorationRecordGroup = {
  key: string
  explorationId?: number
  userId: string
  author: string
  avatar?: string
  avatarFrameId?: string | null
  authorLevel?: number
  /** 组内按时间正序（探索时间线） */
  posts: ProjectCompletion[]
  /** 有终稿时优先展示终稿，否则展示最近一步。 */
  representative: ProjectCompletion
  finalPost?: ProjectCompletion
  /** 该组最新一条，用于组间排序 */
  latestAtIso: string
}

function postTimeIso(post: ProjectCompletion) {
  return post.completedAtIso || ""
}

function groupKey(post: ProjectCompletion) {
  return post.explorationId
    ? `exploration:${post.explorationId}`
    : `legacy-user:${post.userId}`
}

/** 按探索会话聚合；组间按最新动态倒序，组内按时间正序。 */
export function groupCompletionsByExploration(completions: ProjectCompletion[]): ExplorationRecordGroup[] {
  const byExploration = new Map<string, ProjectCompletion[]>()

  for (const item of completions) {
    const key = groupKey(item)
    const list = byExploration.get(key) ?? []
    list.push(item)
    byExploration.set(key, list)
  }

  const groups: ExplorationRecordGroup[] = []

  for (const [key, posts] of byExploration) {
    const chronological = [...posts].sort((a, b) => postTimeIso(a).localeCompare(postTimeIso(b)))
    const latest = chronological[chronological.length - 1]
    const finalPost = chronological.findLast((post) => post.recordKind === 'final')

    groups.push({
      key,
      explorationId: latest.explorationId,
      userId: latest.userId,
      author: latest.author,
      avatar: latest.avatar,
      avatarFrameId: latest.avatarFrameId,
      authorLevel: latest.authorLevel,
      posts: chronological,
      representative: finalPost ?? latest,
      finalPost,
      latestAtIso: postTimeIso(latest),
    })
  }

  return groups.sort((a, b) => b.latestAtIso.localeCompare(a.latestAtIso))
}

/**
 * Filter the posts shown inside each exploration without throwing away the
 * group's final-post metadata. A final submission normally has no record type,
 * so filtering the raw rows before grouping makes an otherwise completed
 * exploration look unfinished.
 */
export function filterExplorationRecordGroups(
  groups: ExplorationRecordGroup[],
  typeFilter: string,
): ExplorationRecordGroup[] {
  if (typeFilter === "all") return groups

  return groups.flatMap((group) => {
    const posts = group.posts.filter((post) => matchesRecordTypeFilter(post, typeFilter))
    return posts.length > 0 ? [{ ...group, posts }] : []
  })
}

/** @deprecated Use groupCompletionsByExploration. */
export const groupCompletionsByExplorer = groupCompletionsByExploration
