import protectedModels from '../../scripts/ldraw-production-protected.json'
import { mkdir, readdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { randomUUID } from 'node:crypto'

export const LDRAW_REVIEW_CANDIDATES = [
  // 151 pieces / 8 source steps; 10 classified native mating contacts; axle lengths and hidden color seams inferred.
  '5-tuo-luo-da-zhan.ldr',
  // 70 pieces / 10 source steps; 48 classified static mating contacts; axle length and hidden base seams inferred.
  '5-ping-heng-cheng.ldr',
  // 68 pieces / 9 steps; 14 classified mating contacts; axle length and hidden seams inferred.
  '5-du-lun-shou-tui-che.ldr',
  // 139 pieces / 10 steps; exact native contact classification, inferred rear roof bonding.
  '5-shen-suo-men.ldr',
  // 56 pieces / 10 source steps; 22 classified mating contacts; inferred insertion depths.
  '5-shi-zi-zha-men.ldr',
  // 98 pieces / 11 source steps; 24 classified mating contacts; physical retention untested.
  '5-da-bai-chui.ldr',
  // 26 pieces/9 steps; 24 joint/support checks; documented source-seated hinge/plate mesh-fit exception.
  '4-tai-yang-neng-re-shui-qi.ldr',
  '4-tian-ping.ldr',
  '4-ji-ta.ldr',
  '4-gong-jian.ldr',
  '4-zhang-yu.ldr',
  '4-er-tong-hua-ban-che.ldr',
  '4-luo-tuo.ldr',
  '4-hu-die.ldr',
  '4-xian-wei-jing.ldr',
  '4-fei-die.ldr',
  '4-wan-long.ldr',
  '4-la-ji-fen-lei.ldr',
  // 299 pieces/14 steps; inferred water layout and documented eccentric simplified joints.
  '4-xie-la-qiao.ldr',
  '4-da-zha-xie.ldr',
  '4-feng-che-fang.ldr',
  '4-gou-wu-che.ldr',
  '4-wang-yuan-jing.ldr',
  '4-ying-er-che.ldr',
  '4-wai-xing-tan-ce-qi.ldr',
  '4-han-xue-bao-ma.ldr',
  '4-fan-chuan.ldr',
  '4-sun-wu-kong.ldr',
  '4-tuo-niao.ldr',
  '4-pang-xie.ldr',
  '4-re-qi-qiu.ldr',
  '4-she-xiang-ji.ldr',
  '4-huang-bao-che.ldr',
  '4-jiu-hu-che.ldr',
  '4-hua-kai-hua-luo.ldr',
  '4-gao-tie-zhan.ldr',
  '4-tan-ke.ldr',
  '4-hai-shi.ldr',
  '4-lan-qiu-jia.ldr',
  '4-shuang-ceng-ba-shi.ldr',
  '4-long-zhou.ldr',
  '4-xuan-zhuan-mu-ma.ldr',
  '4-wa-tu-ji.ldr',
  '4-fan-dou-che.ldr',
  '4-shi-zi-wang.ldr',
  // 123 pieces/15 source steps; gravity contacts and documented rim/canopy fit exceptions.
  '4-huo-jian.ldr',
  '4-tai-deng.ldr',
  // 64 pieces/13 steps; 264 mesh pairs clear, 14 joint/mount checks; inferred 25-degree pose.
  '4-lei-da.ldr',
  // 49 pieces/9 steps; 123 mesh pairs clear and 18 anchors aligned; inferred rear screw seating.
  '4-shu-bao.ldr',
  // 72 pieces/17 steps; tripod and holder contacts checked; documented elbow connector exception.
  '4-zhao-xiang-ji.ldr',
  // 106 pieces/11 steps; 324 mesh pairs clear and four axes aligned; inferred concealed bonds.
  '4-lu-yin-ji.ldr',
  // 90 pieces/13 steps; full mesh clear, eight joint/mount checks; inferred side fastening.
  '4-xing-li-xiang.ldr',
  // 46 pieces/10 steps; four mesh contacts; three documented pipe connector mating exceptions.
  '4-dian-hua-ji.ldr',
  // 72 pieces/9 steps; tripod/panel joints checked; separate flat palette, inferred poses.
  '4-hua-ban.ldr',
  // 74 pieces/13 steps; 272 mesh pairs clear; enclosure corner fasteners inferred.
  '4-deng-long.ldr',
  // 60 pieces/11 source steps; six hinge axes aligned, full 198-pair mesh clear; hidden bonds inferred.
  // 2026-09-27: 77 placements/12 steps; repaired arms, outward hubs and child facing; documented mating-mesh exceptions.
  '4-ban-gong-yi.ldr',
  // 145 parts/18 source steps; three tripod joints aligned, full 379-pair mesh clear; inferred foot locations.
  '4-dong-fang-ming-zhu.ldr',
  // 53 parts/11 source steps; complete local candidate, separate handheld bow and inferred screw fits.
  '4-er-hu.ldr',
  // 2026-09-27: 56 placements/11 source steps; 40 joint checks and full mesh reviewed, approximate Toolo fit.
  '4-da-wen-zi.ldr',
  // 2026-09-27: 42 placements/13 source steps; authorized6294 ears, inferred hidden cover pair; one45002 kit short1 scoop.
  '4-chong-wu-gou.ldr',
  // 2026-09-27: 52 placements/9 source steps; approximate Toolo joints, centre curve height inferred.
  '4-bao-jian.ldr',
  // 2026-09-27: 29 placements/13 source steps; corrected turntable pedestal, inferred Toolo retention.
  '4-ba-wang-long.ldr',
  // 2026-09-27: 78 placements/10 source steps; inferred hinge-retained ramp and fixed-belt geometry.
  '4-an-jian-ji.ldr',
  // User requested visual acceptance, 2026-09-15.
  '3-da-xiang.ldr',
  '3-da-xiong-mao.ldr',
  '3-deng-ta.ldr',
  '3-dian-hua-ji.ldr',
  '3-gao-er-fu-qiu.ldr',
  '3-guan-dao-gou.ldr',
  '3-guan-guang-che.ldr',
  '3-hai-yang-shi-jie.ldr',
  '3-hua-lan.ldr',
  // Source corrections and recursive mesh/renderer review, 2026-09-14.
  '3-ai-fei-er-tie-ta.ldr',
  '3-dian-ying-yuan.ldr',
  // User requested visual review with known geometry issues retained.
  '3-cheng-bao.ldr',
  '3-lao-qiu-bi-sai.ldr',
  '3-tiao-shui-chi.ldr',
  '3-xiang-pi-ting.ldr',
  '3-xiao-fang-che.ldr',
  '3-xiao-huo-che.ldr',
  '3-you-er-yuan.ldr',
  '3-tu-shu-jia.ldr',
  '3-kua-hai-da-qiao.ldr',
  // 112 pieces, full source review; hidden stacked plates inferred, propped lid retention unmeasured.
  '3-chou-ti.ldr',
  '3-ji-jiu-bao.ldr',
  '3-wo-shi-xiao-chu-shi.ldr',
  '3-ju-ji-qiang.ldr',
  '3-wu-long.ldr',
  '3-xue-gao-che.ldr',
  '3-chang-jing-lu.ldr',
  '3-chong-wu-gou.ldr',
  '3-jing-che.ldr',
  '3-ma-che.ldr',
  '3-you-guan-che.ldr',
  '3-xiao-qiu-jie-li-sai.ldr',
  '3-hua-hua-ti.ldr',
  '3-tan-ke.ldr',
  '3-chang-jing-long.ldr',
  '3-gang-qin.ldr',
  // All 11 source pages reviewed; 123 pieces, 170 mesh pairs clear, connected stud grid.
  '3-la-gan-xiang.ldr',
  // Six flower anchors corrected against source; 172 mesh pairs clear, stud seating verified.
  '3-liu-bing-xie.ldr',
  // All 10 source pages reviewed; 121 pieces, 206 mesh pairs clear, stud seating verified.
  '3-dong-fang-ming-zhu.ldr',
  // All 12 source pages reviewed; 272 pieces, 432 mesh pairs clear; flag clip box warnings verified.
  '3-cheng-qiang.ldr',
  // All 14 source pages reviewed; 77 pieces, 104 mesh pairs clear; sword rests on both supports.
  '3-bao-jian.ldr',
  // Source reviewed; wheel/stud and elbow/frame contact checked, physical retention unmeasured.
  '3-xi-che-chang.ldr',
  // Single-stud fences at 40 degrees; hidden bond/face inferred, official figure internal overlaps retained.
  '3-long-zhou.ldr',
  // Source reviewed; step15 crossbar temporarily held until step16, clutch strength unmeasured.
  '3-xun-lu-xue-qiao.ldr',
  // Complete source; one-stud foliage and rolling wheel support need physical review.
  '3-xiao-ya-zi-le-yuan.ldr',
  // Complete source inventory; hidden pond anchors remain image-guided.
  '3-xiao-ke-dou-zhao-ma-ma.ldr',
  // Source reviewed; cantilevered roof clutch strength remains unmeasured.
  '3-shi-bo-guan.ldr',
  // Full source inventory; inlet ball is a transient play pose, socket retention unmeasured.
  '3-xia-shui-dao.ldr',
  // Full source inventory; tube retention and hidden anchors remain manual review items.
  '3-shui-shang-le-yuan.ldr',
  // User-authorized approximate31453 rockers; physical balance remains unverified.
  '3-ping-heng-da-shi.ldr',
  '3-tui-la-men.ldr',
  '3-pang-xie.ldr',
  '3-pen-zai.ldr',
  '3-mei-li-de-xiao-qu.ldr',
  '3-ren-xing-tian-qiao.ldr',
  '3-sa-shui-hu.ldr',
  '3-shen-mi-de-jin-zi-ta.ldr',
  '3-shi-wai-ka-fei-zhuo.ldr',
  '3-zuo-yi.ldr',
  '3-li-he.ldr',
  '3-la-ji-tong.ldr',
  '3-you-xiang.ldr',
  '3-shou-dian-tong.ldr',
  '3-xiao-ti-deng.ldr',
  '3-xi-shou-tai.ldr',
  '3-hua-jiao.ldr',
  '3-zhao-xiang-ji.ldr',
  '3-yun-dou.ldr',
  '3-tai-qiu.ldr',
  '3-wan-sheng-jie-nan-gua-tou.ldr',
  '3-shu-zhuang-tai.ldr',
  '3-sheng-dan-lao-ren.ldr',
  '3-wo-niu.ldr',
  '3-tao-quan-quan.ldr',
  '3-zu-qiu-chang.ldr',
  '3-wu-gui.ldr',
  '3-wang-yuan-jing.ldr',
  '3-zhang-yu.ldr',
  '3-tui-tu-ji.ldr',
  '3-xi-chen-qi.ldr',
  '3-xiao-niao-gui-chao.ldr',
  '3-tian-e.ldr',
  // User requested this 118-part version for review; zebra panel intentionally omitted.
  '3-shu-kou-bei.ldr',
  '3-yu-gang.ldr',
  '3-shan-yang.ldr',
  // Full source inventory; hidden reef joins and scene anchors remain manual review items.
  '3-qian-shui-jing.ldr',
  '3-qiu-qian.ldr',
  // User requested the interlocking-wall variant; five roof flowers remain omitted.
  '3-shu-wu.ldr',
  // Photo-based cockpit and official canopy; snap fit and historical door provenance remain review items.
  '3-shuang-ceng-ba-shi.ldr',
  // Full inventory restored; cockpit anchor and snap retention remain manual review items.
  '3-qian-shui-ting.ldr',
  // Source rebuilt; local cockpit and rear-door pane layout need visual acceptance.
  '3-jiu-hu-che.ldr',
  // Collision-checked and source-reviewed; remaining limits are documented manual acceptance items.
  '3-gou-wu-che.ldr',
  '3-gui-zi.ldr',
  '3-hu-die.ldr',
  '3-huo-jian.ldr',
  '3-jiang-bei.ldr',
  '3-lan-qiu-chang.ldr',
  '3-liang-ting.ldr',
  '3-lun-chuan.ldr',
  '3-mao-mao-chong.ldr',
  // 2026-10-12: 129 课开发稿（docs/ldraw-rebuild-20261011/HANDOFF-129.md @4a0a4a90），供用户确认。
  // 54 个课件对照明显不对/小差异的已撤出待确认，见 scripts/ldraw-fixing-20261012.json（修复中）。
  '4-da-long-xia.ldr',
  '4-da-xiang.ldr',
  '4-ci-xuan-fu-lie-che.ldr',
  '4-mo-tian-lun.ldr',
  '4-yao-yao-ma.ldr',
  '4-ju-ji-qiang.ldr',
  '4-ke-ji.ldr',
  '4-shou-ge-ji.ldr',
  '4-tui-tu-ji.ldr',
  '4-tang-lang.ldr',
  '4-ji-guan-qiang.ldr',
  '4-jun-jian.ldr',
  '4-qian-shui-ting.ldr',
  '4-sheng-jiang-jiu-yuan-che.ldr',
  '4-ta-diao.ldr',
  '4-zhi-sheng-ji.ldr',
  '4-zuan-tu-che.ldr',
  '5-cha-che.ldr',
  '5-ci-xuan-fu-lie-che.ldr',
  '5-dan-che.ldr',
  '5-dan-gan-yun-dong-yuan.ldr',
  '5-di-qiu-yi.ldr',
  '5-diao-che.ldr',
  '5-diao-shan.ldr',
  '5-fan-dou-che.ldr',
  '5-feng-che-fang.ldr',
  '5-ge-cao-ji.ldr',
  '5-hai-dao-chuan.ldr',
  '5-hu-die.ldr',
  '5-hua-ban-che.ldr',
  '5-ji-xie-shou.ldr',
  '5-jiao-ban-qi.ldr',
  '5-kai-ye-zi-qi.ldr',
  '5-lan-che.ldr',
  '5-long-men-diao.ldr',
  '5-qiu-qian.ldr',
  '5-shuai-gan-ji.ldr',
  '5-shuang-kai-da-men.ldr',
  '5-si-qu-che.ldr',
  '5-ti-xian-mu-ou.ldr',
  '5-tian-ping.ldr',
  '5-tou-shi-che.ldr',
  '5-wo-lun-diao-qiao.ldr',
  '5-xi-yi-ji.ldr',
  '5-xiao-song-shu-qi-che.ldr',
  '5-xuan-zhuan-ai-xin.ldr',
  '5-xuan-zhuan-can-ting.ldr',
  '5-xuan-zhuan-men.ldr',
  '5-xuan-zhuan-mu-ma.ldr',
  '5-xuan-zhuan-wu-tai.ldr',
  '5-ya-lu-ji.ldr',
  '5-ya-mian-ji.ldr',
  '5-ya-shui-jing.ldr',
  '5-yan-jing-she.ldr',
  '5-yao-yao-che.ldr',
  '5-yi-dong-guang-gao-pai.ldr',
  '5-yu-er-de-wei-ba.ldr',
  '5-yu-hang-yuan-xun-lian-ji.ldr',
  // 2026-10-12 batch1 修好放回待确认：
  // 2026-10-12 batch2 修好放回待确认：
  // 2026-10-12 batch3 修好放回待确认：
  // 2026-10-12 batch4 修好放回待确认：
  // 2026-10-12 batch5 修好放回待确认：
  // 2026-10-12 batch6 修好放回待确认：
  // 2026-10-12 batch7 修好放回待确认：
  // 2026-10-13 hand review, camera calibrated to courseware final page; main parts match.
  '5-zhan-chi-gao-fei.ldr',
  '5-shou-tui-fei-ji.ldr',
  // 2026-10-13 rechecked against the real 5+ PDFs (camera-calibrated overlay).
  '5-shui-jing.ldr',
  '5-ta-diao.ldr',
  // 2026-10-13 night: v3 overlay vs courseware p16; side lever moved; main body/arm match.
  '5-huan-wei-che.ldr',
  // 2026-10-13 night: figures lowered, panes white; front overlay vs p14 matches main structure.
  '5-sheng-jiang-dian-ti.ldr',
  // 2026-10-13 night: orange scoops + side arm pose vs courseware p15; camera overlay approximate.
  '4-wa-li.ldr',
] as const

export type LdrawReviewStatus = 'confirmed' | 'changed' | 'unconfirmed' | 'untracked'

/** Compatibility for consumers of the former two review outcomes. */
export function legacyReviewStatusFor(status: LdrawReviewStatus): 'confirmed' | 'pending' {
  return status === 'confirmed' ? 'confirmed' : 'pending'
}
export interface LdrawReviewRecord {
  revision: string
  confirmedAt: string
}

const REVIEW_DIR = resolve(process.cwd(), 'scripts/ldraw-reviews')

export function isLdrawReviewCandidate(fileName: string): boolean {
  return (LDRAW_REVIEW_CANDIDATES as readonly string[]).includes(fileName)
}

async function readRecord(fileName: string): Promise<LdrawReviewRecord | null> {
  try {
    const parsed = JSON.parse(await readFile(resolve(REVIEW_DIR, `${fileName}.json`), 'utf8')) as Partial<LdrawReviewRecord>
    return typeof parsed.revision === 'string' && typeof parsed.confirmedAt === 'string' ? parsed as LdrawReviewRecord : null
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
    return null
  }
}

async function readRecords(): Promise<Record<string, LdrawReviewRecord>> {
  let files: string[]
  try {
    files = (await readdir(REVIEW_DIR)).filter((name) => name.endsWith('.ldr.json')).map((name) => name.slice(0, -5))
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
    return {}
  }
  const entries = await Promise.all(files.map(async (fileName) => ({ fileName, record: await readRecord(fileName) })))
  return entries.reduce<Record<string, LdrawReviewRecord>>((records, entry) => {
    if (entry.record) records[entry.fileName] = entry.record
    return records
  }, {})
}

export async function getLdrawReviewRecords() {
  return readRecords()
}

export async function confirmLdrawModel(fileName: string, revision: string): Promise<LdrawReviewRecord> {
  const record: LdrawReviewRecord = { revision, confirmedAt: new Date().toISOString() }
  const target = resolve(REVIEW_DIR, `${fileName}.json`)
  const temp = `${target}.${process.pid}.${randomUUID()}.tmp`
  await mkdir(dirname(target), { recursive: true })
  await writeFile(temp, `${JSON.stringify(record, null, 2)}\n`, 'utf8')
  await rename(temp, target)
  return record
}

export function isProductionProtected(fileName: string): boolean {
  return protectedModels.models.includes(fileName.replace(/\.ldr$/, ''))
}

export function reviewStatusFor(fileName: string, records: Record<string, LdrawReviewRecord>, revision?: string, frozenRevision?: string): LdrawReviewStatus {
  const record = records[fileName]
  if (!record) return isLdrawReviewCandidate(fileName) ? 'unconfirmed' : 'untracked'
  if (isProductionProtected(fileName)) return 'confirmed'
  return record.revision === revision || record.revision === frozenRevision ? 'confirmed' : 'changed'
}

export function reviewRecordFor(fileName: string, records: Record<string, LdrawReviewRecord>) {
  return records[fileName] ?? null
}
