import { expect, test, type Page } from '@playwright/test'
import { skipVisitLoginPrompt, waitForRecordedPageView } from './visit-prompt'

test.beforeEach(async ({ page }, testInfo) => {
  if (!testInfo.title.startsWith('首次访问')) await skipVisitLoginPrompt(page)
})

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
  await expect(page.getByRole('heading', { name: '游乐场', exact: true, level: 1 })).toBeVisible()
})

for (const width of [390, 1440]) {
  test(`游乐场目录、探索记录与下架玩法 ${width}px`, { tag: '@smoke-playground' }, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    await page.goto('/playground', { waitUntil: 'domcontentloaded' })
    await waitForRecordedPageView(page, '/playground')

    const science = page.getByRole('navigation', { name: '游乐场科学入口' })
    await expect(science.getByRole('link', { name: '物理实验室' })).toHaveAttribute('href', '/playground/physics-lab')
    await expect(science.getByRole('link', { name: '3D 物理课本' })).toHaveAttribute('href', '/textbook')

    const directory = page.locator('section[aria-label="全部玩法"]')
    for (const name of ['天平称重', '记忆翻牌', '函数战争']) {
      await expect(directory.getByRole('heading', { name, level: 2 })).toBeVisible()
    }
    await expect(directory.getByRole('heading', { name: '数织' })).toBeVisible()
    await expect(directory.getByRole('link', { name: /数独/ })).toHaveAttribute('href', '/playground/sudoku')
    await expect(directory.getByRole('link', { name: /N 皇后/ })).toHaveAttribute('href', '/playground/nqueens')

    for (const game of ['2048', 'fifteen', 'quickmath', 'tangram', 'symmetry', 'ballsort']) {
      await expect(page.locator(`a[href="/playground/${game}"]`)).toHaveCount(0)
    }
    await expect(page.getByRole('searchbox')).toHaveCount(0)

    const records = page.locator('details').filter({ has: page.getByText('我的探索记录', { exact: true }) })
    await expect(records).toHaveCount(1)
    await expect(records).toHaveJSProperty('open', false)
    await expect(records.getByText('累计游玩记录')).toBeHidden()
    // Nested 「记录说明」 details also has a summary; only open the outer one.
    await records.locator(':scope > summary').click()
    await expect(records).toHaveJSProperty('open', true)
    await expect(records.getByText('累计游玩记录')).toBeVisible()
    await expect(records.getByRole('link', { name: '查看我的徽章' })).toHaveAttribute('href', '/profile#profile-badges-anchor')

    // Game sidebar lives in playground-shell on individual games, not the hub.
    await expect(page.getByRole('navigation', { name: '游乐场游戏导航' })).toHaveCount(0)

    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  })
}

test('游乐场已删除玩法直达返回 404、noindex 且无 canonical 或重定向', { tag: '@smoke-playground' }, async ({ request }) => {
  for (const game of ['2048', 'fifteen', 'quickmath', 'tangram', 'symmetry', 'ballsort']) {
    const path = `/playground/${game}`
    const response = await request.get(path, { maxRedirects: 0 })
    expect(response.status()).toBe(404)
    expect(response.headers().location).toBeUndefined()
    expect(new URL(response.url()).pathname).toBe(path)
    const html = await response.text()
    expect(html).toMatch(/<meta\b[^>]*name="robots"[^>]*content="[^"]*\bnoindex\b/i)
    expect(html).not.toMatch(/<link\b[^>]*rel="canonical"/i)
  }
})

