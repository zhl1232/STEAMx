import type { JourneyRecord } from '@/lib/journeys/types'

export async function readProjectRecords(projectId: string | number, preferredId: number | null, signal?: AbortSignal, request: typeof fetch = fetch) {
  const response = await request(`/api/journeys?source_type=project&source_id=${projectId}&status=all`, {cache:'no-store',signal})
  if (!response.ok) throw new Error('记录列表读取失败')
  const payload = await response.json()
  if (!Array.isArray(payload.journeys)) throw new Error('记录列表格式无效')
  const journeys = payload.journeys as {id:number;status:string}[]
  const selected = journeys.find(j => j.status === 'active') ?? journeys.find(j => j.id === preferredId) ?? journeys[0]
  if (!selected) return {id:null,status:null,records:[] as JourneyRecord[]}
  if (!Number.isInteger(selected.id)) throw new Error('探索记录编号无效')
  const detail = await request(`/api/journeys/${selected.id}?limit=100`, {cache:'no-store',signal})
  if (!detail.ok) throw new Error('探索记录读取失败')
  const data = await detail.json()
  if (!Array.isArray(data.records) || typeof data.journey?.status !== 'string') throw new Error('探索记录格式无效')
  return {id:selected.id,status:data.journey.status as string,records:data.records as JourneyRecord[]}
}
