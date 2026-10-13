import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  clearPendingOtp,
  OTP_COOLDOWN_SECONDS,
  OTP_VALIDITY_MS,
  PENDING_OTP_STORAGE_KEY,
  readPendingOtp,
  savePendingOtp,
} from '@/lib/auth/pending-otp'

describe('pending-otp session storage', () => {
  beforeEach(() => {
    sessionStorage.clear()
    vi.useRealTimers()
  })

  afterEach(() => {
    sessionStorage.clear()
    vi.useRealTimers()
  })

  it('round-trips a fresh pending OTP with full cooldown', () => {
    const sentAt = Date.now()
    savePendingOtp({
      phone: '+8613800138000',
      displayPhone: '13800138000',
      sentAt,
      termsAgreed: true,
    })

    const restored = readPendingOtp(sentAt + 100)
    expect(restored).toEqual({
      phone: '+8613800138000',
      displayPhone: '13800138000',
      sentAt,
      termsAgreed: true,
      cooldownSeconds: OTP_COOLDOWN_SECONDS,
    })
  })

  it('shrinks cooldown as time passes and clears after OTP validity', () => {
    const sentAt = 1_700_000_000_000
    savePendingOtp({
      phone: '+8613800138000',
      displayPhone: '13800138000',
      sentAt,
      termsAgreed: true,
    })

    expect(readPendingOtp(sentAt + 15_000)?.cooldownSeconds).toBe(OTP_COOLDOWN_SECONDS - 15)
    expect(readPendingOtp(sentAt + 60_000)?.cooldownSeconds).toBe(0)
    expect(readPendingOtp(sentAt + OTP_VALIDITY_MS - 1)?.cooldownSeconds).toBe(0)
    expect(readPendingOtp(sentAt + OTP_VALIDITY_MS)).toBeNull()
    expect(sessionStorage.getItem(PENDING_OTP_STORAGE_KEY)).toBeNull()
  })

  it('rejects malformed payloads and clearPendingOtp removes the key', () => {
    sessionStorage.setItem(PENDING_OTP_STORAGE_KEY, '{"phone":"nope"}')
    expect(readPendingOtp()).toBeNull()
    expect(sessionStorage.getItem(PENDING_OTP_STORAGE_KEY)).toBeNull()

    savePendingOtp({
      phone: '+8613800138000',
      displayPhone: '13800138000',
      sentAt: Date.now(),
      termsAgreed: true,
    })
    clearPendingOtp()
    expect(sessionStorage.getItem(PENDING_OTP_STORAGE_KEY)).toBeNull()
  })
})
