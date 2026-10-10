import type { LdrawBom } from '@/lib/utils/ldraw-bom'
import { mergeLessonMaterialPreferences } from '@/lib/courses/lesson-material-preferences'
import { compareLessonMaterials, mergeKitInventories, type MaterialRequirement } from '@/lib/courses/lesson-materials'

export function LessonMaterialsPreparation({ courseId, bom }: { courseId: number; bom: LdrawBom }) {
  const prefs = mergeLessonMaterialPreferences(courseId)
  if (!prefs.kits.length) return null
  const result = compareLessonMaterials(bom, mergeKitInventories(prefs.kits), prefs)
  return (
    <section className="surface-card mt-6 rounded-xl p-5 md:p-7" aria-labelledby="kit-comparison-heading">
      <h2 id="kit-comparison-heading" className="text-lg font-bold text-foreground">套装对比</h2>
      <p className="mt-2 text-sm text-muted-foreground">参考库存：{prefs.kits.map(kit => `${kit.setNum} × ${kit.copies} 套`).join(' + ')}。</p>
      {courseId === 6 ? <p className="mt-1 text-sm text-muted-foreground">工程搭建可参考 45002。Toolo 指零件形态，具体连接件仍需逐件核对。</p> : null}
      <p className="mt-2 text-sm leading-6 text-muted-foreground">默认接受换色与印花替代；展示用底板可选。按整套库存估算，请先核对家里已有零件，再决定补买。</p>
      <div className="mt-5 rounded-md border border-destructive/30 p-4">
        <h3 className="font-bold text-foreground">缺件（必需） · {result.stats.requiredMissing} 块</h3>
        <Rows entries={result.requiredMissing} empty="已识别的必需零件数量够用。" />
      </div>
      <div className="mt-5">
        <h3 className="font-semibold text-foreground">可换色 / 印花与近义替代 · {result.stats.substituted} 块</h3>
        <Rows entries={result.colorSubstitutes} substitute empty="无需替代。" />
      </div>
      <div className="mt-5">
        <h3 className="font-semibold text-foreground">建议补齐的可选底板 · {result.stats.optionalMissing} 块</h3>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">可按展示需要准备，不计入上面的必需缺件；起连接作用的底板需保留。</p>
        <Rows entries={result.optionalMissing} empty="没有待补齐的可选底板。" />
      </div>
      <div className="mt-5">
        <h3 className="font-semibold text-foreground">未能识别 / 待核对 · {result.stats.unknown} 块</h3>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">人物配件可参考手里的整个人物；未识别的零件尚未计入缺件，请对照模型确认。</p>
        <Rows entries={result.unknown} empty="本课零件均已纳入对照。" />
      </div>
    </section>
  )
}
function Rows({ entries, empty, substitute = false }: { entries: MaterialRequirement[]; empty: string; substitute?: boolean }) {
  if (!entries.length) return <p className="mt-2 text-sm text-muted-foreground">{empty}</p>
  return <ul className="mt-2 space-y-2">{entries.map(entry => <li key={`${entry.partId}|${entry.colorCode}`} className="text-sm leading-6 text-foreground">
    {entry.colorName} {entry.partName} <span className="text-xs text-muted-foreground">（{entry.partId}）</span>：{substitute ? `可替代 ${entry.substituted}` : `待准备 ${entry.missing}`} 块
    {substitute ? <span className="block text-xs text-muted-foreground">可用：{entry.allocations.filter(a => a.substitute).map(a => `${a.colorName} ${a.partNum} × ${a.quantity}`).join('、')}</span> : null}
  </li>)}</ul>
}
