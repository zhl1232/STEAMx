/** Cross-disciplinary exploration themes; independent of STEAM subjects and materials. */
export const LEARNING_THEMES = [
  { id: 'life-health', label: '生命健康' },
  { id: 'ecology', label: '生态环境' },
  { id: 'earth', label: '地球奥秘' },
  { id: 'aerospace', label: '航空航天' },
  { id: 'emerging-industry', label: '新兴产业' },
  { id: 'artificial-intelligence', label: '人工智能' },
] as const

export type LearningThemeId = typeof LEARNING_THEMES[number]['id']
export const LEARNING_THEME_TAGS: readonly string[] = LEARNING_THEMES.map(theme => theme.label)
export function isLearningThemeTag(tag: string): boolean {
  return LEARNING_THEME_TAGS.includes(tag)
}
