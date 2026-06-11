import type { WeeklyPlan } from '@/lib/profile/weekly-plan'

const inflightByUserId = new Map<string, Promise<WeeklyPlan>>()

async function parseJsonResponse(response: Response) {
  return response.json().catch(() => ({}))
}

export async function fetchWeeklyPlan(userId: string): Promise<WeeklyPlan> {
  const inflight = inflightByUserId.get(userId)
  if (inflight) return inflight

  const promise = (async () => {
    const response = await fetch('/api/profile/weekly-plan')
    const payload = await parseJsonResponse(response)

    if (!response.ok) {
      throw new Error(payload?.error || '本周探索计划加载失败')
    }

    return payload.plan as WeeklyPlan
  })().finally(() => {
    inflightByUserId.delete(userId)
  })

  inflightByUserId.set(userId, promise)
  return promise
}

export function invalidateWeeklyPlan(userId: string) {
  inflightByUserId.delete(userId)
}
