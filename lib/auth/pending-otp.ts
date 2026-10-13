/**
 * Session-scoped pending SMS OTP for login.
 * Closing the login dialog unmounts AuthFlow; without this the UI drops back
 * to "get code" while the server still enforces the 60s resend cooldown.
 */

export const PENDING_OTP_STORAGE_KEY = 'steamx:auth-pending-otp-v1'
export const OTP_COOLDOWN_SECONDS = 60
/** Match server phone_otps expiry in app/api/auth/sms/send */
export const OTP_VALIDITY_MS = 10 * 60 * 1000

export type PendingOtpState = {
  /** E.164, e.g. +8613800138000 */
  phone: string
  /** Raw input shown in "已发送到 …" */
  displayPhone: string
  /** Date.now() when send succeeded */
  sentAt: number
  termsAgreed: boolean
}

export type RestoredPendingOtp = PendingOtpState & {
  /** Remaining resend cooldown in whole seconds (0 when elapsed) */
  cooldownSeconds: number
}

function isPendingOtpState(value: unknown): value is PendingOtpState {
  if (!value || typeof value !== 'object') return false
  const v = value as Record<string, unknown>
  return (
    typeof v.phone === 'string'
    && /^\+\d{8,15}$/.test(v.phone)
    && typeof v.displayPhone === 'string'
    && v.displayPhone.trim().length > 0
    && typeof v.sentAt === 'number'
    && Number.isFinite(v.sentAt)
    && typeof v.termsAgreed === 'boolean'
  )
}

export function readPendingOtp(now = Date.now()): RestoredPendingOtp | null {
  if (typeof window === 'undefined') return null

  try {
    const raw = sessionStorage.getItem(PENDING_OTP_STORAGE_KEY)
    if (!raw) return null

    const parsed: unknown = JSON.parse(raw)
    if (!isPendingOtpState(parsed)) {
      sessionStorage.removeItem(PENDING_OTP_STORAGE_KEY)
      return null
    }

    const ageMs = now - parsed.sentAt
    if (ageMs < 0 || ageMs >= OTP_VALIDITY_MS) {
      sessionStorage.removeItem(PENDING_OTP_STORAGE_KEY)
      return null
    }

    const cooldownSeconds = Math.max(
      0,
      Math.ceil(OTP_COOLDOWN_SECONDS - ageMs / 1000),
    )

    return { ...parsed, cooldownSeconds }
  } catch {
    return null
  }
}

export function savePendingOtp(state: PendingOtpState): void {
  if (typeof window === 'undefined') return

  try {
    sessionStorage.setItem(PENDING_OTP_STORAGE_KEY, JSON.stringify(state))
  } catch {
    // private mode / quota — in-memory resume still works until unmount
  }
}

export function clearPendingOtp(): void {
  if (typeof window === 'undefined') return

  try {
    sessionStorage.removeItem(PENDING_OTP_STORAGE_KEY)
  } catch {
    // ignore
  }
}
