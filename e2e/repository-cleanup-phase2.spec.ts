import { expect, test } from '@playwright/test'

const retained = [
  ...['content', 'invite', 'messages', 'shop', 'wallet'].map(name => `/assets/profile-icons/action-${name}.webp`),
  ...['birds', 'insects', 'plants'].map(name => `/assets/nature-topic-${name}.webp`),
  '/assets/species-detail/bird-identification.png',
  '/assets/nature-hero-lakeside-observation.png',
  '/assets/profile-mobile-hero-space-bg.png',
]

test('current profile, atlas and detail illustrations remain available after cleanup', async ({ request }) => {
  for (const url of retained) {
    const response = await request.get(url)
    expect(response.status(), url).toBe(200)
    expect(response.headers()['content-type'], url).toMatch(/^image\//)
    expect((await response.body()).length, url).toBeGreaterThan(0)
  }
})

test('retired interface assets are not accidentally retained in public output', async ({ request }) => {
  const retired = [
    '/assets/bird-topic-campus-lake-hero.png',
    '/assets/observation-list-reeds-sky-bg.png',
    '/assets/species-archive-blue-tech-bg.png',
    '/assets/profile-hero-explorer-v4.webp',
    ...['content', 'invite', 'messages', 'shop', 'wallet'].map(name => `/assets/profile-actions/${name}.webp`),
  ]
  for (const url of retired) {
    const response = await request.get(url)
    expect(response.status(), url).toBe(404)
  }
})
