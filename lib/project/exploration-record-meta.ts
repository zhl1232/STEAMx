export const RECORD_TYPE_OPTIONS = [
  { id: "observation", label: "观察记录", tone: "green" },
  { id: "help", label: "问题求助", tone: "blue" },
  { id: "insight", label: "心得分享", tone: "orange" },
  { id: "discovery", label: "新发现", tone: "amber" },
  { id: "decorate", label: "布置美化", tone: "rose" },
  { id: "result", label: "成果展示", tone: "purple" },
] as const

export const STAGE_TAG_OPTIONS = [
  { id: "growth", label: "植物生长", tone: "green" },
  { id: "decorate", label: "布置美化", tone: "mint" },
  { id: "help", label: "问题求助", tone: "orange" },
  { id: "observe", label: "日常观察", tone: "blue" },
  { id: "result", label: "成果展示", tone: "purple" },
] as const

export type RecordTypeId = (typeof RECORD_TYPE_OPTIONS)[number]["id"]
export type StageTagId = (typeof STAGE_TAG_OPTIONS)[number]["id"]

const TYPE_PREFIX = /^\[([^\]]{1,12})\]\s*/
const STAGE_INLINE = /阶段[:：]\s*([^\n]+)/

export function parseExplorationRecordNotes(notes?: string | null) {
  const raw = (notes || "").trim()
  if (!raw) {
    return { body: "", recordTypeLabel: undefined as string | undefined, stageLabel: undefined as string | undefined }
  }

  let body = raw
  let recordTypeLabel: string | undefined
  const prefix = raw.match(TYPE_PREFIX)
  if (prefix) {
    recordTypeLabel = prefix[1]
    body = raw.slice(prefix[0].length).trim()
  }

  let stageLabel: string | undefined
  const stage = body.match(STAGE_INLINE)
  if (stage) {
    stageLabel = stage[1].trim()
    body = body.replace(STAGE_INLINE, "").trim()
  }

  return { body: body || raw, recordTypeLabel, stageLabel }
}

export function getStageTagTone(label?: string) {
  if (!label) return "green"
  if (label.includes("求助")) return "orange"
  if (label.includes("美化") || label.includes("布置")) return "mint"
  if (label.includes("成果")) return "purple"
  if (label.includes("观察")) return "blue"
  return "green"
}

export function getRecordTypeLabel(recordTypeId?: string | null) {
  if (!recordTypeId) return undefined
  return RECORD_TYPE_OPTIONS.find((item) => item.id === recordTypeId)?.label
}

/** 展示用：仅使用 DB 字段或 notes 内嵌元数据，不伪造标签 */
export function resolveRecordTypeLabel(input: {
  recordType?: string | null
  notes?: string | null
}): string | undefined {
  const fromDb = getRecordTypeLabel(input.recordType)
  if (fromDb) return fromDb
  const parsed = parseExplorationRecordNotes(input.notes)
  return parsed.recordTypeLabel
}

/** 展示用：阶段标签（可选）；无数据时返回 undefined */
export function resolveStageLabel(input: {
  stageLabel?: string | null
  notes?: string | null
}): string | undefined {
  if (input.stageLabel?.trim()) return input.stageLabel.trim()
  const parsed = parseExplorationRecordNotes(input.notes)
  return parsed.stageLabel
}

export function matchesRecordTypeFilter(
  item: { recordType?: string | null; notes?: string | null },
  filterId: string,
): boolean {
  if (filterId === "all") return true
  const target = RECORD_TYPE_OPTIONS.find((option) => option.id === filterId)?.id
  if (!target) return true
  if (item.recordType === target) return true
  const parsed = parseExplorationRecordNotes(item.notes)
  const parsedLabel = parsed.recordTypeLabel
  if (!parsedLabel) return false
  const option = RECORD_TYPE_OPTIONS.find((o) => o.id === target)
  return option ? parsedLabel === option.label : false
}
