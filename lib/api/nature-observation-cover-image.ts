import { existsSync, readdirSync } from 'node:fs'
import path from 'node:path'

import type { NatureTopicKey } from '@/lib/config/nature-topics'

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

  return existsSync(absolutePath) ? trimmedUrl : null
}

export function normalizeSpeciesRow(row: SpeciesRow): SpeciesRow {
  return {
    ...row,
    cover_image_url: resolvePublicAssetUrl(row.cover_image_url),
    audio_url: resolvePublicAssetUrl(row.audio_url),
  }
}

const speciesImageDirectories: Partial<Record<NatureTopicKey, string>> = {
  birds: '/birds/images',
  plants: '/trees/images',
}

const speciesImageExtensions = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif'])

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
  const assetDirectories = [
    getAssetDirectoryFromUrl(coverImageUrl),
    speciesImageDirectories[row.nature_topic as NatureTopicKey],
  ].filter((directory): directory is string => Boolean(directory))

  return Array.from(
    new Set([
      coverImageUrl,
      ...assetDirectories.flatMap((directory) => listSpeciesImagesInDirectory(row.slug, directory)),
    ].filter((url): url is string => Boolean(url))),
  )
}
