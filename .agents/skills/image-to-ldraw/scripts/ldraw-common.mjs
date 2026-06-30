import { createHash } from 'node:crypto'
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { dirname, resolve, join } from 'node:path'
import { fileURLToPath } from 'node:url'

export const EPS = 0.001

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))
export const SKILL_ROOT = resolve(SCRIPT_DIR, '..')
export const PROJECT_ROOT = process.cwd()
export const METADATA_PATH = resolve(SKILL_ROOT, 'references/part-metadata.json')

export async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'))
}

export async function loadPartMetadata() {
  const metadata = await readJson(METADATA_PATH)
  const parts = new Map()
  for (const [partId, part] of Object.entries(metadata.parts ?? {})) {
    parts.set(normalizePartId(partId), { partId, ...part })
  }
  return { metadata, parts }
}

export function normalizePartId(partId) {
  return String(partId).trim().replace(/\\/g, '/').toLowerCase()
}

export function formatNumber(value) {
  if (Math.abs(value) < EPS) return '0'
  const rounded = Number(value.toFixed(6))
  return Number.isInteger(rounded) ? String(rounded) : String(rounded)
}

export function matrixForOrientation(orientation, metadata) {
  if (Array.isArray(orientation)) {
    if (orientation.length !== 9 || orientation.some((value) => typeof value !== 'number')) {
      throw new Error('orientation transform must contain 9 numbers')
    }
    return orientation
  }
  const key = orientation ?? 'north'
  const matrix = metadata.orientationMatrices?.[key]
  if (!matrix) throw new Error(`unknown orientation: ${key}`)
  return matrix
}

export function transformPoint(point, matrix, origin) {
  const [a, b, c, d, e, f, g, h, i] = matrix
  const [x, y, z] = point
  return {
    x: origin.x + a * x + b * y + c * z,
    y: origin.y + d * x + e * y + f * z,
    z: origin.z + g * x + h * y + i * z,
  }
}

function parseLdrawType1Line(line) {
  const tokens = String(line).trim().split(/\s+/)
  if (tokens[0] !== '1' || tokens.length < 15) {
    throw new Error('placement.ldrawLine must be an LDraw type 1 line')
  }

  const colorCode = Number(tokens[1])
  const x = Number(tokens[2])
  const y = Number(tokens[3])
  const z = Number(tokens[4])
  const matrix = tokens.slice(5, 14).map(Number)
  if (![colorCode, x, y, z, ...matrix].every(Number.isFinite)) {
    throw new Error('placement.ldrawLine contains non-numeric transform values')
  }

  return {
    colorCode,
    origin: { x, y, z },
    matrix,
    partId: tokens.slice(14).join(' '),
  }
}

function transformVector(vector, matrix) {
  const [a, b, c, d, e, f, g, h, i] = matrix
  const [x, y, z] = vector
  return {
    x: a * x + b * y + c * z,
    y: d * x + e * y + f * z,
    z: g * x + h * y + i * z,
  }
}

function vectorForAxis(axis) {
  if (axis === 'x') return [1, 0, 0]
  if (axis === 'y') return [0, 1, 0]
  return [0, 0, 1]
}

function radialAxesForNormal(axis) {
  if (axis === 'x') return ['y', 'z']
  if (axis === 'y') return ['x', 'z']
  return ['x', 'y']
}

function normalizeVector(vector) {
  const length = Math.hypot(vector.x, vector.y, vector.z)
  if (length < EPS) return undefined
  return { x: vector.x / length, y: vector.y / length, z: vector.z / length }
}

function dot(a, b) {
  return a.x * b.x + a.y * b.y + a.z * b.z
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z)
}

function subtract(a, b) {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z }
}

