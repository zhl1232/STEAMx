import { NextResponse } from 'next/server'
import { handleApiError, requireAuth } from '@/lib/api/auth'
import { requireInteractionAccess } from '@/lib/access/interaction-access'
import { requireRateLimit } from '@/lib/api/rate-limit'
import { createClient } from '@/lib/supabase/server'
import { MAX_PHYSICS_STATE_BYTES, parsePhysicsBackup } from '@/lib/physics-lab/state'
import type { Json } from '@/lib/supabase/types'

const headers = { 'Cache-Control': 'private, no-store', Vary: 'Cookie' }
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers })
function apiError(error: unknown) {
  const response = handleApiError(error)
  Object.entries(headers).forEach(([key, value]) => response.headers.set(key, value))
  return response
}

class BodyError extends Error {
  constructor(message: string, public statusCode: number) { super(message) }
}

async function readBody(request: Request): Promise<unknown> {
  // Reserve a small envelope for ownerId/revision while bounding the entire
  // streamed request, including requests with no or misleading Content-Length.
  const limit = MAX_PHYSICS_STATE_BYTES + 1024
  const length = Number(request.headers.get('content-length'))
  if (Number.isFinite(length) && length > limit) throw new BodyError('实验室备份不能大于 8 MB', 413)
  if (!request.body) throw new BodyError('缺少保存内容', 400)
  const reader = request.body.getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > limit) {
        await reader.cancel()
        throw new BodyError('实验室备份不能大于 8 MB', 413)
      }
      chunks.push(value)
    }
  } finally { reader.releaseLock() }
  const bytes = new Uint8Array(size)
  let offset = 0
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength }
  try { return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)) }
  catch { throw new BodyError('保存内容不是有效的 JSON', 400) }
}

export async function GET() {
  try {
    const supabase = await createClient()
    const user = await requireAuth(supabase)
    const { data: row, error } = await supabase.from('physics_lab_states')
      .select('data, revision, updated_at').eq('user_id', user.id).maybeSingle()
    if (error) throw error
    return json({ ownerId: user.id, revision: row?.revision ?? 0,
      data: row ? parsePhysicsBackup(row.data) : null, updatedAt: row?.updated_at ?? null })
  } catch (error) { return apiError(error) }
}

export async function PUT(request: Request) {
  try {
    const supabase = await createClient()
    const user = await requireAuth(supabase)
    await requireInteractionAccess(supabase, user, 'save_progress')
    await requireRateLimit(supabase, { key: 'api-physics-lab-state', limit: 20, windowMs: 60_000 })
    const body = await readBody(request)
    if (!body || typeof body !== 'object' || Array.isArray(body)) return json({ error: '保存内容格式不正确' }, 400)
    const { ownerId, revision, data } = body as Record<string, unknown>
    if (typeof ownerId !== 'string') return json({ error: '缺少账户标识' }, 400)
    if (ownerId !== user.id) return json({ error: '账户已变更，请重新载入实验室' }, 403)
    if (typeof revision !== 'number' || !Number.isInteger(revision) || revision < 0 || revision >= 2147483647) {
      return json({ error: '保存版本不正确' }, 400)
    }
    let backup
    try {
      if (new TextEncoder().encode(JSON.stringify(data)).byteLength > MAX_PHYSICS_STATE_BYTES) {
        return json({ error: '实验室备份不能大于 8 MB' }, 413)
      }
      backup = parsePhysicsBackup(data)
    } catch { return json({ error: '实验室备份格式或模型不正确' }, 400) }
    const payload = { data: backup as Json, revision: revision + 1, updated_at: new Date().toISOString() }
    const result = revision === 0
      ? await supabase.from('physics_lab_states').insert({ ...payload, user_id: user.id })
        .select('data, revision, updated_at').single()
      : await supabase.from('physics_lab_states').update(payload).eq('user_id', user.id).eq('revision', revision)
        .select('data, revision, updated_at').maybeSingle()
    if (result.error?.code === '23505' || (!result.error && !result.data)) {
      return json({ error: '云端记录已更新，请重新读取并合并', code: 'STATE_CONFLICT' }, 409)
    }
    if (result.error) throw result.error
    const row = result.data!
    return json({ ownerId: user.id, revision: row.revision, data: parsePhysicsBackup(row.data), updatedAt: row.updated_at })
  } catch (error) { return apiError(error) }
}
