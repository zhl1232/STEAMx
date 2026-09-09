import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { randomUUID } from 'node:crypto'

export const LDRAW_REVIEW_CANDIDATES = [
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