function transformBox(box, matrix, origin) {
  const corners = [
    [box.xMin, box.yMin, box.zMin],
    [box.xMin, box.yMin, box.zMax],
    [box.xMin, box.yMax, box.zMin],
    [box.xMin, box.yMax, box.zMax],
    [box.xMax, box.yMin, box.zMin],
    [box.xMax, box.yMin, box.zMax],
    [box.xMax, box.yMax, box.zMin],
    [box.xMax, box.yMax, box.zMax],
  ].map((point) => transformPoint(point, matrix, origin))

  return {
    xMin: Math.min(...corners.map((point) => point.x)),
    xMax: Math.max(...corners.map((point) => point.x)),
    yMin: Math.min(...corners.map((point) => point.y)),
    yMax: Math.max(...corners.map((point) => point.y)),
    zMin: Math.min(...corners.map((point) => point.z)),
    zMax: Math.max(...corners.map((point) => point.z)),
  }
}

function transformSurface(surface, matrix, origin) {
  if (!surface) return undefined
  return transformBox({
    xMin: surface.xMin,
    xMax: surface.xMax,
    yMin: surface.yLdu,
    yMax: surface.yLdu,
    zMin: surface.zMin,
    zMax: surface.zMax,
  }, matrix, origin)
}

function anchorToOriginXZ(anchor, metadata) {
  if (!anchor || typeof anchor !== 'object') {
    throw new Error('placement anchor is required')
  }
  if (anchor.type === 'originLdu') {
    const x = Number(anchor.x)
    const y = Number(anchor.y)
    const z = Number(anchor.z)
    if (![x, y, z].every(Number.isFinite)) throw new Error('originLdu anchor requires numeric x, y, and z')
    return { type: anchor.type, x, z, exactY: y }
  }
  if (anchor.type === 'centerStud') {
    const pitch = metadata.grid?.studPitchLdu ?? 40
    const x = Number(anchor.x)
    const z = Number(anchor.z)
    if (![x, z].every(Number.isFinite)) throw new Error('centerStud anchor requires numeric x and z')
    return { type: anchor.type, x: x * pitch, z: z * pitch }
  }
  throw new Error(`unsupported anchor type: ${anchor.type}`)
}

function overlap1d(aMin, aMax, bMin, bMax) {
  return Math.min(aMax, bMax) - Math.max(aMin, bMin) > EPS
}

function overlapArea(a, b) {
  const xOverlap = Math.min(a.xMax, b.xMax) - Math.max(a.xMin, b.xMin)
  const zOverlap = Math.min(a.zMax, b.zMax) - Math.max(a.zMin, b.zMin)
  return Math.max(0, xOverlap) * Math.max(0, zOverlap)
}

function volumeOverlaps(a, b) {
  return (
    overlap1d(a.xMin, a.xMax, b.xMin, b.xMax) &&
    overlap1d(a.yMin, a.yMax, b.yMin, b.yMax) &&
    overlap1d(a.zMin, a.zMax, b.zMin, b.zMax)
  )
}

function surfaceArea(surface) {
  if (!surface) return 0
  return Math.max(0, surface.xMax - surface.xMin) * Math.max(0, surface.zMax - surface.zMin)
}

function isTubePart(part) {
  return part.category === 'tube'
}

function hasTubeOpenings(part) {
  return Array.isArray(part.tubeOpenings) && part.tubeOpenings.length > 0
}

function hasTubePath(part) {
  return Boolean(part.tubePath)
}

function hasTubePorts(part) {
  return Array.isArray(part.tubePorts) && part.tubePorts.length > 0
}

function resolveTubePorts(item) {
  if (!Array.isArray(item.part.tubePorts)) return []
  return item.part.tubePorts
    .map((port) => {
      const center = transformPoint(metadataPoint(port.center), item.matrix, item.origin)
      const outward = normalizeVector(transformVector(metadataPoint(port.outward), item.matrix))
      if (!outward) return null
      return {
        id: port.id,
        center,
        outward,
        toleranceLdu: Number(port.toleranceLdu ?? item.part.tubePortToleranceLdu ?? 4),
        alignmentDotMax: Number(port.alignmentDotMax ?? item.part.tubePortAlignmentDotMax ?? -0.95),
      }
    })
    .filter(Boolean)
}

function findResolvedTubePort(item, portId) {
  return resolveTubePorts(item).find((port) => port.id === portId)
}

