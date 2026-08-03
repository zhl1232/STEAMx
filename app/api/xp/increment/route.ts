import { NextResponse } from 'next/server'

export async function POST() {
  return NextResponse.json(
    {
      error: 'XP 只能由服务端业务事件发放',
      code: 'XP_EVENT_REQUIRED',
    },
    { status: 410 },
  )
}
