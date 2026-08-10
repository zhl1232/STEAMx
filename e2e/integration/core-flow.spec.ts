import { expect, test } from '@playwright/test'

import { signUpAndLogin } from './helpers/auth-flow'
import { deleteSafetyGovernanceFixtures } from './helpers/supabase-admin'

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
})
