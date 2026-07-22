import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export function GET() {
  const memory = process.memoryUsage()
  const toMegabytes = (bytes: number) => Math.round((bytes / 1024 / 1024) * 10) / 10

  return NextResponse.json(
    {
      ok: true,
      service: 'steam-app',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.round(process.uptime()),
      memory: {
        rssMb: toMegabytes(memory.rss),
        heapUsedMb: toMegabytes(memory.heapUsed),
        heapTotalMb: toMegabytes(memory.heapTotal),
        externalMb: toMegabytes(memory.external),
        arrayBuffersMb: toMegabytes(memory.arrayBuffers),
      },
    },
    {
      headers: {
        'Cache-Control': 'no-store',
      },
    },
  )
}
