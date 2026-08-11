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

export async function deleteSafetyGovernanceFixtures(params: {
  userIds: string[]
  projectIds: number[]
}) {
  const userIds = [...new Set(params.userIds.filter(Boolean))]
  const projectIdSet = new Set(params.projectIds.filter((id) => Number.isInteger(id) && id > 0))

  // UI 流程可能在拿到项目 URL 前失败。先按临时作者补齐项目 ID，
  // 避免遗留项目阻止 auth.users 的级联删除。
  if (userIds.length > 0) {
    const { data, error } = await admin
      .from('projects')
      .select('id')
      .in('author_id', userIds)
    if (error) throw error
    for (const row of data ?? []) projectIdSet.add(row.id)
  }

  const projectIds = [...projectIdSet]

  const reportIds = new Set<number>()
  if (userIds.length > 0) {
    const { data, error } = await admin
      .from('reports')
      .select('id')
      .in('reporter_id', userIds)
    if (error) throw error
    for (const row of data ?? []) reportIds.add(row.id)
  }
  if (projectIds.length > 0) {
    const { data, error } = await admin
      .from('reports')
      .select('id')
      .eq('content_type', 'project')
      .in('content_id', projectIds)
    if (error) throw error
    for (const row of data ?? []) reportIds.add(row.id)
  }

  const caseIds = new Set<number>()
  if (userIds.length > 0) {
    const { data, error } = await admin
      .from('moderation_cases')
      .select('id')
      .in('author_id', userIds)
    if (error) throw error
    for (const row of data ?? []) caseIds.add(row.id)
  }
  if (projectIds.length > 0) {
    const { data, error } = await admin
      .from('moderation_cases')
      .select('id')
      .eq('content_type', 'project')
      .in('content_id', projectIds)
    if (error) throw error
    for (const row of data ?? []) caseIds.add(row.id)
  }

  const actionIds = new Set<number>()
  if (userIds.length > 0) {
    const { data, error } = await admin
      .from('safety_actions')
      .select('id')
      .in('user_id', userIds)
    if (error) throw error
    for (const row of data ?? []) actionIds.add(row.id)
  }

  const appealIds = new Set<number>()
  if (userIds.length > 0) {
    const { data, error } = await admin
      .from('safety_appeals')
      .select('id')
      .in('appellant_id', userIds)
    if (error) throw error
    for (const row of data ?? []) appealIds.add(row.id)
  }
  if (actionIds.size > 0) {
    const { data, error } = await admin
      .from('safety_appeals')
      .select('id')
      .in('action_id', [...actionIds])
    if (error) throw error
    for (const row of data ?? []) appealIds.add(row.id)
  }

  const deletionErrors: string[] = []
  const attempt = async (label: string, operation: () => Promise<unknown>) => {
    try {
      await operation()
    } catch (error) {
      deletionErrors.push(`${label}: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  if (appealIds.size > 0) {
    await attempt('safety appeals', async () => {
      const { error } = await admin.from('safety_appeals').delete().in('id', [...appealIds])
      if (error) throw error
    })
  }
  if (actionIds.size > 0) {
    await attempt('safety actions', async () => {
      const { error } = await admin.from('safety_actions').delete().in('id', [...actionIds])
      if (error) throw error
    })
  }
  if (reportIds.size > 0) {
    await attempt('reports', async () => {
      const { error } = await admin.from('reports').delete().in('id', [...reportIds])
      if (error) throw error
    })
  }
  if (caseIds.size > 0) {
    await attempt('moderation cases', async () => {
      const { error } = await admin.from('moderation_cases').delete().in('id', [...caseIds])
      if (error) throw error
    })
  }
  if (userIds.length > 0) {
    await attempt('blocks by blocker', async () => {
      const { error } = await admin.from('user_blocks').delete().in('blocker_id', userIds)
      if (error) throw error
    })
    await attempt('blocks by blocked user', async () => {
      const { error } = await admin.from('user_blocks').delete().in('blocked_user_id', userIds)
      if (error) throw error
    })
  }
  if (projectIds.length > 0) {
    await attempt('projects', async () => {
      const { error } = await admin.from('projects').delete().in('id', projectIds)
      if (error) throw error
    })
  }
  for (const userId of userIds) {
    await attempt(`user ${userId}`, () => deleteUserById(userId))
  }

  if (deletionErrors.length > 0) {
    throw new Error(`安全治理测试数据清理失败：${deletionErrors.join('; ')}`)
  }
}

export type ExplorationJourneyFixture = {
  projectId: number
  explorationId: number
  progressId: number
  initialXp: number | null
}

export async function createApprovedExplorationJourneyFixture(params: {
  userId: string
  nonce: number
}): Promise<ExplorationJourneyFixture> {
  const { data: profile, error: profileError } = await admin
    .from('profiles')
    .select('xp')
    .eq('id', params.userId)
    .single()
  if (profileError) throw profileError

  const initialXp = profile?.xp == null ? null : Number(profile.xp)
  let projectId: number | null = null

  try {
    const { data: project, error: projectError } = await admin
      .from('projects')
      .insert({
        title: `E2E 探索闭环 ${params.nonce}`,
        description: '用于验证探索记录到完成作品的真实浏览器链路。',
        author_id: params.userId,
        category: '科学',
        tags: ['E2E'],
        status: 'approved',
        moderation_state: 'approved',
      })
      .select('id')
      .single()
    if (projectError) throw projectError
    projectId = Number(project.id)

    const { data: exploration, error: explorationError } = await admin
      .from('project_explorations')
      .insert({
        user_id: params.userId,
        project_id: projectId,
        status: 'active',
      })
      .select('id')
      .single()
    if (explorationError) throw explorationError

    const { data: progress, error: progressError } = await admin
      .from('completed_projects')
      .insert({
        user_id: params.userId,
        project_id: projectId,
        exploration_id: exploration.id,
        completed_at: new Date(Date.now() - 60_000).toISOString(),
        proof_images: ['/logo.png'],
        proof_captions: ['浏览器回归夹具图片'],
        notes: '[成果展示] 阶段：成果展示\n这一步已经完成，可以作为最终成果。',
        is_public: true,
        status: 'approved',
        reviewed_at: new Date().toISOString(),
        record_kind: 'progress',
        record_type: 'result',
        stage_label: '成果展示',
        moderation_source: 'e2e',
        moderation_state: 'approved',
      })
      .select('id')
      .single()
    if (progressError) throw progressError

    return {
      projectId,
      explorationId: Number(exploration.id),
      progressId: Number(progress.id),
      initialXp,
    }
  } catch (error) {
    if (projectId) {
      await admin.from('projects').delete().eq('id', projectId)
    }
    throw error
  }
}

export async function deleteExplorationJourneyFixture(params: {
  userId: string
  projectId: number
  initialXp?: number | null
  removeUser?: boolean
}) {
  const { error: completionsError } = await admin
    .from('completed_projects')
    .delete()
    .eq('user_id', params.userId)
    .eq('project_id', params.projectId)
  if (completionsError) throw completionsError

  const { error: explorationsError } = await admin
    .from('project_explorations')
    .delete()
    .eq('user_id', params.userId)
    .eq('project_id', params.projectId)
  if (explorationsError) throw explorationsError

  const { error: projectError } = await admin
    .from('projects')
    .delete()
    .eq('id', params.projectId)
  if (projectError) throw projectError

  const { error: xpLogError } = await admin
    .from('xp_logs')
    .delete()
    .eq('user_id', params.userId)
    .eq('action_type', 'complete_project')
    .eq('resource_id', String(params.projectId))
  if (xpLogError) throw xpLogError

  if (params.initialXp !== undefined) {
    const { error: profileError } = await admin
      .from('profiles')
      .update({ xp: params.initialXp })
      .eq('id', params.userId)
    if (profileError) throw profileError
  }

  if (params.removeUser) {
    await deleteUserById(params.userId)
  }
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
