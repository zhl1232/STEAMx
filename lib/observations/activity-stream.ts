import type { Comment, ObservationIdentification } from '@/lib/mappers/types'

export type ActivityStreamItem =
  | {
      kind: 'identification'
      id: string
      createdAt: string
      identification: ObservationIdentification
    }
  | {
      kind: 'comment'
      id: string
      createdAt: string
      comment: Comment
    }

export function buildActivityStream(
  identifications: ObservationIdentification[],
  comments: Comment[],
): ActivityStreamItem[] {
  const items: ActivityStreamItem[] = [
    ...identifications.map((identification) => ({
      kind: 'identification' as const,
      id: `id-${identification.id}`,
      createdAt: identification.createdAt,
      identification,
    })),
    ...comments.map((comment) => ({
      kind: 'comment' as const,
      id: `comment-${comment.id}`,
      createdAt: comment.created_at ?? comment.date,
      comment,
    })),
  ]

  return items.toSorted(
    (left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime(),
  )
}
