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

export async function deleteUserByEmail(email: string) {
  const user = await findUserByEmail(email)
  if (!user) return
  const { error } = await admin.auth.admin.deleteUser(user.id)
  if (error) throw error
}
