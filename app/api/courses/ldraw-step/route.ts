import { readFile, stat } from 'node:fs/promises'
import path from 'node:path'

import { NextRequest, NextResponse } from 'next/server'

import { createPackedLdrawStep } from '@/lib/utils/ldraw-mpd'

export const runtime = 'nodejs'

const MODEL_NAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]*\.mpd$/
const LDRAW_DIRECTORY = path.resolve(process.cwd(), 'public/courses/ldraw')
const MAX_LDRAW_MODEL_BYTES = 16 * 1024 * 1024
const MAX_CONCURRENT_LDRAW_TRANSFORMS = 4
type PackedStep = ReturnType<typeof createPackedLdrawStep>
const packedStepInFlight = new Map<string, Promise<PackedStep>>()

class LdrawTransformBusyError extends Error {}

function loadPackedStep(model: string, step: number): Promise<PackedStep> {
  const cacheKey = `${model}:${step}`
  const existing = packedStepInFlight.get(cacheKey)
  if (existing) return existing
  if (packedStepInFlight.size >= MAX_CONCURRENT_LDRAW_TRANSFORMS) {
    throw new LdrawTransformBusyError('Too many LDraw transforms are running')
  }

  const promise = (async () => {
    const modelPath = path.join(LDRAW_DIRECTORY, model)
    const modelStat = await stat(modelPath)
    if (!modelStat.isFile() || modelStat.size > MAX_LDRAW_MODEL_BYTES) {
      throw new RangeError('LDraw model is too large')
    }

    const sourceMpd = await readFile(modelPath, 'utf8')
    return createPackedLdrawStep(sourceMpd, step)
  })().finally(() => {
    if (packedStepInFlight.get(cacheKey) === promise) packedStepInFlight.delete(cacheKey)
  })

  packedStepInFlight.set(cacheKey, promise)
  return promise
}

export async function GET(request: NextRequest) {
  const model = request.nextUrl.searchParams.get('model') ?? ''
  const rawStep = request.nextUrl.searchParams.get('step') ?? ''
  const step = Number(rawStep)

  if (!MODEL_NAME_PATTERN.test(model) || model.includes('..')) {
    return NextResponse.json({ error: 'Invalid LDraw model name' }, { status: 400 })
  }
  if (!/^\d+$/.test(rawStep) || !Number.isSafeInteger(step)) {
    return NextResponse.json({ error: 'Invalid LDraw step index' }, { status: 400 })
  }

  try {
    const packedStep = await loadPackedStep(model, step)
    return new NextResponse(packedStep.mpdText, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
        'X-Content-Type-Options': 'nosniff',
        'X-LDraw-Step-Count': String(packedStep.stepCount),
      },
    })
  } catch (error) {
    if (error instanceof LdrawTransformBusyError) {
      return NextResponse.json(
        { error: error.message },
        { status: 503, headers: { 'Retry-After': '1' } },
      )
    }
    const code = (error as NodeJS.ErrnoException).code
    if (code === 'ENOENT') {
      return NextResponse.json({ error: 'LDraw model not found' }, { status: 404 })
    }
    if (error instanceof RangeError) {
      if (error.message === 'LDraw model is too large') {
        return NextResponse.json({ error: error.message }, { status: 413 })
      }
      return NextResponse.json({ error: error.message }, { status: 416 })
    }
    return NextResponse.json({ error: 'Unable to build LDraw step' }, { status: 500 })
  }
}
