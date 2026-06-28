#!/usr/bin/env node
// 把一个 LDraw 源模型（.ldr）连同它递归引用的所有零件/图元打包成单个自托管 .mpd，
// 并下载配色文件 ldconfig.ldr，输出到 public/courses/ldraw/。
//
// 这样课时页只需加载一个 .mpd + 一个配色文件，无需在运行时访问外部 LDraw 库，
// 也避免成千上万次零件子文件的网络请求（three.js LDrawLoader 官方推荐做法）。
//
// 用法：node scripts/pack-ldraw-model.mjs scripts/ldraw-models/duplo-car.ldr duplo-car
//
// 依赖来源：gkjohnson 的 LDraw 库镜像（官方 complete 库 + 非官方件）。
// 许可：LDraw 零件库按 CC BY / CCAL 再分发，使用处需署名（见课时页页脚）。

import { execFile } from 'node:child_process'
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

const MIRROR = 'https://raw.githubusercontent.com/gkjohnson/ldraw-parts-library/master'
const COMPLETE = `${MIRROR}/complete/ldraw`
const LDCONFIG_URL = `${COMPLETE}/LDConfig.ldr`

// 一个被引用文件可能落在这些子目录里，按顺序试探。
const SEARCH_DIRS = ['parts', 'p', 'models']

const OUT_DIR = resolve(process.cwd(), 'public/courses/ldraw')

/** 从已打包的本地 MPD 文件里读取依赖块，避免重复下载相同 LDraw 零件。 */
async function loadLocalMpdCache() {
  const cache = new Map()

  let files = []
  try {
    files = await readdir(OUT_DIR)
  } catch {
    return cache
  }

  for (const file of files) {
    if (!file.endsWith('.mpd')) continue

    const text = await readFile(resolve(OUT_DIR, file), 'utf8')
    const lines = text.split(/\r?\n/)
    let currentName = null
    let currentLines = []

    const flush = () => {
      if (!currentName || currentLines.length === 0) return
      const key = currentName.toLowerCase()
      if (!cache.has(key)) cache.set(key, currentLines.join('\n').trimEnd())
    }

    for (const line of lines) {
      if (line.startsWith('0 FILE ')) {
        flush()
        currentName = line.slice('0 FILE '.length).trim()
        currentLines = []
        continue
      }
      if (currentName) currentLines.push(line)
    }
    flush()
  }

  return cache
}

/** 把 LDraw 引用名（可能含反斜杠）规范化为正斜杠。 */
function normalizeRef(ref) {
  return ref.trim().replace(/\\/g, '/')
}

/**
 * 复刻 LDrawLoader 解析 type-1 引用时的同款变换（见 three LDrawLoader 第 915-935 行）：
 * 归一化反斜杠后，子目录引用 `s/` 前加 `parts/`、`48/` 前加 `p/`。
 * 打包时必须用变换后的名字作为 `0 FILE` 名，否则加载器查缓存对不上键，会退化为网络加载子件。
 */
function loaderKey(ref) {
  const normalized = normalizeRef(ref)
  if (normalized.startsWith('s/')) return `parts/${normalized}`
  if (normalized.startsWith('48/')) return `p/${normalized}`
  return normalized
}

/** 抓取文本，404 返回 null。用 curl 以便复用沙箱代理设置（node fetch 不读 HTTP_PROXY）。 */
async function fetchText(url) {
  try {
    const { stdout } = await execFileAsync(
      'curl',
      ['-sSL', '-w', '\n%{http_code}', '--max-time', '30', url],
      { maxBuffer: 64 * 1024 * 1024 },
    )
    const idx = stdout.lastIndexOf('\n')
    const body = stdout.slice(0, idx)
    const code = stdout.slice(idx + 1).trim()
    if (code === '404') return null
    if (code !== '200') throw new Error(`HTTP ${code} for ${url}`)
    return body
  } catch (err) {
    throw new Error(`fetch failed for ${url}: ${err.message}`)
  }
}

/** 在候选子目录里找到引用文件的内容；返回 { content, url } 或 null。 */
async function resolvePart(ref) {
  const normalized = normalizeRef(ref)
  // 已经带子目录前缀（如 s/3011s01.dat 或 48/1-4chrd.dat）时也要在 parts/ 与 p/ 下试。
  for (const dir of SEARCH_DIRS) {
    const url = `${COMPLETE}/${dir}/${normalized}`
    const content = await fetchText(url)
    if (content !== null) return { content, url }
  }
  return null
}

/** 从一行 LDraw 文本里解析子文件引用（type 1 行的最后一个字段）。 */
function extractRef(line) {
  const trimmed = line.trim()
  if (!trimmed.startsWith('1 ')) return null
  const tokens = trimmed.split(/\s+/)
  // 1 colour x y z a b c d e f g h i <file...>
  if (tokens.length < 15) return null
  return tokens.slice(14).join(' ')
}

async function main() {
  const [sourcePathArg, outName] = process.argv.slice(2)
  if (!sourcePathArg || !outName) {
    console.error('用法: node scripts/pack-ldraw-model.mjs <source.ldr> <outName>')
    process.exit(1)
  }

  const sourcePath = resolve(process.cwd(), sourcePathArg)
  const modelText = await readFile(sourcePath, 'utf8')
  const localMpdCache = await loadLocalMpdCache()

  // key: 加载器缓存键（变换后、正斜杠、含 parts/ 或 p/ 前缀）；value: 文件内容
  const collected = new Map()
  const visited = new Set()

  async function walk(text) {
    const refs = []
    for (const line of text.split(/\r?\n/)) {
      const ref = extractRef(line)
      if (ref) refs.push(ref)
    }
    for (const ref of refs) {
      const key = loaderKey(ref).toLowerCase()
      if (visited.has(key)) continue
      visited.add(key)
      const cached = localMpdCache.get(key)
      const resolved = cached ? { content: cached, url: 'local MPD cache' } : await resolvePart(ref)
      if (!resolved) {
        throw new Error(`无法解析零件引用: "${ref}"（在 parts/ p/ models/ 下都找不到）`)
      }
      collected.set(loaderKey(ref), resolved.content)
      await walk(resolved.content)
    }
  }

  console.log(`解析模型依赖: ${sourcePathArg}`)
  await walk(modelText)
  console.log(`共收集 ${collected.size} 个零件/图元文件`)

  // 组装 MPD：主模型在最前，其后是所有依赖（用原始引用名作为 0 FILE 名）。
  const blocks = [`0 FILE ${outName}.ldr\n${modelText.trimEnd()}\n`]
  for (const [ref, content] of collected) {
    blocks.push(`0 FILE ${ref}\n${content.trimEnd()}\n`)
  }
  const mpd = blocks.join('\n')

  await mkdir(OUT_DIR, { recursive: true })
  const mpdPath = resolve(OUT_DIR, `${outName}.mpd`)
  await writeFile(mpdPath, mpd, 'utf8')
  console.log(`已写出: ${mpdPath}`)

  // 配色文件（只需下载一次，多模型共用）。
  const ldconfigPath = resolve(OUT_DIR, 'LDConfig.ldr')
  let ldconfig = null
  try {
    ldconfig = await readFile(ldconfigPath, 'utf8')
  } catch {
    ldconfig = await fetchText(LDCONFIG_URL)
    if (!ldconfig) throw new Error('无法下载 LDConfig.ldr')
    await writeFile(ldconfigPath, ldconfig, 'utf8')
    console.log(`已写出: ${ldconfigPath}`)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
