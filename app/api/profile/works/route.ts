import { NextRequest, NextResponse } from "next/server"

import { handleApiError, requireAuth } from "@/lib/api/auth"
import { createClient } from "@/lib/supabase/server"
import { getUserWorks } from "@/lib/works/data"

export async function GET(request: NextRequest) {
  const client = await createClient()
  try {
    const user = await requireAuth(client)
    const page = Math.max(0, Number(request.nextUrl.searchParams.get("page") || 0) || 0)
    const pageSize = Math.min(24, Math.max(1, Number(request.nextUrl.searchParams.get("pageSize") || 24) || 24))
    return NextResponse.json(await getUserWorks({ userId: user.id, page, pageSize }))
  } catch (error) {
    return handleApiError(error)
  }
}
