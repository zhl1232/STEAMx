import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import path from 'node:path'

const require = createRequire(import.meta.url)
const vitePath = require.resolve('vite', { paths: [path.dirname(require.resolve('vitest/package.json'))] })
const { createServer } = await import(pathToFileURL(vitePath).href)
const { default: react } = await import('@vitejs/plugin-react')
const root = process.cwd()
const fixture = path.join(root, 'e2e/project-card')
const server = await createServer({
  configFile: false,
  root: fixture,
  publicDir: false,
  plugins: [react()],
  server: { host: '127.0.0.1', port: 4187, strictPort: true, fs: { allow: [root] } },
  resolve: { alias: [
    { find: 'next/link', replacement: path.join(fixture, 'link.jsx') },
    { find: '@/lib/context/project-context', replacement: path.join(fixture, 'mocks.jsx') },
    { find: 'next/image', replacement: path.join(root, 'e2e/registration/image.jsx') },
    { find: '@', replacement: root },
  ] },
})
await server.listen()
