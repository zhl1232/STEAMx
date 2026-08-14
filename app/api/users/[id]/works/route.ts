import { NextRequest, NextResponse } from "next/server"

import { handleApiError } from "@/lib/api/auth"
import { isUuid } from "@/lib/api/validation"
import { getUserWorks } from "@/lib/works/data"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const userId = (await params).id
    // 非 UUID 直接拦下，否则 Postgres 会抛 22P02，被当成 500 透出。
    if (!isUuid(userId)) return NextResponse.json({ error: "User not found" }, { status: 404 })
    const page = Math.max(0, Number(request.nextUrl.searchParams.get("page") || 0) || 0)
    return NextResponse.json(await getUserWorks({ userId, page, pageSize: 12, publicOnly: true }))
  } catch (error) {
    return handleApiError(error)
  }
}
