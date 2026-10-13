import { expect, test, type Page } from '@playwright/test'

async function expectHealthyPage(page: Page, path: string) {
  const pageErrors: string[] = []
  const onPageError = (error: Error) => {
    pageErrors.push(error.message)
  }

  page.on('pageerror', onPageError)
  try {
    const response = await page.goto(path, { waitUntil: 'domcontentloaded' })
    expect(response?.status()).toBeLessThan(500)
    await expect(page.locator('body')).not.toContainText('Application error')
    expect(pageErrors).toEqual([])
  } finally {
    page.off('pageerror', onPageError)
  }
}

test('首页 smoke', async ({ page }) => {
  await expectHealthyPage(page, '/')
  await expect(page).toHaveTitle('创探空间｜积木搭建、科学小实验、少儿编程与自然观察')
})

test('探索页 smoke', async ({ page }) => {
  await expectHealthyPage(page, '/explore')
})

test('自然观察页 smoke', async ({ page }) => {
  await expectHealthyPage(page, '/nature')
  await expect(page.getByRole('heading', { name: '自然观察' }).first()).toBeVisible()
})

test('项目挑战页 smoke', async ({ page }) => {
  await expectHealthyPage(page, '/create')
  await expect(page.getByRole('heading', { name: '项目挑战' }).first()).toBeVisible()
})

test('课程列表只有 /courses 一个入口', async ({ page }) => {
  await page.goto('/create?tab=courses', { waitUntil: 'domcontentloaded' })
  await expect(page).toHaveURL(/\/courses$/)
})

test('技能课程页 smoke', async ({ page }) => {
  await expectHealthyPage(page, '/courses')
  await expect(page.getByRole('heading', { name: '技能课程' }).first()).toBeVisible()
})

test('游乐场页 smoke', async ({ page }) => {
  await expectHealthyPage(page, '/playground')
  await expect(page.getByRole('heading', { name: /STEAM Playground/ })).toBeVisible()
})

test('联网竞速登录链接保留邀请房间码', async ({ page }) => {
  await page.goto('/playground/24game?room=ABC123', { waitUntil: 'domcontentloaded' })
  await page.getByRole('link', { name: '去登录' }).click()
  await expect(page).toHaveURL(/\/login\?next=/)

  const loginUrl = new URL(page.url())
  expect(loginUrl.searchParams.get('next')).toBe('/playground/24game?room=ABC123')
})

test('登录页 smoke', async ({ page }) => {
  await expectHealthyPage(page, '/login')
  await expect(page.getByRole('heading', { name: '手机号登录' })).toBeVisible()
})

test('登录页移动端聚焦表单', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await expectHealthyPage(page, '/login')
  await expect(page.getByRole('heading', { name: '手机号登录' })).toBeVisible()
  await expect(page.getByRole('heading', { name: '回到你的探索档案' })).toBeHidden()
})

test('手机验证码登录保持两步表单和重发倒计时', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  let sentCount = 0
  await page.route('**/api/auth/sms/send', (route) => {
    sentCount += 1
    return route.fulfill({ json: { ok: true } })
  })
  await page.goto('/login')
  // The controlled Radix checkbox confirms hydration before typing into SSR inputs.
  await page.getByRole('checkbox').check()
  await expect(page.getByRole('checkbox')).toBeChecked()
  await page.getByLabel('手机号', { exact: true }).fill('13800138000')
  await expect(page.getByLabel('手机号', { exact: true })).toHaveValue('13800138000')
  await page.getByRole('button', { name: '获取验证码', exact: true }).click()
  await expect(page.getByRole('heading', { name: '输入验证码' })).toBeVisible()
  await expect(page.getByRole('checkbox')).toHaveCount(0)
  await expect(page.getByRole('button', { name: /s 后重发/ })).toBeDisabled()
  await expect(page.getByRole('button', { name: '验证并继续' })).toBeDisabled()
  await page.getByLabel('验证码', { exact: true }).fill('123456')
  await expect(page.getByRole('button', { name: '验证并继续' })).toBeEnabled()
  await page.getByRole('button', { name: '修改手机号' }).click()
  await expect(page.getByLabel('手机号', { exact: true })).toHaveValue('13800138000')
  await expect(page.getByRole('checkbox')).toBeChecked()
  await expect(page.getByRole('button', { name: /s 后重新获取/ })).toBeDisabled()
  expect(sentCount).toBe(1)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
})

test('移动端自然观察页 smoke', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await expectHealthyPage(page, '/nature')
  await expect(page.getByText('发布观察').first()).toBeVisible()
})

