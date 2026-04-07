import type { SupabaseClient } from '@supabase/supabase-js'

import type { Database } from '@/lib/supabase/types'
import { logger } from '@/lib/logger'

export type SteamRadarWithGuidance = Record<string, {
  raw: number
  display: number
  tier: string
  guidance: string | null
}>

const TIER_GUIDANCE: Record<string, Record<string, string>> = {
  none: {
    S: '还没探索过科学领域，去看看相关项目吧',
    T: '还没探索过技术领域，去看看相关项目吧',
    E: '还没探索过工程领域，去看看相关项目吧',
    A: '还没探索过艺术领域，去看看相关项目吧',
    M: '还没探索过数学领域，去看看相关项目吧',
  },
  foundation: {
    S: '完成一个 3 星以上的科学项目来突破基础段',
    T: '完成一个 3 星以上的技术项目来突破基础段',
    E: '完成一个 3 星以上的工程项目来突破基础段',
    A: '完成一个 3 星以上的艺术项目来突破基础段',
    M: '完成一个 3 星以上的数学项目来突破基础段',
  },
  intermediate: {
    S: '挑战高难度科学项目可以解锁挑战段（75+）',
    T: '挑战高难度技术项目可以解锁挑战段（75+）',
    E: '挑战高难度工程项目可以解锁挑战段（75+）',
    A: '挑战高难度艺术项目可以解锁挑战段（75+）',
    M: '挑战高难度数学项目可以解锁挑战段（75+）',
  },
}

export async function getSteamRadarWithGuidance(
  supabase: SupabaseClient<Database, 'public'>,
  userId: string,
): Promise<SteamRadarWithGuidance> {
  const { data, error } = await (supabase.rpc as unknown as (
    fn: string,
    args: unknown,
  ) => PromiseLike<{ data: unknown; error: unknown }>)(
    'calculate_steam_radar',
    { target_user_id: userId },
  )

  if (error) {
    throw error
  }

  const result = data as Record<string, { raw: number; display: number; tier: string }> | null
  const withGuidance: SteamRadarWithGuidance = {}

  for (const dim of ['S', 'T', 'E', 'A', 'M']) {
    const radar = result?.[dim] || { raw: 0, display: 0, tier: 'none' }
    withGuidance[dim] = {
      ...radar,
      guidance: TIER_GUIDANCE[radar.tier]?.[dim] || null,
    }
  }

  return withGuidance
}

export async function getSteamRadarWithGuidanceSafe(
  supabase: SupabaseClient<Database, 'public'>,
  userId: string,
  context: string,
): Promise<SteamRadarWithGuidance | null> {
  try {
    return await getSteamRadarWithGuidance(supabase, userId)
  } catch (error) {
    logger.warn('Failed to calculate STEAM radar, continuing without it', {
      context,
      userId,
      error,
    })

    return null
  }
}
