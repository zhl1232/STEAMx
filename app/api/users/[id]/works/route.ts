import { NextRequest, NextResponse } from "next/server"

import { handleApiError } from "@/lib/api/auth"
import { getUserWorks } from "@/lib/works/data"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const userId = (await params).id
    if (!userId) return NextResponse.json({ error: "Invalid user id" }, { status: 400 })
    const page = Math.max(0, Number(request.nextUrl.searchParams.get("page") || 0) || 0)
    return NextResponse.json(await getUserWorks({ userId, page, pageSize: 12, publicOnly: true }))
  } catch (error) {
    return handleApiError(error)
  }
}
