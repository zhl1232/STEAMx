"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useGameRoom, type GameRoomConfig } from "@/hooks/playground/use-game-room";
import { useAuth } from "@/lib/context/auth-context";
import {
    RACE_GAME_META,
    decideRaceWinner,
    oppositeRaceRole,
    type RaceGameKey,
    type RaceMatchRow,
    type RaceResult,
    type RaceRole,
    type RaceSettings,
    type RaceWinner,
} from "@/lib/playground/race-online";

function stableSettingsKey(settings: RaceSettings): string {
    const keys = Object.keys(settings).sort() as Array<keyof RaceSettings>;
    return JSON.stringify(
        keys.reduce<Record<string, string | number>>((acc, key) => {
            const value = settings[key];
            if (value !== undefined) acc[key] = value;
            return acc;
        }, {}),
    );
}

export function activeRaceMatchKey(gameKey: RaceGameKey): string {
    return `playground_race_active_${gameKey}`;
}

export function useRaceOnline(gameKey: RaceGameKey, settings: RaceSettings) {
    const { user } = useAuth();
    const settingsKey = stableSettingsKey(settings);
    const submittedRef = useRef<Set<string>>(new Set());
    const [submitting, setSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState<string | null>(null);

    const config = useMemo<GameRoomConfig>(
        () => ({
            table: "playground_race_matches",
            apiBase: "/api/playground/race-rooms",
            channelPrefix: "race-match",
            createBody: () => ({
                game_key: gameKey,
                settings,
            }),
            joinBody: (code) => ({ code, game_key: gameKey }),
        }),
        // settingsKey intentionally narrows dependency churn for object props.
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [gameKey, settingsKey],
    );

    const room = useGameRoom<RaceMatchRow>(config);
    const match = room.state.match;
    const myUserId = user?.id ?? null;

    const myRole: RaceRole | null = useMemo(() => {
        if (!match || !myUserId) return null;
        if (match.host_user_id === myUserId) return "host";
        if (match.guest_user_id === myUserId) return "guest";
        return null;
    }, [match, myUserId]);

    const opponentRole: RaceRole | null = myRole ? oppositeRaceRole(myRole) : null;
    const myResult = myRole ? (myRole === "host" ? match?.host_result : match?.guest_result) ?? null : null;
    const opponentResult = opponentRole
        ? (opponentRole === "host" ? match?.host_result : match?.guest_result) ?? null
        : null;
    const winner: RaceWinner = match?.winner ?? decideRaceWinner(gameKey, match?.host_result ?? null, match?.guest_result ?? null);
    const activeKey = activeRaceMatchKey(gameKey);
    const hasSubmitted =
        Boolean(match?.id && submittedRef.current.has(match.id)) || myResult !== null;

    useEffect(() => {
        if (typeof window === "undefined") return;
        if (match?.id && (match.status === "waiting" || match.status === "playing")) {
            window.localStorage.setItem(activeKey, match.id);
        } else if (match?.id && (match.status === "finished" || match.status === "cancelled")) {
            const stored = window.localStorage.getItem(activeKey);
            if (stored === match.id) window.localStorage.removeItem(activeKey);
        }
    }, [activeKey, match?.id, match?.status]);

    const createRoom = useCallback(() => room.createRoom(), [room]);
    const joinRoom = useCallback((code: string) => room.joinRoom(code), [room]);

    const submitResult = useCallback(
        async (result: RaceResult | Omit<RaceResult, "completed">) => {
            if (!match?.id || hasSubmitted || submitting) return null;
            setSubmitting(true);
            setSubmitError(null);
            try {
                const res = await fetch(`/api/playground/race-rooms/${match.id}/result`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ result: { completed: true, ...result } }),
                });
                if (!res.ok) {
                    const body = await res.json().catch(() => null);
                    throw new Error(body?.error ?? "提交成绩失败");
                }
                submittedRef.current = new Set(submittedRef.current).add(match.id);
                room.refresh();
                return (await res.json()) as { match: RaceMatchRow };
            } catch (error) {
                const message = error instanceof Error ? error.message : "提交成绩失败";
                setSubmitError(message);
                return null;
            } finally {
                setSubmitting(false);
            }
        },
        [hasSubmitted, match?.id, room, submitting],
    );

    const leaveRoom = useCallback(() => {
        setSubmitError(null);
        void room.leaveRoom();
    }, [room]);

    const reset = useCallback(() => {
        setSubmitError(null);
        if (typeof window !== "undefined" && room.state.matchId) {
            const stored = window.localStorage.getItem(activeKey);
            if (stored === room.state.matchId) window.localStorage.removeItem(activeKey);
        }
        room.resetLocalState();
    }, [activeKey, room]);

    return {
        gameKey,
        meta: RACE_GAME_META[gameKey],
        activeMatchStorageKey: activeKey,
        phase: room.state.phase,
        matchId: room.state.matchId,
        code: room.state.code,
        match,
        settings: match?.settings ?? settings,
        error: submitError ?? room.state.error,
        submitting,
        myRole,
        opponentRole,
        myResult,
        opponentResult,
        winner,
        hasSubmitted,
        isWaiting: room.state.phase === "waiting",
        isPlaying: room.state.phase === "playing",
        isFinished: room.state.phase === "finished",
        createRoom,
        joinRoom,
        reconnect: room.reconnect,
        leaveRoom,
        submitResult,
        reset,
        refresh: room.refresh,
    };
}
