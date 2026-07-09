'use client'

/**
 * 小迪吉祥物动画组件。
 *
 * 帧资源已经合并为 sprite：默认 ai-draft 使用 public/xiaodi-ai/sprite.webp，
 * legacy default 变体使用 public/xiaodi/sprite.webp。运行时只加载每个变体的一张 sprite，
 * 每个状态按序列切换 sprite 坐标，外层再叠一层状态化 CSS 运动
 * （呼吸/前倾/摇摆/弹跳……），组成"绘本式"动画。
 *
 * 用法：<XiaoDi state="thinking" size={160} />
 */

import { memo, useEffect, useRef, useState, type CSSProperties } from 'react'

import { cn } from '@/lib/utils'

import styles from './xiaodi.module.css'

export const XIAODI_STATES = [
  'idle',
  'listening',
  'thinking',
  'speaking',
  'success',
  'error',
  'working',
] as const

export type XiaoDiState = (typeof XIAODI_STATES)[number]
export type XiaoDiVariant = 'default' | 'ai-draft'

const DEFAULT_FRAMES_PER_STATE = 4
const AI_DRAFT_FRAMES_PER_STATE = 8
const SPRITE_ROWS = XIAODI_STATES.length

type StateConfig = {
  durationMs: number
  once?: boolean
  motionClass: string
}

const STATE_CONFIG: Record<XiaoDiState, StateConfig> = {
  idle: { durationMs: 3360, motionClass: styles.motionIdle },
  listening: { durationMs: 1800, motionClass: styles.motionListening },
  thinking: { durationMs: 2280, motionClass: styles.motionThinking },
  speaking: { durationMs: 1740, motionClass: styles.motionSpeaking },
  success: { durationMs: 1000, once: true, motionClass: styles.motionSuccess },
  error: { durationMs: 1040, once: true, motionClass: styles.motionError },
  working: { durationMs: 1980, motionClass: styles.motionWorking },
}

const AI_DRAFT_DURATION_MS: Partial<Record<XiaoDiState, number>> = {
  idle: 3600,
  listening: 2400,
  thinking: 2800,
  speaking: 2800,
  success: 1500,
  error: 1800,
  working: 2600,
}

const STATE_LABELS: Record<XiaoDiState, string> = {
  idle: '小迪在待命',
  listening: '小迪在认真听',
  thinking: '小迪在思考',
  speaking: '小迪在讲解',
  success: '小迪完成啦',
  error: '小迪有点困惑',
  working: '小迪在操作',
}

function hasAiDraftFrames(_state: XiaoDiState, variant: XiaoDiVariant) {
  return variant === 'ai-draft'
}

function frameCount(state: XiaoDiState, variant: XiaoDiVariant) {
  return hasAiDraftFrames(state, variant) ? AI_DRAFT_FRAMES_PER_STATE : DEFAULT_FRAMES_PER_STATE
}

function frameSequence(state: XiaoDiState, variant: XiaoDiVariant) {
  const count = frameCount(state, variant)
  const forward = Array.from({ length: count }, (_, index) => index)
  if (STATE_CONFIG[state].once) return forward
  return [...forward, ...forward.slice(1, -1).reverse()]
}

function frameMs(state: XiaoDiState, variant: XiaoDiVariant) {
  const durationMs = hasAiDraftFrames(state, variant) ? (AI_DRAFT_DURATION_MS[state] ?? STATE_CONFIG[state].durationMs) : STATE_CONFIG[state].durationMs
  return Math.round(durationMs / frameSequence(state, variant).length)
}

function spriteSrc(variant: XiaoDiVariant) {
  if (variant === 'ai-draft') return '/xiaodi-ai/sprite.webp'
  return '/xiaodi/sprite.webp'
}

const spritePromises = new Map<string, Promise<void>>()
const decodedSprites = new Set<string>()

function preloadSprite(variant: XiaoDiVariant) {
  if (typeof window === 'undefined') return Promise.resolve()
  const src = spriteSrc(variant)
  if (decodedSprites.has(src)) return Promise.resolve()
  const cached = spritePromises.get(src)
  if (cached) return cached

  const promise = new Promise<void>((resolve) => {
    const img = new window.Image()
    let settled = false
    img.decoding = 'async'

    const finish = () => {
      if (settled) return
      settled = true
      decodedSprites.add(src)
      resolve()
    }

    const decodeThenFinish = () => {
      if (typeof img.decode === 'function') {
        void img.decode().then(finish, finish)
      } else {
        finish()
      }
    }

    img.onload = decodeThenFinish
    img.onerror = finish
    img.src = src
    if (img.complete && img.naturalWidth > 0) decodeThenFinish()
  })
  spritePromises.set(src, promise)
  return promise
}

function spriteSheetStyle(entry: StackEntry, size: number): CSSProperties {
  const columns = frameCount(entry.state, entry.variant)
  const row = XIAODI_STATES.indexOf(entry.state)
  return {
    width: columns * size,
    height: SPRITE_ROWS * size,
    backgroundImage: `url(${spriteSrc(entry.variant)})`,
    backgroundSize: '100% 100%',
    transform: `translate3d(${-entry.frame * size}px, ${-row * size}px, 0)`,
  }
}

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false)
  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReduced(query.matches)
    const onChange = (event: MediaQueryListEvent) => setReduced(event.matches)
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])
  return reduced
}

