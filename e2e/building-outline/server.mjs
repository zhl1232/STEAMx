import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import { readFileSync } from 'node:fs'
import path from 'node:path'
const require = createRequire(import.meta.url)
const vitePath = require.resolve('vite', { paths: [path.dirname(require.resolve('vitest/package.json'))] })
const { createServer } = await import(pathToFileURL(vitePath).href)
const { default: react } = await import('@vitejs/plugin-react')
const root = process.cwd()
const fixture = path.join(root, 'e2e/building-outline')
const server = await createServer({
  define: { 'process.env.ASSETS_BASE_URL': '""', 'process.env.NEXT_PUBLIC_ASSETS_BASE_URL': '""' },
  configFile: false, root: fixture, publicDir: path.join(root, 'public'), plugins: [react(), {name:'local-ldraw-fixture', configureServer: registerRoutes}],
  server: { host: '127.0.0.1', port: 4182, strictPort: true, fs: { allow: [root] } },
  resolve: { alias: [
    ...['@/lib/context/auth-context', '@/lib/context/login-prompt-context', '@/hooks/use-toast', 'next/dynamic'].map(find => ({find, replacement: path.join(fixture,'mocks.jsx')})),
    { find: 'next/link', replacement: path.join(root, 'e2e/registration/link.jsx') },
    { find: 'next/image', replacement: path.join(root, 'e2e/registration/image.jsx') },
    { find: '@', replacement: root },
  ] },
})
const {createPackedLdrawStep} = await server.ssrLoadModule(path.join(root,'lib/utils/ldraw-mpd.ts'))
function registerRoutes(server) { server.middlewares.use((req,res,next) => {
  const url = new URL(req.url, 'http://localhost')
  if(url.pathname === '/api/assets/courses/ldraw/LDConfig.ldr') {res.end(readFileSync(path.join(root,'public/courses/ldraw/LDConfig.ldr')));return}
  if(url.pathname === '/api/courses/ldraw-step') {
    const model = url.searchParams.get('model')
    if(!['3-hu-die.mpd','3-hua-lan.mpd'].includes(model)) {res.statusCode=400;res.end();return}
    const step = createPackedLdrawStep(readFileSync(path.join(root,'public/courses/ldraw',model),'utf8'), Number(url.searchParams.get('step')))
    res.setHeader('Content-Type','text/plain');res.setHeader('X-LDraw-Step-Count',String(step.stepCount));res.end(step.mpdText);return
  }
  if(url.pathname.startsWith('/api/')) {res.setHeader('Content-Type','application/json');res.end(JSON.stringify({entries:[],steps:[]}));return}
  next()
}) }
await server.listen()
