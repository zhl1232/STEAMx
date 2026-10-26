import { createRequire } from 'node:module'
import { copyFile, lstat, mkdir, readlink, symlink } from 'node:fs/promises'
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

// Next traces its own server entry points. The separate worker needs its SDK
// and transitive runtime dependencies copied using the same pinned tracer.
const require = createRequire(import.meta.url)
const { nodeFileTrace } = require('next/dist/compiled/@vercel/nft')
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const destination = resolve(process.argv[2] || join(root, '.next/standalone'))
if (destination === root) throw new Error('Runtime destination must be separate from the source tree')
const { fileList } = await nodeFileTrace([join(root, 'deploy/feishu-bridge.mjs')], {
  base: root,
  processCwd: root,
})
let copied = 0
for (const file of fileList) {
  if (!file.startsWith(`node_modules${sep}`) || file.includes(`..${sep}`)) continue
  const source = join(root, file)
  const target = join(destination, file)
  const stat = await lstat(source)
  await mkdir(dirname(target), { recursive: true })
  if (stat.isSymbolicLink()) {
    const original = await readlink(source)
    const linked = resolve(dirname(source), original)
    if (!linked.startsWith(root + sep)) throw new Error('Runtime dependency points outside the workspace')
    const value = isAbsolute(original) ? relative(dirname(source), linked) : original
    try { await symlink(value, target) } catch (error) { if (error.code !== 'EEXIST') throw error }
  } else if (stat.isFile()) {
    await copyFile(source, target)
  }
  copied++
}
const runtimeRequire = createRequire(join(destination, 'commerce-worker.mjs'))
const sdk = runtimeRequire('@larksuiteoapi/node-sdk')
if (typeof sdk.WSClient !== 'function' || typeof sdk.EventDispatcher !== 'function') throw new Error('Feishu runtime SDK is incomplete')
console.info(`Feishu worker runtime verified (${copied} dependency files)`)
