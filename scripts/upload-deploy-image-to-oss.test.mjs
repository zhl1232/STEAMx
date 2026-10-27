import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { digestObjectKey, uploadDeployImage } from './upload-deploy-image-to-oss.mjs'

test('digestObjectKey builds deploy/steamx/sha256-<hex>.tar.gz', () => {
  const digest = `sha256:${'a'.repeat(64)}`
  assert.equal(
    digestObjectKey(digest),
    `deploy/steamx/sha256-${'a'.repeat(64)}.tar.gz`,
  )
  assert.equal(
    digestObjectKey(digest, '/deploy/steamx/'),
    `deploy/steamx/sha256-${'a'.repeat(64)}.tar.gz`,
  )
})

test('digestObjectKey rejects malformed digests', () => {
  assert.throws(() => digestObjectKey('sha256:abc'), /must look like/)
  assert.throws(() => digestObjectKey('sha256:' + 'g'.repeat(64)), /must look like/)
})

test('uploadDeployImage saves the exact pulled image ID and publishes only safe cross-job metadata', async (t) => {
  const outputDir = await mkdtemp(path.join(tmpdir(), 'oss-output-test-'))
  t.after(() => rm(outputDir, { recursive: true, force: true }))
  const output = path.join(outputDir, 'output')
  const imageId = `sha256:${'c'.repeat(64)}`
  const inspected = []
  const pulled = []
  const digest = `sha256:${'b'.repeat(64)}`
  const puts = []
  const multipart = []
  const client = {
    options: { bucket: 'steamx' },
    async multipartUpload(key, file, options) {
      multipart.push({ key, file, options })
    },
    async put(key, body, options) {
      puts.push({ key, body: Buffer.isBuffer(body) ? body.toString('utf8') : body, options })
    },
    signatureUrl(key, options) {
      assert.fail('build job must never generate a signed URL')
    },
  }
  const saved = []
  const result = await uploadDeployImage({
    env: {
      REGISTRY_IMAGE: 'ghcr.io/acme/steam',
      IMAGE_DIGEST: digest,
      DEPLOY_OSS_ACCESS_KEY_ID: 'id',
      DEPLOY_OSS_ACCESS_KEY_SECRET: 'secret',
      GITHUB_SHA: 'deadbeef',
      GITHUB_OUTPUT: output,
    },
    clientFactory: () => client,
    pull: async (ref) => { pulled.push(ref) },
    inspect: async (ref) => { inspected.push(ref); return imageId },
    save: async (ref, archivePath) => {
      saved.push({ ref, archivePath })
      const { writeFile } = await import('node:fs/promises')
      await writeFile(archivePath, 'fake-tar-gz')
    },
    now: () => new Date('2026-10-27T02:00:00.000Z'),
  })

  assert.equal(result.objectKey, `deploy/steamx/sha256-${'b'.repeat(64)}.tar.gz`)
  assert.equal(result.signedUrl, undefined)
  assert.equal(multipart.length, 1)
  assert.equal(multipart[0].key, result.objectKey)
  assert.deepEqual(pulled, [`ghcr.io/acme/steam@${digest}`])
  assert.deepEqual(inspected, pulled)
  assert.equal(saved[0].ref, imageId)
  assert.equal(result.imageId, imageId)
  const outputs = Object.fromEntries((await readFile(output, 'utf8')).trim().split('\n').map(line => line.split('=')))
  assert.deepEqual(outputs, { uploaded: 'true', image_id: imageId, object_key: result.objectKey, size_bytes: '11' })
  assert.equal(puts.length, 1)
  assert.equal(puts[0].key, result.objectKey.replace(/\.tar\.gz$/, '.json'))
  assert.match(puts[0].body, /"gitSha": "deadbeef"/)
  assert.match(puts[0].body, new RegExp('"digest": "sha256:' + 'b'.repeat(64) + '"'))
})


test('invalid inspected image ID never saves or uploads an archive', async () => {
  await assert.rejects(uploadDeployImage({
    env: { REGISTRY_IMAGE: 'ghcr.io/acme/steam', IMAGE_DIGEST: `sha256:${'b'.repeat(64)}` },
    pull: async () => {},
    inspect: async () => 'sha256:truncated',
    save: async () => assert.fail('must not save'),
    clientFactory: () => assert.fail('must not upload'),
  }), /Invalid Docker image ID/)
})
