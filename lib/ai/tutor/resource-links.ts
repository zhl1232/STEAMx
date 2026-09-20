import { TUTOR_PLAYGROUND_GAME_KEYS } from '@/lib/ai/tutor/types'

export type TutorResourceKind = 'lesson' | 'challenge' | 'resource' | 'species' | 'game' | 'project' | 'course'

type ParsedTag = { kind: TutorResourceKind; id: string; title: string }

/** Recognize the envelope first; invalid IDs must not survive as clickable references. */
export const TUTOR_RESOURCE_TAG_REGEX = /\[(lesson|challenge|resource|species|game|project|course):([^|\]\n]+)\|([^\]\n]*)\]/gu
const KINDS = new Set<string>(['lesson', 'challenge', 'resource', 'species', 'game', 'project', 'course'])
const SPECIES_SLUG = /^[\p{L}\p{N}_-]+$/u

function numericId(value: string) {
  const number = Number(value)
  return /^\d+$/.test(value) && Number.isSafeInteger(number) && number > 0 ? String(number) : null
}

function normalizeId(kind: TutorResourceKind, value: string): string | null {
  if (kind === 'species') return SPECIES_SLUG.test(value) ? value : null
  if (kind === 'game') return (TUTOR_PLAYGROUND_GAME_KEYS as readonly string[]).includes(value) ? value : null
  if (kind === 'lesson') {
    const parts = value.split(':')
    if (parts.length !== 2) return null
    const course = numericId(parts[0]), lesson = numericId(parts[1])
    return course && lesson ? `${course}:${lesson}` : null
  }
  return numericId(value)
}

function plainTitle(value: string) {
  return value.replace(/[[\]|\r\n]/g, ' ').trim()
}

function validTitle(value: string) {
  return Boolean(value.trim()) && !/[[\]|\r\n]/.test(value)
    && !Array.from(value).some((character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127)
}

function parseTag(kind: string, rawId: string, title: string): ParsedTag | null {
  if (!KINDS.has(kind) || !validTitle(title)) return null
  const id = normalizeId(kind as TutorResourceKind, rawId)
  return id ? { kind: kind as TutorResourceKind, id, title: title.trim() } : null
}

function mapTags(text: string, callback: (tag: ParsedTag) => string) {
  return text.replace(TUTOR_RESOURCE_TAG_REGEX, (_raw, kind: string, id: string, title: string) => {
    const tag = parseTag(kind, id, title)
    return tag ? callback(tag) : plainTitle(title)
  })
}

export function tutorResourceHref(kind: TutorResourceKind, value: string) {
  const id = normalizeId(kind, value)
  if (!id) return ''
  if (kind === 'lesson') {
    const [course, lesson] = id.split(':')
    return `/courses/${course}/lessons/${lesson}`
  }
  const base = { challenge: '/pbl', resource: '/resources', species: '/nature/species', game: '/playground', project: '/project', course: '/courses' }
  return `${base[kind]}/${id}`
}

export function createTutorResourceTag(kind: TutorResourceKind, value: string | number, title: string): string {
  if (!KINDS.has(kind) || !validTitle(title)) return ''
  const id = normalizeId(kind, String(value))
  return id ? `[${kind}:${id}|${title.trim()}]` : ''
}

export function tutorResourceTagsToMarkdown(text: string) {
  return mapTags(text, (tag) => `[${tag.title.replace(/[\\`*_[\]()]|[#!+\-.>]/g, '\\$&')}](${tutorResourceHref(tag.kind, tag.id)})`)
}

/** Only server-validated resource tags grant a clickable destination in a reply. */
export function getTutorResourceHrefs(text: string): Set<string> {
  const hrefs = new Set<string>()
  mapTags(text, (tag) => {
    hrefs.add(tutorResourceHref(tag.kind, tag.id))
    return ''
  })
  return hrefs
}

export function stripTutorResourceTags(text: string) {
  return mapTags(text, (tag) => tag.title)
}

/** Each source is a complete trusted-context section, and may contain many references. */
export function validateTutorResourceTags(text: string, sources: string[]) {
  const canonical = new Map<string, string>()
  const byHref = new Map<string, string>()
  for (const source of sources) {
    for (const match of source.matchAll(new RegExp(TUTOR_RESOURCE_TAG_REGEX.source, 'gu'))) {
      const tag = parseTag(match[1], match[2], match[3])
      if (tag) {
        canonical.set(`${tag.kind}:${tag.id}`, tag.title)
        byHref.set(tutorResourceHref(tag.kind, tag.id), createTutorResourceTag(tag.kind, tag.id, tag.title))
      }
    }
  }
  const normalized = text.replace(/\[([^\]\n]*)\]\(([^)\n]*)\)/g, (_raw, label: string, href: string) =>
    byHref.get(href) ?? plainTitle(label),
  )
  return mapTags(normalized, (tag) => {
    const title = canonical.get(`${tag.kind}:${tag.id}`)
    return title ? createTutorResourceTag(tag.kind, tag.id, title) : plainTitle(tag.title)
  })
}

export function isTutorResourceHref(href: string) {
  let path: string
  try { path = decodeURIComponent(href) } catch { return false }
  const lesson = path.match(/^\/courses\/([^/]+)\/lessons\/([^/]+)$/)
  if (lesson) return normalizeId('lesson', `${lesson[1]}:${lesson[2]}`) !== null
  const match = path.match(/^\/(project|courses|pbl|resources|nature\/species|playground)\/([^/]+)$/)
  if (!match) return false
  const kinds: Record<string, TutorResourceKind> = { project: 'project', courses: 'course', pbl: 'challenge', resources: 'resource', 'nature/species': 'species', playground: 'game' }
  return normalizeId(kinds[match[1]], match[2]) !== null
}
