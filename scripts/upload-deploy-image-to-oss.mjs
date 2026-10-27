#!/usr/bin/env node
/**
 * Save the Release image (same digest already pushed to GHCR) and upload it to
 * Aliyun OSS so the Beijing production host can download over the domestic
 * backbone instead of pulling from GHCR.
 *
 * Object key:
 *   ${DEPLOY_OSS_PREFIX}/sha256-<64hex>.tar.gz
 * default prefix: deploy/steamx
 *
 * Required env:
 *   REGISTRY_IMAGE          e.g. ghcr.io/zhl1232/steamx
 *   IMAGE_DIGEST            sha256:...
 *   DEPLOY_OSS_ACCESS_KEY_ID
 *   DEPLOY_OSS_ACCESS_KEY_SECRET
 *
 * Optional env:
 *   DEPLOY_OSS_BUCKET       default steamx
 *   DEPLOY_OSS_REGION       default oss-cn-hangzhou
 *   DEPLOY_OSS_ENDPOINT     overrides region-derived endpoint
 *   DEPLOY_OSS_PREFIX       default deploy/steamx
 *   DEPLOY_OSS_SIGN_EXPIRES signed URL lifetime in seconds (default 7200)
 *   GITHUB_SHA              recorded in the sidecar JSON
 *   GITHUB_OUTPUT           when set, writes signed_url / image_id / object_key / uploaded
 *
 * This script never deletes OSS objects. Cleanup is a separate, manual proposal.
 */

import { createWriteStream } from 'node:fs'
import { mkdtemp, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { pipeline } from 'node:stream/promises'
import { createGzip } from 'node:zlib'
import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)

export function digestObjectKey(digest, prefix = 'deploy/steamx') {
  const match = /^(sha256:)([0-9a-f]{64})$/i.exec(String(digest || '').trim())
  if (!match) {
    throw new Error(`IMAGE_DIGEST must look like sha256:<64 hex>, got: ${digest}`)
  }
  const cleanPrefix = String(prefix || 'deploy/steamx').replace(/^\/+|\/+$/g, '')
  return `${cleanPrefix}/sha256-${match[2].toLowerCase()}.tar.gz`
}

export function createDeployOssClient(env = process.env) {
  const OSS = require('ali-oss')
  const accessKeyId = env.DEPLOY_OSS_ACCESS_KEY_ID
  const accessKeySecret = env.DEPLOY_OSS_ACCESS_KEY_SECRET
  if (!accessKeyId || !accessKeySecret) {
    throw new Error('DEPLOY_OSS_ACCESS_KEY_ID and DEPLOY_OSS_ACCESS_KEY_SECRET are required')
  }
  const bucket = env.DEPLOY_OSS_BUCKET || 'steamx'
  const region = env.DEPLOY_OSS_REGION || 'oss-cn-hangzhou'
  const endpoint = env.DEPLOY_OSS_ENDPOINT
  const config = { accessKeyId, accessKeySecret, bucket, region, secure: true, timeout: 600_000 }
  if (endpoint) config.endpoint = endpoint
  return new OSS(config)
}

function requireEnv(name, env = process.env) {
  const value = env[name]
  if (!value) throw new Error(`Missing required environment variable: ${name}`)
  return value
}

function run(command, args, { stdio = 'inherit' } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio })
    child.on('error', reject)
    child.on('close', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`${command} ${args.join(' ')} exited with ${code}`))
    })
  })
}

async function inspectImageId(imageRef) {
  return new Promise((resolve, reject) => {
    const child = spawn('docker', ['image', 'inspect', '--format', '{{.Id}}', imageRef], {
      stdio: ['ignore', 'pipe', 'inherit'],
    })
    let output = ''
    child.stdout.setEncoding('utf8').on('data', (chunk) => { output += chunk })
    child.on('error', reject)
    child.on('close', (code) => {
      if (code === 0) resolve(output.trim())
      else reject(new Error(`docker image inspect exited with ${code}`))
    })
  })
}