function checkAxisBounds(delta, bounds, label) {
  const messages = []
  for (const axis of ['x', 'y', 'z']) {
    const value = delta[axis]
    const min = bounds?.min?.[axis]
    const max = bounds?.max?.[axis]
    if (typeof min === 'number' && value < min - EPS) {
      messages.push(`${label} ${axis} delta ${formatNumber(value)} < ${formatNumber(min)}`)
    }
    if (typeof max === 'number' && value > max + EPS) {
      messages.push(`${label} ${axis} delta ${formatNumber(value)} > ${formatNumber(max)}`)
    }
  }
  return messages
}

function checkPlacementTubeConstraints(item, resolvedById) {
  const checks = item.placement.tubeChecks
  if (!Array.isArray(checks)) return []

  const messages = []
  for (const check of checks) {
    if (check.type === 'portConnection') {
      const port = findResolvedTubePort(item, check.portId)
      const target = resolvedById.get(check.targetPlacementId)
      const targetPort = target ? findResolvedTubePort(target, check.targetPortId) : undefined
      if (!port || !target || !targetPort) {
        messages.push(
          `${item.placement.id} cannot run tube port connection check; missing ${check.portId ?? 'portId'} or ${check.targetPlacementId ?? 'targetPlacementId'}:${check.targetPortId ?? 'targetPortId'}`
        )
        continue
      }

      const maxDistance = Number(check.toleranceLdu ?? Math.max(port.toleranceLdu, targetPort.toleranceLdu))
      const maxDot = Number(check.alignmentDotMax ?? Math.max(port.alignmentDotMax, targetPort.alignmentDotMax))
      const portDistance = distance(port.center, targetPort.center)
      const portDot = dot(port.outward, targetPort.outward)
      const label = `${item.placement.id} ${item.placement.partId} ${check.label ?? `${check.portId}->${check.targetPlacementId}.${check.targetPortId}`}`
      if (portDistance > maxDistance + EPS) {
        messages.push(`${label} port distance ${formatNumber(portDistance)} > ${formatNumber(maxDistance)}`)
      }
      if (portDot > maxDot + EPS) {
        messages.push(`${label} port outward dot ${formatNumber(portDot)} > ${formatNumber(maxDot)}`)
      }
      continue
    }

    if (check.type !== 'portDelta') {
      messages.push(`${item.placement.id} has unsupported tube check type: ${check.type}`)
      continue
    }

    const fromPort = findResolvedTubePort(item, check.fromPortId)
    const toPort = findResolvedTubePort(item, check.toPortId)
    if (!fromPort || !toPort) {
      messages.push(
        `${item.placement.id} cannot run tube port delta check; missing ${check.fromPortId ?? 'fromPortId'} or ${check.toPortId ?? 'toPortId'}`
      )
      continue
    }

    const delta = subtract(toPort.center, fromPort.center)
    const label = `${item.placement.id} ${item.placement.partId} ${check.label ?? `${check.fromPortId}->${check.toPortId}`}`
    messages.push(...checkAxisBounds(delta, check, label))
  }
  return messages
}

function tubePathPoints(item) {
  const path = item.part.tubePath
  if (!path) return []
  const points = Array.isArray(path.points) ? path.points : [path.start, path.end]
  return points.filter(Boolean).map((point) => transformPoint(metadataPoint(point), item.matrix, item.origin))
}

