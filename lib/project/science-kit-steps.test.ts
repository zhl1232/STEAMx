import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

import reviewed from './science-reviewed.data.json'
import legacy from './science-samples.data.json'

const discouragingPhrases = [
  '暂不能直接跟做', '不能直接跟做', '尚未完善', '不凭画面猜测',
  '待核清', '以观看为主', '尚待补充', '操作资料补齐',
  '不是完整操作教程', '不照搬热水',
]
const patchedIds = [552, 642, 810, 822, 847, 869, 893, 907, 949, 964, 985, 1021, 1102, 1116, 1189]

function expectEncouraging(copy: string) {
  for (const phrase of discouragingPhrases) expect(copy).not.toContain(phrase)
}

describe('science kit instructions', () => {
  it.each([['reviewed', reviewed], ['legacy', legacy]] as const)('%s data avoids discouraging copy', (_, data) => {
    expectEncouraging(JSON.stringify(data))
  })

  it.each(patchedIds)('project %i has usable steps and refers to the manual for kit details', id => {
    const item = reviewed.find(row => row.id === id)!
    expect(item).toBeDefined()
    expect(item.steps.length).toBeGreaterThanOrEqual(4)
    expect(item.steps.map(step => step.title)).not.toContain('先记录准备中的问题')
    if (item.mode === 'preparation' || item.instructionGap) {
      expect(JSON.stringify(item.steps)).toContain('说明书')
    }
  })

  it.each([
    ['components/features/project/project-detail-actions.tsx', '查看材料与步骤无需登录；动手时按材料包里的说明书操作，用量和组装方式以说明书为准。'],
    ['components/features/project/project-detail-actions.tsx', '登录后可记录探索过程；动手时按材料包说明书一步步操作'],
    ['components/features/project/project-exploration-records.tsx', '按材料包说明书完成探索后，可以记录过程和发现。'],
    ['components/features/project/mobile-project-steps.tsx', '按材料包里的说明书一步步操作；用量、配比和组装方式以说明书为准。'],
    ['app/project/[id]/page.tsx', '按材料包里的说明书一步步操作；用量、配比和组装方式以说明书为准。'],
    ['lib/ai/tutor/context-builders.ts', '【项目定位】材料包实验：学生会收到材料包和说明书。可以按页面步骤讲解和引导动手；用量、配比、组装细节以材料包说明书为准，不要自行编造具体用量或配方，页面没写的细节提醒学生对照说明书或请家长帮忙。'],
  ])('%s keeps the approved manual guidance: %s', (file, copy) => {
    const source = readFileSync(resolve(process.cwd(), file), 'utf8')
    expect(source).toContain(copy)
    expect(copy).toContain('说明书')
    expectEncouraging(source)
  })
})
