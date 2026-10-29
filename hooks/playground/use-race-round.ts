"use client"

import { useEffect, useRef, useState } from "react"

type RaceRound = {
    matchId?: string | null
    match?: { id: string; status: string } | null
    isWaiting: boolean
    isPlaying: boolean
    hasSubmitted: boolean
}

/** A room starts a fresh local round once, even when its settings match solo play. */
export function useRaceRound(race: RaceRound, startRound: () => void) {
    const startedRef = useRef<string | null>(null)
    const waitingRef = useRef<string | null>(null)
    const [readyMatch, setReadyMatch] = useState<string | null>(null)
    const active = race.isWaiting || race.isPlaying
    const loaded = Boolean(race.matchId) && race.match?.id === race.matchId
        && race.match?.status === (race.isPlaying ? "playing" : "waiting")

    useEffect(() => {
        // Joining publishes phase/id before the authoritative room fetch completes.
        if (!loaded) return
        if (race.isWaiting && race.matchId && waitingRef.current !== race.matchId) {
            waitingRef.current = race.matchId
            startRound()
            return
        }
        if (!race.isPlaying || !race.matchId || startedRef.current === race.matchId) return
        startedRef.current = race.matchId
        startRound()
        setReadyMatch(race.matchId)
    }, [loaded, race.isPlaying, race.isWaiting, race.matchId, startRound])

    const ready = loaded && race.isPlaying && Boolean(race.matchId) && readyMatch === race.matchId
    return {
        active,
        canPlay: !active || (ready && !race.hasSubmitted),
        canSubmit: ready && !race.hasSubmitted,
    }
}