function closestSegmentPoints(aStart, aEnd, bStart, bEnd) {
  const u = subtract(aEnd, aStart)
  const v = subtract(bEnd, bStart)
  const w = subtract(aStart, bStart)
  const a = dot(u, u)
  const b = dot(u, v)
  const c = dot(v, v)
  const d = dot(u, w)
  const e = dot(v, w)
  const denominator = a * c - b * b

  let sNumerator
  let sDenominator = denominator
  let tNumerator
  let tDenominator = denominator

  if (denominator < EPS) {
    sNumerator = 0
    sDenominator = 1
    tNumerator = e
    tDenominator = c
  } else {
    sNumerator = b * e - c * d
    tNumerator = a * e - b * d
    if (sNumerator < 0) {
      sNumerator = 0
      tNumerator = e
      tDenominator = c
    } else if (sNumerator > sDenominator) {
      sNumerator = sDenominator
      tNumerator = e + b
      tDenominator = c
    }
  }

  if (tNumerator < 0) {
    tNumerator = 0
    if (-d < 0) {
      sNumerator = 0
    } else if (-d > a) {
      sNumerator = sDenominator
    } else {
      sNumerator = -d
      sDenominator = a
    }
  } else if (tNumerator > tDenominator) {
    tNumerator = tDenominator
    if (-d + b < 0) {
      sNumerator = 0
    } else if (-d + b > a) {
      sNumerator = sDenominator
    } else {
      sNumerator = -d + b
      sDenominator = a
    }
  }

  const s = Math.abs(sNumerator) < EPS ? 0 : sNumerator / sDenominator
  const t = Math.abs(tNumerator) < EPS ? 0 : tNumerator / tDenominator
  const point = {
    x: aStart.x + s * u.x,
    y: aStart.y + s * u.y,
    z: aStart.z + s * u.z,
  }
  const priorPoint = {
    x: bStart.x + t * v.x,
    y: bStart.y + t * v.y,
    z: bStart.z + t * v.z,
  }
  return {
    point,
    priorPoint,
    distance: distance(point, priorPoint),
  }
}

function findAlignedTubePortConnection(item, prior, point, priorPoint) {
  const ports = resolveTubePorts(item)
  const priorPorts = resolveTubePorts(prior)
  for (const port of ports) {
    for (const priorPort of priorPorts) {
      const maxDistance = Math.max(port.toleranceLdu, priorPort.toleranceLdu)
      const maxDot = Math.max(port.alignmentDotMax, priorPort.alignmentDotMax)
      if (
        distance(port.center, priorPort.center) <= maxDistance + EPS &&
        (!point || distance(point, port.center) <= maxDistance + EPS) &&
        (!priorPoint || distance(priorPoint, priorPort.center) <= maxDistance + EPS) &&
        dot(port.outward, priorPort.outward) <= maxDot + EPS
      ) {
        return { port, priorPort }
      }
    }
  }
  return undefined
}

function checkTubePathInterference(item, prior) {
  if (!isTubePart(item.part) || !isTubePart(prior.part)) return []
  if (!hasTubePath(item.part) || !hasTubePath(prior.part)) return []

  const points = tubePathPoints(item)
  const priorPoints = tubePathPoints(prior)
  const tolerance = Math.max(
    item.part.tubePath?.collisionToleranceLdu ?? item.part.tubePathToleranceLdu ?? 6,
    prior.part.tubePath?.collisionToleranceLdu ?? prior.part.tubePathToleranceLdu ?? 6,
  )
  for (let i = 0; i < points.length - 1; i += 1) {
    for (let j = 0; j < priorPoints.length - 1; j += 1) {
      const closest = closestSegmentPoints(points[i], points[i + 1], priorPoints[j], priorPoints[j + 1])
      if (closest.distance > tolerance + EPS) continue
      if (findAlignedTubePortConnection(item, prior, closest.point, closest.priorPoint)) continue

      return [
        `${item.placement.id} ${item.placement.partId} tube path intersects ${prior.placement.id} ${prior.placement.partId} away from aligned ports`,
      ]
    }
  }
  return []
}

function shouldSkipCoarseCollision(item, prior) {
  // Arch frames are checked with tube opening alignment; coarse boxes false-positive passages.
  if (item.isExactTransform && hasTubeOpenings(prior.part)) return true
  if (prior.isExactTransform && hasTubeOpenings(item.part)) return true
  // Tube pairs are checked by tubePorts above; coarse boxes false-positive valid flanges.
  if (
    isTubePart(item.part) &&
    isTubePart(prior.part) &&
    (hasTubePath(item.part) || hasTubePorts(item.part)) &&
    (hasTubePath(prior.part) || hasTubePorts(prior.part))
  ) return true
  // Exact ldrawLine bricks use coarse boxes only for gross placement; skip brick-brick pairs.
  if (item.isExactTransform && prior.isExactTransform) return true
  return false
}

