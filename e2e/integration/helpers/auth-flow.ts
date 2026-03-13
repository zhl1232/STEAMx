import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'
import { confirmUserEmail } from './supabase-admin'

type AuthOptions = {
  email: string
  password: string
}

export async function signUpAndLogin(page: Page, { email, password }: AuthOptions) {
  await page.goto('/login')
  await page.getByRole('button', { name: '立即注册' }).click()
  await page.getByPlaceholder('name@example.com / 13800138000').fill(email)
  await page.getByPlaceholder('••••••••').fill(password)
  await page.locator('#terms').click()
  await page.getByRole('button', { name: '注册' }).click()

  const registeredAndLoggedIn = await page
    .waitForURL(/\/$/, { timeout: 8000 })
    .then(() => true)
    .catch(() => false)

  if (!registeredAndLoggedIn) {
    const alreadyRegistered = await page
      .getByText('该邮箱已被注册')
      .first()
      .isVisible()
      .catch(() => false)

    if (!alreadyRegistered) {
      await expect(page.getByText('注册成功')).toBeVisible({ timeout: 8000 })
      await confirmUserEmail(email)
    }

    await page.getByRole('button', { name: '立即登录' }).click()
    await page.getByPlaceholder('name@example.com / 13800138000').fill(email)
    await page.getByPlaceholder('••••••••').fill(password)
    await page.locator('#terms').click()
    await page.getByRole('button', { name: '登录' }).click()
    await page.waitForURL(/\/$/, { timeout: 8000 })
  }
}
