import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { randomUUID } from 'node:crypto'

export const LDRAW_REVIEW_CANDIDATES = [
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

] as const

export type LdrawReviewStatus = 'pending' | 'confirmed' | 'untracked'
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
  const entries = await Promise.all(LDRAW_REVIEW_CANDIDATES.map(async (fileName) => ({ fileName, record: await readRecord(fileName) })))
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

export function reviewStatusFor(fileName: string, records: Record<string, LdrawReviewRecord>, revision?: string): LdrawReviewStatus {
  if (!isLdrawReviewCandidate(fileName)) return 'untracked'
  const record = records[fileName]
  return record && (!revision || record.revision === revision) ? 'confirmed' : 'pending'
}

export function reviewRecordFor(fileName: string, records: Record<string, LdrawReviewRecord>) {
  return records[fileName] ?? null
}