function checkTubeStraightPenetration(tubeItem, straightItem) {
  if (!isTubePart(tubeItem.part) || normalizePartId(straightItem.placement.partId) !== '31452.dat') return []

  let overlaps = false
  for (const volume of tubeItem.bounds.collisionVolumes) {
    for (const priorVolume of straightItem.bounds.collisionVolumes) {
      if (volumeOverlaps(volume, priorVolume)) {
        overlaps = true
        break
      }
    }
    if (overlaps) break
  }
  if (!overlaps) return []

  const runLength = straightItem.part.bbox?.zMax ?? 120
  const start = transformPoint(metadataPoint({ x: 0, y: 0, z: 0 }), straightItem.matrix, straightItem.origin)
  const end = transformPoint(metadataPoint({ x: 0, y: 0, z: runLength }), straightItem.matrix, straightItem.origin)
  const point = tubeItem.origin
  const segment = subtract(end, start)
  const lengthSquared = dot(segment, segment)
  if (lengthSquared < EPS) return []

  const t = dot(subtract(point, start), segment) / lengthSquared
  const endpointBand = 0.12
  if (t > endpointBand && t < 1 - endpointBand) {
    return [
      `${tubeItem.placement.id} ${tubeItem.placement.partId} penetrates ${straightItem.placement.id} ${straightItem.placement.partId} run (projection ${formatNumber(t)})`,
    ]
  }
  return []
}

function createPartBounds(part, matrix, origin) {
  const collisionSource = part.collisionVolumes?.length ? part.collisionVolumes : [part.bbox]
  const collisionVolumes = collisionSource
    .filter(Boolean)
    .map((box) => transformBox(box, matrix, origin))
  const bbox = transformBox(part.bbox, matrix, origin)
  return {
    bbox,
    collisionVolumes,
    topSurface: transformSurface(part.connectionSurfaces?.top, matrix, origin),
    bottomSurface: transformSurface(part.connectionSurfaces?.bottom, matrix, origin),
  }
}

function metadataPoint(point, fallback = { x: 0, y: 0, z: 0 }) {
  return [
    Number(point?.x ?? fallback.x),
    Number(point?.y ?? fallback.y),
    Number(point?.z ?? fallback.z),
  ]
}

function checkTubeOpeningAlignment(tubeItem, openingItem) {
  const path = tubeItem.part.tubePath
  const openings = openingItem.part.tubeOpenings
  if (path?.type !== 'straight' || !Array.isArray(openings) || openings.length === 0) return []

  const start = transformPoint(metadataPoint(path.start), tubeItem.matrix, tubeItem.origin)
  const end = transformPoint(metadataPoint(path.end), tubeItem.matrix, tubeItem.origin)
  const messages = []

  for (const opening of openings) {
    const normalAxis = opening.axis ?? 'z'
    const normal = normalizeVector(transformVector(vectorForAxis(normalAxis), openingItem.matrix))
    if (!normal) continue

    const center = transformPoint(metadataPoint(opening.center), openingItem.matrix, openingItem.origin)
    const startDistance = dot(subtract(start, center), normal)
    const endDistance = dot(subtract(end, center), normal)
    const halfThickness = (opening.thicknessLdu ?? 0) / 2
    const denominator = startDistance - endDistance

    let t
    if (Math.abs(denominator) < EPS) {
      if (Math.abs(startDistance) > halfThickness + EPS) continue
      t = 0
    } else {
      t = startDistance / denominator
      if (t < -EPS || t > 1 + EPS) continue
      t = Math.min(1, Math.max(0, t))
    }

    const point = {
      x: start.x + (end.x - start.x) * t,
      y: start.y + (end.y - start.y) * t,
      z: start.z + (end.z - start.z) * t,
    }
    const radialAxes = opening.radialAxes ?? radialAxesForNormal(normalAxis)
    const uAxis = normalizeVector(transformVector(vectorForAxis(radialAxes[0]), openingItem.matrix))
    const vAxis = normalizeVector(transformVector(vectorForAxis(radialAxes[1]), openingItem.matrix))
    if (!uAxis || !vAxis) continue

    const delta = subtract(point, center)
    const u = dot(delta, uAxis)
    const v = dot(delta, vAxis)
    const centerOffset = Math.hypot(u, v)
    const tubeRadius = path.outerRadiusLdu ?? path.radiusLdu ?? 0
    const allowedOffset = (opening.innerRadiusLdu ?? Infinity) - tubeRadius + (opening.toleranceLdu ?? 0)
    if (centerOffset > allowedOffset + EPS) {
      messages.push(
        `${tubeItem.placement.id} ${tubeItem.placement.partId} misses ${openingItem.placement.id} ${openingItem.placement.partId} tube opening by ${formatNumber(centerOffset)} LDU (allowed ${formatNumber(allowedOffset)})`
      )
    }
  }

  return messages
}

