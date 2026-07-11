import { NextRequest, NextResponse } from "next/server"
import { logger } from "@/lib/logger"
import { createClient } from "@/lib/supabase/server"

const DIFFICULTIES = new Set(["beginner", "intermediate", "expert"])

type MinesweeperLeaderboardRow = {
  user_id: string
  display_name: string | null
  avatar_url: string | null
  best_time: number
  rank: number
}

export async function GET(request: NextRequest) {
  const difficulty = request.nextUrl.searchParams.get("difficulty") ?? "beginner"
  if (!DIFFICULTIES.has(difficulty)) {
    return NextResponse.json({ error: "Invalid difficulty" }, { status: 400 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const { data, error } = await supabase.rpc("get_minesweeper_leaderboard", {
      difficulty_key: difficulty,
      limit_count: 10,
    })
    if (error) throw error

    const rows = (data as MinesweeperLeaderboardRow[] | null) ?? []
    return NextResponse.json({
      entries: rows.map((row) => ({
        userId: row.user_id,
        name: row.display_name || "神秘玩家",
        avatarUrl: row.avatar_url,
        bestTime: Number(row.best_time),
        rank: Number(row.rank),
        isCurrentUser: row.user_id === user.id,
      })),
    })
  } catch (error) {
    logger.error("Error in GET /api/playground/minesweeper/leaderboard", { error })
    return NextResponse.json({ error: "Failed to fetch leaderboard" }, { status: 500 })
  }
}
