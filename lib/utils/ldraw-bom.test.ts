/** @vitest-environment node */

import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import {
  describeLdrawColorName,
  describeLdrawPartName,
  parseLdrawColorTable,
  summarizePackedLdrawBom,
} from '@/lib/utils/ldraw-bom'
import { getPackedLdrawStepCount } from '@/lib/utils/ldraw-mpd'
import { prepareLessonBomForCourse } from '@/lib/courses/lesson-materials'

const LDRAW_DIRECTORY = path.resolve(process.cwd(), 'public/courses/ldraw')

const COLOR_TABLE = parseLdrawColorTable(
  [
    '0 !COLOUR Blue    CODE   1   VALUE #1E5AA8   EDGE #333333',
    '0 !COLOUR Yellow  CODE  14   VALUE #FAC80A   EDGE #333333',
    '0 !COLOUR Light_Bluish_Grey CODE 71 VALUE #969696 EDGE #333333',
  ].join('\n'),
)

/** 两步搭建：黄色 2x4 砖 ×2 + 蓝色 2x2 砖 ×1，另含一个不计数的图元。 */
const FIXTURE_MPD = [
  '0 FILE demo.ldr',
  '0 Demo model',
  '0 !LDRAW_ORG Model',
  '1 14 0 0 0 1 0 0 0 1 0 0 0 1 3011.dat',
  '1 14 80 0 0 1 0 0 0 1 0 0 0 1 3011.dat',
  '0 STEP',
  '1 1 0 -48 0 1 0 0 0 1 0 0 0 1 3437.dat',
  '1 0 0 -48 40 1 0 0 0 1 0 0 0 1 4-4ndis.dat',
  '0 STEP',
  '',
  '0 FILE 3011.dat',
  '0 Duplo Brick  2 x  4',
  '0 !LDRAW_ORG Part UPDATE 2020-01',
  '4 16 0 0 0 1 0 0 1 1 0 0 1 0',
  '',
  '0 FILE 3437.dat',
  '0 Duplo Brick  2 x  2',
  '0 !LDRAW_ORG Part UPDATE 2020-03',
  '4 16 0 0 0 1 0 0 1 1 0 0 1 0',
  '',
  '0 FILE 4-4ndis.dat',
  '0 Disc Negative 1.0',
  '0 !LDRAW_ORG Primitive UPDATE 2012-01',
  '4 16 0 0 0 1 0 0 1 1 0 0 1 0',
].join('\n')

