/**
 * 阿里云 OSS 客户端，仅供 scripts/ 下的同步/迁移脚本使用。
 *
 * 凭证从环境变量读取（不要在仓库里硬编码）：
 *   ALIYUN_OSS_ACCESS_KEY_ID
 *   ALIYUN_OSS_ACCESS_KEY_SECRET
 *   ALIYUN_OSS_BUCKET
 *   ALIYUN_OSS_REGION                 例如 oss-cn-hangzhou
 *   ALIYUN_OSS_ENDPOINT  (可选)        指定后覆盖 region 拼接出来的 endpoint
 *
 * 注意：本文件只在 Node 端使用，不要被 Next.js 客户端代码引入。
 */

import fs from 'node:fs/promises'
import path from 'node:path'
import OSS from 'ali-oss'

function requireEnv(name) {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }
  return value
}

export function createOssClient() {
  const accessKeyId = requireEnv('ALIYUN_OSS_ACCESS_KEY_ID')
  const accessKeySecret = requireEnv('ALIYUN_OSS_ACCESS_KEY_SECRET')
  const bucket = requireEnv('ALIYUN_OSS_BUCKET')
  const region = process.env.ALIYUN_OSS_REGION
  const endpoint = process.env.ALIYUN_OSS_ENDPOINT

  if (!region && !endpoint) {
    throw new Error('Either ALIYUN_OSS_REGION or ALIYUN_OSS_ENDPOINT must be set')
  }

  const config = { accessKeyId, accessKeySecret, bucket, secure: true }
  if (endpoint) config.endpoint = endpoint
  if (region) config.region = region

  return new OSS(config)
}

const CONTENT_TYPE_BY_EXT = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ogg': 'audio/ogg',
  '.oga': 'audio/ogg',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.flac': 'audio/flac',
  '.mp4': 'video/mp4',
  '.m4v': 'video/x-m4v',
  '.mov': 'video/quicktime',
  '.webm': 'video/webm',
  '.pdf': 'application/pdf',
  '.json': 'application/json; charset=utf-8',
}

function inferContentType(filePath) {
  return CONTENT_TYPE_BY_EXT[path.extname(filePath).toLowerCase()]
}

async function listLocalFiles(rootDir, { recursive = true } = {}) {
  const result = []
  async function walk(currentDir) {
    const entries = await fs.readdir(currentDir, { withFileTypes: true })
    for (const entry of entries) {
      const absPath = path.join(currentDir, entry.name)
      if (entry.isDirectory()) {
        if (recursive) await walk(absPath)
      } else if (entry.isFile()) {
        result.push(absPath)
      }
    }
  }
  await walk(rootDir)
  return result
}

async function withConcurrency(items, concurrency, worker) {
  const queue = items.slice()
  const errors = []
  let done = 0
  const total = items.length

  async function runOne() {
    for (;;) {
      const next = queue.shift()
      if (next === undefined) return
      try {
        await worker(next)
      } catch (err) {
        errors.push({ item: next, error: err })
      } finally {
        done += 1
        if (done % 50 === 0 || done === total) {
          process.stdout.write(`  uploaded ${done}/${total}\n`)
        }
      }
    }
  }

  const runners = Array.from({ length: Math.min(concurrency, total) }, () => runOne())
  await Promise.all(runners)
  return errors
}

/**
 * 把本地目录批量上传到 OSS，object key 与 publicPathPrefix 对应。
 * 例如 publicPathPrefix='birds/images', localDir='public/birds/images',
 * 文件 'public/birds/images/foo.jpg' → key 'birds/images/foo.jpg'。
 *
 * cacheControl: 默认 1 年长缓存（资源文件名包含内容标识时合理）
 * skipExisting: 默认跳过 OSS 上已存在的相同 key（用 headObject 检测）
 * recursive: 默认递归上传子目录；设为 false 时只上传 localDir 根层文件
 */
export async function uploadDirectory(client, {
  localDir,
  publicPathPrefix,
  concurrency = 16,
  cacheControl = 'public, max-age=31536000, immutable',
  skipExisting = true,
  recursive = true,
}) {
  const absLocalDir = path.resolve(localDir)
  const files = await listLocalFiles(absLocalDir, { recursive })

  console.info(`Uploading ${files.length} files from ${absLocalDir} → oss:${publicPathPrefix}/`)

  const errors = await withConcurrency(files, concurrency, async (filePath) => {
    const relativeKey = path.relative(absLocalDir, filePath).split(path.sep).join('/')
    const objectKey = `${publicPathPrefix}/${relativeKey}`.replace(/^\/+/, '')

    if (skipExisting) {
      try {
        await client.head(objectKey)
        return
      } catch (err) {
        if (err && err.code !== 'NoSuchKey') {
          // 网络错误等：让 put 阶段重试或报错
        }
      }
    }

    const headers = { 'Cache-Control': cacheControl }
    const contentType = inferContentType(filePath)
    if (contentType) headers['Content-Type'] = contentType

    await client.put(objectKey, filePath, { headers, timeout: 120_000 })
  })

  if (errors.length > 0) {
    console.error(`Upload finished with ${errors.length} errors:`)
    for (const { item, error } of errors.slice(0, 10)) {
      console.error(`  ${item}: ${error?.message || error}`)
    }
    throw new Error(`Failed to upload ${errors.length} file(s)`)
  }

  console.info(`✓ Uploaded ${files.length} files to oss:${publicPathPrefix}/`)
  return files.length
}