test('未登录访问商店会跳转到登录页', async ({ page }) => {
  await page.goto('/shop', { waitUntil: 'domcontentloaded' })
  await expect(page).toHaveURL(/\/login/)
  await expect(page.locator('body')).not.toContainText('Application error')
})

// 详情页一旦有 loading.tsx，Suspense 会先把外壳连同 200 冲出去，后面再调 notFound()
// 就只换 UI 不改状态码，内容删掉后仍然是可索引的“软 404”。
for (const missing of [
  '/project/999999',
  '/nature/observations/999999',
  '/nature/species/no-such-slug',
]) {
  test(`${missing} 返回真正的 404 状态码`, async ({ page }) => {
    const response = await page.goto(missing, { waitUntil: 'domcontentloaded' })
    expect(response?.status()).toBe(404)
  })
}

// 受登录保护的分区不能只回跳到分区首页，否则从通知/分享点进来的深链接登录后会走丢。
const protectedDeepLinks = [
  ['/profile/timeline', '/profile/timeline'],
  ['/profile/followers', '/profile/followers'],
  ['/messages/11111111-1111-1111-1111-111111111111', '/messages/11111111-1111-1111-1111-111111111111'],
  ['/share?edit=42', '/share?edit=42'],
  ['/coins', '/coins'],
] as const

for (const [target, expectedNext] of protectedDeepLinks) {
  test(`未登录访问 ${target} 会带上完整回跳地址`, async ({ page }) => {
    await page.goto(target, { waitUntil: 'domcontentloaded' })
    await expect(page).toHaveURL(/\/login\?next=/)
    expect(new URL(page.url()).searchParams.get('next')).toBe(expectedNext)
  })
}

// Disable page JavaScript so these assertions cover the actual nested SSR output,
// including metadata inheritance, without relying on hydration to repair it.
for (const route of [
  { path: '/playground/minesweeper', name: '扫雷 在线逻辑推理游戏', crumbs: ['首页', '游乐场', '扫雷'] },
  { path: '/playground/minesweeper/course', name: '扫雷解局学 入门教程', crumbs: ['首页', '游乐场', '扫雷', '扫雷解局学'] },
]) {
  test(`${route.path} SSR 页面身份一致`, async ({ browser, baseURL }) => {
    const context = await browser.newContext({ baseURL, javaScriptEnabled: false })
    try {
      const page = await context.newPage()
      const response = await page.goto(route.path)
      expect(response?.status()).toBe(200)
      const canonical = page.locator('link[rel="canonical"]')
      await expect(canonical).toHaveCount(1)
      const expectedUrl = `https://steam.bj.cn${route.path}`
      await expect(canonical).toHaveAttribute('href', expectedUrl)
      const entities = await page.locator('script[type="application/ld+json"]').evaluateAll(
        (scripts) => scripts.flatMap((script) => {
          const data = JSON.parse(script.textContent || 'null')
          return Array.isArray(data) ? data : data['@graph'] ?? [data]
        }),
      )
      const webPages = entities.filter((entity) => entity['@type'] === 'WebPage')
      expect(webPages).toHaveLength(1)
      expect(webPages[0]).toMatchObject({
        '@id': `${expectedUrl}#webpage`,
        url: expectedUrl,
        name: route.name,
        isPartOf: { name: '创探空间' },
        about: { '@type': 'Game', name: '扫雷', url: 'https://steam.bj.cn/playground/minesweeper' },
      })
      const breadcrumbs = entities.filter((entity) => entity['@type'] === 'BreadcrumbList')
      expect(breadcrumbs).toHaveLength(1)
      expect(breadcrumbs[0].itemListElement).toEqual(route.crumbs.map((name, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name,
        item: ['https://steam.bj.cn/', 'https://steam.bj.cn/playground',
          'https://steam.bj.cn/playground/minesweeper',
          'https://steam.bj.cn/playground/minesweeper/course'][index],
      })))
    } finally {
      await context.close()
    }
  })
}

