import { expect, test } from '@playwright/test'
import { signUpAndLogin } from './helpers/auth-flow'

const DEFAULT_PASSWORD = process.env.E2E_USER_PASSWORD ?? '123456'

test.describe('社区回复点赞状态', () => {
  test('刷新后仍显示已点赞', async ({ page, browser }) => {
    const nonce = Date.now()
    const discussionTitle = `E2E 讨论 ${nonce}`
    const discussionContent = `E2E 讨论内容 ${nonce}`
    const replyText = `E2E 回复 ${nonce}`

    const authorEmail = process.env.E2E_USER_EMAIL ?? `e2e_author_${nonce}@example.com`
    const likerEmail = `e2e_liker_${nonce}@example.com`
    await signUpAndLogin(page, { email: authorEmail, password: DEFAULT_PASSWORD })

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

    await page.getByRole('button', { name: '分享你的观点...' }).click()
    const replyBox = page.locator('textarea').last()
    await replyBox.fill(replyText)
    const replyForm = page.locator('form').filter({ has: replyBox })
    await replyForm.getByRole('button', { name: '发布' }).click()

    const discussionUrl = page.url()
    const likerContext = await browser.newContext()
    const likerPage = await likerContext.newPage()

    try {
      await signUpAndLogin(likerPage, { email: likerEmail, password: DEFAULT_PASSWORD })
      await likerPage.goto(discussionUrl)

      const replyContent = likerPage.getByText(replyText, { exact: true })
      await expect(replyContent).toBeVisible({ timeout: 10000 })
      const replyLikeButton = replyContent.locator('..').getByRole('button', { name: '赞' })
      await replyLikeButton.click()
      await expect(replyLikeButton.locator('svg')).toHaveClass(/fill-current/)

      await likerPage.reload({ waitUntil: 'domcontentloaded' })
      const replyAfterReload = likerPage.getByText(replyText, { exact: true })
      await expect(replyAfterReload).toBeVisible({ timeout: 10000 })
      const likeAfterReload = replyAfterReload.locator('..').getByRole('button', { name: '赞' })
      await expect(likeAfterReload.locator('svg')).toHaveClass(/fill-current/)
    } finally {
      await likerContext.close()
    }
  })
})
