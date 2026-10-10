import { getDefaultKitsForCourse, type KitSelection } from './course-kit-config'
export interface LessonMaterialPreferences {
  kits: KitSelection[]
  acceptColorSubstitutes: boolean
  includeOptionalBaseplates: boolean
  structuralBaseplates: string[]
}
/** 无持久化；所有套数必须为非负安全整数，0 表示不使用该套装。 */
export function mergeLessonMaterialPreferences(courseId: number, overrides: Partial<LessonMaterialPreferences> = {}): LessonMaterialPreferences {
  const prefs = { kits: getDefaultKitsForCourse(courseId), acceptColorSubstitutes: true, includeOptionalBaseplates: false, structuralBaseplates: [], ...overrides }
  return { ...prefs, structuralBaseplates: [...prefs.structuralBaseplates], kits: prefs.kits.map(kit => {
    if (!Number.isSafeInteger(kit.copies) || kit.copies < 0) throw new Error('套数须为非负整数')
    return { ...kit }
  }) }
}
