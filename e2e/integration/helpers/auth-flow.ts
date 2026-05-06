import type { Page } from '@playwright/test'
import { ensureEmailUser } from './supabase-admin'

type AuthOptions = {
  email: string
  password: string
}

async function openEmailAuthForm(page: Page, mode: 'sign_in' | 'sign_up') {
  await page.goto('/login')
  await page.getByRole('button', { name: mode === 'sign_in' ? '登录' : '注册', exact: true }).first().click()
  await page.getByRole('button', { name: '邮箱', exact: true }).click()
  return page.getByRole('form', { name: /欢迎回到 STEAM 探索/ })
}

async function loginWithEmail(page: Page, { email, password }: AuthOptions) {
  const form = await openEmailAuthForm(page, 'sign_in')
  await form.getByPlaceholder('请输入邮箱').fill(email)
  await form.getByPlaceholder('请输入至少 6 位密码').fill(password)
  await form.getByRole('button', { name: '登录', exact: true }).click()
  await page.waitForURL(/\/$/, { timeout: 25000 })
}

export async function signUpAndLogin(page: Page, { email, password }: AuthOptions) {
  // Integration runs against shared Supabase environments where public signups
  // may be disabled. Seed the user via admin API, then verify the real login UI.
  await ensureEmailUser({ email, password })
  await loginWithEmail(page, { email, password })
}
