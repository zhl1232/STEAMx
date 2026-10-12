import { readFile } from 'node:fs/promises'
import { parseEnv } from 'node:util'
import { pathToFileURL } from 'node:url'
import { summarizeMissingProfiles } from './lib/missing-profiles.mjs'

export async function checkMissingProfiles({ url, key, fetchImpl = fetch }) {
  const base = new URL(url)
  if (!['https:', 'http:'].includes(base.protocol) || !key) throw new Error('Invalid configuration')
  const headers = { apikey: key, Authorization: `Bearer ${key}` }
  async function get(path) {
    const response = await fetchImpl(new URL(path, base), {
      headers, signal: AbortSignal.timeout(30_000), redirect: 'error',
    })
    if (!response.ok) throw new Error('Profile check request failed')
    return response.json()
  }
  const users = []
  for (let page = 1; ; page += 1) {
    const result = await get(`/auth/v1/admin/users?page=${page}&per_page=1000`)
    if (!Array.isArray(result.users)) throw new Error('Invalid users response')
    if (!result.users.length) break
    users.push(...result.users.map(({ id, created_at }) => ({ id, created_at })))
  }
  const profiles = []
  for (let offset = 0; ;) {
    const rows = await get(`/rest/v1/profiles?select=id&order=id.asc&offset=${offset}&limit=1000`)
    if (!Array.isArray(rows)) throw new Error('Invalid profiles response')
    if (!rows.length) break
    profiles.push(...rows)
    offset += rows.length
  }
  return summarizeMissingProfiles(users, profiles)
}

async function main() {
  try {
    // Match local ops configuration, with injected environment taking precedence.
    let local = {}
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      try { local = parseEnv(await readFile('.env.local', 'utf8')) }
      catch (error) { if (error.code !== 'ENOENT') throw error }
    }
    const result = await checkMissingProfiles({
      url: process.env.NEXT_PUBLIC_SUPABASE_URL ?? local.NEXT_PUBLIC_SUPABASE_URL,
      key: process.env.SUPABASE_SERVICE_ROLE_KEY ?? local.SUPABASE_SERVICE_ROLE_KEY,
    })
    console.log(JSON.stringify(result, null, 2))
    process.exitCode = result.missingCount > 0 ? 1 : 0
  } catch {
    // Never print response bodies, URLs, credentials, or personal data.
    console.error('Profile check failed: configuration or network/response error')
    process.exitCode = 2
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main()
