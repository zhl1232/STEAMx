import { NextRequest, NextResponse } from "next/server";

import { getHomepageRecommendations, type HomepageRecommendationMode } from "@/lib/home/recommendations";
import { logger } from "@/lib/logger";

function parsePositiveInteger(value: string | null, fallback: number): number {
  const parsed = Number.parseInt(value || "", 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return fallback;
  }

  return parsed;
}

function parseMode(value: string | null): HomepageRecommendationMode | undefined {
  return value === "popular-fallback" || value === "personalized" ? value : undefined;
}

function parseExcludeIds(value: string | null): Array<string | number> {
  if (!value) return [];

  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => {
      const numericValue = Number(item);
      return Number.isInteger(numericValue) ? numericValue : item;
    });
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const limit = Math.min(8, Math.max(1, parsePositiveInteger(searchParams.get("limit"), 4) || 4));
  const offset = parsePositiveInteger(searchParams.get("offset"), 0);
  const mode = parseMode(searchParams.get("mode"));
  const excludeIds = parseExcludeIds(searchParams.get("excludeIds"));

  try {
    const payload = await getHomepageRecommendations({
      limit,
      offset,
      mode,
      excludeIds,
    });

    return NextResponse.json(payload);
  } catch (error) {
    logger.error("Error in GET /api/home/recommendations", { error, limit, offset, mode });
    return NextResponse.json(
      { error: "Failed to fetch homepage recommendations" },
      { status: 500 },
    );
  }
}
