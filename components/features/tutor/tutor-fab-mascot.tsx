'use client'

import { memo, useEffect, useState } from 'react'

import { XiaoDi, type XiaoDiState } from '@/components/features/tutor/xiaodi'
import type { TutorFabDockEdge } from '@/components/features/tutor/tutor-fab-position'
import { cn } from '@/lib/utils'

import styles from './tutor-fab-dock.module.css'

const EDGE_PEEK_SRC = '/xiaodi-ai/edge-peek.webp'

type TutorFabMascotProps = {
  state: XiaoDiState
  docked: boolean
  edge: TutorFabDockEdge
  edgeDockEnabled: boolean
  onCycleEnd: (state: XiaoDiState) => void
}

/** Keep the standing pose visible until the small mobile-only peek asset has decoded. */
export const TutorFabMascot = memo(function TutorFabMascot({
  state,
  docked,
  edge,
  edgeDockEnabled,
  onCycleEnd,
}: TutorFabMascotProps) {
  const [peekReady, setPeekReady] = useState(false)

  useEffect(() => {
    if (!edgeDockEnabled || peekReady) return
    let cancelled = false
    const image = new window.Image()
    image.decoding = 'async'
    image.onload = () => {
      void image.decode().catch(() => undefined).then(() => {
        if (!cancelled) setPeekReady(true)
      })
    }
    image.src = EDGE_PEEK_SRC
    return () => { cancelled = true }
  }, [edgeDockEnabled, peekReady])

  const showPeek = docked && peekReady && state === 'idle'

  return (
    <span className={styles.visual} data-edge={edge} aria-hidden="true">
      <span className={cn(styles.standing, showPeek && styles.standingResting)}>
        <XiaoDi state={state} size={86} animated={state !== 'idle'} onCycleEnd={onCycleEnd} />
      </span>
      {peekReady && (
        <span className={cn(styles.peek, showPeek && styles.peekVisible)}>
          <span className={cn(styles.peekArt, edge === 'left' && styles.peekArtLeft)} />
        </span>
      )}
    </span>
  )
})
