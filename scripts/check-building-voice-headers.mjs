// Lightweight transport check only. Does not prove byte integrity or engine readiness.
import { appendFileSync, readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const ORIGIN = 'https://steam.bj.cn';
export function readManifest(text) {
  const match = /const BUILDING_VOICE_ASSETS = (\{[\s\S]*\})\s*;?\s*$/.exec(text);
  if (!match) throw Error('Unknown manifest format');
  const assets = JSON.parse(match[1]);
  if (Object.keys(assets).sort().join(',') !== 'model.tar.gz,vosk.js') throw Error('Unexpected assets');
  for (const [name, asset] of Object.entries(assets)) {
    if (!Number.isSafeInteger(asset.bytes) || asset.bytes < 1 || !/^[a-f0-9]{64}$/.test(asset.sha256)
        || asset.url !== `https://assets.steamx.cc/courses/vosk/${asset.sha256}/${name}`
        || asset.fallbackUrl !== `/courses/vosk/v1/${name}`) throw Error('Unexpected asset metadata');
  }
  return assets;
}

export async function checkVoiceHeaders(assets, request = fetch) {
  async function check(url, options = {}) {
    const response = await request(url, { method: options.health ? 'GET' : 'HEAD',
      headers: { Origin: ORIGIN }, redirect: 'error', signal: AbortSignal.timeout(15_000) });
    // Do not consume any resource body even if a server mishandles HEAD.
    await response.body?.cancel();
    if (response.status !== 200) throw Error(`Unexpected status for ${url}`);
    if (options.bytes && response.headers.get('content-length') !== String(options.bytes)) {
      throw Error(`Uncertain asset length for ${url}`);
    }
    if (options.cors && !['*', ORIGIN].includes(response.headers.get('access-control-allow-origin'))) {
      throw Error(`CORS unavailable for ${url}`);
    }
    if (options.js && !/^(application|text)\/(javascript|ecmascript)(;|$)/i.test(response.headers.get('content-type') ?? '')) {
      throw Error(`Unexpected worker MIME type for ${url}`);
    }
  }
  await check(`${ORIGIN}/api/health`, { health: true });
  await check(ORIGIN);
  for (const path of ['v2/assets.js', 'v2/prepare-worker.js', 'v2/resource-cache.js', 'v1/vosk-worker.js']) {
    await check(`${ORIGIN}/courses/vosk/${path}`, { js: true });
  }
  for (const asset of Object.values(assets)) {
    await check(asset.url, { bytes: asset.bytes, cors: true });
    await check(`${ORIGIN}${asset.fallbackUrl}`, { bytes: asset.bytes });
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const assets = readManifest(readFileSync(new URL('../public/courses/vosk/v2/assets.js', import.meta.url), 'utf8'));
    await checkVoiceHeaders(assets);
    const summary = 'Voice health/headers passed; body integrity and engine initialization were not tested.';
    console.log(summary);
    if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${summary}\n`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
