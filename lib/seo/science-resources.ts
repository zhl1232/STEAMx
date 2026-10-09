import type { Project } from '@/lib/mappers/types'
import { isPlaceholderProjectDescription, isPlaceholderProjectStep } from './project-description'

export function selectScienceResources(projects: Project[], limit = 6): Project[] {
  const unique = [...new Map(projects.map(project => [project.id, project])).values()]
  const complete = (project: Project) => (project.steps ?? []).some(step => !isPlaceholderProjectStep(step))
  return unique.filter(project => project.category === '科学')
    .sort((a, b) => Number(complete(b)) - Number(complete(a)))
    .slice(0, limit)
}

export function scienceResourceSummary(project: Project): string | undefined {
  return isPlaceholderProjectDescription(project.description, project.title)
    ? undefined : project.description?.trim()
}
