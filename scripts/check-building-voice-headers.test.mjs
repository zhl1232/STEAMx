import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { checkVoiceHeaders, readManifest } from './check-building-voice-headers.mjs';
const manifest = readFileSync(new URL('../public/courses/vosk/v2/assets.js', import.meta.url), 'utf8');
const assets = readManifest(manifest);
function mockRequest(calls, mutate = () => {}) {
  return async (url, options) => {
    const asset = Object.values(assets).find(a => url === a.url || url.endsWith(a.fallbackUrl));
    const data = { status: 200, headers: new Headers({
      'content-length': String(asset?.bytes ?? 100), 'access-control-allow-origin': '*',
      'content-type': 'application/javascript; charset=utf-8',
    }), body: { cancel: async () => { calls.at(-1).cancelled = true; } } };
    calls.push({ url, options }); mutate(data, url);
    return data;
  };
}
test('checks health and headers with no resource GETs or body consumption', async () => {
  const calls = [];
  await checkVoiceHeaders(assets, mockRequest(calls));
  assert.equal(calls.length, 10);
  assert.deepEqual(calls.filter(c => c.options.method === 'GET').map(c => c.url), ['https://steam.bj.cn/api/health']);
  assert.equal(calls.filter(c => c.url.startsWith('https://assets.steamx.cc/')).length, 2);
  assert(calls.every(c => c.cancelled && c.options.redirect === 'error' && c.options.signal));
});
test('unknown manifests reject instead of inventing a resource list', () => {
  for (const text of ['', '{}', manifest.replace('44934262', '0'), manifest.replace('assets.steamx.cc', 'untrusted.invalid')]) {
    assert.throws(() => readManifest(text));
  }
});
test('status, MIME, length, CORS, timeout or network uncertainty fails for full-probe fallback', async () => {
  for (const mutate of [data => { data.status = 503; },
    (data, url) => { if (url.includes('prepare-worker')) data.headers.set('content-type', 'text/html'); },
    (data, url) => { if (url.includes('assets.steamx.cc')) data.headers.delete('content-length'); },
    (data, url) => { if (url.includes('assets.steamx.cc')) data.headers.set('content-length', '1'); },
    (data, url) => { if (url.includes('assets.steamx.cc')) data.headers.delete('access-control-allow-origin'); }]) {
    await assert.rejects(checkVoiceHeaders(assets, mockRequest([], mutate)));
  }
  await assert.rejects(checkVoiceHeaders(assets, async () => { throw Error('timeout'); }));
});
