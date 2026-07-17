import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const dist = path.resolve(__dirname, '../dist')
const target = path.resolve(__dirname, '../../../public/scratch')
const bundledAssetSource = path.resolve(__dirname, '../src/default-project-assets')

// 仅清理由 webpack 产出的部分；保留 fetch-scratch-assets 镜像下来的 assets/
const PRESERVE = new Set(['assets'])

const ASSET_URL_REPLACEMENTS = [
  [
    'https://cdn.assets.scratch.mit.edu/internalapi/asset/',
    '/internalapi/asset/',
  ],
  [
    'https://assets.scratch.mit.edu/internalapi/asset/',
    '/internalapi/asset/',
  ],
  ['https://cdn2.assets.scratch.mit.edu/internalapi/asset/', '/internalapi/asset/'],
]

function patchScratchGuiAssetUrls(scratchDir) {
  const guiPath = path.join(scratchDir, 'scratch-gui.js')
  if (!existsSync(guiPath)) {
    console.warn('scratch-gui.js not found; skip asset URL patch')
    return
  }
  let content = readFileSync(guiPath, 'utf8')
  let changed = false
  for (const [from, to] of ASSET_URL_REPLACEMENTS) {
    if (content.includes(from)) {
      content = content.split(from).join(to)
      changed = true
    }
  }

  // scratch-storage 嵌套 webpack 的 publicPath 是 "/"，Worker 会请求
  // /chunks/fetch-worker-*.js；实际文件在 /scratch/chunks/。改成 /scratch/。
  const nestedPublicPath = /(\.[pP]\s*=\s*)"\/"/g
  if (nestedPublicPath.test(content)) {
    content = content.replace(nestedPublicPath, '$1"/scratch/"')
    changed = true
    console.log('Patched scratch-gui.js nested webpack publicPath → /scratch/')
  }

  if (changed) {
    writeFileSync(guiPath, content)
    console.log('Patched scratch-gui.js asset URLs → /internalapi/asset/')
  }
}

if (!existsSync(dist)) {
  console.error('scratch-host dist/ not found. Run pnpm --filter scratch-host build first.')
  process.exit(1)
}

mkdirSync(target, { recursive: true })
for (const name of readdirSync(target)) {
  if (PRESERVE.has(name)) continue
  rmSync(path.join(target, name), { recursive: true, force: true })
}
cpSync(dist, target, { recursive: true })
if (existsSync(bundledAssetSource)) {
  const assetTarget = path.join(target, 'assets')
  mkdirSync(assetTarget, { recursive: true })
  cpSync(bundledAssetSource, assetTarget, { recursive: true })
}
patchScratchGuiAssetUrls(target)
console.log(`Copied scratch-host dist → ${target}`)