test('数织移动端先展示棋盘，竞速登录可选展开', { tag: '@smoke-playground' }, async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/playground/nonogram', { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('application', { name: '数织棋盘' })).toBeVisible()
  await expect(page.getByRole('link', { name: '去登录' })).toHaveCount(0)
  await page.getByText('联机竞速 · 邀请好友', { exact: true }).filter({ visible: true }).click()
  await expect(page.getByRole('link', { name: '去登录' })).toBeVisible()
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

test('移动端自然观察页 smoke', { tag: '@smoke-nature' }, async ({ page }) => {
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
  test(`${route.path} SSR 页面身份一致`, { tag: '@smoke-playground' }, async ({ browser, baseURL }) => {
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
const homeHeroTopics = [
  ['搭积木', '/courses'],
  ['做实验', '/learn/science'],
  ['学编程', '/learn/scratch'],
  ['观察自然', '/nature'],
] as const

for (const viewport of [
  { width: 320, height: 740, dark: false },
  { width: 360, height: 800, dark: false },
  { width: 390, height: 844, dark: false },
  { width: 430, height: 900, dark: false },
  { width: 767, height: 1000, dark: false },
  { width: 390, height: 844, dark: true },
]) {
  test(`手机首页 ${viewport.width}${viewport.dark ? ' 暗色' : ''} 展示四个文字入口并隐藏快捷轮播`, { tag: '@smoke-home' }, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height })
    await expectHealthyPage(page, '/')
    await waitForRecordedPageView(page, '/')
    await page.evaluate((dark) => document.documentElement.classList.toggle('dark', dark), viewport.dark)
    const heading = page.getByRole('heading', { level: 1, name: '陪孩子，一起动手做', exact: true })
    await expect(heading).toBeVisible()
    await expect(page.locator('h1')).toHaveCount(1)
    const hero = page.locator('section').filter({ has: heading })
    await expect(hero.getByText('搭积木 · 做实验 · 学编程 · 观察自然', { exact: true })).toBeVisible()
    await expect(hero.getByText('从孩子想做的开始，跟着指导一步步尝试。', { exact: true })).toBeHidden()
    await expect(hero.locator('a[href="/explore"]')).toBeHidden()
    await expect(hero.getByRole('link')).toHaveCount(4)
    await expect(hero.getByRole('link', { name: '探索指南', exact: true })).toHaveCount(0)
    for (const [name, href] of homeHeroTopics) {
      const link = hero.getByRole('link', { name, exact: true })
      await expect(link).toBeVisible()
      await expect(link).toHaveAttribute('href', href)
      const box = await link.boundingBox()
      expect(box).not.toBeNull()
      expect(box!.height).toBeGreaterThanOrEqual(44)
    }
    const heroBox = await hero.boundingBox()
    expect(heroBox).not.toBeNull()
    expect(heroBox!.height).toBeLessThanOrEqual(300)
    await expect(page.locator('section[aria-label="首页快捷入口"]')).toBeHidden()
    await expect(page.locator('[aria-label="首页快捷入口分页"]')).toBeHidden()
    const recommendation = page.getByRole('link', { name: /积木搭建，从这里开始/, includeHidden: true })
    await expect(recommendation).toHaveAttribute('href', '/courses')
    await expect(recommendation).toContainText('免费积木课，跟着 3D 步骤一起搭')
    await expect(recommendation).toBeHidden()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await testInfo.attach('home-hero', { body: await hero.screenshot(), contentType: 'image/png' })
  })
}

for (const viewport of [
  { width: 768, dark: false },
  { width: 1024, dark: false },
  { width: 1280, dark: false },
  { width: 1440, dark: false },
  { width: 1840, dark: false },
  { width: 1840, dark: true },
]) {
  test(`首页 ${viewport.width}${viewport.dark ? ' 暗色' : ''} 精简横幅且保留兴趣入口`, { tag: '@smoke-home' }, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: viewport.width, height: 1000 })
    await expectHealthyPage(page, '/')
    await waitForRecordedPageView(page, '/')
    await page.evaluate((dark) => document.documentElement.classList.toggle('dark', dark), viewport.dark)
    const heading = page.getByRole('heading', { level: 1, name: '陪孩子找项目，一起动手做', exact: true })
    await expect(heading).toBeVisible()
    await expect(page.locator('h1')).toHaveCount(1)
    const hero = page.locator('section').filter({ has: heading })
    await expect(hero.getByText('陪孩子，一起动手做', { exact: true })).toBeHidden()
    await expect(hero.getByText('创探空间', { exact: true })).toHaveCount(0)
    await expect(hero.getByText('从孩子想做的开始，跟着指导一步步尝试。', { exact: true })).toHaveCount(0)
    await expect(hero.getByText('搭积木、做实验、学编程、观察自然。', { exact: true })).toHaveCount(0)
    await expect(hero.getByText('搭积木 · 做实验 · 学编程 · 观察自然', { exact: true })).toBeVisible()
    await expect(hero.getByRole('link')).toHaveCount(4)
    for (const [name, href] of homeHeroTopics) {
      const link = hero.getByRole('link', { name, exact: true })
      await expect(link).toBeVisible()
      await expect(link).toHaveAttribute('href', href)
    }
    const titleFits = await heading.evaluate((el) => el.scrollWidth <= el.clientWidth)
    expect(titleFits).toBe(true)
    const categories = page.locator('section[aria-labelledby="home-start-heading"]')
    await expect(categories.getByRole('heading', { name: '按兴趣探索', exact: true })).toBeVisible()
    await expect(categories.getByRole('link')).toHaveCount(6)
    await expect(categories.locator('a[href="/courses"]')).toHaveCount(0)
    await expect(page.getByText('社区正在创作', { exact: true })).toHaveCount(0)
    await expect(page.getByText('身边的真实发现', { exact: true })).toHaveCount(0)
    const nature = page.locator('section[aria-labelledby="home-nature-heading"]')
    await expect(nature.getByRole('heading', { name: '自然观察', exact: true })).toBeVisible()
    await expect(nature.getByRole('link', { name: '全部观察' })).toHaveAttribute('href', '/nature/observations')
    await expect(nature.locator('a[href="/nature"]')).toHaveCount(0)
    await expect(nature.getByText('立即进入', { exact: true })).toHaveCount(0)
    const worksHeading = page.getByRole('heading', { name: '大家的作品', exact: true })
    await expect(worksHeading).toBeVisible()
    if (viewport.width >= 1024) {
      const worksBox = await worksHeading.boundingBox()
      const natureBox = await nature.getByRole('heading', { name: '自然观察', exact: true }).boundingBox()
      expect(worksBox).not.toBeNull()
      expect(natureBox).not.toBeNull()
      expect(Math.abs(worksBox!.y - natureBox!.y)).toBeLessThanOrEqual(1)
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await testInfo.attach('home-hero', { body: await hero.screenshot(), contentType: 'image/png' })
  })
}

