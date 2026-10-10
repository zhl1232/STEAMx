import type { LdrawBom } from '@/lib/utils/ldraw-bom'
import { mergeLessonMaterialPreferences } from '@/lib/courses/lesson-material-preferences'
import {
  compareLessonMaterials,
  mergeKitInventories,
  type MaterialRequirement,
} from '@/lib/courses/lesson-materials'

export function LessonMaterialsPreparation({
  courseId,
  bom,
}: {
  courseId: number
  bom: LdrawBom
}) {
  const prefs = mergeLessonMaterialPreferences(courseId)
  if (!prefs.kits.length) return null

  const result = compareLessonMaterials(bom, mergeKitInventories(prefs.kits), prefs)

  return (
    <section
      className="surface-card mt-6 rounded-xl p-5 md:p-7"
      aria-labelledby="kit-comparison-heading"
    >
      <h2 id="kit-comparison-heading" className="text-lg font-bold text-foreground">
        套装对比
      </h2>
      <p className="mt-2 text-sm text-muted-foreground">
        参考库存：{prefs.kits.map((kit) => `${kit.setNum} × ${kit.copies} 套`).join(' + ')}。
      </p>
      {courseId === 6 ? (
        <p className="mt-1 text-sm text-muted-foreground">
          工程搭建可参考 45002。Toolo 指零件形态，具体连接件仍需逐件核对。
        </p>
      ) : null}
      <p className="mt-2 text-sm leading-6 text-muted-foreground">
        默认接受换色与印花替代；展示用底板可选。人物按「完整小人」折算（头、身体、手臂、腿等散件合并计数），用套装里的完整小人抵扣。按整套库存估算，请先核对家里已有零件，再决定补买。
      </p>

      {result.figureDemand > 0 ? (
        <p className="mt-3 rounded-md bg-muted/60 px-3 py-2 text-sm text-foreground">
          本课折算需要 <strong>{result.figureDemand}</strong> 个完整小人
          {result.stats.requiredMissing === 0 ||
          !result.requiredMissing.some((e) => e.partId.includes('__duplo_child_figure__'))
            ? '，套装数量够用。'
            : '；若下方「缺件」列出小人，表示套装里的小人还不够。'}
        </p>
      ) : null}

      <div className="mt-5 rounded-md border border-destructive/30 p-4">
        <h3 className="font-bold text-foreground">
          缺件（必需） · {result.stats.requiredMissing} 块
        </h3>
        <Rows entries={result.requiredMissing} empty="已识别的必需零件数量够用。" />
      </div>

      <div className="mt-5">
        <h3 className="font-semibold text-foreground">
          可换色 / 印花与近义替代 · {result.stats.substituted} 块
        </h3>
        <Rows entries={result.colorSubstitutes} substitute empty="无需替代。" />
      </div>

      <div className="mt-5">
        <h3 className="font-semibold text-foreground">
          建议补齐的可选底板 · {result.stats.optionalMissing} 块
        </h3>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">
          可按展示需要准备，不计入上面的必需缺件；起连接作用的底板需保留。
        </p>
        <Rows entries={result.optionalMissing} empty="没有待补齐的可选底板。" />
      </div>

      {result.stats.unknown > 0 ? (
        <div className="mt-5">
          <h3 className="font-semibold text-foreground">
            套装中暂无对应零件 · {result.stats.unknown} 块
          </h3>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            多为本地特殊件或未收录的异形件，无法用当前教育套装抵扣，需要另行准备。
          </p>
          <Rows entries={result.unknown} empty="" />
        </div>
      ) : null}
    </section>
  )
}

function Rows({
  entries,
  empty,
  substitute = false,
}: {
  entries: MaterialRequirement[]
  empty: string
  substitute?: boolean
}) {
  if (!entries.length) {
    return empty ? <p className="mt-2 text-sm text-muted-foreground">{empty}</p> : null
  }
  return (
    <ul className="mt-2 space-y-2">
      {entries.map((entry) => (
        <li
          key={`${entry.partId}|${entry.colorCode}`}
          className="text-sm leading-6 text-foreground"
        >
          {entry.colorName} {entry.partName}{' '}
          <span className="text-xs text-muted-foreground">（{entry.partId}）</span>：
          {substitute ? `可替代 ${entry.substituted}` : `待准备 ${entry.missing}`} 块
          {substitute ? (
            <span className="block text-xs text-muted-foreground">
              可用：
              {entry.allocations
                .filter((a) => a.substitute)
                .map((a) => `${a.colorName} ${a.partNum} × ${a.quantity}`)
                .join('、')}
            </span>
          ) : null}
        </li>
      ))}
    </ul>
  )
}
