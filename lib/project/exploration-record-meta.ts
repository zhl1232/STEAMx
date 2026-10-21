/** 发记录时可选的 3 种类型（2026-10 由 6 种合并而来） */
export const RECORD_TYPE_OPTIONS = [
  { id: "observation", label: "观察记录", tone: "green" },
  { id: "help", label: "问题求助", tone: "blue" },
  { id: "result", label: "成果展示", tone: "purple" },
] as const

export type RecordTypeId = (typeof RECORD_TYPE_OPTIONS)[number]["id"]

export const DEFAULT_RECORD_TYPE: RecordTypeId = "observation"

/** 旧类型 id → 新类型 id（只用于展示和筛选，不改库） */
const LEGACY_TYPE_ID_MAP: Record<string, RecordTypeId> = {
  observation: "observation",
  discovery: "observation",
  help: "help",
  insight: "result",
  decorate: "result",
  result: "result",
}

/** 旧标签文字（notes 里的 [标签]、旧阶段标签）→ 新类型 id */
const LEGACY_LABEL_MAP: Record<string, RecordTypeId> = {
  观察记录: "observation",
  新发现: "observation",
  日常观察: "observation",
  问题求助: "help",
  心得分享: "result",
  布置美化: "result",
  成果展示: "result",
}

/**
 * 阶段标签：旧版 5 个里「布置美化 / 问题求助 / 日常观察 / 成果展示」与记录类型重复，
 * 已并入类型；只保留「植物生长」这种真正描述阶段的标签。
 */
export const STAGE_TAG_OPTIONS = [{ id: "growth", label: "植物生长", tone: "green" }] as const

export type StageTagId = (typeof STAGE_TAG_OPTIONS)[number]["id"]

export function normalizeRecordTypeId(recordType?: string | null): RecordTypeId | undefined {
  if (!recordType) return undefined
  return LEGACY_TYPE_ID_MAP[recordType.trim()]
}

export function recordTypeIdFromLabel(label?: string | null): RecordTypeId | undefined {
  if (!label) return undefined
  return LEGACY_LABEL_MAP[label.trim()]
}

function labelOf(id?: RecordTypeId) {
  return id ? RECORD_TYPE_OPTIONS.find((item) => item.id === id)?.label : undefined
}

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
  return labelOf(normalizeRecordTypeId(recordTypeId))
}

/** 展示用：仅使用 DB 字段或 notes 内嵌元数据，不伪造标签 */
export function resolveRecordTypeLabel(input: {
  recordType?: string | null
  notes?: string | null
}): string | undefined {
  const fromDb = getRecordTypeLabel(input.recordType)
  if (fromDb) return fromDb
  const parsed = parseExplorationRecordNotes(input.notes)
  if (!parsed.recordTypeLabel) return undefined
  return labelOf(recordTypeIdFromLabel(parsed.recordTypeLabel)) ?? parsed.recordTypeLabel
}

/** 记录实际归属的新类型：DB 字段 → notes [标签] → 与类型重复的旧阶段标签 */
export function resolveRecordTypeId(input: {
  recordType?: string | null
  notes?: string | null
  stageLabel?: string | null
}): RecordTypeId | undefined {
  return (
    normalizeRecordTypeId(input.recordType) ??
    recordTypeIdFromLabel(parseExplorationRecordNotes(input.notes).recordTypeLabel) ??
    recordTypeIdFromLabel(input.stageLabel ?? parseExplorationRecordNotes(input.notes).stageLabel)
  )
}

/** 展示用：阶段标签（可选）；无数据时返回 undefined */
export function resolveStageLabel(input: {
  stageLabel?: string | null
  notes?: string | null
}): string | undefined {
  const label = input.stageLabel?.trim() || parseExplorationRecordNotes(input.notes).stageLabel
  if (!label) return undefined
  // 和记录类型重复的旧阶段标签不再单独显示
  if (recordTypeIdFromLabel(label)) return undefined
  return label
}

export function matchesRecordTypeFilter(
  item: { recordType?: string | null; notes?: string | null; stageLabel?: string | null },
  filterId: string,
): boolean {
  if (filterId === "all") return true
  const target = normalizeRecordTypeId(filterId)
  if (!target) return true
  return resolveRecordTypeId(item) === target
}
