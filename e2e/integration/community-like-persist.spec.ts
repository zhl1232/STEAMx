import { expect, test } from '@playwright/test'

const E2E_USER_EMAIL = process.env.E2E_USER_EMAIL ?? 'student@example.com'
const E2E_USER_PASSWORD = process.env.E2E_USER_PASSWORD ?? '123456'

test.describe('社区回复点赞状态', () => {
  test('刷新后仍显示已点赞', async ({ page }) => {
    const nonce = Date.now()
    const discussionTitle = `E2E 讨论 ${nonce}`
    const discussionContent = `E2E 讨论内容 ${nonce}`
    const replyText = `E2E 回复 ${nonce}`

    await page.goto('/login')
    await page.getByPlaceholder('name@example.com').fill(E2E_USER_EMAIL)
    await page.getByPlaceholder('••••••••').fill(E2E_USER_PASSWORD)
    await page.locator('#terms').click()
    await page.getByRole('button', { name: '登录' }).click()
    await page.waitForURL('**/')

    await page.goto('/community')
    await page.getByRole('button', { name: '发起讨论' }).click()

    const createForm = page.locator('form').filter({
      has: page.getByPlaceholder('请输入标题...'),
    })
    await createForm.getByPlaceholder('请输入标题...').fill(discussionTitle)
    await createForm.getByPlaceholder('详细描述你的问题或想法...').fill(discussionContent)
    await createForm.getByRole('button', { name: '发布' }).click()

    await expect(page.getByText(discussionTitle)).toBeVisible({ timeout: 10000 })
    await page.getByRole('link', { name: `进入讨论：${discussionTitle}` }).click()
    await expect(page).toHaveURL(/\/community\/discussion\//)

    const replyBox = page.getByPlaceholder('分享你的观点...')
    await replyBox.fill(replyText)
    const replyForm = page.locator('form').filter({ has: replyBox })
    await replyForm.getByRole('button', { name: '发布' }).click()

    const replyContent = page.getByText(replyText, { exact: true })
    await expect(replyContent).toBeVisible({ timeout: 10000 })
    const replyLikeButton = replyContent.locator('..').getByRole('button', { name: '赞' })
    await replyLikeButton.click()
    await expect(replyLikeButton.locator('svg')).toHaveClass(/fill-current/)

    await page.reload({ waitUntil: 'domcontentloaded' })
    const replyAfterReload = page.getByText(replyText, { exact: true })
    await expect(replyAfterReload).toBeVisible({ timeout: 10000 })
    const likeAfterReload = replyAfterReload.locator('..').getByRole('button', { name: '赞' })
    await expect(likeAfterReload.locator('svg')).toHaveClass(/fill-current/)
  })
})