function getSupportIds(support) {
  if (!support || support.type === 'ground') return []
  if (support.type === 'placements') {
    if (Array.isArray(support.ids)) return support.ids
    if (typeof support.id === 'string') return [support.id]
  }
  return []
}

function resolveOriginY({ placement, part, matrix, anchor, resolvedById }) {
  if (anchor.type === 'originLdu') return anchor.exactY
  const support = placement.support ?? { type: 'ground' }
  const bottomLocal = part.connectionSurfaces?.bottom?.yLdu ?? part.origin?.originToBottom
  if (typeof bottomLocal !== 'number') {
    throw new Error(`part ${placement.partId} is missing bottom connection metadata`)
  }
  if (support.type === 'ground' || !support.type) {
    const topLocal = part.connectionSurfaces?.top?.yLdu ?? part.origin?.originToTop ?? 0
    return -topLocal
  }
  const supportIds = getSupportIds(support)
  if (supportIds.length === 0) throw new Error('support.ids is required for placement support')
  const topYs = supportIds.map((id) => {
    const supportPlacement = resolvedById.get(id)
    if (!supportPlacement) throw new Error(`unknown support placement: ${id}`)
    const top = supportPlacement.bounds.topSurface
    if (!top) throw new Error(`support placement ${id} has no top surface`)
    return top.yMin
  })
  const firstTop = topYs[0]
  if (topYs.some((value) => Math.abs(value - firstTop) > EPS)) {
    throw new Error(`support placements are not level: ${supportIds.join(', ')}`)
  }
  return firstTop - bottomLocal
}

function ldrawLineForPlacement(placement, resolved) {
  if (placement.ldrawLine) return placement.ldrawLine
  return [
    '1',
    placement.colorCode,
    formatNumber(resolved.origin.x),
    formatNumber(resolved.origin.y),
    formatNumber(resolved.origin.z),
    ...resolved.matrix.map(formatNumber),
    placement.partId,
  ].join(' ')
}

export function summarizeBom(resolvedPlacements) {
  const groups = new Map()
  for (const item of resolvedPlacements) {
    if (item.part.decorative && item.placement.ldrawLine) continue
    const key = `${normalizePartId(item.placement.partId)}:${item.placement.colorCode}`
    const existing = groups.get(key) ?? {
      partId: item.placement.partId,
      partName: item.part.name,
      colorCode: item.placement.colorCode,
      colorName: item.placement.colorName,
      quantity: 0,
      minConfidence: 1,
    }
    existing.quantity += 1
    existing.minConfidence = Math.min(existing.minConfidence, item.placement.confidence ?? 1)
    groups.set(key, existing)
  }
  return [...groups.values()].sort((a, b) => a.partId.localeCompare(b.partId) || a.colorCode - b.colorCode)
}

