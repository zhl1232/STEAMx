import { spawn } from 'node:child_process'
import { cp, mkdir, readdir, symlink } from 'node:fs/promises'
import path from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const root = path.resolve(import.meta.dirname, '..')
const [mode, workspace, port, catalog] = process.argv.slice(2)
if (!['build', 'rebuild', 'start'].includes(mode) || !workspace?.startsWith('/tmp/chuangtan-store-integration-')) {
  throw new Error('Usage: start-store-integration-test-server.mjs build /tmp/chuangtan-store-integration-ID | start WORKSPACE PORT true|false')
}
if (mode === 'start' && (!/^\d+$/.test(port || '') || !['true', 'false'].includes(catalog))) {
  throw new Error('Start requires a local port and catalog true|false')
}

if (mode === 'build') {
  await mkdir(workspace)
  const sourceDirectories = new Set(['app', 'components', 'hooks', 'lib', 'data', 'packages', 'scripts', 'tests', 'e2e', '__tests__', 'deploy', 'supabase'])
  for (const entry of await readdir(root, { withFileTypes: true })) {
    if (entry.isDirectory() ? !sourceDirectories.has(entry.name) : entry.name.startsWith('.') || !/\.(?:[cm]?js|tsx?|json|ya?ml|css)$/.test(entry.name)) continue
    await cp(path.join(root, entry.name), path.join(workspace, entry.name), {
      recursive: true,
      filter: source => !['node_modules', '__pycache__', '.next', '.git'].includes(path.basename(source)) && !path.basename(source).startsWith('.env'),
    })
  }
  await symlink(path.join(root, 'node_modules'), path.join(workspace, 'node_modules'), 'dir')
  await symlink(path.join(root, 'public'), path.join(workspace, 'public'), 'dir')
}

// A separate checkout prevents Next from changing the user's dev output or loading .env files.
const env = Object.fromEntries(['PATH', 'HOME', 'TMPDIR', 'LANG', 'NODE_EXTRA_CA_CERTS', 'HTTP_PROXY', 'HTTPS_PROXY', 'ALL_PROXY', 'NO_PROXY']
  .filter(key => process.env[key] !== undefined).map(key => [key, process.env[key]]))
Object.assign(env, {
  NODE_ENV: 'production',
  NEXT_TELEMETRY_DISABLED: '1',
  NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54329',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: 'isolated-store-integration-anon-key',
  SUPABASE_SERVICE_ROLE_KEY: '',
  NEXT_PUBLIC_ASSETS_BASE_URL: '',
  STORE_ENVIRONMENT: 'test',
  STORE_CATALOG_ENABLED: mode === 'start' ? catalog : 'false',
  STORE_CHECKOUT_ENABLED: 'false',
  STORE_PAYMENTS_ENABLED: 'false',
  STORE_ALIPAY_ENABLED: 'false',
  STORE_WECHAT_ENABLED: 'false',
  STORE_ADMIN_PREVIEW_ENABLED: 'false',
  SUPPORT_FEISHU_WEBHOOK: '',
  SUPPORT_FEISHU_SECRET: '',
  SUPPORT_SITE_URL: '',
  PLAYWRIGHT_SMOKE: '',
  NEXT_PUBLIC_PLAYWRIGHT_SMOKE: '',
})
const args = mode === 'start' ? ['start', '--hostname', '127.0.0.1', '--port', port] : ['build', '--webpack']
const child = spawn(process.execPath, [require.resolve('next/dist/bin/next'), ...args], {
  cwd: workspace,
  env,
  stdio: 'inherit',
})
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal))
child.on('exit', code => process.exit(code ?? 1))
