import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import { readFileSync } from 'node:fs'
import path from 'node:path'
const require = createRequire(import.meta.url)
const vitePath = require.resolve('vite', { paths: [path.dirname(require.resolve('vitest/package.json'))] })
const { createServer } = await import(pathToFileURL(vitePath).href)
const { default: react } = await import('@vitejs/plugin-react')
const root = process.cwd()
const fixture = path.join(root, 'e2e/building-kws')
const server = await createServer({
  configFile: false, root: fixture, publicDir: path.join(root, 'public'),
  plugins: [react(), { name: 'local-kws-fixture', configureServer: (server) => { server.middlewares.use((req, res, next) => {
    const url = new URL(req.url, 'http://localhost')
    if (url.pathname === '/api/tutor/speech/course-control') {
      res.setHeader('Content-Type', 'application/json')
      if (req.method !== 'GET') { res.statusCode = 400; res.end(); return }
      res.end(JSON.stringify({ userId: 'synthetic-user', validForMs: 300000 })); return
    }
    if (url.pathname === '/api/assets/courses/ldraw/LDConfig.ldr') { res.end(readFileSync(path.join(root,'public/courses/ldraw/LDConfig.ldr'))); return }
    if (url.pathname === '/api/courses/ldraw-step') {
      const step = createPackedLdrawStep(readFileSync(path.join(root, 'public/courses/ldraw/3-hu-die.mpd'), 'utf8'), Number(url.searchParams.get('step')))
      res.setHeader('Content-Type', 'text/plain'); res.setHeader('X-LDraw-Step-Count', String(step.stepCount)); res.end(step.mpdText); return
    }
    if (url.pathname.startsWith('/synthetic/')) {
      const name = url.pathname.slice('/synthetic/'.length)
      if (!/^(?:clear\/)?[a-z_]+\.wav$/.test(name)) { res.statusCode = 400; res.end(); return }
      try { res.setHeader('Content-Type', 'audio/wav'); res.end(readFileSync(path.join(process.env.BUILDING_KWS_TEST_AUDIO_DIR || path.join(fixture, 'audio'), name))) }
      catch { res.statusCode = 404; res.end() }
      return
    }
    if (url.pathname.startsWith('/api/')) { res.setHeader('Content-Type','application/json');res.end(JSON.stringify({entries:[],steps:[]}));return }
    next()
  }) } }],
  server: { host: '127.0.0.1', port: 4183, strictPort: true, fs: { allow: [root] } },
  resolve: { alias: [
    {find: '@/lib/context/auth-context', replacement: path.join(fixture, 'auth.jsx')},
    ...['@/lib/context/login-prompt-context', '@/hooks/use-toast', 'next/dynamic'].map(find => ({find,replacement:path.join(root,'e2e/building-outline/mocks.jsx')})),
    {find:'next/link',replacement:path.join(root,'e2e/registration/link.jsx')},
    {find:'next/image',replacement:path.join(root,'e2e/registration/image.jsx')},
    {find:'@',replacement:root},
  ] },
})
const { createPackedLdrawStep } = await server.ssrLoadModule(path.join(root, 'lib/utils/ldraw-mpd.ts'))
await server.listen()
