/** Compare snapshots without exposing email, phone, or full IDs. */
export function summarizeMissingProfiles(users, profiles) {
  if (!users.every(user => typeof user.id === 'string' && typeof user.created_at === 'string') ||
      !profiles.every(profile => typeof profile.id === 'string')) {
    throw new Error('Invalid profile snapshot')
  }
  const profileIds = new Set(profiles.map(profile => profile.id))
  const uniqueUsers = new Map(users.map(user => [user.id, user]))
  const missing = [...uniqueUsers.values()]
    .filter(user => !profileIds.has(user.id))
    .map(user => ({ id: user.id.slice(0, 8), created_at: user.created_at }))
  return { userCount: uniqueUsers.size, profileCount: profileIds.size, missingCount: missing.length, missing }
}
