import { defineConfig, devices } from '@playwright/test'

const baseURL = 'http://127.0.0.1:8601'

export default defineConfig({
  testDir: './e2e/scratch-host',
  timeout: 90_000,
  fullyParallel: false,
  workers: 1,
  reporter: 'html',
  use: {
    baseURL,
    screenshot: 'only-on-failure',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'pnpm --filter scratch-host dev',
    url: `${baseURL}/index.html`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
})
