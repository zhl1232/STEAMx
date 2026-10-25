import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import { readFileSync, createReadStream, statSync } from 'node:fs'
import path from 'node:path'
import { createServer as createHttpServer } from 'node:http'
const require = createRequire(import.meta.url)
const vitePath = require.resolve('vite', { paths: [path.dirname(require.resolve('vitest/package.json'))] })
const { createServer } = await import(pathToFileURL(vitePath).href)
const { default: react } = await import('@vitejs/plugin-react')
const root = process.cwd()
const fixture = path.join(root, 'e2e/building-vosk')
// A real second origin exercises CORS fetches without depending on the public CDN in CI.
const assetServer = createHttpServer((req, res) => {
  const url = new URL(req.url, 'http://localhost')
  const match = url.pathname.match(/^\/courses\/vosk\/[a-f0-9]{64}\/(model\.tar\.gz|vosk\.js)$/)
  if (!match) { res.statusCode = 404; res.end(); return }
  const file = path.join(root, 'public/courses/vosk/v1', match[1])
  if (url.searchParams.get('cors') !== 'deny') res.setHeader('Access-Control-Allow-Origin', 'http://127.0.0.1:4185')
  res.setHeader('Content-Type', match[1].endsWith('.gz') ? 'application/gzip' : 'application/javascript')
  res.setHeader('Content-Length', statSync(file).size)
  createReadStream(file).pipe(res)
})
await new Promise(resolve => assetServer.listen(4186, '127.0.0.1', resolve))
const server = await createServer({
  configFile: false, root: fixture, publicDir: path.join(root, 'public'),
  plugins: [react(), { name: 'local-kws-fixture', configureServer: (server) => { server.middlewares.use((req, res, next) => {
    const url = new URL(req.url, 'http://localhost')
    if (url.pathname === '/courses/vosk/v2/assets.js') {
      res.setHeader('Content-Type', 'application/javascript')
      res.end(readFileSync(path.join(root, 'public/courses/vosk/v2/assets.js'), 'utf8').replaceAll('https://assets.steamx.cc', 'http://127.0.0.1:4186')); return
    }
    if (url.pathname === '/sw-legacy-fixture.js') {
      res.setHeader('Content-Type', 'application/javascript')
      res.end("self.addEventListener('install',e=>e.waitUntil(self.skipWaiting())); self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()))"); return
    }
    // Vite otherwise treats .gz as Content-Encoding and changes verified model bytes.
    if (url.pathname === '/courses/vosk/v1/model.tar.gz') {
      const file = path.join(root, 'public/courses/vosk/v1/model.tar.gz')
      res.setHeader('Content-Type', 'application/gzip'); res.setHeader('Content-Length', statSync(file).size)
      createReadStream(file).pipe(res); return
    }
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
      if (!/^[a-z0-9_-]+\.wav$/.test(name)) { res.statusCode = 400; res.end(); return }
      try { res.setHeader('Content-Type', 'audio/wav'); res.end(readFileSync(path.join(process.env.BUILDING_VOSK_TEST_AUDIO_DIR || path.join(fixture, 'audio'), name))) }
      catch { res.statusCode = 404; res.end() }
      return
    }
    if (url.pathname.startsWith('/api/')) { res.setHeader('Content-Type','application/json');res.end(JSON.stringify({entries:[],steps:[]}));return }
    next()
  }) } }],
  server: { host: '127.0.0.1', port: 4185, strictPort: true, fs: { allow: [root] } },
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
