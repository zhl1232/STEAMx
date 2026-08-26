import { cache } from 'react'

import { logger } from '@/lib/logger'
import { supabaseAdmin } from '@/lib/supabase/admin'

import { CONTENT_CLASSIFICATION_SETTINGS_DEFAULTS } from './constants'
import type { PublicClassificationSettings } from './types'

/**
 * Read the server-side rollout switches from the single authoritative row.
 *
 * The fallback is intentional: the application can be deployed before the
 * phase-1 migration reaches a database, without changing the old public DTO.
 */
export const getContentClassificationSettings = cache(async (): Promise<PublicClassificationSettings> => {
  if (!supabaseAdmin) return CONTENT_CLASSIFICATION_SETTINGS_DEFAULTS

  const { data, error } = await supabaseAdmin
    .from('content_classification_settings')
    .select('public_v1_enabled, enforcement_enabled')
    .eq('id', true)
    .maybeSingle()

  if (error || !data) {
    if (error) {
      logger.warn('Content classification settings unavailable; using compatibility defaults', {
        error,
      })
    }
    return CONTENT_CLASSIFICATION_SETTINGS_DEFAULTS
  }

  return {
    publicV1Enabled: data.public_v1_enabled === true,
    enforcementEnabled: data.enforcement_enabled === true,
  }
})

/** Remove the optional public classification field when the API rollout is off. */
export function withoutPublicClassification<T extends { classification?: unknown }>(item: T): Omit<T, 'classification'> {
  const { classification: _classification, ...rest } = item
  return rest
}

export function applyPublicClassificationVisibility<T extends { classification?: unknown }>(
  items: readonly T[],
  settings: PublicClassificationSettings,
): T[] {
  return settings.publicV1Enabled
    ? [...items]
    : items.map((item) => withoutPublicClassification(item) as T)
}