export function resolveAssembly(assembly, partMetadata) {
  const errors = []
  const warnings = []
  const resolved = []
  const resolvedById = new Map()
  const seenIds = new Set()

  for (const [stepIndex, step] of (assembly.steps ?? []).entries()) {
    for (const placement of (step.placements ?? [])) {
      try {
        if (!placement.id) throw new Error('placement id is required')
        if (seenIds.has(placement.id)) throw new Error(`duplicate placement id: ${placement.id}`)
        seenIds.add(placement.id)

        const part = partMetadata.parts.get(normalizePartId(placement.partId))
        if (!part) throw new Error(`missing part metadata: ${placement.partId}`)
        if (part.requiresExactTransform && !placement.ldrawLine && !Array.isArray(placement.orientation)) {
          throw new Error(`${placement.partId} requires placement.ldrawLine or exact transform`)
        }
        if (typeof placement.colorCode !== 'number') throw new Error('colorCode must be a number')
        if (typeof placement.confidence === 'number' && (placement.confidence < 0 || placement.confidence > 1)) {
          throw new Error('confidence must be between 0 and 1')
        }

        const exactTransform = placement.ldrawLine ? parseLdrawType1Line(placement.ldrawLine) : undefined
        if (exactTransform && normalizePartId(exactTransform.partId) !== normalizePartId(placement.partId)) {
          throw new Error(`placement.ldrawLine part ${exactTransform.partId} does not match ${placement.partId}`)
        }

        const matrix = exactTransform?.matrix ?? matrixForOrientation(placement.orientation, partMetadata.metadata)
        if (
          !exactTransform &&
          typeof placement.orientation === 'string' &&
          part.allowedOrientations?.length &&
          !part.allowedOrientations.includes(placement.orientation)
        ) {
          throw new Error(`${placement.partId} does not allow orientation ${placement.orientation}`)
        }

        const anchor = placement.anchor ?? placement.position?.anchor
        const anchorPosition = exactTransform
          ? { x: exactTransform.origin.x, y: exactTransform.origin.y, z: exactTransform.origin.z }
          : anchorToOriginXZ(anchor, partMetadata.metadata)
        const origin = exactTransform
          ? exactTransform.origin
          : {
              x: anchorPosition.x,
              y: resolveOriginY({ placement, part, matrix, anchor: anchorPosition, resolvedById }),
              z: anchorPosition.z,
            }
        const bounds = createPartBounds(part, matrix, origin)
        const item = {
          stepIndex,
          stepNumber: step.step ?? stepIndex + 1,
          stepTitle: step.title,
          placement,
          part,
          matrix,
          origin,
          bounds,
          isExactTransform: Boolean(exactTransform),
          ldrawLine: ldrawLineForPlacement(placement, { origin, matrix }),
        }

        for (const message of checkPlacementTubeConstraints(item, resolvedById)) {
          throw new Error(message)
        }

        if (part.supportPolicy !== 'decorative' && !part.decorative && !placement.decorative) {
          if (!exactTransform || placement.support) {
            const support = placement.support ?? { type: 'ground' }
            const supportIds = getSupportIds(support)
            if (support.type === 'ground' || !support.type) {
              const top = bounds.topSurface
              if (top && Math.abs(top.yMin) > EPS) {
                const message = `${placement.id} ${placement.partId} is not on the ground plane`
                if (part.supportPolicy === 'manual') warnings.push(`${message}; manual part accepted`)
                else throw new Error(message)
              }
            }
            if (support.type === 'placements') {
              const bottom = bounds.bottomSurface
              const footprintArea = surfaceArea(bottom)
              let coveredArea = 0
              let expectedTopY
              for (const id of supportIds) {
                const supportItem = resolvedById.get(id)
                if (!supportItem?.bounds.topSurface || !bottom) continue
                expectedTopY ??= supportItem.bounds.topSurface.yMin
                if (Math.abs(supportItem.bounds.topSurface.yMin - expectedTopY) > EPS) {
                  throw new Error(`${placement.id} support placements are not level`)
                }
                coveredArea += overlapArea(bottom, supportItem.bounds.topSurface)
              }
              if (bottom && typeof expectedTopY === 'number' && Math.abs(bottom.yMin - expectedTopY) > EPS) {
                const message = `${placement.id} ${placement.partId} bottom plane is not aligned to support top plane`
                if (part.supportPolicy === 'manual') warnings.push(`${message}; manual part accepted`)
                else throw new Error(message)
              }
              const required = footprintArea * (part.supportCoverage ?? partMetadata.metadata.grid?.defaultSupportCoverage ?? 0.2)
              if (part.supportPolicy === 'manual') {
                if (coveredArea + EPS < required) {
                  warnings.push(`${placement.id} ${placement.partId} has low support coverage; manual part accepted`)
                }
              } else if (coveredArea + EPS < required) {
                throw new Error(`${placement.id} ${placement.partId} support coverage ${coveredArea.toFixed(2)} < ${required.toFixed(2)}`)
              }
            }
          }

          for (const prior of resolved) {
            if (prior.part.decorative || prior.part.supportPolicy === 'decorative' || prior.placement.decorative) continue
            for (const message of [
              ...checkTubePathInterference(item, prior),
              ...checkTubeOpeningAlignment(item, prior),
              ...checkTubeOpeningAlignment(prior, item),
              ...checkTubeStraightPenetration(item, prior),
              ...checkTubeStraightPenetration(prior, item),
            ]) {
              throw new Error(message)
            }
            if (shouldSkipCoarseCollision(item, prior)) continue
            for (const volume of bounds.collisionVolumes) {
              for (const priorVolume of prior.bounds.collisionVolumes) {
                if (volumeOverlaps(volume, priorVolume)) {
                  const manualOverlap = part.collisionPolicy === 'manual' || prior.part.collisionPolicy === 'manual'
                  if (manualOverlap) {
                    warnings.push(`${placement.id} overlaps ${prior.placement.id}; manual collision accepted`)
                  } else {
                    throw new Error(`${placement.id} overlaps ${prior.placement.id}`)
                  }
                }
              }
            }
          }
        }

        if (placement.needsReview) warnings.push(`${placement.id} is marked needsReview`)
        if ((placement.confidence ?? 1) < 0.8) warnings.push(`${placement.id} has low confidence`)

        resolved.push(item)
        resolvedById.set(placement.id, item)
      } catch (error) {
        errors.push(`step ${step.step ?? stepIndex + 1}: ${error.message}`)
      }
    }
  }

  return { errors, warnings, resolved, bom: summarizeBom(resolved) }
}

