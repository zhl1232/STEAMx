import { isSafeInternalHref } from '@/lib/utils/safe-internal-href'

export interface ApiErrorDetails {
  redirectTo?: string
  capability?: string
  [key: string]: unknown
}

export interface ApiErrorPayload {
  error?: string
  message?: string
  code?: string
  details?: ApiErrorDetails
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export async function getApiErrorPayload(response: Response): Promise<ApiErrorPayload> {
  try {
    const payload = await response.clone().json()
    if (isRecord(payload)) return payload as ApiErrorPayload
  } catch {
    // Ignore invalid JSON and fall back to plain text.
  }

  try {
    const text = await response.clone().text()
    if (text.trim().length > 0) {
      return { error: text }
    }
  } catch {
    // Ignore read errors and use an empty payload below.
  }

  return {}
}

export function getApiErrorMessageFromPayload(payload: ApiErrorPayload, fallback = 'Request failed') {
  if (typeof payload.error === 'string' && payload.error.trim().length > 0) {
    return payload.error
  }
  if (typeof payload.message === 'string' && payload.message.trim().length > 0) {
    return payload.message
  }
  return fallback
}

export function isAgeConfirmationRequired(payload: ApiErrorPayload) {
  return payload.code === 'AGE_CONFIRMATION_REQUIRED'
}

export function getInteractionAccessRedirect(payload: ApiErrorPayload) {
  if (!isAgeConfirmationRequired(payload)) return null

  const redirectTo = payload.details?.redirectTo
  if (isSafeInternalHref(redirectTo)) {
    return redirectTo
  }

  return '/settings/security?section=age-confirmation'
}

export async function getApiErrorMessage(response: Response, fallback = 'Request failed') {
  const payload = await getApiErrorPayload(response)
  return getApiErrorMessageFromPayload(payload, fallback)
}
