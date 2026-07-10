import type { Work, WorkSource } from '@/lib/mappers/types'

export type { Work, WorkSource }

export type WorkSubmissionPayload = {
  images: string[]
  imageCaptions?: string[]
  videoUrl?: string | null
  notes?: string
  isPublic?: boolean
}

export type WorkListResult = {
  works: Work[]
  total: number
  hasMore: boolean
}
