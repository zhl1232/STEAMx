import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import path from 'node:path'
const require = createRequire(import.meta.url)
const vitePath = require.resolve('vite', { paths: [path.dirname(require.resolve('vitest/package.json'))] })
const { createServer } = await import(pathToFileURL(vitePath).href)
const { default: react } = await import('@vitejs/plugin-react')
const root = process.cwd()
const fixture = path.join(root, 'e2e/registration')
const server = await createServer({
  configFile: false, root: fixture, plugins: [react()],
  server: { host: '127.0.0.1', port: 4179, strictPort: true, fs: { allow: [root] } },
  define: { 'process.env.NEXT_PUBLIC_PLAYWRIGHT_SMOKE': JSON.stringify('0') },
  resolve: { alias: [
    { find: '@/lib/supabase/client', replacement: path.join(fixture, 'auth-client.js') },
    { find: '@/lib/context/gamification-context', replacement: path.join(fixture, 'auxiliary.jsx') },
    { find: '@/lib/context/notification-context', replacement: path.join(fixture, 'auxiliary.jsx') },
    { find: 'next/navigation', replacement: path.join(fixture, 'navigation.jsx') },
    { find: 'next/link', replacement: path.join(fixture, 'link.jsx') },
    { find: 'next/image', replacement: path.join(fixture, 'image.jsx') },
    { find: '@', replacement: root },
  ] },
})
await server.listen()
