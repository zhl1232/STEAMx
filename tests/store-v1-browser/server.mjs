import { createRequire } from 'node:module'
import path from 'node:path'
import { readFile } from 'node:fs/promises'
const require = createRequire(import.meta.url)
const vite = await import(createRequire(require.resolve('vitest')).resolve('vite'))
const root = process.cwd()
const server = await vite.createServer({
  plugins: [{name:'local-fixture-attachments',configureServer(server){server.middlewares.use(async(req,res,next)=>{if(req.url?.startsWith('/api/support/attachments/')){res.setHeader('Content-Type','image/jpeg');res.end(await readFile(path.join(root,'public/store/source-drafts/warehouse-shared/main-5.jpg')));return}next()})}}],
  configFile: false, root: path.join(root, 'tests/store-v1-browser'), publicDir: path.join(root, 'public'),
  esbuild: { jsx: 'automatic' }, define: { 'process.env': '{}' },
  resolve: { alias: [
    { find: 'next/link', replacement: path.join(root, 'tests/store-v1-browser/next-mocks.tsx') },
    { find: 'next/image', replacement: path.join(root, 'tests/store-v1-browser/image-mock.tsx') },
    { find: 'next/navigation', replacement: path.join(root, 'tests/store-v1-browser/navigation-mock.ts') },
    { find: '@', replacement: root },
  ] },
  css: { postcss: path.join(root, 'postcss.config.js') },
  server: { hmr: false, watch: { ignored: ['**/*'] }, host: '127.0.0.1', port: 3101, strictPort: true, fs: { allow: [root] }, headers: { 'Content-Security-Policy': "connect-src 'self' ws://127.0.0.1:3101; img-src 'self' data: blob:; media-src 'self';" } },
})
await server.listen()
console.info('Local fixture preview, no DB: http://127.0.0.1:3101')
