/** @vitest-environment node */
import { NextRequest } from 'next/server'
import { beforeEach, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ member: false, text: '一起试试吧。' as string | null, rpc: vi.fn(), task: vi.fn() }))
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => ({ rpc: mocks.rpc }) }))
vi.mock('@/lib/api/auth', () => ({ requireAuth: async () => ({ id: 'one' }), handleApiError: () => new Response('', { status: 500 }) }))
vi.mock('@/lib/api/rate-limit', () => ({ requireRateLimit: vi.fn() }))
vi.mock('@/lib/ai/tutor/voice-access', () => ({ getTutorVoiceAccess: async () => ({ canChoose: mocks.member, voice: 'yezhiqing_v3.1' }) }))
vi.mock('@/lib/ai/tutor/guarded-speech', () => ({ createGuardedTutorSpeechStreamer: mocks.task, guardedSynthesizeTutorSpeech: vi.fn() }))
import { POST } from './route'
import { TUTOR_VOICE_PREVIEW_TEXT } from '@/lib/ai/tutor/speech-source'
beforeEach(() => {
  vi.clearAllMocks(); mocks.member = false; mocks.text = '一起试试吧。'
  mocks.rpc.mockImplementation(async () => ({ data: mocks.text, error: null }))
  mocks.task.mockReturnValue({ start: vi.fn(), push: vi.fn(), finish: vi.fn().mockResolvedValue(true), abort: vi.fn() })
})
const post = (body: object) => POST(new NextRequest('https://test/api/tutor/speech/synthesize', {
  method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
}))
it('denies nonmember preview before any supplier task', async () => {
  expect((await post({ preview: true, voice: 'longsanshu_v3.1' })).status).toBe(403)
  expect(mocks.task).not.toHaveBeenCalled(); expect(mocks.rpc).not.toHaveBeenCalled()
})
it('members preview only a whitelisted voice using server text', async () => {
  mocks.member = true
  expect((await post({ preview: true, voice: 'Ethan' })).status).toBe(400)
  await (await post({ preview: true, voice: 'longsanshu_v3.1' })).text()
  expect(mocks.task).toHaveBeenCalledWith('one', expect.objectContaining({ voice: 'longsanshu_v3.1', signal: expect.any(AbortSignal) }))
  expect(mocks.task.mock.results[0].value.push).toHaveBeenCalledWith(TUTOR_VOICE_PREVIEW_TEXT)
  expect(mocks.rpc).not.toHaveBeenCalled()
})
it('rejects unowned/arbitrary text before task creation', async () => {
  mocks.text = null
  expect((await post({ text: 'arbitrary text' })).status).toBe(404)
  expect(mocks.task).not.toHaveBeenCalled()
})
it('binds both opaque ids and exact-text compatibility to the scoped source RPC', async () => {
  await (await post({ messageId: 3 })).text()
  expect(mocks.rpc).toHaveBeenCalledWith('resolve_tutor_speech_reply', { p_message_id: 3, p_text: null })
  expect(mocks.task).toHaveBeenCalledWith('one', expect.objectContaining({ voice: 'yezhiqing_v3.1' }))
})
it('does not accept a preview with caller supplied text', async () => {
  mocks.member = true
  expect((await post({ preview: true, voice: 'longsanshu_v3.1', text: 'arbitrary' })).status).toBe(400)
  expect(mocks.task).not.toHaveBeenCalled()
})
it('rejects the total request size, not merely parsed text length', async () => {
  expect((await post({ text: 'a'.repeat(270000) })).status).toBe(413)
  expect(mocks.task).not.toHaveBeenCalled()
})
