import { createServer } from 'node:http'

const publicReadRpcs = new Set(['get_trending_works'])

// Read-only empty public content for static prerendering and anonymous browser reads.
// This is not Supabase/Auth, and it cannot accept table writes or create identities.
const server = createServer((request, response) => {
  const url = new URL(request.url || '/', 'http://127.0.0.1:54329')
  response.setHeader('Access-Control-Allow-Origin', '*')
  response.setHeader('Access-Control-Allow-Headers', 'authorization, apikey, content-type, x-client-info, prefer, range, accept-profile, content-profile')
  response.setHeader('Content-Type', 'application/json')
  if (request.method === 'OPTIONS') { response.end(); return }
  const rpc = url.pathname.startsWith('/rest/v1/rpc/')
  const readRpc = rpc && ['GET', 'HEAD', 'POST'].includes(request.method || '') && publicReadRpcs.has(url.pathname.slice('/rest/v1/rpc/'.length))
  const readTable = !rpc && url.pathname.startsWith('/rest/v1/') && ['GET', 'HEAD'].includes(request.method || '')
  if (readTable || readRpc) {
    response.setHeader('Content-Range', '*/0')
    response.end('[]')
    return
  }
  response.statusCode = 401
  response.end(JSON.stringify({ error: 'Anonymous read-only fixture; authentication and writes are unavailable.' }))
})
server.listen(54329, '127.0.0.1', () => console.info('Read-only empty public content fixture: http://127.0.0.1:54329'))
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close(() => process.exit()))
