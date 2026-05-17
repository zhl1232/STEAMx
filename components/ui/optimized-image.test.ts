import { describe, expect, it } from 'vitest'
import { getOptimizedImageSrc } from './optimized-image'

describe('getOptimizedImageSrc', () => {
  it('keeps opentrust storage URLs on the original object endpoint', () => {
    const src =
      'https://spb-l3q6k3bebzxrok83.supabase.opentrust.net/storage/v1/object/public/project-completions/a1111111-0000-0000-0000-000000000000/1775618536559-cfh4a9j.png'

    expect(getOptimizedImageSrc(src, 'grid')).toBe(src)
  })

  it('uses Supabase render transforms on supabase.co public storage URLs', () => {
    const src =
      'https://example.supabase.co/storage/v1/object/public/project-completions/user/file.png'

    expect(getOptimizedImageSrc(src, 'grid')).toBe(
      'https://example.supabase.co/storage/v1/render/image/public/project-completions/user/file.png?width=320&quality=60',
    )
  })
})
