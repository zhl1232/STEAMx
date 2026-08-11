import { expect, test } from '@playwright/test'

import { signUpAndLogin } from './helpers/auth-flow'
import {
  createApprovedExplorationJourneyFixture,
  deleteExplorationJourneyFixture,
  deleteSafetyGovernanceFixtures,
  deleteUserById,
  type ExplorationJourneyFixture,
} from './helpers/supabase-admin'

const DEFAULT_PASSWORD = process.env.E2E_USER_PASSWORD ?? '123456'

test.describe('核心业务链路', () => {
  test('注册 -> 创建项目 -> 项目页聚焦作品记录', async ({ page }) => {
    const nonce = Date.now()
    const usesSharedUser = Boolean(process.env.E2E_USER_EMAIL)
    const email = process.env.E2E_USER_EMAIL ?? `e2e_${nonce}@example.com`
    const password = DEFAULT_PASSWORD
    const projectTitle = `E2E 项目 ${nonce}`
    let userId = ''
    let projectId: number | null = null

    try {
      userId = await signUpAndLogin(page, { email, password })

      await page.goto('/share')
      await expect(page).toHaveURL(/\/share$/)
      await page.locator('#title').fill(projectTitle)
      await page.locator('#materials').fill('材料 A\n材料 B')
      await page.locator('#step-desc-0').fill('这是自动化测试步骤。')
      await page.getByRole('button', { name: '提交审核' }).click()

      const interactionConfirmation = page.getByRole('dialog').filter({ hasText: '互动前安全确认' })
      const firstStep = await Promise.race([
        page.waitForURL('**/profile', { timeout: 15000 }).then(() => 'profile' as const),
        interactionConfirmation.waitFor({ state: 'visible', timeout: 15000 }).then(() => 'confirmation' as const),
      ])
      if (firstStep === 'confirmation') {
        await interactionConfirmation.getByRole('button', { name: '完成确认' }).click()
        await page.waitForURL('**/profile', { timeout: 15000 })
      }
      const projectPlanItem = page.getByText(projectTitle, { exact: true }).locator('..').locator('..')
      const projectLink = projectPlanItem.locator('a[href^="/project/"]').first()
      await expect(projectLink).toBeVisible({ timeout: 10000 })
      const projectHref = await projectLink.getAttribute('href')
      const projectIdMatch = projectHref?.match(/\/project\/(\d+)/)
      projectId = projectIdMatch ? Number(projectIdMatch[1]) : null
      expect(projectId).toBeGreaterThan(0)
      await page.goto(projectHref!, { waitUntil: 'domcontentloaded' })
      await expect(page).toHaveURL(/\/project\//)

      await expect(page.getByRole('heading', { name: '探索记录' }).first()).toBeVisible()
      await expect(page.locator('#project-comments-desktop')).toHaveCount(0)
      await expect(page.getByRole('button', { name: '说点什么...' })).toHaveCount(0)
    } finally {
      await deleteSafetyGovernanceFixtures({
        userIds: usesSharedUser ? [] : [userId],
        projectIds: projectId ? [projectId] : [],
      })
    }
  })

  test('探索记录 -> 完成作品 -> 作品详情与分享卡片', async ({ page, context }) => {
    test.setTimeout(120_000)

    const nonce = Date.now()
    const usesSharedUser = Boolean(process.env.E2E_USER_EMAIL)
    const email = process.env.E2E_USER_EMAIL ?? `e2e_journey_${nonce}@example.com`
    const password = DEFAULT_PASSWORD
    let userId = ''
    let fixture: ExplorationJourneyFixture | null = null

    try {
      userId = await signUpAndLogin(page, {
        email,
        password,
        fullName: 'E2E 探索者',
        username: `e2e_journey_${nonce}`,
      })
      fixture = await createApprovedExplorationJourneyFixture({ userId, nonce })

      await page.goto(`/project/${fixture.projectId}/records`, { waitUntil: 'domcontentloaded' })
      const journeyLink = page.getByRole('link', { name: '查看 E2E 探索者 的完整探索详情' })
      await expect(journeyLink).toBeVisible({ timeout: 20_000 })
      await journeyLink.click()
      await expect(page).toHaveURL(new RegExp(`/works/${fixture.progressId}$`))
      await page.waitForLoadState('networkidle')

      await expect(page.getByRole('heading', { name: '探索过程' })).toBeVisible()
      const promoteButton = page.getByRole('button', { name: '把这一步设为完成作品' })
      await expect(promoteButton).toBeVisible()
      await expect(promoteButton).toBeEnabled()
      const promoteResponsePromise = page.waitForResponse(
        (response) => response.url().includes(`/api/completions/${fixture!.progressId}/promote`)
          && response.request().method() === 'POST',
      )
      await promoteButton.click()
      const promoteResponse = await promoteResponsePromise
      expect(promoteResponse.ok()).toBeTruthy()
      await expect(page.getByText('已设为完成作品', { exact: true })).toBeVisible({ timeout: 10_000 })

      await expect(page).toHaveURL(new RegExp(`/works/${fixture.progressId}\\?share=1$`), {
        timeout: 30_000,
      })

      const shareDialog = page.getByRole('dialog')
      await expect(shareDialog).toBeVisible({ timeout: 20_000 })
      await expect(shareDialog).toContainText('分享这件作品')
      await shareDialog.getByRole('button', { name: '关闭' }).click()

      const shareButton = page.getByRole('button', { name: '分享作品' })
      await expect(shareButton).toBeVisible()
      await shareButton.click()
      await expect(shareDialog).toBeVisible()

      const copyButton = shareDialog.getByRole('button', { name: '复制链接' })
      await expect(copyButton).toBeEnabled({ timeout: 20_000 })
      await context.grantPermissions(['clipboard-read', 'clipboard-write'])
      await copyButton.click()
      await expect(shareDialog.getByRole('button', { name: '已复制' })).toBeVisible()
    } finally {
      if (fixture) {
        await deleteExplorationJourneyFixture({
          userId,
          projectId: fixture.projectId,
          initialXp: fixture.initialXp,
          removeUser: !usesSharedUser,
        })
      } else if (userId && !usesSharedUser) {
        await deleteUserById(userId)
      }
    }
  })
})
