'use client'

import { useQuery } from '@tanstack/react-query'

import {
  fetchProfileSummary,
  profileSummaryQueryKey,
} from '@/lib/profile/profile-summary-client'

export function useProfileSummary(userId: string | undefined) {
  return useQuery({
    queryKey: profileSummaryQueryKey(userId),
    queryFn: () => fetchProfileSummary(userId!),
    enabled: !!userId,
    staleTime: 60_000,
  })
}
