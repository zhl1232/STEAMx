import { createHmac, timingSafeEqual } from 'node:crypto'

/**
 * Server-side proof that an observation photo passed the combined
 * moderation + identification vision call.
 *
 * `observation_media_analyses` rows are owner-updatable under RLS, so the
 * `moderation_pass` column alone cannot be trusted at publish time. The
 * media-analysis route stores an HMAC (keyed by a server-only secret) next to
 * the provider response; submit only skips the separate image moderation call
 * when this attestation verifies. Anything else falls back to the standalone
 * moderation model, so an unmoderated image is never published.
 */

const ATTESTATION_VERSION = 'v1'
export const OBSERVATION_MODERATION_ATTESTATION_KEY = 'moderation_attestation'

function getSecret(): string | null {
  const secret =
    process.env.OBSERVATION_MODERATION_ATTESTATION_SECRET?.trim() ||
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  return secret || null
}

function digest(secret: string, userId: string, imageUrl: string, modelName: string): string {
  // Derive a purpose-bound key so the raw secret is never used directly.
  const key = createHmac('sha256', secret).update('observation-moderation-attestation').digest()
  return createHmac('sha256', key)
    .update([ATTESTATION_VERSION, userId, imageUrl, modelName, 'moderation_pass=true'].join('\n'))
    .digest('hex')
}

export type ObservationModerationAttestation = {
  version: string
  model: string
  sig: string
}

export function signObservationModerationPass(
  userId: string,
  imageUrl: string,
  modelName: string,
): ObservationModerationAttestation | null {
  const secret = getSecret()
  if (!secret) return null
  return { version: ATTESTATION_VERSION, model: modelName, sig: digest(secret, userId, imageUrl, modelName) }
}

export function verifyObservationModerationPass(
  row: {
    user_id?: string | null
    image_url?: string | null
    moderation_pass?: boolean | null
    raw_response?: unknown
  } | null | undefined,
  userId: string,
  imageUrl: string,
): boolean {
  if (!row || row.moderation_pass !== true) return false
  if (row.user_id && row.user_id !== userId) return false
  if (row.image_url && row.image_url !== imageUrl) return false
  const secret = getSecret()
  if (!secret) return false

  const raw = row.raw_response
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return false
  const att = (raw as Record<string, unknown>)[OBSERVATION_MODERATION_ATTESTATION_KEY]
  if (!att || typeof att !== 'object' || Array.isArray(att)) return false
  const { version, model, sig } = att as Record<string, unknown>
  if (version !== ATTESTATION_VERSION || typeof model !== 'string' || typeof sig !== 'string') return false

  const expected = Buffer.from(digest(secret, userId, imageUrl, model), 'hex')
  const actual = Buffer.from(sig, 'hex')
  return actual.length === expected.length && timingSafeEqual(actual, expected)
}

/** Observation photos defer moderation to the combined identify call. */
export function isObservationPhotoUpload(bucket: string, pathPrefix: string | null): boolean {
  return bucket === 'project-images' && pathPrefix === 'observations'
}

export const OBSERVATION_SUGGESTION_ATTESTATION_KEY = 'suggestion_attestation'

function suggestionDigest(secret: string, userId: string, imageUrl: string, payload: string): string {
  const key = createHmac('sha256', secret).update('observation-suggestion-attestation').digest()
  return createHmac('sha256', key)
    .update([ATTESTATION_VERSION, userId, imageUrl, payload].join('\n'))
    .digest('hex')
}

function canonicalSuggestions(items: Array<{ commonName: string; scientificName: string | null }>): string {
  return JSON.stringify(items.map((item) => [item.commonName, item.scientificName ?? null]))
}

/** Signs the unmatched 「其他」 suggestions produced by the server-side vision call. */
export function signObservationSuggestions(
  userId: string,
  imageUrl: string,
  items: Array<{ commonName: string; scientificName: string | null }>,
): { version: string; sig: string } | null {
  if (items.length === 0) return null
  const secret = getSecret()
  if (!secret) return null
  return { version: ATTESTATION_VERSION, sig: suggestionDigest(secret, userId, imageUrl, canonicalSuggestions(items)) }
}

/** True only when the stored suggestions are exactly those the server signed. */
export function verifyObservationSuggestions(
  rawResponse: unknown,
  userId: string,
  imageUrl: string,
  items: Array<{ commonName: string; scientificName: string | null }>,
): boolean {
  if (items.length === 0) return false
  const secret = getSecret()
  if (!secret) return false
  if (!rawResponse || typeof rawResponse !== 'object' || Array.isArray(rawResponse)) return false
  const att = (rawResponse as Record<string, unknown>)[OBSERVATION_SUGGESTION_ATTESTATION_KEY]
  if (!att || typeof att !== 'object' || Array.isArray(att)) return false
  const { version, sig } = att as Record<string, unknown>
  if (version !== ATTESTATION_VERSION || typeof sig !== 'string') return false
  const expected = Buffer.from(suggestionDigest(secret, userId, imageUrl, canonicalSuggestions(items)), 'hex')
  const actual = Buffer.from(sig, 'hex')
  return actual.length === expected.length && timingSafeEqual(actual, expected)
}
