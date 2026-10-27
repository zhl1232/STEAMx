#!/usr/bin/env node
// Generate the short-lived URL inside the deployment job. It must never be a
// job output: GitHub drops outputs containing secrets across job boundaries.
import { appendFile } from 'node:fs/promises'
import path from 'node:path'
import { createDeployOssClient, digestObjectKey } from './upload-deploy-image-to-oss.mjs'

export async function signDeployImageUrl({
  env = process.env,
  clientFactory = createDeployOssClient,
  log = (message) => console.info(message),
  writeEnv = (value) => appendFile(env.GITHUB_ENV, `IMAGE_OSS_URL=${value}\n`),
} = {}) {
  try {
    // Clear any inherited value even when upload/configuration/signing fails.
    await writeEnv('')
    if (env.IMAGE_OSS_UPLOADED !== 'true' || !env.IMAGE_OSS_OBJECT ||
        !env.DEPLOY_OSS_ACCESS_KEY_ID || !env.DEPLOY_OSS_ACCESS_KEY_SECRET) {
      log('OSS signing skipped; deployment will use GHCR.')
      return false
    }
    if (!/^sha256:[0-9a-f]{64}$/.test(env.IMAGE_ID || '')) {
      throw new Error('Invalid trusted image ID')
    }
    const expectedKey = digestObjectKey(env.IMAGE_DIGEST, env.DEPLOY_OSS_PREFIX)
    if (env.IMAGE_OSS_OBJECT !== expectedKey) throw new Error('Unexpected object key')
    const expires = Number(env.DEPLOY_OSS_SIGN_EXPIRES || 7200)
    if (!Number.isInteger(expires) || expires < 60) throw new Error('Invalid expiry')
    const signedUrl = clientFactory(env).signatureUrl(expectedKey, { expires, method: 'GET' })
    if (typeof signedUrl !== 'string' || /[^\x21-\x7e]/.test(signedUrl) ||
        new URL(signedUrl).protocol !== 'https:') throw new Error('Invalid signed URL')
    // Mask before writing the URL anywhere. Percent must be escaped in workflow
    // commands; CR/LF and other control characters are rejected above.
    log(`::add-mask::${signedUrl.replaceAll('%', '%25')}`)
    await writeEnv(signedUrl)
    log('OSS URL prepared for this deployment job.')
    return true
  } catch {
    // Never print SDK exceptions: they may embed authenticated request URLs.
    try { await writeEnv('') } catch { /* The optional OSS path remains unused. */ }
    log('OSS signing failed; deployment will use GHCR.')
    return false
  }
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)
if (isMain) await signDeployImageUrl()
