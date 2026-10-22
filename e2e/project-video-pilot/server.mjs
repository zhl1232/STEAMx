import { createServer } from 'node:http'
import { readFileSync } from 'node:fs'
import { spawn } from 'node:child_process'

// Local read-only Supabase HTTP boundary; the actual Next route, mapper and UI run unchanged.
// Content fixtures were checked against the two public pages on 2026-10-21.
const fixtures = JSON.parse(readFileSync('__tests__/fixtures/project-video-pilot.json', 'utf8'))
const projects = [...fixtures,
  { ...fixtures[0], id: 501, title: '单步骤项目', steps: [{ title: '折纸带', description: '把纸带折成折扇形。' }] },
  { ...fixtures[0], id: 502, title: '其他占位项目' },
  { ...fixtures[0], id: 503, title: '未公开项目', status: 'pending', moderation_state: 'pending' },
].map(project => ({
  ...project, image_url: project.image, video_url: project.videoUrl, likes_count: project.likes,
  profiles: { display_name: project.author },
  project_materials: project.materials.map((material, sort_order) => ({ material, sort_order })),
  project_steps: project.steps.map((step, sort_order) => ({ ...step, sort_order })),
}))

const database = createServer((req, res) => {
  res.setHeader('Content-Type', 'application/json')
  res.setHeader('Access-Control-Allow-Origin', 'http://127.0.0.1:4191')
  res.setHeader('Access-Control-Allow-Headers', '*')
  if (req.method === 'OPTIONS') { res.end(); return }
  const url = new URL(req.url, 'http://127.0.0.1:4192')
  // Permit only the existing read-only coin-count RPC; reject all mutations.
  if (req.method === 'POST' && url.pathname === '/rest/v1/rpc/get_project_total_coins_received') { res.end('0'); return }
  if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405); res.end('{"error":"read-only fixture"}'); return }
  let rows = []
  if (url.pathname === '/rest/v1/projects') {
    rows = projects.filter(project => url.searchParams.get('id') === `eq.${project.id}`
      && (!url.searchParams.has('status') || url.searchParams.get('status') === `eq.${project.status}`)
      && (!url.searchParams.has('moderation_state') || url.searchParams.get('moderation_state') === `eq.${project.moderation_state}`))
  }
  if (url.pathname === '/rest/v1/profiles') rows = [{ id: fixtures[0].author_id, display_name: '测试作者', xp: 0 }]
  res.setHeader('Content-Range', `0-${Math.max(0, rows.length - 1)}/${rows.length}`)
  res.end(JSON.stringify(req.headers.accept?.includes('vnd.pgrst.object') ? rows[0] ?? null : rows))
})
await new Promise(resolve => database.listen(4192, '127.0.0.1', resolve))

// Pin the database to the local fixture and override any inherited live database key.
const env = { ...process.env,
  NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:4192', NEXT_PUBLIC_SUPABASE_ANON_KEY: 'pilot-fixture-anon-key',
  SUPABASE_SERVICE_ROLE_KEY: '', NEXT_PUBLIC_ASSETS_BASE_URL: 'https://assets.steamx.cc',
  ASSETS_URL_SIGNING_SECRET: 'pilot-fixture-signing-secret',
  STORE_CATALOG_ENABLED: 'false', STORE_CHECKOUT_ENABLED: 'false', STORE_PAYMENTS_ENABLED: 'false',
  PLAYWRIGHT_SMOKE: '', NEXT_PUBLIC_PLAYWRIGHT_SMOKE: '',
}
const next = spawn('pnpm', ['exec', 'next', 'dev', '--port', '4191'], { env, stdio: 'inherit' })
const stop = () => { next.kill('SIGTERM'); database.close() }
process.on('SIGTERM', stop)
process.on('SIGINT', stop)
next.on('exit', code => { database.close(); process.exitCode = code ?? 0 })
