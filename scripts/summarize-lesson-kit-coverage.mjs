/** Run: node scripts/summarize-lesson-kit-coverage.mjs */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
// Reuse the project's Vitest/Vite toolchain without adding a runtime dependency.
const require = createRequire(import.meta.url)
const vitestRequire = createRequire(require.resolve('vitest/package.json'))
const { createServer } = await import(vitestRequire.resolve('vite'))
const vite = await createServer({ configFile: false, server: { middlewareMode: true, watch: null }, resolve: { alias: { '@': process.cwd() } } })
try {
const { summarizePackedLdrawBom } = await vite.ssrLoadModule('/lib/utils/ldraw-bom.ts')
const { compareLessonMaterials, mergeKitInventories } = await vite.ssrLoadModule('/lib/courses/lesson-materials.ts')
const { mergeLessonMaterialPreferences } = await vite.ssrLoadModule('/lib/courses/lesson-material-preferences.ts')
const prefs = mergeLessonMaterialPreferences(5)
const inventory = mergeKitInventories(prefs.kits)
const files = readdirSync('public/courses/ldraw').filter(f => /^3-.*\.mpd$/.test(f)).sort()
const missing = new Map()
const unknown = new Set()
let zero = 0
let complete = 0
for (const file of files) {
  const bom = summarizePackedLdrawBom(readFileSync(`public/courses/ldraw/${file}`, 'utf8'))
  const result = compareLessonMaterials(bom, inventory, prefs)
  if (!result.stats.requiredMissing) zero++
  if (!result.stats.requiredMissing && !result.stats.unknown) complete++
  const lessonMissing = new Map()
  for (const row of result.requiredMissing) lessonMissing.set(row.partId, (lessonMissing.get(row.partId) ?? 0) + row.missing)
  for (const [id, quantity] of lessonMissing) {
    const previous = missing.get(id) ?? { lessons: 0, quantity: 0 }
    missing.set(id, { lessons: previous.lessons + 1, quantity: previous.quantity + quantity })
  }
  for (const row of result.unknown) unknown.add(row.partId)
}
const top = [...missing].sort((a, b) => b[1].lessons - a[1].lessons || b[1].quantity - a[1].quantity || a[0].localeCompare(b[0])).slice(0, 10)
const report = `# 小班套装对比粗算\n\n库存：9090-2 + 9076-1，各 1 套。每课独立使用完整库存；默认接受换色/印花替代，可选底板不计入必需缺件，结构底板白名单为空。\n\n- 模型：${files.length} 课\n- requiredMissing=0：${zero} 课\n- 同时没有未知零件：${complete} 课\n\n零缺件不代表全部可搭；仍需检查未知零件与底板的实际连接作用。库存是预解析 Rebrickable 种子，未联网刷新，也不反映客户丢失的零件。\n\n| 缺件 TOP（按涉及课数） | 课数 | 缺少总块数 |\n| --- | ---: | ---: |\n${top.map(([id, value]) => `| ${id} | ${value.lessons} | ${value.quantity} |`).join('\n')}\n\n待人工核对：${[...unknown].sort().map(id => `\`${id}\``).join('、')}。人物散件与整个人物不是同一计数单位，小颗粒混入和本地简化件保留未知。\n\n中班工程搭建可参考 **45002-1**（文案为「工程搭建可参考 45002」）；Toolo 是零件形态。大班默认 9656-1。中班/大班本次只配置库存与默认套装，未做全课程人工映射验收。\n\n复现：\`node scripts/summarize-lesson-kit-coverage.mjs\`。\n`
writeFileSync('docs/courses/lesson-kit-coverage-small-class.md', report)
console.log(report)

} finally { await vite.close() }
