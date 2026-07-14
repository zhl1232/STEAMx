import { expect, test } from '@playwright/test'
import { signUpAndLogin } from './helpers/auth-flow'

const DEFAULT_PASSWORD = process.env.E2E_USER_PASSWORD ?? '123456'
const AUTH_ROUTES_EMAIL =
  process.env.E2E_AUTH_ROUTES_EMAIL ?? 'e2e_authenticated_routes@example.com'
const AUTH_ROUTES_USERNAME = 'e2e_authenticated_routes'
const AUTH_ROUTES_NAME = 'E2E Auth Routes'

test.describe('登录态路由与权限', () => {
  test('普通用户可访问个人页面且不能进入管理后台', async ({ page }) => {
    const pageErrors: string[] = []
    page.on('pageerror', (error) => {
      pageErrors.push(error.message)
    })

    await signUpAndLogin(page, {
      email: AUTH_ROUTES_EMAIL,
      password: DEFAULT_PASSWORD,
      fullName: AUTH_ROUTES_NAME,
      username: AUTH_ROUTES_USERNAME,
      role: 'user',
    })

    await page.goto('/profile')
    await expect(page).toHaveURL(/\/profile$/)
    await expect(page.getByText('STEAM 能力雷达').first()).toBeVisible({ timeout: 20000 })

    await page.goto('/messages')
    await expect(page).toHaveURL(/\/messages$/)
    await expect(page.getByRole('heading', { name: '站内通知与私信' })).toBeVisible({
      timeout: 15000,
    })
    await expect(page.getByRole('button', { name: /私信/ })).toBeVisible()

    await page.goto('/settings/profile')
    await expect(page).toHaveURL(/\/settings\/profile$/)
    await expect(page.getByRole('heading', { name: '个人资料' })).toBeVisible({
      timeout: 15000,
    })
    await expect(page.getByLabel('昵称')).toBeVisible({ timeout: 15000 })

    await page.goto('/admin')
    await expect(page).toHaveURL(/\/$/, { timeout: 15000 })
    await expect(page.getByText('后台管理')).toHaveCount(0)

    expect(pageErrors).toEqual([])
  })
})
