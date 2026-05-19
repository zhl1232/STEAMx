'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'

import { fetchProfileHomeData, invalidateProfileHomeData } from '@/lib/profile/profile-home-client'

export const profileHomeQueryKey = (userId: string | undefined) => ['profile', 'home', userId] as const

export function useProfilePageData(userId: string | undefined) {
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: profileHomeQueryKey(userId),
    queryFn: () => fetchProfileHomeData(userId!),
    enabled: !!userId,
  })

  const refetchProfileHome = useCallback(async () => {
    if (!userId) return
    invalidateProfileHomeData(userId)
    await queryClient.invalidateQueries({ queryKey: profileHomeQueryKey(userId) })
  }, [queryClient, userId])

  return {
    ...query,
    refetchProfileHome,
  }
}
