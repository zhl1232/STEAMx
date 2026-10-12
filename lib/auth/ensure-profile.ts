import 'server-only'
import { createHash, randomUUID } from 'node:crypto'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { logger } from '@/lib/logger'
import { createDefaultDisplayName, isPhoneBasedDisplayName } from '@/lib/auth/default-display-name'
import { getDefaultAvatarPath } from '@/lib/profile/avatar-options'

function randomUsername() {
  return `user_${createHash('md5').update(randomUUID()).digest('hex').slice(0, 8)}`
}

export async function ensureProfile(params: {
  userId: string
  userMetadata?: Record<string, unknown> | null
  phone?: string | null
  client?: typeof supabaseAdmin | null
}): Promise<{ ok: boolean; created: boolean; error?: string }> {
  try {
    const { userId, userMetadata, phone, client = supabaseAdmin } = params
    if (!client) throw new Error('Profile service unavailable')
    const existing = await client.from('profiles').select('id').eq('id', userId).maybeSingle()
    if (existing.error) throw existing.error
    if (existing.data) return { ok: true, created: false }

    // SQL btrim removes spaces; count Unicode code points like char_length.
    let username = typeof userMetadata?.username === 'string' ? userMetadata.username.replace(/^ +| +$/g, '') : ''
    if (Array.from(username).length >= 3) {
      const occupied = await client.from('profiles').select('id').eq('username', username).neq('id', userId).limit(1)
      if (occupied.error) throw occupied.error
      if (occupied.data?.length) username = randomUsername()
    } else {
      username = randomUsername()
    }
    const fullName = typeof userMetadata?.full_name === 'string' ? userMetadata.full_name.replace(/^ +| +$/g, '') : ''
    const displayName = !fullName || (phone != null && isPhoneBasedDisplayName(fullName, phone))
      ? createDefaultDisplayName(undefined, 'hex') : fullName
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const { data, error } = await client.from('profiles').upsert({
        id: userId, username, display_name: displayName, avatar_url: getDefaultAvatarPath(userId),
      }, { onConflict: 'id', ignoreDuplicates: true }).select('id')
      if (!error) return { ok: true, created: Boolean(data?.length) }
      // The id conflict is already ignored; username is the remaining unique key.
      if (error.code !== '23505' || attempt === 4) throw error
      username = randomUsername()
    }
    throw new Error('Profile retry limit reached')
  } catch (error) {
    // Database details can contain a username; record only the error code.
    const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : 'unknown'
    logger.error('[ensure-profile] recovery failed', { code })
    return { ok: false, created: false, error: 'Profile recovery failed' }
  }
}
