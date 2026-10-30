import associations from './learning-theme-projects.data.json'
import { isLearningThemeTag } from './learning-themes'

const entries = new Map(associations.map(entry => [entry.id, entry]))

/** Explicit, reviewed associations only; never infer themes from title keywords. */
export function getLearningThemeProjectIds(tags: string[]): number[] {
  const themes = tags.filter(isLearningThemeTag)
  if (!themes.length) return []
  return associations.filter(entry => themes.every(theme => entry.themes.includes(theme))).map(entry => entry.id)
}

export function matchesLearningThemes(
  project: { id: string | number; title: string; category: string },
  tags: string[],
): boolean {
  const themes = tags.filter(isLearningThemeTag)
  if (!themes.length) return true
  const entry = entries.get(Number(project.id))
  return !!entry && entry.title === project.title && entry.category === project.category
    && themes.every(theme => entry.themes.includes(theme))
}