type XiaoDiProps = {
  state?: XiaoDiState
  /** 渲染尺寸（正方形边长，px），默认 160 */
  size?: number
  className?: string
  /** 默认启用 AI 8 帧候选；传 default 可对比原版 4 帧 */
  variant?: XiaoDiVariant
  /** 每完成一轮帧序列回调一次；可用于 success/error 播完后切回 idle */
  onCycleEnd?: (state: XiaoDiState) => void
}

type StackEntry = {
  state: XiaoDiState
  variant: XiaoDiVariant
  frame: number
  exiting: boolean
}

function XiaoDiComponent({ state = 'idle', size = 160, className, variant = 'ai-draft', onCycleEnd }: XiaoDiProps) {
  const reducedMotion = usePrefersReducedMotion()

  // 当前/退场中的状态栈：状态切换时旧姿势短暂淡出，避免硬切。
  // 每个变体先 decode sprite；帧切换只移动 sprite 坐标，避免透明闪烁。
  const [current, setCurrent] = useState<XiaoDiState>(state)
  const [currentVariant, setCurrentVariant] = useState<XiaoDiVariant>(variant)
  const [exiting, setExiting] = useState<StackEntry | null>(null)
  const [exitReady, setExitReady] = useState(false)
  const [step, setStep] = useState(0)
  const [displayFrame, setDisplayFrame] = useState(0)
  const [spriteReadyTick, setSpriteReadyTick] = useState(0)

  const onCycleEndRef = useRef(onCycleEnd)
  onCycleEndRef.current = onCycleEnd
  const currentRef = useRef(current)
  const currentVariantRef = useRef(currentVariant)
  const displayFrameRef = useRef(displayFrame)

  useEffect(() => {
    currentRef.current = current
  }, [current])

  useEffect(() => {
    currentVariantRef.current = currentVariant
  }, [currentVariant])

  useEffect(() => {
    displayFrameRef.current = displayFrame
  }, [displayFrame])

  useEffect(() => {
    let cancelled = false

    void preloadSprite(variant).then(() => {
      if (cancelled) return
      setSpriteReadyTick((value) => value + 1)
      const previous = currentRef.current
      const previousVariant = currentVariantRef.current
      if (state === previous && variant === previousVariant) return

      const previousFrame = displayFrameRef.current
      setExiting({ state: previous, variant: previousVariant, frame: previousFrame, exiting: true })
      setExitReady(false)
      currentRef.current = state
      currentVariantRef.current = variant
      displayFrameRef.current = 0
      setStep(0)
      setCurrent(state)
      setCurrentVariant(variant)
      setDisplayFrame(0)
    })

    return () => {
      cancelled = true
    }
  }, [state, variant])

  useEffect(() => {
    if (!exiting) return

    if (!exitReady) {
      if (!decodedSprites.has(spriteSrc(currentVariant))) return
      setExitReady(true)
      return
    }

    const timer = setTimeout(() => setExiting(null), 180)
    return () => clearTimeout(timer)
  }, [currentVariant, exiting, exitReady, spriteReadyTick])

  useEffect(() => {
    setStep(0)
    if (reducedMotion) return
    const sequence = frameSequence(current, currentVariant)
    const intervalMs = frameMs(current, currentVariant)
    let localStep = 0
    const timer = setInterval(() => {
      localStep = (localStep + 1) % sequence.length
      setStep(localStep)
      if (localStep === 0) onCycleEndRef.current?.(current)
    }, intervalMs)
    return () => clearInterval(timer)
  }, [current, currentVariant, reducedMotion])

  useEffect(() => {
    const sequence = frameSequence(current, currentVariant)
    const nextFrame = reducedMotion ? 0 : sequence[step % sequence.length]
    if (nextFrame === displayFrameRef.current) return

    displayFrameRef.current = nextFrame
    setDisplayFrame(nextFrame)
  }, [current, currentVariant, reducedMotion, step])

  const stacks: StackEntry[] =
    exiting && (exiting.state !== current || exiting.variant !== currentVariant)
      ? [exiting, { state: current, variant: currentVariant, frame: displayFrame, exiting: false }]
      : [{ state: current, variant: currentVariant, frame: displayFrame, exiting: false }]

  return (
    <div
      className={cn(styles.root, className)}
      style={{ width: size, height: size }}
      role="img"
      aria-label={STATE_LABELS[current]}
    >
      <div className={styles.shadow} aria-hidden />
      {stacks.map((entry) => {
        const config = STATE_CONFIG[entry.state]
        const entryKey = `${entry.state}-${entry.variant}`
        const shouldAnimateEntry = Boolean(exiting) && !entry.exiting && exitReady
        return (
          <div
            key={entryKey}
            className={cn(
              styles.stack,
              entry.exiting ? (exitReady ? styles.stackExit : styles.stackHold) : shouldAnimateEntry ? styles.stackEnter : styles.stackVisible,
            )}
          >
            <div className={cn(styles.layer, !reducedMotion && !entry.exiting && config.motionClass)}>
              <div className={styles.spriteViewport} aria-hidden>
                <div className={styles.spriteSheet} style={spriteSheetStyle(entry, size)} />
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

export const XiaoDi = memo(XiaoDiComponent)
