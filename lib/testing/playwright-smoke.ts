export function isPlaywrightSmoke() {
  return process.env.PLAYWRIGHT_SMOKE === '1' || process.env.NEXT_PUBLIC_PLAYWRIGHT_SMOKE === '1'
}

export function isPlaywrightSmokeClient() {
  return process.env.NEXT_PUBLIC_PLAYWRIGHT_SMOKE === '1'
}