test('手机首页四个文字入口分别直达对应页面', { tag: '@smoke-home' }, async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  for (const [name, href] of homeHeroTopics) {
    await expectHealthyPage(page, '/')
    await waitForRecordedPageView(page, '/')
    const hero = page.locator('section').filter({ has: page.locator('h1') })
    await hero.getByRole('link', { name, exact: true }).click()
    await expect(page).toHaveURL(new RegExp(`${href}$`))
    await waitForRecordedPageView(page, href)
  }
})

test('手机首屏放大文字仍保留完整标题和四个可点击入口', { tag: '@smoke-home' }, async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 })
  await expectHealthyPage(page, '/')
  await waitForRecordedPageView(page, '/')
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
  await expect(heading).toBeVisible()
  await expect(page.locator('h1')).toHaveCount(1)
  expect(await hero.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  const heroBox = await hero.boundingBox()
  expect(heroBox).not.toBeNull()
  for (const [name, href] of homeHeroTopics) {
    const link = hero.getByRole('link', { name, exact: true })
    await expect(link).toBeVisible()
    await expect(link).toHaveAttribute('href', href)
    const box = await link.boundingBox()
    expect(box).not.toBeNull()
    expect(box!.height).toBeGreaterThanOrEqual(44)
    expect(box!.y + box!.height).toBeLessThan(heroBox!.y + heroBox!.height)
  }
  await hero.getByRole('link', { name: '搭积木', exact: true }).click()
  await expect(page).toHaveURL(/\/courses$/)
})

test('首次访问不自动弹登录层，只显示首页横幅；看到第 2 个页面后轻弹一次，关掉当天不再弹', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  const dialog = page.getByRole('dialog', { name: '登录或注册' })
  await expect(page.getByTestId('home-login-banner')).toBeVisible()
  await waitForRecordedPageView(page, '/')
  await expect(dialog).toHaveCount(0)
  await page.goto('/explore', { waitUntil: 'domcontentloaded' })
  await expect(dialog).toBeVisible()
  await page.getByRole('button', { name: '先去探索，关闭登录层' }).click()
  await expect(dialog).toBeHidden()
  await page.goto('/nature', { waitUntil: 'domcontentloaded' })
  await waitForRecordedPageView(page, '/nature')
  await expect(dialog).toHaveCount(0)
})
