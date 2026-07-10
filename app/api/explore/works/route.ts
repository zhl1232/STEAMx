import { NextRequest, NextResponse } from "next/server"

import { logger } from "@/lib/logger"
import { getTrendingWorks } from "@/lib/works/data"

const DEFAULT_LIMIT = 8

export async function GET(request: NextRequest) {
  try {
    const parsed = Number(request.nextUrl.searchParams.get("offset") || 0)
    const offset = Number.isInteger(parsed) && parsed >= 0 ? parsed : 0
    const parsedLimit = Number(request.nextUrl.searchParams.get("limit") || DEFAULT_LIMIT)
    const limit = Number.isInteger(parsedLimit)
      ? Math.min(DEFAULT_LIMIT, Math.max(1, parsedLimit))
      : DEFAULT_LIMIT
    return NextResponse.json(await getTrendingWorks(limit, offset))
  } catch (error) {
    logger.error("Failed to load explore works", { error })
    return NextResponse.json({ error: "Failed to load works" }, { status: 500 })
  }
}
