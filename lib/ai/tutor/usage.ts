import type {
  DashScopeModelRole,
  DashScopeTokenUsage,
  DashScopeUsageObserver,
  DashScopeUsageStatus,
} from '@/lib/ai/dashscope'

export type TutorUsagePurpose =
  | 'main_reply'
  | 'resource_planner'
  | 'tool_planner'
  | 'scratch_diagnosis'
  | 'audio_planner'
  | 'notebook_summary'
  | 'conversation_summary'

export const TUTOR_USAGE_BUDGET_MESSAGE = '本次对话的可用代币额度不足，请减少内容或图片后再试。'
/** An execution allowance for an image, not a tokenizer or a customer charge. */
export const TUTOR_IMAGE_INPUT_RESERVE_TOKENS = 16_384
const DEFAULT_MAX_OUTPUT_TOKENS = 8192
const MAX_REQUEST_TOKENS = 131_072

export class TutorUsageBudgetError extends Error {
  constructor() {
    super(TUTOR_USAGE_BUDGET_MESSAGE)
    this.name = 'TutorUsageBudgetError'
  }
}

type VerifiedUsage = {
  inputTokens: number | null
  outputTokens: number | null
  totalTokens: number
}

function validCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
}

/** Only provider counts are billable. Reasoning is already a subset of output. */
export function normalizeTutorUsage(usage: DashScopeTokenUsage | null | undefined): VerifiedUsage | null {
  if (!usage) return null
  for (const value of [usage.promptTokens, usage.completionTokens, usage.totalTokens, usage.reasoningTokens]) {
    if (value != null && !validCount(value)) return null
  }
  const input = usage.promptTokens
  const output = usage.completionTokens
  const total = usage.totalTokens
  const possibleOutput = output ?? (total != null && input != null ? total - input : total)
  if (usage.reasoningTokens != null && usage.reasoningTokens > (possibleOutput ?? -1)) return null
  if (input != null && output != null) {
    const sum = input + output
    if (!validCount(sum) || (total != null && total !== sum)) return null
    return { inputTokens: input, outputTokens: output, totalTokens: sum }
  }
  if (total == null || (input != null && input > total) || (output != null && output > total)) return null
  return {
    inputTokens: input ?? (output == null ? null : total - output),
    outputTokens: output ?? (input == null ? null : total - input),
    totalTokens: total,
  }
}

/**
 * Conservative text/structure byte allowance plus a separate image allowance.
 * This prevents unbounded work and reserves concurrent calls synchronously; it
 * is not exact model tokenization and is never used for charging. Provider
 * overruns stop later calls, while settlement must cap charges at its receipt.
 */
export function estimateTutorInputTokens(payload: Record<string, unknown>): number {
  let imageCount = 0
  const serialized = JSON.stringify(payload, (key, value: unknown) => {
    if (['max_tokens', 'max_completion_tokens', 'stream', 'stream_options', 'temperature'].includes(key)) return undefined
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const part = value as Record<string, unknown>
      if (part.type === 'image_url' || part.type === 'input_image') {
        imageCount += 1
        return { type: 'image', content: '[image allowance]' }
      }
    }
    return value
  })
  const messageCount = Array.isArray(payload.messages) ? payload.messages.length : 0
  return new TextEncoder().encode(serialized).length + 256 + messageCount * 32 + imageCount * TUTOR_IMAGE_INPUT_RESERVE_TOKENS
}

export type TutorUsageCall = {
  callId: number
  purpose: TutorUsagePurpose
  role: DashScopeModelRole
  model: string
  status: DashScopeUsageStatus | 'pending'
  estimatedInputTokens: number
  maxOutputTokens: number
  usage: DashScopeTokenUsage | null
  inputTokens: number | null
  outputTokens: number | null
  totalTokens: number | null
  usageMissing: boolean
}

export type TutorUsageSnapshot = {
  inputTokens: number | null
  outputTokens: number | null
  /** Sum of verified calls only, including calls whose result was later unused. */
  totalTokens: number
  usageMissing: boolean
  budgetExceeded: boolean
  budgetDeniedCalls: number
  pendingCalls: number
  calls: TutorUsageCall[]
}

