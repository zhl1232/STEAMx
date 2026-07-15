import type { Page } from '@playwright/test'
import { ensureEmailUser, type UserRole } from './supabase-admin'

type AuthOptions = {
  email: string
  password: string
  fullName?: string
  username?: string
  role?: UserRole
}

async function openEmailAuthForm(page: Page) {
  await page.goto('/login')
  const form = page.locator('form').first()
  await form.getByPlaceholder('请输入手机号').waitFor({ state: 'visible' })
  return form
}

async function loginWithEmail(page: Page, { email, password }: AuthOptions) {
  const form = await openEmailAuthForm(page)
  await form.getByPlaceholder('请输入手机号').fill(email)
  await form.getByPlaceholder('请输入至少 6 位密码').fill(password)
  await form.locator('button[type="submit"]').click()
  await page.waitForURL(/\/$/, { timeout: 25000 })
}

export async function signUpAndLogin(page: Page, options: AuthOptions) {
  const { email, password } = options
  // Integration runs against shared Supabase environments where public signups
  // may be disabled. Seed the user via admin API, then verify the real login UI.
  const userId = await ensureEmailUser(options)
  await loginWithEmail(page, { email, password })
  return userId
}
