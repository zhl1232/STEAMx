/** @vitest-environment node */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import {
  isObservationPhotoUpload,
  signObservationSuggestions,
  verifyObservationSuggestions,
  signObservationModerationPass,
  verifyObservationModerationPass,
} from '@/lib/ai/observation-moderation-attestation'

const USER = 'user-1'
const URL = 'https://x.supabase.co/storage/v1/object/public/project-images/observations/user-1/a.jpg'

describe('observation moderation attestation', () => {
  const saved = { ...process.env }
  beforeEach(() => {
    process.env.OBSERVATION_MODERATION_ATTESTATION_SECRET = 'test-secret'
  })
  afterEach(() => {
    process.env = { ...saved }
  })

  function row(overrides: Record<string, unknown> = {}) {
    const att = signObservationModerationPass(USER, URL, 'qwen3.8-max-0902')
    return {
      user_id: USER,
      image_url: URL,
      moderation_pass: true,
      raw_response: { provider: {}, moderation_attestation: att },
      ...overrides,
    }
  }

  it('verifies a server-signed pass', () => {
    expect(verifyObservationModerationPass(row(), USER, URL)).toBe(true)
  })

  it('rejects a forged/owner-edited row without a valid signature', () => {
    expect(verifyObservationModerationPass(row({ raw_response: { moderation_attestation: { version: 'v1', model: 'm', sig: 'ab'.repeat(32) } } }), USER, URL)).toBe(false)
    expect(verifyObservationModerationPass(row({ raw_response: null }), USER, URL)).toBe(false)
  })

  it('rejects when moderation_pass is not true', () => {
    expect(verifyObservationModerationPass(row({ moderation_pass: false }), USER, URL)).toBe(false)
    expect(verifyObservationModerationPass(row({ moderation_pass: null }), USER, URL)).toBe(false)
  })

  it('binds the signature to user and image', () => {
    expect(verifyObservationModerationPass(row({ user_id: undefined }), 'user-2', URL)).toBe(false)
    expect(verifyObservationModerationPass(row({ image_url: undefined }), USER, `${URL}?x`)).toBe(false)
  })

  it('fails closed without any secret', () => {
    const r = row()
    delete process.env.OBSERVATION_MODERATION_ATTESTATION_SECRET
    delete process.env.SUPABASE_SERVICE_ROLE_KEY
    expect(signObservationModerationPass(USER, URL, 'm')).toBeNull()
    expect(verifyObservationModerationPass(r, USER, URL)).toBe(false)
  })

  it('only defers moderation for observation photo uploads', () => {
    expect(isObservationPhotoUpload('project-images', 'observations')).toBe(true)
    expect(isObservationPhotoUpload('project-images', 'covers')).toBe(false)
    expect(isObservationPhotoUpload('project-images', null)).toBe(false)
    expect(isObservationPhotoUpload('avatars', 'observations')).toBe(false)
  })

  it('verifies only the exact server-signed 「其他」 suggestions', () => {
    const items = [{ commonName: '同型巴蜗牛', scientificName: 'Bradybaena similaris' }]
    const raw = { suggestion_attestation: signObservationSuggestions(USER, URL, items) }
    expect(verifyObservationSuggestions(raw, USER, URL, items)).toBe(true)
    expect(verifyObservationSuggestions(raw, USER, URL, [{ commonName: '随便写', scientificName: null }])).toBe(false)
    expect(verifyObservationSuggestions(raw, 'user-2', URL, items)).toBe(false)
    expect(verifyObservationSuggestions({}, USER, URL, items)).toBe(false)
    expect(signObservationSuggestions(USER, URL, [])).toBeNull()
  })
})
