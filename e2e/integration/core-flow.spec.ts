import { expect, test } from '@playwright/test'
import { signUpAndLogin } from './helpers/auth-flow'

const DEFAULT_PASSWORD = process.env.E2E_USER_PASSWORD ?? '123456'

test.describe('核心业务链路', () => {
  test('注册 -> 创建项目 -> 评论互动', async ({ page }) => {
    const nonce = Date.now()
    const email = process.env.E2E_USER_EMAIL ?? `e2e_${nonce}@example.com`
    const password = DEFAULT_PASSWORD
    const projectTitle = `E2E 项目 ${nonce}`
    const commentText = `E2E 评论 ${nonce}`

    await signUpAndLogin(page, { email, password })

    await page.goto('/share')
    await expect(page).toHaveURL(/\/share$/)
    await page.locator('#title').fill(projectTitle)
    await page.locator('#materials').fill('材料 A\n材料 B')
    await page.locator('#step-desc-0').fill('这是自动化测试步骤。')
    await page.getByRole('button', { name: '提交审核' }).click()

    await page.waitForURL('**/profile', { timeout: 15000 })
    const projectLink = page.locator('a[href^="/project/"]').filter({ hasText: projectTitle }).first()
    await expect(projectLink).toBeVisible({ timeout: 10000 })
    await projectLink.click()
    await expect(page).toHaveURL(/\/project\//)

    await page.getByRole('button', { name: '说点什么...' }).click()
    const commentBox = page.locator('textarea').last()
    await commentBox.fill(commentText)
    const commentForm = page.locator('form').filter({ has: commentBox })
    await commentForm.getByRole('button', { name: '发布' }).click()

    const commentItem = page.getByText(commentText, { exact: true }).first()
    await expect(commentItem).toBeVisible({ timeout: 10000 })

    await page.reload({ waitUntil: 'domcontentloaded' })
    await expect(page.getByText(commentText, { exact: true }).first()).toBeVisible({ timeout: 10000 })
  })
})
