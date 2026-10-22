import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const [mode, port, catalog] = process.argv.slice(2)
if (!['production', 'development'].includes(mode) || !/^\d+$/.test(port) || !['true', 'false'].includes(catalog)) {
  throw new Error('Usage: start-internal-route-test-server.mjs production|development PORT true|false')
}

// Local fixtures only. No database, credentials, payment or production configuration.
const child = spawn(process.execPath, [require.resolve('next/dist/bin/next'), mode === 'production' ? 'start' : 'dev', '--hostname', '127.0.0.1', '--port', port], {
  stdio: 'inherit',
  env: {
    ...process.env,
    NODE_ENV: mode,
    NEXT_TELEMETRY_DISABLED: '1',
    NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54329',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: 'isolated-test-anon-key',
    SUPABASE_SERVICE_ROLE_KEY: '',
    STORE_CATALOG_ENABLED: catalog,
    STORE_CHECKOUT_ENABLED: 'false',
    STORE_PAYMENTS_ENABLED: 'false',
    STORE_ADMIN_PREVIEW_ENABLED: 'false',
    PLAYWRIGHT_SMOKE: '',
    NEXT_PUBLIC_PLAYWRIGHT_SMOKE: '',
  },
})
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal))
child.on('exit', (code) => process.exit(code ?? 1))
