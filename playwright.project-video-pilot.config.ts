import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e/project-video-pilot',
  outputDir: './test-results/project-video-pilot',
  reporter: 'list',
  timeout: 120000,
  workers: 1,
  forbidOnly: !!process.env.CI,
  webServer: {
    command: 'node e2e/project-video-pilot/server.mjs',
    url: 'http://127.0.0.1:4191/project/1301',
    timeout: 180000,
    reuseExistingServer: false,
  },
  use: {
    baseURL: 'http://127.0.0.1:4191',
    ...(process.env.PLAYWRIGHT_USE_SYSTEM_CHROME === '1' ? { channel: 'chrome' } : {}),
    launchOptions: {
      chromiumSandbox: true,
      ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } : {}),
    },
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1440, height: 1000 } } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
})