/** One instance per admitted user request; no ambient/global accounting state. */
export function createTutorUsageCollector({ maxTotalTokens, onBudgetExceeded }: {
  maxTotalTokens: number
  /** Service confirms an atomic switch to this request's free allowance. */
  onBudgetExceeded?: (minimumTotalTokens: number) => Promise<{ maxTotalTokens: number } | null>
}) {
  if (!validCount(maxTotalTokens)) throw new Error('Invalid tutor request budget')
  const calls: TutorUsageCall[] = []
  let budgetUsed = 0
  let budgetExceeded = false
  let budgetDeniedCalls = 0
  let verifiedTotal = 0
  let recoveryPromise: Promise<boolean> | null = null

  const recoverBudget: NonNullable<DashScopeUsageObserver['recoverBudget']> = async (input, error) => {
    if (!(error instanceof TutorUsageBudgetError) || !onBudgetExceeded || maxTotalTokens >= MAX_REQUEST_TOKENS) return false
    if (recoveryPromise) return recoveryPromise
    const minimumTotalTokens = budgetUsed + estimateTutorInputTokens(input.payload) + 1
    if (!validCount(minimumTotalTokens) || minimumTotalTokens <= maxTotalTokens || minimumTotalTokens > MAX_REQUEST_TOKENS) return false
    recoveryPromise = (async () => {
      try {
        const expanded = await onBudgetExceeded(minimumTotalTokens)
        if (!expanded || !validCount(expanded.maxTotalTokens) || expanded.maxTotalTokens <= maxTotalTokens ||
          expanded.maxTotalTokens < minimumTotalTokens || expanded.maxTotalTokens > MAX_REQUEST_TOKENS) return false
        maxTotalTokens = expanded.maxTotalTokens
        return true
      } catch {
        // An unconfirmed quota transaction must not permit additional AI work.
        return false
      }
    })()
    return recoveryPromise
  }

  const forPurpose = (purpose: TutorUsagePurpose): DashScopeUsageObserver => ({
    ...(purpose === 'main_reply' ? { recoverBudget } : {}),
    start({ role, model, payload }) {
      const estimatedInputTokens = estimateTutorInputTokens(payload)
      const requestedOutput = payload.max_tokens ?? payload.max_completion_tokens ?? DEFAULT_MAX_OUTPUT_TOKENS
      if (!validCount(requestedOutput) || requestedOutput === 0) throw new Error('Invalid tutor output budget')
      const availableOutput = maxTotalTokens - budgetUsed - estimatedInputTokens
      const maxOutputTokens = purpose === 'main_reply'
        ? Math.min(requestedOutput, Math.max(0, availableOutput))
        : requestedOutput
      if (budgetUsed > maxTotalTokens || maxOutputTokens < 1 || availableOutput < maxOutputTokens) {
        budgetDeniedCalls += 1
        throw new TutorUsageBudgetError()
      }
      const reservedTokens = estimatedInputTokens + maxOutputTokens
      budgetUsed += reservedTokens
      const call: TutorUsageCall = {
        callId: calls.length + 1,
        purpose, role, model, status: 'pending', estimatedInputTokens, maxOutputTokens,
        usage: null, inputTokens: null, outputTokens: null, totalTokens: null, usageMissing: true,
      }
      calls.push(call)
      let finished = false
      return {
        maxOutputTokens,
        finish({ usage, status }) {
          if (finished) return
          finished = true
          let verified = normalizeTutorUsage(usage)
          if (verified && !validCount(verifiedTotal + verified.totalTokens)) verified = null
          call.status = status
          // Only normalized counts are kept; malformed provider fields cannot
          // become plausible-looking billing metadata through serialization.
          call.usage = verified && usage ? { ...usage } : null
          call.inputTokens = verified?.inputTokens ?? null
          call.outputTokens = verified?.outputTokens ?? null
          call.totalTokens = verified?.totalTokens ?? null
          call.usageMissing = !verified && status !== 'rejected'
          if (verified) {
            verifiedTotal += verified.totalTokens
            budgetUsed += verified.totalTokens - reservedTokens
          } else if (status === 'rejected') {
            budgetUsed -= reservedTokens
          }
          // Missing usage remains reserved for execution, never charged. This
          // prevents an optional retry from creating unlimited unmetered work.
          if (budgetUsed > maxTotalTokens) budgetExceeded = true
        },
      }
    },
  })

  const snapshot = (): TutorUsageSnapshot => {
    const verified = calls.filter((call) => call.totalTokens != null)
    return {
      inputTokens: verified.some((call) => call.inputTokens == null)
        ? null : verified.reduce((sum, call) => sum + (call.inputTokens ?? 0), 0),
      outputTokens: verified.some((call) => call.outputTokens == null)
        ? null : verified.reduce((sum, call) => sum + (call.outputTokens ?? 0), 0),
      totalTokens: verifiedTotal,
      usageMissing: calls.some((call) => call.usageMissing),
      budgetExceeded,
      budgetDeniedCalls,
      pendingCalls: calls.filter((call) => call.status === 'pending').length,
      calls: calls.map((call) => ({ ...call, usage: call.usage ? { ...call.usage } : null })),
    }
  }

  return { forPurpose, snapshot }
}
