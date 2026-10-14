import { defineConfig, devices } from '@playwright/test'
export default defineConfig({
  testDir: './e2e/building-outline', outputDir: '../outline-warm-evidence', reporter: [['list'], ['json', {outputFile:'../outline-warm-evidence/results.json'}]],
  timeout: 90000, workers: 1,
  webServer: {command: 'node e2e/building-outline/server.mjs', url: 'http://127.0.0.1:4182', timeout: 90000, reuseExistingServer: false},
  use: {baseURL:'http://127.0.0.1:4182', channel:'chrome', launchOptions:{args:['--enable-unsafe-swiftshader']}, screenshot:'only-on-failure'},
  projects: [{name:'desktop',use:{viewport:{width:1440,height:1000}}}, {name:'mobile',use:{...devices['Pixel 7'],defaultBrowserType:'chromium'}}],
})
