import { test, expect } from '@playwright/test';

test.describe('私信系统', () => {
  test('未登录访问 /messages 应跳转到登录页', async ({ page }) => {
    await page.goto('/messages');
    await expect(page).toHaveURL(/\/login/);
  });

  test('会话详情页路由存在且不报错', async ({ page }) => {
    const res = await page.goto('/messages/11111111-0000-0000-0000-000000000000', { waitUntil: 'domcontentloaded' });
    expect(res?.status()).toBeLessThan(500);
  });

  test('私信列表页路由存在且不报错', async ({ page }) => {
    const res = await page.goto('/messages', { waitUntil: 'domcontentloaded' });
    expect(res?.status()).toBeLessThan(500);
  });

  test('主导航在未登录时不显示私信链接', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('header')).toBeVisible();
    const nav = page.locator('nav a[href="/messages"]');
    await expect(nav).toHaveCount(0);
  });
});