export function buildReport(assembly, validation) {
  return {
    model: assembly.model,
    title: assembly.title,
    totalPlacements: validation.resolved.length,
    errors: validation.errors,
    warnings: validation.warnings,
    bom: validation.bom,
  }
}

export function ldrawHeader(assembly, outName) {
  return [
    `0 ${assembly.title ?? outName}`,
    `0 Name: ${outName}.ldr`,
    '0 Author: Image to LDraw Skill',
    '0 !LICENSE Redistributable under CCAL version 2.0 : see CAreadme.txt',
    '0 BFC CERTIFY CCW',
    '0 // Generated from reviewed assembly JSON. Each 0 STEP follows one source step.',
  ]
}

export function ldrawBody(assembly, validation) {
  const byStep = new Map()
  for (const item of validation.resolved) {
    if (!byStep.has(item.stepIndex)) byStep.set(item.stepIndex, [])
    byStep.get(item.stepIndex).push(item)
  }
  const lines = []
  for (const [index, step] of (assembly.steps ?? []).entries()) {
    lines.push(`0 // Step ${step.step ?? index + 1}: ${step.title ?? ''}`.trimEnd())
    for (const item of byStep.get(index) ?? []) lines.push(item.ldrawLine)
    lines.push('0 STEP')
  }
  return lines
}

export async function writeJson(path, value) {
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, JSON.stringify(value, null, 2) + '\n', 'utf8')
}

export async function listFilesSafe(dir) {
  try {
    return await readdir(dir)
  } catch {
    return []
  }
}

export function sha256(text) {
  return createHash('sha256').update(text).digest('hex')
}

export function localPartCandidates(partId) {
  const normalized = normalizePartId(partId)
  return [
    resolve(PROJECT_ROOT, 'scripts/ldraw-models/parts', normalized),
    resolve(PROJECT_ROOT, 'scripts/ldraw-models/p', normalized),
    resolve(PROJECT_ROOT, 'scripts/ldraw-models/models', normalized),
  ]
}

export function cachePathForPart(partId) {
  return resolve(PROJECT_ROOT, 'scripts/ldraw-models/.cache/ldraw-parts', normalizePartId(partId))
}

export function fileExists(path) {
  return existsSync(path)
}

export function safeJoin(...parts) {
  return join(...parts)
}
