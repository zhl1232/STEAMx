import { createClient } from '@supabase/supabase-js'

type AdminUser = { id: string; email?: string | null }

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
}) {
  const existingProfile = await admin
    .from('profiles')
    .select('id')
    .eq('id', params.userId)
    .maybeSingle()

  if (existingProfile.error) throw existingProfile.error
  if (existingProfile.data) return

  const { error } = await admin.from('profiles').insert({
    id: params.userId,
    username: params.username,
    display_name: params.fullName,
    avatar_url: defaultAvatarPath(params.userId),
    role: 'user',
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
    await ensureProfileRow({ userId: existing.id, username, fullName })
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

  await ensureProfileRow({ userId: data.user.id, username, fullName })
  return data.user.id
}

export async function deleteUserByEmail(email: string) {
  const user = await findUserByEmail(email)
  if (!user) return
  const { error } = await admin.auth.admin.deleteUser(user.id)
  if (error) throw error
}

/** Service-role delete: removes discussion and cascaded replies / likes. */
export async function deleteDiscussionByTitle(title: string) {
  const trimmed = title.trim()
  if (!trimmed) return
  const { error } = await admin.from('discussions').delete().eq('title', trimmed)
  if (error) throw error
}
