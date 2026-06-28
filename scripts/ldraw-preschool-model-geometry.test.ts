import { readdirSync, readFileSync } from 'node:fs'
import { basename, resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

type Matrix3 = [
  number, number, number,
  number, number, number,
  number, number, number,
]

type BrickFootprint = {
  file: string
  line: number
  part: string
  xMin: number
  xMax: number
  yTop: number
  yBottom: number
  zMin: number
  zMax: number
}

const MODEL_DIR = resolve(process.cwd(), 'scripts/ldraw-models')
const MODEL_FILES = readdirSync(MODEL_DIR)
  .filter((file) => file.startsWith('preschool-') && file.endsWith('.ldr'))
  .sort()

const PART_SIZES: Record<string, { x: number; z: number; height: number }> = {
  '3011.dat': { x: 160, z: 80, height: 48 },
  '3437.dat': { x: 80, z: 80, height: 48 },
  '41989.dat': { x: 160, z: 80, height: 48 },
}

const DECORATIVE_PARTS = new Set(['4-4ndis.dat'])

const EPS = 0.001

function isAxisAligned(matrix: Matrix3) {
  return matrix.every((value) => Math.abs(value) < EPS || Math.abs(Math.abs(value) - 1) < EPS)
}

function transformPoint(x: number, y: number, z: number, matrix: Matrix3, origin: [number, number, number]) {
  const [a, b, c, d, e, f, g, h, i] = matrix
  return {
    x: origin[0] + a * x + b * y + c * z,
    y: origin[1] + d * x + e * y + f * z,
    z: origin[2] + g * x + h * y + i * z,
  }
}

function parseMainModelBricks(file: string) {
  const text = readFileSync(resolve(MODEL_DIR, file), 'utf8')
  const bricks: BrickFootprint[] = []
  const errors: string[] = []

  text.split(/\r?\n/).forEach((line, index) => {
    const trimmed = line.trim()
    if (!trimmed.startsWith('1 ')) return

    const tokens = trimmed.split(/\s+/)
    const part = tokens.slice(14).join(' ').trim()
    const size = PART_SIZES[part]
    if (!size) return

    const numeric = tokens.slice(2, 14).map((token) => Number.parseFloat(token))
    const [x, y, z, ...matrixRaw] = numeric
    const matrix = matrixRaw as Matrix3
    const lineNumber = index + 1

    if (!isAxisAligned(matrix)) {
      errors.push(`${file}:${lineNumber} ${part} uses a non-orthogonal transform`)
      return
    }

    const corners = [
      [-size.x / 2, 0, -size.z / 2],
      [size.x / 2, 0, -size.z / 2],
      [-size.x / 2, 0, size.z / 2],
      [size.x / 2, 0, size.z / 2],
      [-size.x / 2, size.height, -size.z / 2],
      [size.x / 2, size.height, -size.z / 2],
      [-size.x / 2, size.height, size.z / 2],
      [size.x / 2, size.height, size.z / 2],
    ].map(([px, py, pz]) => transformPoint(px, py, pz, matrix, [x, y, z]))

    bricks.push({
      file,
      line: lineNumber,
      part,
      xMin: Math.min(...corners.map((point) => point.x)),
      xMax: Math.max(...corners.map((point) => point.x)),
      yTop: Math.min(...corners.map((point) => point.y)),
      yBottom: Math.max(...corners.map((point) => point.y)),
      zMin: Math.min(...corners.map((point) => point.z)),
      zMax: Math.max(...corners.map((point) => point.z)),
    })
  })

  return { bricks, errors }
}

function overlaps1d(aMin: number, aMax: number, bMin: number, bMax: number) {
  return Math.min(aMax, bMax) - Math.max(aMin, bMin) > EPS
}

function overlapArea(a: BrickFootprint, b: BrickFootprint) {
  const xOverlap = Math.min(a.xMax, b.xMax) - Math.max(a.xMin, b.xMin)
  const zOverlap = Math.min(a.zMax, b.zMax) - Math.max(a.zMin, b.zMin)
  return Math.max(0, xOverlap) * Math.max(0, zOverlap)
}

function supportedBy(priorBricks: BrickFootprint[], brick: BrickFootprint) {
  if (brick.yTop >= -EPS) return true

  const supporters = priorBricks.filter((candidate) => Math.abs(candidate.yTop - brick.yBottom) < EPS)
  const requiredArea = (brick.xMax - brick.xMin) * (brick.zMax - brick.zMin) * 0.2
  const supportArea = supporters.reduce((sum, candidate) => sum + overlapArea(candidate, brick), 0)

  return supportArea >= requiredArea
}

describe('学前大颗粒 LDraw 源模型几何', () => {
  it('所有课程源模型都在测试清单中', () => {
    expect(MODEL_FILES).toEqual([
      'preschool-bridge.ldr',
      'preschool-car.ldr',
      'preschool-crane.ldr',
      'preschool-garden.ldr',
      'preschool-gears.ldr',
      'preschool-house.ldr',
      'preschool-maze.ldr',
      'preschool-park.ldr',
      'preschool-ramp.ldr',
      'preschool-seesaw.ldr',
      'preschool-tower.ldr',
      'preschool-windmill.ldr',
    ])
  })

  it.each(MODEL_FILES)('%s has no impossible preschool brick placement', (file) => {
    const { bricks, errors } = parseMainModelBricks(file)
    const geometryErrors = [...errors]

    for (let i = 0; i < bricks.length; i += 1) {
      const brick = bricks[i]
      const priorBricks = bricks.slice(0, i)

      if (DECORATIVE_PARTS.has(brick.part)) continue

      if (!supportedBy(priorBricks, brick)) {
        geometryErrors.push(`${file}:${brick.line} ${brick.part} is unsupported`)
      }

      for (const other of priorBricks) {
        if (DECORATIVE_PARTS.has(other.part)) continue

        const sameLayer = Math.abs(brick.yTop - other.yTop) < EPS
        if (
          sameLayer &&
          overlaps1d(brick.xMin, brick.xMax, other.xMin, other.xMax) &&
          overlaps1d(brick.zMin, brick.zMax, other.zMin, other.zMax)
        ) {
          geometryErrors.push(`${file}:${brick.line} ${brick.part} overlaps ${basename(other.file)}:${other.line}`)
        }
      }
    }

    expect(geometryErrors).toEqual([])
  })
})
