import { expect, test } from '@playwright/test'

test('duplicate-logo URLs still serve the canonical PNG after cleanup', async ({ request }) => {
  const canonical = await request.get('/logo.png')
  expect(canonical.status()).toBe(200)
  expect(canonical.headers()['content-type']).toContain('image/png')
  const canonicalBody = await canonical.body()

  for (const path of ['/logo-mark.png', '/brand-kit/logo-avatar-transparent.png']) {
    const response = await request.get(path)
    expect(response.status(), path).toBe(200)
    expect(response.headers()['content-type'], path).toContain('image/png')
    expect(await response.body(), path).toEqual(canonicalBody)
  }
})

test('cached pages can still optimize the old header-logo URL', async ({ request }) => {
  const response = await request.get('/_next/image?url=%2Flogo-mark.png&w=64&q=75')
  expect(response.status()).toBe(200)
  expect(response.headers()['content-type']).toMatch(/^image\//)
  expect((await response.body()).length).toBeGreaterThan(0)
})
