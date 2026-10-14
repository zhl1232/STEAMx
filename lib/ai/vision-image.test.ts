/** @vitest-environment node */
import sharp from 'sharp'
import { describe, expect, it, vi } from 'vitest'

import { prepareVisionImageUrl } from '@/lib/ai/vision-image'

vi.mock('@/lib/logger', () => ({ logger: { warn: vi.fn() } }))

describe('prepareVisionImageUrl', () => {
  it('downscales large photos to a 1024px long side JPEG data URL', async () => {
    const big = await sharp({ create: { width: 3000, height: 2000, channels: 3, background: '#4a7' } }).png().toBuffer()
    const fetchImpl = vi.fn(async () => new Response(new Uint8Array(big))) as unknown as typeof fetch
    const out = await prepareVisionImageUrl('https://x.supabase.co/a.png', { fetchImpl })
    expect(out.startsWith('data:image/jpeg;base64,')).toBe(true)
    const meta = await sharp(Buffer.from(out.split(',')[1], 'base64')).metadata()
    expect(Math.max(meta.width ?? 0, meta.height ?? 0)).toBe(1024)
  })

  it('falls back to the original URL on fetch failure or relative URLs', async () => {
    const fetchImpl = vi.fn(async () => new Response('x', { status: 404 })) as unknown as typeof fetch
    expect(await prepareVisionImageUrl('https://x.supabase.co/a.jpg', { fetchImpl })).toBe('https://x.supabase.co/a.jpg')
    expect(await prepareVisionImageUrl('/storage/a.jpg', { fetchImpl })).toBe('/storage/a.jpg')
  })
})
