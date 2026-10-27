import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm, writeFile, mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { uploadDeployImage, digestObjectKey } from './upload-deploy-image-to-oss.mjs'
import { signDeployImageUrl } from './sign-deploy-image-url.mjs'

const digest = `sha256:${'b'.repeat(64)}`
const imageId = `sha256:${'c'.repeat(64)}`
const objectKey = digestObjectKey(digest)
const signedUrl = `https://oss.example/${objectKey}?OSSAccessKeyId=fake&Signature=private%2Bvalue`
const configured = {
  IMAGE_OSS_UPLOADED: 'true', IMAGE_OSS_OBJECT: objectKey,
  IMAGE_ID: imageId, IMAGE_DIGEST: digest,
  DEPLOY_OSS_ACCESS_KEY_ID: 'fake-id', DEPLOY_OSS_ACCESS_KEY_SECRET: 'fake-secret',
}

async function fixture(t) {
  const dir = await mkdtemp(path.join(tmpdir(), 'oss-sign-test-'))
  t.after(() => rm(dir, { recursive: true, force: true }))
  return { dir, file: path.join(dir, 'env') }
}

test('build output passes only safe metadata to deploy, which masks before writing same-job env', async (t) => {
  const { dir, file } = await fixture(t)
  const output = path.join(dir, 'output')
  const result = await uploadDeployImage({
    env: { REGISTRY_IMAGE: 'ghcr.io/acme/steam', IMAGE_DIGEST: digest, GITHUB_OUTPUT: output },
    pull: async () => {}, inspect: async () => imageId,
    save: async (_, archive) => writeFile(archive, 'archive'),
    clientFactory: () => ({
      options: { bucket: 'steamx' }, multipartUpload: async () => {}, put: async () => {},
      signatureUrl: () => assert.fail('build must not sign'),
    }),
  })
  const metadata = Object.fromEntries((await readFile(output, 'utf8')).trim().split('\n').map(line => line.split('=')))
  assert.equal(metadata.signed_url, undefined)
  assert.equal(result.signedUrl, undefined)
  const events = []
  const ok = await signDeployImageUrl({
    env: { ...configured, IMAGE_OSS_UPLOADED: metadata.uploaded, IMAGE_OSS_OBJECT: metadata.object_key,
      IMAGE_ID: metadata.image_id, GITHUB_ENV: file },
    clientFactory: () => ({ signatureUrl(key, options) {
      assert.equal(key, objectKey)
      assert.deepEqual(options, { expires: 7200, method: 'GET' })
      return signedUrl
    } }),
    log: message => events.push(['log', message]),
    writeEnv: async value => {
      events.push(['env', value])
      await writeFile(file, `IMAGE_OSS_URL=${value}\n`, { flag: 'a' })
    },
  })
  assert.equal(ok, true)
  assert.deepEqual(events.slice(0, 3), [
    ['env', ''], ['log', `::add-mask::${signedUrl.replaceAll('%', '%25')}`], ['env', signedUrl],
  ])
  assert.equal(await readFile(file, 'utf8'), `IMAGE_OSS_URL=\nIMAGE_OSS_URL=${signedUrl}\n`)
  assert.equal(events.filter(([type, message]) => type === 'log' && !message.startsWith('::add-mask::')).some(([, message]) => message.includes(signedUrl)), false)
})