async function saveImageArchive(imageRef, archivePath) {
  const save = spawn('docker', ['save', imageRef], { stdio: ['ignore', 'pipe', 'inherit'] })
  const completed = new Promise((resolve, reject) => {
    save.on('error', reject)
    save.on('close', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`docker save exited with ${code}`))
    })
  })
  await Promise.all([
    completed,
    pipeline(save.stdout, createGzip({ level: 1 }), createWriteStream(archivePath)),
  ])
}

async function appendGithubOutput(values, env) {
  const file = env.GITHUB_OUTPUT
  if (!file) return
  const lines = Object.entries(values).map(([key, value]) => `${key}=${value}`)
  await writeFile(file, `${lines.join('\n')}\n`, { flag: 'a' })
}

export async function uploadDeployImage({
  env = process.env,
  clientFactory = createDeployOssClient,
  pull = (ref) => run('docker', ['pull', ref]),
  inspect = inspectImageId,
  save = saveImageArchive,
  now = () => new Date(),
} = {}) {
  const registryImage = requireEnv('REGISTRY_IMAGE', env)
  const digest = requireEnv('IMAGE_DIGEST', env)
  const prefix = env.DEPLOY_OSS_PREFIX || 'deploy/steamx'
  const objectKey = digestObjectKey(digest, prefix)
  const imageRef = `${registryImage}@${digest}`
  const expires = Number(env.DEPLOY_OSS_SIGN_EXPIRES || 7200)
  if (!Number.isFinite(expires) || expires < 60) {
    throw new Error('DEPLOY_OSS_SIGN_EXPIRES must be an integer >= 60')
  }

  const workDir = await mkdtemp(path.join(tmpdir(), 'steam-deploy-oss-'))
  const archivePath = path.join(workDir, 'image.tar.gz')
  try {
    console.info(`Pulling ${imageRef} for OSS archive ...`)
    await pull(imageRef)
    // The registry digest is not preserved by docker save/load. Trust the
    // image ID inspected from the exact pulled digest, never archive metadata.
    const imageId = await inspect(imageRef)
    if (!/^sha256:[0-9a-f]{64}$/.test(imageId)) {
      throw new Error(`Invalid Docker image ID: ${imageId}`)
    }
    console.info(`Saving gzip archive to ${archivePath} ...`)
    await save(imageId, archivePath)
    const sizeBytes = (await stat(archivePath)).size
    console.info(`Archive size: ${sizeBytes} bytes`)

    const client = clientFactory(env)
    console.info(`Uploading oss://${client.options.bucket}/${objectKey} ...`)
    await client.multipartUpload(objectKey, archivePath, {
      partSize: 8 * 1024 * 1024,
      timeout: 600_000,
      headers: {
        'Content-Type': 'application/gzip',
        'Cache-Control': 'private, no-cache',
        'x-oss-meta-image-digest': digest,
        'x-oss-meta-image-id': imageId,
        'x-oss-meta-git-sha': env.GITHUB_SHA || '',
        'x-oss-meta-registry-image': registryImage,
      },
      progress: (p) => {
        if (p === 1 || Math.round(p * 100) % 20 === 0) {
          console.info(`  upload progress ${Math.round(p * 100)}%`)
        }
      },
    })

    const sidecarKey = objectKey.replace(/\.tar\.gz$/, '.json')
    const sidecar = {
      objectKey,
      digest,
      imageId,
      registryImage,
      gitSha: env.GITHUB_SHA || null,
      sizeBytes,
      uploadedAt: now().toISOString(),
    }
    await client.put(sidecarKey, Buffer.from(`${JSON.stringify(sidecar, null, 2)}\n`, 'utf8'), {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'private, no-cache',
      },
    })

    const signedUrl = client.signatureUrl(objectKey, { expires, method: 'GET' })
    console.info(`Uploaded ${objectKey}; signed URL expires in ${expires}s`)
    await appendGithubOutput({
      uploaded: 'true',
      image_id: imageId,
      object_key: objectKey,
      signed_url: signedUrl,
      size_bytes: String(sizeBytes),
    }, env)
    return { objectKey, signedUrl, imageId, sizeBytes, sidecarKey }
  } finally {
    await rm(workDir, { recursive: true, force: true })
  }
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)
if (isMain) {
  uploadDeployImage().catch((error) => {
    console.error(error?.stack || error)
    process.exit(1)
  })
}
