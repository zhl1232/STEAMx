import { after } from 'next/server'
import { safelyRunGrowthReview } from './worker'
import { logger } from '@/lib/logger'
export function scheduleGrowthReview() {
  try { after(async () => { await safelyRunGrowthReview() }) }
  catch { logger.warn('Growth review scheduling deferred to existing worker') }
}
