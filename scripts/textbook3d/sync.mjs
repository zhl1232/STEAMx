#!/usr/bin/env node
// 把 3D 课本构建产物（tools/build_split.py 输出的 dist-split/）复制进 public/textbook3d/<版本>/。
// 用法：node scripts/textbook3d/sync.mjs <dist-split 目录> [课号…] [--prune]
//   - 共享文件（shared/ 下带哈希的 JS 和字体）总是全部复制；文件名带内容哈希，已存在且相同就跳过。
//   - 课时 HTML：不带课号时同步登记表 lib/textbook3d/registry.ts 里的全部课。
//   - --prune：删掉不再被任何课时引用的旧共享文件。默认保留，因为已缓存的旧 HTML 可能还引用它们。
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..")
const registry = readFileSync(join(root, "lib/textbook3d/registry.ts"), "utf8")
const version = registry.match(/TEXTBOOK3D_VERSION = "(v\d+)"/)?.[1]
const sharedBase = registry.match(/TEXTBOOK3D_SHARED_BASE = `([^`]+)`/)?.[1]?.replace("${TEXTBOOK3D_VERSION}", version ?? "")
const registered = [...registry.matchAll(/\{ id: "(g\d+[ab]-\d+-\d+)"/g)].map((m) => m[1])
const args = process.argv.slice(2)
const prune = args.includes("--prune")
const [distArg, ...only] = args.filter((a) => a !== "--prune")
const fail = (msg) => { console.error(msg); process.exit(1) }
if (!distArg || !version || !sharedBase) fail("用法：node scripts/textbook3d/sync.mjs <dist-split 目录> [课号…] [--prune]")

const dist = resolve(distArg)
const manifestPath = join(dist, "shared-manifest.json")
if (!existsSync(manifestPath)) fail(`缺少 ${manifestPath}，请用 tools/build_split.py 构建`)
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"))
if (manifest.base !== sharedBase) fail(`构建时的资源基址 ${manifest.base} 与登记表 TEXTBOOK3D_SHARED_BASE ${sharedBase} 不一致`)

const SHARED_NAME = /^[\w-]+-[A-Za-z0-9]{8,}\.(js|woff2)$/
const MAX_SHARED_BYTES = 1.5 * 1024 * 1024
const MAX_LESSON_BYTES = 64 * 1024
const MAX_LESSON_JS_BYTES = 200 * 1024
const publicDir = join(root, "public/textbook3d", version)
const sharedOut = join(publicDir, "shared")
mkdirSync(sharedOut, { recursive: true })

let sharedTotal = 0
for (const name of manifest.files) {
  if (!SHARED_NAME.test(name)) fail(`共享文件名必须带内容哈希：${name}`)
  const from = join(dist, "shared", name)
  if (!existsSync(from)) fail(`缺少共享文件 ${from}`)
  const size = statSync(from).size
  if (size > MAX_SHARED_BYTES) fail(`${name} 超过 1.5MB（${size} 字节）`)
  sharedTotal += size
  const to = join(sharedOut, name)
  if (existsSync(to) && statSync(to).size === size) continue
  copyFileSync(from, to)
}
console.info(`shared  ${manifest.files.length} 个文件，${(sharedTotal / 1024).toFixed(0)} KB -> ${sharedOut.slice(root.length + 1)}`)

const ids = only.length ? only : registered
const missing = ids.filter((id) => !registered.includes(id))
if (missing.length) fail(`这些课号还没写进 lib/textbook3d/registry.ts：${missing.join(", ")}`)
const sharedRef = new RegExp(`${sharedBase.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&")}([\\w.-]+)`, "g")
for (const id of ids) {
  const from = join(dist, id, "index.html")
  if (!existsSync(from)) fail(`缺少 ${from}`)
  const html = readFileSync(from, "utf8")
  const size = statSync(from).size
  if (size > MAX_LESSON_BYTES) fail(`${id} 的 HTML 超过 64KB（${size} 字节），可能还是内联旧构建`)
  const entry = manifest.entries[id]
  if (!entry || !html.includes(`${sharedBase}${entry}`)) fail(`${id} 没有引用自己的入口脚本 ${entry}`)
  if (statSync(join(dist, "shared", entry)).size > MAX_LESSON_JS_BYTES) fail(`${id} 的入口脚本超过 200KB`)
  for (const [, ref] of html.matchAll(sharedRef)) {
    if (!manifest.files.includes(ref)) fail(`${id} 引用了不存在的共享文件 ${ref}`)
  }
  const to = join(publicDir, id, "index.html")
  mkdirSync(dirname(to), { recursive: true })
  copyFileSync(from, to)
  console.info(`${id}  ${(size / 1024).toFixed(1)} KB -> ${to.slice(root.length + 1)}`)
}

if (prune) {
  const used = new Set()
  for (const dir of readdirSync(publicDir)) {
    const file = join(publicDir, dir, "index.html")
    if (dir === "shared" || !existsSync(file)) continue
    for (const [, ref] of readFileSync(file, "utf8").matchAll(sharedRef)) used.add(ref)
  }
  // 入口脚本 import 的共享 chunk 也要保留
  for (const name of [...used]) {
    if (!name.endsWith(".js")) continue
    for (const [, dep] of readFileSync(join(sharedOut, name), "utf8").matchAll(/["']\.\/([\w-]+\.js)["']/g)) used.add(dep)
  }
  for (const name of readdirSync(sharedOut)) {
    if (!used.has(name)) { rmSync(join(sharedOut, name)); console.info(`pruned ${name}`) }
  }
}
