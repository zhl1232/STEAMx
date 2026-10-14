import { defineConfig, devices } from '@playwright/test'
export default defineConfig({
  testDir: './e2e/registration', testMatch: '*.spec.ts', workers: 1, reporter: 'list', timeout: 30000,
  use: { baseURL: 'http://127.0.0.1:4179', channel: 'chrome' },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['iPhone 13'], defaultBrowserType: 'chromium' } },
  ],
  webServer: { command: 'node e2e/registration/server.mjs', url: 'http://127.0.0.1:4179', reuseExistingServer: false },
})
