import { readdirSync, readFileSync } from 'node:fs'
import { expect, it } from 'vitest'
import { describeLdrawColorName, parseLdrawColorTable, summarizePackedLdrawBom } from '../utils/ldraw-bom'
import { KIT_CATALOG } from './course-kit-config'
import { mergeLessonMaterialPreferences } from './lesson-material-preferences'
import { compareLessonMaterials, mergeKitInventories, prepareLessonBomForCourse, sameDisplayColor, substituteDetail } from './lesson-materials'

const directory = 'public/courses/ldraw'
const colors = parseLdrawColorTable(readFileSync(`${directory}/LDConfig.ldr`, 'utf8'))
const files = readdirSync(directory).filter((file) => /^[345]-.*\.mpd$/.test(file) && !/-[a-f0-9]{8,}\.mpd$/.test(file))

it('all 160 lessons render only meaningful substitutions with default and all-four-kit inventories', () => {
  expect(files).toHaveLength(160)
  const failures: string[] = []
  for (const file of files) {
    const courseId = Number(file[0]) + 2
    const bom = prepareLessonBomForCourse(courseId, summarizePackedLdrawBom(readFileSync(`${directory}/${file}`, 'utf8'), colors))
    for (const prefs of [mergeLessonMaterialPreferences(courseId), mergeLessonMaterialPreferences(courseId, {
      kits: KIT_CATALOG.map(({ setNum }) => ({ setNum, copies: 1 })),
    })]) {
      const result = compareLessonMaterials(bom, mergeKitInventories(prefs.kits), prefs)
      for (const row of result.colorSubstitutes) {
        const detail = substituteDetail(row)
        const phrases = detail.replace(/^用 /, '').replace(/代替$/, '').split('、')
          .map((phrase) => phrase.replace(/\d+ 块/g, '').trim())
        if (new Set(phrases).size !== phrases.length) failures.push(`${file}: repeated phrase: ${detail}`)
        for (const a of row.allocations.filter((a) => a.substitute)) {
          if (a.partDifference === '不同图案的' && (a.partName ?? row.partName).includes('（眼睛）') &&
            sameDisplayColor(row, { ...a, name: a.partName ?? row.partName })) {
            failures.push(`${file}: same-color eye print reported as substitute: ${detail}`)
          }
          const color = describeLdrawColorName(a.colorName)
          if (color === row.colorName && !a.partDifference && (!a.areaLabel || a.areaLabel === row.partName)) {
            failures.push(`${file}: ${row.colorName}${row.partName} → ${detail}`)
          }
        }
        if (!detail || detail.includes(`可以用 ${row.colorName} `)) failures.push(`${file}: ${detail}`)
      }
    }
  }
  expect(failures).toEqual([])
}, 20_000)
