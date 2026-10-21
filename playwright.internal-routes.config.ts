import { defineConfig, devices } from '@playwright/test'

const cases = [
  { name: 'production-closed', mode: 'production', port: 3100, catalog: false },
  { name: 'production-open', mode: 'production', port: 3101, catalog: true },
  { name: 'development', mode: 'development', port: 3102, catalog: false },
] as const

export default defineConfig({
  testDir: './e2e/internal-routes',
  workers: 1,
  timeout: 120_000,
  forbidOnly: !!process.env.CI,
  reporter: 'list',
  use: {
    ...devices['Desktop Chrome'],
    ...(process.env.PLAYWRIGHT_USE_SYSTEM_CHROME === '1' ? { channel: 'chrome' } : {}),
    launchOptions: { chromiumSandbox: true },
    trace: 'retain-on-failure',
  },
  projects: cases.map(({ name, mode, port, catalog }) => ({
    name,
    metadata: { mode, catalog },
    use: { baseURL: `http://localhost:${port}` },
  })),
  webServer: cases.map(({ mode, port, catalog }) => ({
    command: `node scripts/start-internal-route-test-server.mjs ${mode} ${port} ${catalog}`,
    url: `http://127.0.0.1:${port}/api/health`,
    reuseExistingServer: false,
    timeout: 120_000,
  })),
})