for (const [name, override] of [
  ['no uploaded object', { IMAGE_OSS_OBJECT: '' }],
  ['upload did not succeed', { IMAGE_OSS_UPLOADED: 'false' }],
  ['no credentials', { DEPLOY_OSS_ACCESS_KEY_SECRET: '' }],
  ['missing image ID', { IMAGE_ID: '' }],
  ['injected image ID', { IMAGE_ID: `${imageId}\nEVIL=1` }],
  ['wrong object digest', { IMAGE_OSS_OBJECT: digestObjectKey(`sha256:${'d'.repeat(64)}`) }],
  ['wrong object prefix', { IMAGE_OSS_OBJECT: `other/${objectKey}` }],
  ['injected object', { IMAGE_OSS_OBJECT: `${objectKey}\nEVIL=1` }],
  ['injected prefix', { DEPLOY_OSS_PREFIX: 'deploy/steamx\nEVIL=1' }],
  ['traversal prefix', { DEPLOY_OSS_PREFIX: 'deploy/../steamx' }],
  ['injected digest', { IMAGE_DIGEST: `${digest}\nEVIL=1` }],
  ['fractional expiry', { DEPLOY_OSS_SIGN_EXPIRES: '60.5' }],
]) {
  test(`${name} clears stale URL and falls back without loading the SDK`, async (t) => {
    const { file } = await fixture(t)
    const logs = []
    let sdkLoads = 0
    const ok = await signDeployImageUrl({
      env: { ...configured, IMAGE_OSS_URL: signedUrl, ...override, GITHUB_ENV: file },
      clientFactory: () => { sdkLoads++; throw new Error('SDK must not load') }, log: message => logs.push(message),
    })
    assert.equal(ok, false)
    assert.equal(sdkLoads, 0)
    assert.match(await readFile(file, 'utf8'), /^(IMAGE_OSS_URL=\n)+$/)
    assert.equal(logs.join('\n').includes(signedUrl), false)
  })
}

test('SDK signing exceptions never reveal authenticated URLs and leave GHCR fallback', async (t) => {
  const { file } = await fixture(t)
  const logs = []
  const ok = await signDeployImageUrl({
    env: { ...configured, GITHUB_ENV: file }, log: message => logs.push(message),
    clientFactory: () => ({ signatureUrl() { throw new Error(`Request failed: ${signedUrl}`) } }),
  })
  assert.equal(ok, false)
  assert.deepEqual(logs, ['OSS signing failed; deployment will use GHCR.'])
  assert.match(await readFile(file, 'utf8'), /^(IMAGE_OSS_URL=\n)+$/)
})

for (const url of [`${signedUrl}\nEVIL=1`, `${signedUrl}\rEVIL=1`, 'http://oss.example/private', 'not a url']) {
  test('invalid signed URL is rejected without logging or writing it', async (t) => {
    const { file } = await fixture(t)
    const logs = []
    assert.equal(await signDeployImageUrl({
      env: { ...configured, GITHUB_ENV: file }, log: message => logs.push(message),
      clientFactory: () => ({ signatureUrl: () => url }),
    }), false)
    assert.deepEqual(logs, ['OSS signing failed; deployment will use GHCR.'])
    assert.match(await readFile(file, 'utf8'), /^(IMAGE_OSS_URL=\n)+$/)
  })
}

test('CLI resolves temporary SDK via NODE_PATH and emits no URL except add-mask', async (t) => {
  const { dir, file } = await fixture(t)
  const modules = path.join(dir, 'node_modules')
  await mkdir(path.join(modules, 'ali-oss'), { recursive: true })
  await writeFile(path.join(modules, 'ali-oss', 'index.js'), `module.exports = class OSS {
    signatureUrl() { if (process.env.FAKE_THROW) throw Error(process.env.FAKE_URL); return process.env.FAKE_URL }
  }`)
  // Copy entrypoints away from the project's node_modules so NODE_PATH is
  // the only SDK source, as it is in the dependency-free deploy checkout.
  for (const name of ['sign-deploy-image-url.mjs', 'upload-deploy-image-to-oss.mjs']) {
    await writeFile(path.join(dir, name), await readFile(path.join('scripts', name)))
  }
  const invoke = extra => spawnSync(process.execPath, [path.join(dir, 'sign-deploy-image-url.mjs')], {
    encoding: 'utf8', env: { ...process.env, ...configured, GITHUB_ENV: file,
      NODE_PATH: modules, FAKE_URL: signedUrl, ...extra },
  })
  const success = invoke({})
  assert.equal(success.status, 0, success.stderr)
  assert.match(success.stdout, /::add-mask::/)
  assert.equal(success.stdout.split('\n').filter(line => !line.startsWith('::add-mask::')).join('\n').includes(signedUrl), false)
  assert.equal(success.stderr, '')
  const failure = invoke({ FAKE_THROW: '1' })
  assert.equal(failure.status, 0)
  assert.equal((failure.stdout + failure.stderr).includes(signedUrl), false)
  assert.match(await readFile(file, 'utf8'), /IMAGE_OSS_URL=\n$/)
})
