import { expect, test } from '@playwright/test'

const E2E_USER_EMAIL = process.env.E2E_USER_EMAIL ?? 'student@example.com'
const E2E_USER_PASSWORD = process.env.E2E_USER_PASSWORD ?? '123456'

test.describe('核心业务链路', () => {
  test('登录 -> 创建项目 -> 评论互动', async ({ page }) => {
    const nonce = Date.now()
    const projectTitle = `E2E 项目 ${nonce}`
    const commentText = `E2E 评论 ${nonce}`

    await page.goto('/login')
    await page.getByPlaceholder('name@example.com').fill(E2E_USER_EMAIL)
    await page.getByPlaceholder('••••••••').fill(E2E_USER_PASSWORD)
    await page.locator('#terms').click()
    await page.getByRole('button', { name: '登录' }).click()
    await page.waitForURL('**/')

    await page.goto('/share')
    await expect(page).toHaveURL(/\/share$/)
    await page.locator('#title').fill(projectTitle)
    await page.locator('#materials').fill('材料 A\n材料 B')
    await page.locator('#step-desc-0').fill('这是自动化测试步骤。')
    await page.getByRole('button', { name: '提交审核' }).click()

    await page.waitForURL('**/profile', { timeout: 15000 })
    await page.getByRole('button', { name: /我的发布/ }).click()

    await expect(page.getByText(projectTitle)).toBeVisible({ timeout: 10000 })
    await page.getByRole('link', { name: `View project ${projectTitle}` }).click()
    await expect(page).toHaveURL(/\/project\//)

    const commentBox = page.getByPlaceholder('说点什么...')
    await commentBox.fill(commentText)
    await page.getByRole('button', { name: '发布' }).click()

    await expect(page.getByText(commentText)).toBeVisible({ timeout: 10000 })

    const commentContainer = page.getByText(commentText, { exact: true }).locator('..')
    const likeButton = commentContainer.getByRole('button', { name: '赞' })
    await likeButton.click()
    await expect(likeButton.locator('svg')).toHaveClass(/fill-current/)

    await page.reload({ waitUntil: 'domcontentloaded' })
    const commentAfterReload = page.getByText(commentText, { exact: true })
    await expect(commentAfterReload).toBeVisible({ timeout: 10000 })
    const likeAfterReload = commentAfterReload.locator('..').getByRole('button', { name: '赞' })
    await expect(likeAfterReload.locator('svg')).toHaveClass(/fill-current/)
  })
})