describe('summarizePackedLdrawBom', () => {
  it('按 0 STEP 统计每步新增零件与整课总数', () => {
    const bom = summarizePackedLdrawBom(FIXTURE_MPD, COLOR_TABLE)

    expect(bom.stepCount).toBe(2)
    expect(bom.steps.map((step) => step.partCount)).toEqual([2, 1])
    expect(bom.partCount).toBe(3)
    expect(bom.kindCount).toBe(2)
    expect(bom.steps[0].entries).toEqual([
      {
        partId: '3011.dat',
        partName: '2×4 积木',
        partDescription: 'Duplo Brick  2 x  4',
        colorCode: 14,
        colorName: '黄色',
        colorHex: '#FAC80A',
        count: 2,
      },
    ])
  })

  it('不把 LDraw 图元/子件算成一块零件', () => {
    const bom = summarizePackedLdrawBom(FIXTURE_MPD, COLOR_TABLE)

    expect(bom.steps[1].partCount).toBe(1)
    expect(bom.entries.map((entry) => entry.partId)).not.toContain('4-4ndis.dat')
  })

  it('同一零件不同颜色分别成行，全模型汇总按数量降序', () => {
    const mpd = FIXTURE_MPD.replace(
      '1 1 0 -48 0 1 0 0 0 1 0 0 0 1 3437.dat',
      ['1 1 0 -48 0 1 0 0 0 1 0 0 0 1 3011.dat', '1 14 80 -48 0 1 0 0 0 1 0 0 0 1 3011.dat'].join('\n'),
    )
    const bom = summarizePackedLdrawBom(mpd, COLOR_TABLE)

    expect(bom.entries.map((entry) => [entry.colorName, entry.count])).toEqual([
      ['黄色', 3],
      ['蓝色', 1],
    ])
  })

  it('跟随 ~Moved to 占位块取到新零件名', () => {
    const mpd = [
      '0 FILE demo.ldr',
      '1 14 0 0 0 1 0 0 0 1 0 0 0 1 2301.dat',
      '0 STEP',
      '',
      '0 FILE 2301.dat',
      '0 ~Moved to 2301b',
      '0 !LDRAW_ORG Part Alias UPDATE 2012-01',
      '1 16 0 0 0 1 0 0 0 1 0 0 0 1 2301b.dat',
      '',
      '0 FILE 2301b.dat',
      '0 Duplo Brick  2 x  3 x  2 with Inside Curve',
      '0 !LDRAW_ORG Part UPDATE 2012-01',
      '4 16 0 0 0 1 0 0 1 1 0 0 1 0',
    ].join('\n')

    expect(summarizePackedLdrawBom(mpd, COLOR_TABLE).entries[0]).toMatchObject({
      partId: '2301.dat',
      partName: '2×3×2 积木',
    })
  })

  it('缺配色表时仍统计数量，颜色名退回色号', () => {
    const bom = summarizePackedLdrawBom(FIXTURE_MPD)

    expect(bom.partCount).toBe(3)
    expect(bom.entries[0]).toMatchObject({ colorName: '色号 14', colorHex: '#94a3b8' })
  })

  it('步骤下标与 3D 分步一致：Studio 末尾收尾行留下的空步骤按 0 块统计', () => {
    const mpd = FIXTURE_MPD.replace(
      '0 STEP\n\n0 FILE 3011.dat',
      '0 STEP\n0 STEP\n0 NOFILE\n\n0 FILE 3011.dat',
    )
    const bom = summarizePackedLdrawBom(mpd, COLOR_TABLE)

    expect(bom.stepCount).toBe(getPackedLdrawStepCount(mpd))
    expect(bom.steps.map((step) => step.partCount)).toEqual([2, 1, 0, 0])
    expect(bom.partCount).toBe(3)
  })

  it('总块数与模型自带的 0 NumOfBricks 声明一致', () => {
    const colorTable = parseLdrawColorTable(
      readFileSync(path.join(LDRAW_DIRECTORY, 'LDConfig.ldr'), 'utf8'),
    )
    const mismatches: string[] = []
    let checked = 0

    for (const file of readdirSync(LDRAW_DIRECTORY).filter((name) => name.endsWith('.mpd'))) {
      const mpdText = readFileSync(path.join(LDRAW_DIRECTORY, file), 'utf8')
      const declared = mpdText.match(/^0 NumOfBricks (\d+)/m)?.[1]
      if (!declared) continue

      checked += 1
      const counted = summarizePackedLdrawBom(mpdText, colorTable).partCount
      // 不一致说明统计口径变了，或模型改过零件却没更新头部声明。
      if (Number(declared) !== counted) {
        mismatches.push(`${file}: 声明 ${declared} / 统计 ${counted}`)
      }
    }

    expect(mismatches).toEqual([])
    expect(checked).toBeGreaterThan(20)
  })

  it('统计线上课时模型（3+ 蝴蝶）的分步用量', () => {
    const mpdText = readFileSync(path.join(LDRAW_DIRECTORY, '3-hu-die.mpd'), 'utf8')
    const colorTable = parseLdrawColorTable(
      readFileSync(path.join(LDRAW_DIRECTORY, 'LDConfig.ldr'), 'utf8'),
    )
    const bom = summarizePackedLdrawBom(mpdText, colorTable)

    expect(bom.stepCount).toBe(getPackedLdrawStepCount(mpdText))
    expect(bom.steps.map((step) => step.partCount)).toEqual([2, 2, 3, 2, 3, 4, 5, 4, 4, 6])
    expect(bom.partCount).toBe(35)
    expect(bom.entries[0]).toMatchObject({
      partName: '2×4 积木',
      colorName: '红色',
      count: 12,
    })
  })
})

