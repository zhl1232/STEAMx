import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e/project-card',
  outputDir: './test-results/project-card',
  reporter: 'list',
  timeout: 120000,
  workers: 1,
  webServer: {
    command: 'node e2e/project-card/server.mjs',
    url: 'http://127.0.0.1:4187',
    timeout: 90000,
    reuseExistingServer: false,
  },
  use: {
    baseURL: 'http://127.0.0.1:4187',
    ...(process.env.PLAYWRIGHT_USE_SYSTEM_CHROME === '1' ? { channel: 'chrome' } : {}),
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1440, height: 1000 } } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
})
