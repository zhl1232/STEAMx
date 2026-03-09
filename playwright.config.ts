import { defineConfig, devices } from '@playwright/test'

const baseURL = 'http://127.0.0.1:3000'
const supabaseUrl = `${baseURL}/__playwright_supabase__`
const supabaseAnonKey = 'playwright-placeholder-anon-key'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: [
      'PLAYWRIGHT_SMOKE=1',
      'NEXT_PUBLIC_PLAYWRIGHT_SMOKE=1',
      `NEXT_PUBLIC_SUPABASE_URL="${supabaseUrl}"`,
      `NEXT_PUBLIC_SUPABASE_ANON_KEY="${supabaseAnonKey}"`,
      'pnpm dev',
    ].join(' '),
    url: baseURL,
    reuseExistingServer: !process.env.CI,
  },
})
