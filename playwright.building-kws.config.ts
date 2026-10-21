import { defineConfig } from '@playwright/test'
export default defineConfig({
  testDir: './e2e/building-kws', outputDir: '../building-kws-evidence',
  reporter: [['list'], ['json', { outputFile: '../building-kws-evidence/results.json' }]],
  timeout: 90000, workers: 1,
  webServer: { command: 'node e2e/building-kws/server.mjs', url: 'http://127.0.0.1:4183', timeout: 90000, reuseExistingServer: false },
  use: { baseURL: 'http://127.0.0.1:4183', ...(process.env.PLAYWRIGHT_USE_SYSTEM_CHROME === '1' ? { channel: 'chrome' } : {}), launchOptions: {
    ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE } : {}),
    args: ['--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'],
  }, screenshot: 'only-on-failure' },
})
