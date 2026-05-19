import type { ProjectCompletion } from "@/lib/mappers/types"

export type ExplorationRecordGroup = {
  userId: string
  author: string
  avatar?: string
  authorLevel?: number
  /** 组内按时间正序（探索时间线） */
  posts: ProjectCompletion[]
  /** 该组最新一条，用于组间排序 */
  latestAtIso: string
}

function postTimeIso(post: ProjectCompletion) {
  return post.completedAtIso || ""
}

/** 按探索者聚合；组间按最新动态倒序，组内按时间正序 */
export function groupCompletionsByExplorer(completions: ProjectCompletion[]): ExplorationRecordGroup[] {
  const byUser = new Map<string, ProjectCompletion[]>()

  for (const item of completions) {
    const list = byUser.get(item.userId) ?? []
    list.push(item)
    byUser.set(item.userId, list)
  }

  const groups: ExplorationRecordGroup[] = []

  for (const [userId, posts] of byUser) {
    const chronological = [...posts].sort((a, b) => postTimeIso(a).localeCompare(postTimeIso(b)))
    const latest = [...posts].sort((a, b) => postTimeIso(b).localeCompare(postTimeIso(a)))[0]

    groups.push({
      userId,
      author: latest.author,
      avatar: latest.avatar,
      authorLevel: latest.authorLevel,
      posts: chronological,
      latestAtIso: postTimeIso(latest),
    })
  }

  return groups.sort((a, b) => b.latestAtIso.localeCompare(a.latestAtIso))
}
