import { existsSync, readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'

import type { NatureTopicKey } from '@/lib/config/nature-topics'
import { rewriteAssetUrl } from '@/lib/utils/asset-url'

import type { SpeciesRow } from './nature-observation-internal-types'

function resolvePublicAssetUrl(rawUrl: string | null): string | null {
  if (!rawUrl) return null

  const trimmedUrl = rawUrl.trim()
  if (!trimmedUrl) return null

  if (/^https?:\/\//i.test(trimmedUrl)) {
    return trimmedUrl
  }

  if (!trimmedUrl.startsWith('/')) {
    return null
  }

  const relativePath = trimmedUrl.replace(/^\/+/, '')
  const absolutePath = path.join(process.cwd(), 'public', relativePath)
  if (existsSync(absolutePath)) {
    return trimmedUrl
  }

  const rewritten = rewriteAssetUrl(trimmedUrl)
  if (rewritten && /^https?:\/\//i.test(rewritten)) {
    return rewritten
  }

  return null
}

export function normalizeSpeciesRow(row: SpeciesRow): SpeciesRow {
  return {
    ...row,
    cover_image_url: resolvePublicAssetUrl(row.cover_image_url),
    audio_url: resolvePublicAssetUrl(row.audio_url),
  }
}

export function mapSpeciesRowWithCoverImages(row: SpeciesRow): {
  normalizedRow: SpeciesRow
  imageUrls: string[]
} {
  const normalizedRow = normalizeSpeciesRow(row)
  const imageUrls = getSpeciesImageUrls(row)
  const coverImageUrl = normalizedRow.cover_image_url ?? imageUrls[0] ?? null

  return {
    imageUrls,
    normalizedRow: {
      ...normalizedRow,
      cover_image_url: coverImageUrl,
    },
  }
}

const speciesImageDirectories: Partial<Record<NatureTopicKey, string>> = {
  birds: '/birds/images',
  insects: '/insects/images',
  plants: '/trees/images',
}

const speciesExtraImageDirectories: Partial<Record<NatureTopicKey, string[]>> = {
  plants: ['/fruits/images'],
}

const speciesManifestFiles: Partial<Record<NatureTopicKey, string[]>> = {
  birds: ['birds.json'],
  insects: ['insects.json'],
  plants: ['trees.json', 'fruits.json'],
}

const speciesImageExtensions = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif'])

type SpeciesImageManifest = Record<string, string[]>

const manifestCache = new Map<string, SpeciesImageManifest | null>()

function loadSpeciesImageManifest(manifestFile: string): SpeciesImageManifest | null {
  if (manifestCache.has(manifestFile)) {
    return manifestCache.get(manifestFile) ?? null
  }

  const manifestPath = path.join(process.cwd(), 'public', 'manifests', manifestFile)
  if (!existsSync(manifestPath)) {
    manifestCache.set(manifestFile, null)
    return null
  }

  try {
    const content = readFileSync(manifestPath, 'utf8')
    const parsed = JSON.parse(content) as SpeciesImageManifest
    manifestCache.set(manifestFile, parsed)
    return parsed
  } catch {
    manifestCache.set(manifestFile, null)
    return null
  }
}

function getAssetDirectoryFromUrl(url: string | null): string | null {
  if (!url?.startsWith('/')) return null

  const directory = path.posix.dirname(url)
  return directory === '.' ? null : directory
}

function compareSpeciesImageFiles(left: string, right: string) {
  const numberPattern = /-(\d+)\.[^.]+$/i
  const leftNumber = Number(left.match(numberPattern)?.[1] ?? Number.POSITIVE_INFINITY)
  const rightNumber = Number(right.match(numberPattern)?.[1] ?? Number.POSITIVE_INFINITY)

  if (leftNumber !== rightNumber) {
    return leftNumber - rightNumber
  }

  return left.localeCompare(right)
}

function listSpeciesImagesInDirectory(slug: string, publicDirectory: string): string[] {
  const relativeDirectory = publicDirectory.replace(/^\/+/, '')
  const absoluteDirectory = path.join(process.cwd(), 'public', relativeDirectory)

  if (!existsSync(absoluteDirectory)) return []

  return readdirSync(absoluteDirectory, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .filter((fileName) => {
      const extension = path.extname(fileName).toLowerCase()
      if (!speciesImageExtensions.has(extension)) return false

      const baseName = fileName.slice(0, -extension.length)
      return baseName === slug || baseName.startsWith(`${slug}-`)
    })
    .sort(compareSpeciesImageFiles)
    .map((fileName) => `${publicDirectory}/${fileName}`)
    .filter((url) => resolvePublicAssetUrl(url))
}

export function getSpeciesImageUrls(row: SpeciesRow): string[] {
  const coverImageUrl = resolvePublicAssetUrl(row.cover_image_url)
  const topicKey = row.nature_topic as NatureTopicKey
  const manifestFiles = speciesManifestFiles[topicKey] ?? []
  const manifestUrls = manifestFiles.flatMap((manifestFile) => {
    const manifest = loadSpeciesImageManifest(manifestFile)
    return manifest?.[row.slug] ?? []
  })
  const resolvedManifestUrls = manifestUrls
    .map((url) => resolvePublicAssetUrl(url))
    .filter((url): url is string => Boolean(url))

  if (resolvedManifestUrls.length > 0) {
    return Array.from(
      new Set(
        [coverImageUrl, ...resolvedManifestUrls].filter((url): url is string => Boolean(url)),
      ),
    )
  }

  const assetDirectories = [
    getAssetDirectoryFromUrl(row.cover_image_url),
    speciesImageDirectories[topicKey],
    ...(speciesExtraImageDirectories[topicKey] ?? []),
  ].filter((directory): directory is string => Boolean(directory))

  return Array.from(
    new Set([
      coverImageUrl,
      ...assetDirectories.flatMap((directory) => listSpeciesImagesInDirectory(row.slug, directory)),
    ].filter((url): url is string => Boolean(url))),
  )
}
