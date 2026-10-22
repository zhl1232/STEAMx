import { defineConfig } from '@playwright/test'
const evidenceDir = process.env.BUILDING_VOSK_EVIDENCE_DIR || '../building-vosk-evidence'
export default defineConfig({
  testDir: './e2e/building-vosk', outputDir: evidenceDir,
  reporter: [['list'], ['json', { outputFile: `${evidenceDir}/results.json` }]],
  timeout: 90000, workers: 1,
  webServer: { command: 'node e2e/building-vosk/server.mjs', url: 'http://127.0.0.1:4185', timeout: 90000, reuseExistingServer: false },
  use: { baseURL: 'http://127.0.0.1:4185', ...(process.env.PLAYWRIGHT_USE_SYSTEM_CHROME === '1' ? { channel: 'chrome' } : {}), launchOptions: {
    ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE } : {}),
    args: ['--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'],
  }, screenshot: 'only-on-failure' },
})
