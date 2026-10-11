/** Run: node scripts/summarize-lesson-kit-coverage-middle-senior.mjs */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const vitestRequire = createRequire(require.resolve('vitest/package.json'))
const { createServer } = await import(vitestRequire.resolve('vite'))
const vite = await createServer({
  configFile: false,
  server: { middlewareMode: true, watch: null },
  resolve: { alias: { '@': process.cwd() } },
})
try {
  const { summarizePackedLdrawBom } = await vite.ssrLoadModule('/lib/utils/ldraw-bom.ts')
  const { compareLessonMaterials, mergeKitInventories, prepareLessonBomForCourse } = await vite.ssrLoadModule(
    '/lib/courses/lesson-materials.ts',
  )
  const { mergeLessonMaterialPreferences } = await vite.ssrLoadModule(
    '/lib/courses/lesson-material-preferences.ts',
  )
  const reports = []
  for (const [courseId, prefix, label] of [[6, '4-', '中班'], [7, '5-', '大班']]) {
    const prefs = mergeLessonMaterialPreferences(courseId)
    const inventory = mergeKitInventories(prefs.kits)
    const files = readdirSync('public/courses/ldraw')
      .filter((f) => f.startsWith(prefix) && f.endsWith('.mpd'))
      .sort()
    const missing = new Map()
    const unknown = new Map()
    let zero = 0
    let complete = 0
    for (const file of files) {
      const bom = summarizePackedLdrawBom(readFileSync(`public/courses/ldraw/${file}`, 'utf8'))
      const result = compareLessonMaterials(prepareLessonBomForCourse(courseId, bom), inventory, prefs)
      if (!result.stats.requiredMissing) zero++
      if (!result.stats.requiredMissing && !result.stats.unknown) complete++
      const lessonMissing = new Map()
      for (const row of result.requiredMissing) {
        lessonMissing.set(row.partId, (lessonMissing.get(row.partId) ?? 0) + row.missing)
      }
      for (const [id, quantity] of lessonMissing) {
        const previous = missing.get(id) ?? { lessons: 0, quantity: 0 }
        missing.set(id, { lessons: previous.lessons + 1, quantity: previous.quantity + quantity })
      }
      const seenU = new Set()
      for (const row of result.unknown) {
        const previous = unknown.get(row.partId) ?? { lessons: 0, quantity: 0, name: row.partName }
        if (!seenU.has(row.partId)) {
          previous.lessons += 1
          seenU.add(row.partId)
        }
        previous.quantity += row.missing || row.count
        unknown.set(row.partId, previous)
      }
    }
    const top = [...missing]
      .sort(
        (a, b) =>
          b[1].lessons - a[1].lessons || b[1].quantity - a[1].quantity || a[0].localeCompare(b[0]),
      )
      .slice(0, 10)
    const unknownRows = [...unknown].sort(
      (a, b) => b[1].lessons - a[1].lessons || b[1].quantity - a[1].quantity,
    )
    const report = `## ${label}（课程 ${courseId}）

库存：${prefs.kits.map(({ setNum, copies }) => `${setNum} × ${copies}`).join(' + ')}。每课独立使用完整库存；默认接受换色/印花替代。51262（8×8 薄板，含 System 替身 41539）同号同色出现在 stepIndex > 0 的步骤时按结构件计入必需缺件；仅用于第 0 步时仍为可选。普通分配后，必需的 51262 缺口可用剩余 4672（4×8，32 凸点）和 6490（8×16，128 凸点）按每块 64 凸点覆盖；先同色，再按换色偏好用其它颜色，每轮先 4×8 后 8×16，整块消耗且多余面积不复用，不使用 44524（2×8）。覆盖部分进入替代清单，不计入必需缺件。4268（24×24 底板，含替身 3811）保持可选，不计入必需缺件；手动结构底板白名单为空。人物散件折算为完整小人后与套装小人抵扣。

- 模型：${files.length} 课
- requiredMissing=0：${zero} 课
- 同时没有未知零件：${complete} 课
- 仍未知的零件种类：${unknownRows.length}

零缺件不代表全部可搭；结构件识别依据分步位置，仍需核对实际搭建中的连接和支撑。库存是预解析 Rebrickable 种子，未联网刷新，也不反映客户丢失的零件。

| 缺件 TOP（按涉及课数） | 课数 | 缺少总块数 |
| --- | ---: | ---: |
${top.map(([id, value]) => `| ${id} | ${value.lessons} | ${value.quantity} |`).join('\n')}

### 仍未知（无法用当前套装映射）

${
  unknownRows.length
    ? unknownRows
        .map(
          ([id, value]) =>
            `- \`${id}\`：${value.lessons} 课，共 ${value.quantity} 块（${value.name}）`,
        )
        .join('\n')
    : '无。'
}

人物库存包含四套教育套装中的完整小人（含成人）。

复现：\`node scripts/summarize-lesson-kit-coverage-middle-senior.mjs\`。
`
    reports.push(report)
  }
  const report = '# 中班 / 大班套装对比粗算\n\n' + reports.join('\n')
  writeFileSync('docs/courses/lesson-kit-coverage-middle-senior.md', report)
  console.log(report)
} finally {
  await vite.close()
}