// Run against the real homepage and responsive CSS in the regular PR smoke job.
for (const viewport of [
  { width: 320, height: 740, dark: false },
  { width: 360, height: 800, dark: false },
  { width: 390, height: 844, dark: false },
  { width: 430, height: 900, dark: false },
  { width: 390, height: 844, dark: true },
]) {
  test(`手机首页 ${viewport.width}${viewport.dark ? ' 暗色' : ''} 精简首屏且免费课程仍可直达`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height })
    await expectHealthyPage(page, '/')
    await page.evaluate((dark) => document.documentElement.classList.toggle('dark', dark), viewport.dark)
    const heading = page.getByRole('heading', { level: 1, name: '陪孩子，一起动手做', exact: true })
    await expect(heading).toBeVisible()
    await expect(page.locator('h1')).toHaveCount(1)
    const hero = page.locator('section').filter({ has: heading })
    await expect(hero.getByText('搭积木 · 做实验 · 学编程 · 观察自然', { exact: true })).toBeVisible()
    await expect(hero.getByText('从孩子想做的开始，跟着指导一步步尝试。', { exact: true })).toBeHidden()
    await expect(hero.locator('a[href="/courses"]')).toBeHidden()
    await expect(hero.locator('a[href="/explore"]')).toBeHidden()
    await expect(hero.getByRole('link')).toHaveCount(1)
    const guide = hero.getByRole('link', { name: '探索指南', exact: true })
    await expect(guide).toHaveAttribute('href', '/start')
    await expect(page.getByRole('link', { name: '探索指南', exact: true })).toHaveCount(1)
    const guideBox = await guide.boundingBox()
    expect(guideBox).not.toBeNull()
    expect(guideBox!.height).toBeGreaterThanOrEqual(44)
    const heroBox = await hero.boundingBox()
    expect(heroBox).not.toBeNull()
    expect(heroBox!.height).toBeLessThanOrEqual(300)
    const recommendation = page.getByRole('link', { name: /积木搭建，从这里开始/ })
    await expect(recommendation).toHaveAttribute('href', '/courses')
    await expect(recommendation).toContainText('免费积木课，跟着 3D 步骤一起搭')
    await expect(recommendation).toBeInViewport()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  })
}

for (const width of [768, 1280, 1840]) {
  test(`首页 ${width} 保留桌面介绍与两个按钮`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 })
    await expectHealthyPage(page, '/')
    const heading = page.getByRole('heading', { level: 1, name: /陪孩子找个有趣的项目，\s*一起动手做。/ })
    await expect(heading).toBeVisible()
    await expect(page.locator('h1')).toHaveCount(1)
    const hero = page.locator('section').filter({ has: heading })
    await expect(hero.getByText('陪孩子，一起动手做', { exact: true })).toBeHidden()
    await expect(hero.getByText('从孩子想做的开始，跟着指导一步步尝试。', { exact: true })).toBeVisible()
    await expect(hero.getByRole('link', { name: '挑一节免费课程' })).toBeVisible()
    await expect(hero.getByRole('link', { name: '看看动手项目' })).toBeVisible()
    await expect(hero.locator('a[href="/start"]')).toBeHidden()
    await expect(page.getByRole('link', { name: '探索指南', exact: true })).toHaveCount(1)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  })
}

test('手机首页探索指南和免费推荐分别直达对应页面', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await expectHealthyPage(page, '/')
  await page.getByRole('link', { name: '探索指南', exact: true }).click()
  await expect(page).toHaveURL(/\/start$/)
  await expectHealthyPage(page, '/')
  await page.getByRole('link', { name: /积木搭建，从这里开始/ }).click()
  await expect(page).toHaveURL(/\/courses$/)
})

test('手机首屏放大文字仍保留完整标题和可点击指南', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 })
  await expectHealthyPage(page, '/')
  const hero = page.locator('section').filter({ has: page.locator('h1') })
  // Enlarge only the affected content to isolate wrapping and clipping in the hero.
  await hero.locator('h1, p, a').evaluateAll((elements) => {
    const sizes = elements.map((element) => ({
      fontSize: parseFloat(getComputedStyle(element).fontSize),
      lineHeight: parseFloat(getComputedStyle(element).lineHeight),
    }))
    elements.forEach((element, index) => {
      const style = (element as HTMLElement).style
      style.fontSize = `${sizes[index].fontSize * 2}px`
      style.lineHeight = `${sizes[index].lineHeight * 2}px`
    })
  })
  const heading = hero.getByRole('heading', { level: 1, name: '陪孩子，一起动手做', exact: true })
  const guide = hero.getByRole('link', { name: '探索指南', exact: true })
  await expect(heading).toBeVisible()
  await expect(guide).toBeVisible()
  expect(await hero.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true)
  const heroBox = await hero.boundingBox()
  const guideBox = await guide.boundingBox()
  expect(heroBox).not.toBeNull()
  expect(guideBox).not.toBeNull()
  expect(guideBox!.y + guideBox!.height).toBeLessThan(heroBox!.y + heroBox!.height)
  await guide.click()
  await expect(page).toHaveURL(/\/start$/)
})