describe('describeLdrawPartName', () => {
  it.each([
    ['76395.dat', 'Toolo 4 x 6 x 1 (Local simplified part)', '4×6 螺丝积木'],
    ['parts\\31196C01.DAT', 'LOCAL SIMPLIFIED photo-informed geometry', '驾驶舱'],
    ['6527', 'Duplo Wheel with 2 Belt Groves', '皮带轮'],
    ['75349.dat', 'Duplo Brick 2 x 4 with Holes', '2×4 带孔积木'],
    ['6517.dat', '', '2×4 带孔积木'],
    ['6524.dat', '', '7 孔梁'],
    ['76395-001.dat', 'Toolo76395 independent captive screw states 001', '4×6 螺丝积木'],
    ['76395-010.dat', 'Toolo76395 independent captive screw states 010', '4×6 螺丝积木'],
    ['76395-011.dat', 'Toolo76395 independent captive screw states 011', '4×6 螺丝积木'],
    ['76395-100.dat', 'Toolo76395 independent captive screw states 100', '4×6 螺丝积木'],
    ['76395-110.dat', 'Toolo76395 independent captive screw states 110', '4×6 螺丝积木'],
    ['76395-001-p001.dat', 'Toolo76395 captive states001 phase001', '4×6 螺丝积木'],
    ['76395-110-p110.dat', 'Toolo76395 captive states110 phase110', '4×6 螺丝积木'],
    ['76395-110-phase01.dat', 'Toolo76395 independent captive screw states 110', '4×6 螺丝积木'],
    ['76395-110-phase10.dat', 'Toolo76395 independent captive screw states 110', '4×6 螺丝积木'],
    ['31196c01-qst.dat', 'Duplo Toolo Cockpit 4 x 6 - submarine courseware outer-wing approximation', '驾驶舱'],
    ['31239c01.dat', 'Toolo 31239c01 fixed-axis captive assembly', '尾翼'],
    ['14094.dat', 'Duplo Small Tipper Bucket Bed with Lip and Cutout', '翻斗车斗'],
    ['2223.dat', 'Duplo2223 ladder stand source-approved approximation with underside stud recesses', '梯子支架'],
    ['6669c01.dat', 'Toolo SMALL three-blade propeller6669c01 candidate', '小号三叶螺旋桨'],
    ['6670c01.dat', 'Toolo LARGE three-blade propeller candidate', '大号三叶螺旋桨'],
    ['4433c01-shou-ge-ji.dat', 'Duplo Toolo Exhaust Pipe (local approx of 4433c01)', '排气管'],
    ['45146-shou-ge-ji.dat', 'Duplo Windscreen Roll Cage 45146 (4-shou-ge-ji local approximation)', '挡风护架'],
    ['6295-ta-diao.dat', 'Duplo Toolo Arm with Fake Pulley and Hook (6295) - LOCAL APPROXIMATION', '带吊钩起重臂'],
    ['6310.dat', 'Duplo Toolo 6310 three-tooth scoop hand (local approximation)', '三齿铲斗'],
    ['31623.dat', 'Duplo Axle 8 with Gear 8 Tooth', '8 格轴（带 8 齿齿轮）'],
    ['31624.dat', 'Duplo Gearbox', '齿轮箱'],
    ['31625.dat', 'Duplo Worm Gear', '蜗杆'],
    ['61898b.dat', 'Sheet Plastic 13 x 26 Propeller', '13×26 塑料片螺旋桨'],
    ['61898bc01.dat', 'Sheet Plastic 13 x 26 Propeller (Formed)', '13×26 塑料片螺旋桨（成形）'],
  ])('按零件号 %s 优先使用家长可读名称', (id, description, expected) => {
    expect(describeLdrawPartName(description, id)).toBe(expected)
  })

  it('表外零件继续使用通用描述器', () => {
    expect(describeLdrawPartName('Duplo Brick 2 x 4', '3011.dat')).toBe('2×4 积木')
    expect(describeLdrawPartName('Unknown Part', 'unknown.dat')).toBe('Unknown Part')
    expect(describeLdrawPartName('Unknown Toolo variant', '76395-unverified.dat')).toBe('Unknown Toolo variant')
  })

  it.each([
    ['Duplo Brick  2 x  4', '2×4 积木'],
    ['Duplo Brick  2 x  3 with Curved Top', '2×3 积木（弧顶）'],
    ['Duplo Brick  2 x  2 with Eye Pattern on Two Sides', '2×2 积木（眼睛）'],
    ['Duplo Plate  4 x  8 with 11 Underside Studs with Supports', '4×8 薄板'],
    ['Duplo Car Base  2 x  6 with Yellow Wheels with Fake Bolts', '2×6 车底盘（带轮）'],
    ['Duplo Baseplate 24 x 24', '24×24 底板'],
    ['Duplo Ball Tube 45 Degrees', '滚球管（45°）'],
    ['Figure Duplo Adult Male with Cap', '人物（戴帽子）'],
    // 非 Duplo 的砖板要标出小颗粒，避免家长按大颗粒去找
    ['Baseplate 32 x 32', '32×32 小颗粒底板'],
    ['Brick  2 x  4', '2×4 小颗粒积木'],
  ])('%s → %s', (description, expected) => {
    expect(describeLdrawPartName(description)).toBe(expected)
  })

  it('认不出的零件保留官方英文描述', () => {
    expect(describeLdrawPartName('Technic Axle Connector')).toBe('Technic Axle Connector')
    expect(describeLdrawPartName('')).toBe('')
  })
})

