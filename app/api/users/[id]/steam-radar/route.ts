import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()

  try {
    const { id } = await params

    const { data, error } = await (supabase.rpc as unknown as (
      fn: string, args: unknown
    ) => PromiseLike<{ data: unknown; error: unknown }>)(
      'calculate_steam_radar',
      { target_user_id: id }
    )

    if (error) throw error

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

    const result = data as Record<string, { raw: number; display: number; tier: string }>

    const withGuidance: Record<string, unknown> = {}
    for (const dim of ['S', 'T', 'E', 'A', 'M']) {
      const d = result?.[dim] || { raw: 0, display: 0, tier: 'none' }
      withGuidance[dim] = {
        ...d,
        guidance: TIER_GUIDANCE[d.tier]?.[dim] || null,
      }
    }

    return NextResponse.json({ radar: withGuidance })
  } catch (error) {
    logger.error('Error in GET /api/users/[id]/steam-radar', { error })
    return NextResponse.json({ error: 'Failed to calculate STEAM radar' }, { status: 500 })
  }
}
