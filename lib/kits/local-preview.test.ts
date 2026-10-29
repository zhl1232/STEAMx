import { afterEach, expect, it, vi } from 'vitest'
import { canPreviewMissingKitTable, localPreviewKits } from './local-preview'
afterEach(() => vi.unstubAllEnvs())
it('only previews an absent table in development, never other failures or production', async () => {
  vi.stubEnv('NODE_ENV', 'development')
  expect(canPreviewMissingKitTable({code:'PGRST205'})).toBe(true)
  expect(canPreviewMissingKitTable({code:'42501'})).toBe(false)
  vi.stubEnv('NODE_ENV', 'production')
  expect(canPreviewMissingKitTable({code:'PGRST205'})).toBe(false)
  expect(await localPreviewKits()).toEqual([])
})
it('exposes all 18 draft kits through a display whitelist without sourcing fields', async () => {
  vi.stubEnv('NODE_ENV', 'development')
  const kits = await localPreviewKits()
  expect(kits).toHaveLength(18)
  expect(kits.every(k => k.localPreview && k.status === 'draft')).toBe(true)
  const serialized = JSON.stringify(kits)
  for (const field of ['costCents', 'supplierSkuId', 'sourceImageUrl', 'specId', '731063650115']) expect(serialized).not.toContain(field)
})
