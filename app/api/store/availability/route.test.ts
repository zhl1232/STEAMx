import { afterEach, expect, it, vi } from 'vitest'
import { GET } from './route'

afterEach(() => vi.unstubAllEnvs())

it.each(['true', 'false', ''])('reads the runtime catalog gate without exposing payment configuration (%s)', async (value) => {
  vi.stubEnv('STORE_CATALOG_ENABLED', value)
  const response = GET()
  expect(await response.json()).toEqual({ catalogVisible: value === 'true' })
  expect(response.headers.get('Cache-Control')).toContain('no-store')
})