describe('课程材料中文名称覆盖', () => {
  it.each([[5, '3-'], [6, '4-'], [7, '5-']] as const)(
    '课程 %i 的全部 %s 模型在准备后全课和分步清单均无英文名称',
    (courseId, prefix) => {
      const files = readdirSync(LDRAW_DIRECTORY).filter(
        (file) => file.startsWith(prefix) && file.endsWith('.mpd'),
      )
      expect(files.length).toBeGreaterThan(0)
      const failures: string[] = []
      for (const file of files) {
        const bom = prepareLessonBomForCourse(
          courseId,
          summarizePackedLdrawBom(readFileSync(path.join(LDRAW_DIRECTORY, file), 'utf8')),
        )
        expect(bom.entries.length, file).toBeGreaterThan(0)
        for (const entry of [...bom.entries, ...bom.steps.flatMap((step) => step.entries)]) {
          if (/[A-Za-z]{3,}/.test(entry.partName) || !/[\u3400-\u9fff]/.test(entry.partName)) {
            failures.push(`${file}: ${entry.partId} → ${entry.partName}`)
          }
        }
      }
      expect(failures).toEqual([])
    },
  )
})

describe('describeLdrawColorName', () => {
  it.each([
    ['Yellow', '黄色'],
    ['Light_Bluish_Grey', '浅灰色'],
    ['Bright_Light_Blue', '浅蓝色'],
    ['Dark_Turquoise', '深青色'],
    ['Lime', '黄绿色'],
    ['Trans_Red', '透明红色'],
  ])('%s → %s', (englishName, expected) => {
    expect(describeLdrawColorName(englishName)).toBe(expected)
  })

  it('认不出的色名保留英文', () => {
    expect(describeLdrawColorName('Rubber_Special')).toBe('Rubber Special')
  })
})

describe('parseLdrawColorTable', () => {
  it('读出色号与色值，忽略非颜色行', () => {
    const table = parseLdrawColorTable(
      ['0 // comment', '0 !COLOUR Red CODE 4 VALUE #b40000 EDGE #333333'].join('\n'),
    )

    expect(table.get(4)).toEqual({ name: 'Red', hex: '#B40000' })
    expect(table.size).toBe(1)
  })
})
