#!/usr/bin/env node
// 把 3D 课本构建产物复制进 public/textbook3d/<版本>/<课号>/index.html。
// 用法：node scripts/textbook3d/sync.mjs <dist 目录> [课号…]
// 不带课号时同步登记表 lib/textbook3d/registry.ts 里的全部课；登记表里有、dist 里没有会报错。
import { copyFileSync, existsSync, mkdirSync, readFileSync, statSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..")
const registry = readFileSync(join(root, "lib/textbook3d/registry.ts"), "utf8")
const version = registry.match(/TEXTBOOK3D_VERSION = "(v\d+)"/)?.[1]
const registered = [...registry.matchAll(/\{ id: "(g\d+[ab]-\d+-\d+)"/g)].map((m) => m[1])
const [distArg, ...only] = process.argv.slice(2)
if (!distArg || !version) {
  console.error("用法：node scripts/textbook3d/sync.mjs <dist 目录> [课号…]")
  process.exit(1)
}
const ids = only.length ? only : registered
const missing = ids.filter((id) => !registered.includes(id))
if (missing.length) {
  console.error(`这些课号还没写进 lib/textbook3d/registry.ts：${missing.join(", ")}`)
  process.exit(1)
}
const MAX_BYTES = 2.5 * 1024 * 1024
for (const id of ids) {
  const from = join(resolve(distArg), id, "index.html")
  if (!existsSync(from)) { console.error(`缺少 ${from}`); process.exit(1) }
  const html = readFileSync(from, "utf8")
  if (!html.includes("steamx-textbook-")) { console.error(`${id} 不含嵌入协议，可能是旧构建`); process.exit(1) }
  const size = statSync(from).size
  if (size > MAX_BYTES) { console.error(`${id} 超过 2.5MB（${size} 字节），请先拆共享运行时或改放 CDN`); process.exit(1) }
  const to = join(root, "public/textbook3d", version, id, "index.html")
  mkdirSync(dirname(to), { recursive: true })
  copyFileSync(from, to)
  console.info(`${id}  ${(size / 1024).toFixed(0)} KB -> ${to.slice(root.length + 1)}`)
}
