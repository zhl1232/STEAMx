import test from 'node:test'
import assert from 'node:assert/strict'
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

test('uploadDeployImage uploads archive, sidecar, and returns a signed URL', async () => {
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
      return `https://example.test/${key}?expires=${options.expires}`
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
    },
    clientFactory: () => client,
    pull: async () => {},
    save: async (ref, archivePath) => {
      saved.push({ ref, archivePath })
      const { writeFile } = await import('node:fs/promises')
      await writeFile(archivePath, 'fake-tar-gz')
    },
    now: () => new Date('2026-10-27T02:00:00.000Z'),
  })

  assert.equal(result.objectKey, `deploy/steamx/sha256-${'b'.repeat(64)}.tar.gz`)
  assert.equal(result.signedUrl, `https://example.test/${result.objectKey}?expires=7200`)
  assert.equal(multipart.length, 1)
  assert.equal(multipart[0].key, result.objectKey)
  assert.equal(saved[0].ref, `ghcr.io/acme/steam@${digest}`)
  assert.equal(puts.length, 1)
  assert.equal(puts[0].key, result.objectKey.replace(/\.tar\.gz$/, '.json'))
  assert.match(puts[0].body, /"gitSha": "deadbeef"/)
  assert.match(puts[0].body, new RegExp('"digest": "sha256:' + 'b'.repeat(64) + '"'))
})
