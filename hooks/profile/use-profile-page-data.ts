'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'

import { fetchProfileHomeData, invalidateProfileHomeData, mergeProfileHomeData, type ProfileHomeData } from '@/lib/profile/profile-home-client'
import { invalidateProfileSummary, profileSummaryQueryKey } from '@/lib/profile/profile-summary-client'

export const profileHomeQueryKey = (userId: string | undefined) => ['profile', 'home', userId] as const

export function useProfilePageData(userId: string | undefined) {
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: profileHomeQueryKey(userId),
    queryFn: async () => {
      const next = await fetchProfileHomeData(userId!)
      return mergeProfileHomeData(queryClient.getQueryData<ProfileHomeData>(profileHomeQueryKey(userId)), next)
    },
    enabled: !!userId,
  })

  const refetchProfileHome = useCallback(async () => {
    if (!userId) return
    invalidateProfileHomeData(userId)
    invalidateProfileSummary(userId)
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: profileHomeQueryKey(userId) }),
      queryClient.invalidateQueries({ queryKey: profileSummaryQueryKey(userId) }),
    ])
  }, [queryClient, userId])

  return {
    ...query,
    refetchProfileHome,
  }
}
