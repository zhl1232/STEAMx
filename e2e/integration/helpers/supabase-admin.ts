import { createClient } from '@supabase/supabase-js'

type AdminUser = { id: string; email?: string | null }
export type UserRole = 'user' | 'teacher' | 'moderator' | 'admin'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY for integration helpers.')
}

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})

function defaultAvatarPath(userId: string) {
  let hash = 0
  for (const char of userId) {
    hash = (hash * 31 + char.charCodeAt(0)) | 0
  }

  return `/avatars/default-${1 + (Math.abs(hash) % 12)}.svg`
}

async function ensureProfileRow(params: {
  userId: string
  username: string
  fullName: string
  role?: UserRole
}) {
  const role = params.role ?? 'user'
  const avatarUrl = defaultAvatarPath(params.userId)
  const existingProfile = await admin
    .from('profiles')
    .select('id, avatar_url')
    .eq('id', params.userId)
    .maybeSingle()

  if (existingProfile.error) throw existingProfile.error
  if (existingProfile.data) {
    const { error } = await admin
      .from('profiles')
      .update({
        username: params.username,
        display_name: params.fullName,
        avatar_url: existingProfile.data.avatar_url || avatarUrl,
        role,
        age_confirmed_at: new Date().toISOString(),
      })
      .eq('id', params.userId)

    if (error) throw error
    return
  }

  const { error } = await admin.from('profiles').insert({
    id: params.userId,
    username: params.username,
    display_name: params.fullName,
    avatar_url: avatarUrl,
    role,
    age_confirmed_at: new Date().toISOString(),
  })

  if (error) throw error
}

async function findUserByEmail(email: string): Promise<AdminUser | null> {
  const normalized = email.trim().toLowerCase()
  let page = 1

  while (page <= 5) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 })
    if (error) throw error

    const users = data?.users ?? []
    const match = users.find((user) => user.email?.toLowerCase() === normalized)
    if (match) return { id: match.id, email: match.email }

    if (users.length < 200) break
    page += 1
  }

  return null
}

export async function confirmUserEmail(email: string) {
  let user: AdminUser | null = null
  for (let attempt = 0; attempt < 5; attempt += 1) {
    user = await findUserByEmail(email)
    if (user) break
    await new Promise((resolve) => setTimeout(resolve, 500))
  }

  if (!user) {
    throw new Error(`Unable to find user for email: ${email}`)
  }

  const { error } = await admin.auth.admin.updateUserById(user.id, {
    email_confirm: true,
  })

  if (error) throw error

  return user.id
}

export async function ensureEmailUser(params: {
  email: string
  password: string
  fullName?: string
  username?: string
  role?: UserRole
}) {
  const normalizedEmail = params.email.trim().toLowerCase()
  const fallbackName = normalizedEmail.split('@')[0] || 'e2e-user'
  const fullName = params.fullName ?? fallbackName
  const username =
    params.username ??
    `e2e_${fallbackName.replace(/[^a-z0-9_]/gi, '_').slice(0, 20)}`

  const existing = await findUserByEmail(normalizedEmail)

  if (existing) {
    const { error } = await admin.auth.admin.updateUserById(existing.id, {
      password: params.password,
      email_confirm: true,
      user_metadata: {
        username,
        full_name: fullName,
      },
    })

    if (error) throw error
    await ensureProfileRow({ userId: existing.id, username, fullName, role: params.role })
    return existing.id
  }

  const { data, error } = await admin.auth.admin.createUser({
    email: normalizedEmail,
    password: params.password,
    email_confirm: true,
    user_metadata: {
      username,
      full_name: fullName,
    },
  })

  if (error) throw error
  if (!data.user) throw new Error(`Unable to create user for email: ${normalizedEmail}`)

  await ensureProfileRow({ userId: data.user.id, username, fullName, role: params.role })
  return data.user.id
}

export async function deleteUserByEmail(email: string) {
  const user = await findUserByEmail(email)
  if (!user) return
  const { error } = await admin.auth.admin.deleteUser(user.id)
  if (error) throw error
}

export async function deleteUserById(userId: string) {
  if (!userId) return
  const { error } = await admin.auth.admin.deleteUser(userId)
  if (error) throw error
}

export async function deletePlaygroundRaceMatchByCode(code: string) {
  const normalizedCode = code.trim().toUpperCase()
  if (!normalizedCode) return
  const { error } = await admin
    .from('playground_race_matches')
    .delete()
    .eq('code', normalizedCode)
  if (error) throw error
}

export async function setPlaygroundRaceMatchDeadline(matchId: string, deadlineAt: string) {
  const { error } = await admin
    .from('playground_race_matches')
    .update({ deadline_at: deadlineAt })
    .eq('id', matchId)
  if (error) throw error
}

export async function deleteFunctionWarsMatchByCode(code: string) {
  const normalizedCode = code.trim().toUpperCase()
  if (!normalizedCode) return
  const { error } = await admin
    .from('function_wars_matches')
    .delete()
    .eq('code', normalizedCode)
  if (error) throw error
}

export async function setFunctionWarsMatchDeadline(matchId: string, deadlineAt: string) {
  const { error } = await admin
    .from('function_wars_matches')
    .update({ turn_deadline_at: deadlineAt })
    .eq('id', matchId)
  if (error) throw error
}

export async function getFunctionWarsOnlineStats(userId: string) {
  const { data, error } = await admin
    .from('playground_stats')
    .select('stats')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw error

  const stats = data?.stats as Record<string, unknown> | null | undefined
  const online = stats?.function_wars_stats
  const record = online && typeof online === 'object' && !Array.isArray(online)
    ? online as Record<string, unknown>
    : {}

  return {
    onlineGames: typeof record.onlineGames === 'number' ? record.onlineGames : 0,
    onlineWins: typeof record.onlineWins === 'number' ? record.onlineWins : 0,
  }
}

/** Service-role delete: removes discussion and cascaded replies / likes. */
export async function deleteDiscussionByTitle(title: string) {
  const trimmed = title.trim()
  if (!trimmed) return
  const { error } = await admin.from('discussions').delete().eq('title', trimmed)
  if (error) throw error
}
