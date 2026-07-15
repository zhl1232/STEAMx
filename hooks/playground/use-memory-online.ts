"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useAuth } from "@/lib/context/auth-context";
import { useGameRoom, type GameRoomConfig } from "@/hooks/playground/use-game-room";
import { getPlaygroundItem, setPlaygroundItem } from "@/lib/playground/storage";
import { usePlaygroundStatsLoader } from "@/lib/playground/use-playground-stats-loader";
import { createClient } from "@/lib/supabase/client";
import {
    getMemoryColumns,
    opponentRole,
    type MemoryDifficulty,
    type MemoryFlipResult,
    type MemoryMatchRow,
    type MemoryRole,
    type MemoryTheme,
} from "@/lib/playground/memory-online";

export type MemoryOnlineResult = "win" | "loss" | "draw";

type MemoryOnlineStats = {
    totalGames: number;
    wins: number;
    losses: number;
    draws: number;
    memoryOnlineWins: number;
};

const STATS_KEY = "memory_match_online_stats";
const ACTIVE_MATCH_KEY = "memory_online_active_match";
const RECORDED_KEY = "memory_online_recorded";

// 记忆翻牌房间层配置：建房时把 { theme, difficulty } 作为请求体。
const MEMORY_ROOM_CONFIG: GameRoomConfig = {
    table: "memory_matches",
    apiBase: "/api/playground/memory-rooms",
    channelPrefix: "memory-match",
    createBody: (options) => {
        const opts = (options ?? {}) as { theme?: MemoryTheme; difficulty?: MemoryDifficulty };
        return { theme: opts.theme, difficulty: opts.difficulty };
    },
};

const EMPTY_STATS: MemoryOnlineStats = {
    totalGames: 0,
    wins: 0,
    losses: 0,
    draws: 0,
    memoryOnlineWins: 0,
};

function loadStats(): MemoryOnlineStats {
    const p = getPlaygroundItem<Partial<MemoryOnlineStats>>(STATS_KEY);
    if (!p) return { ...EMPTY_STATS };
    return {
        totalGames: p.totalGames ?? 0,
        wins: p.wins ?? 0,
        losses: p.losses ?? 0,
        draws: p.draws ?? 0,
        memoryOnlineWins: p.memoryOnlineWins ?? 0,
    };
}

function saveStats(stats: MemoryOnlineStats) {
    const existing = getPlaygroundItem<Record<string, unknown>>(STATS_KEY) ?? {};
    setPlaygroundItem(STATS_KEY, { ...existing, ...stats });
}

function applyResultAndPersist(result: MemoryOnlineResult): MemoryOnlineStats {
    const prev = loadStats();
    const next = applyResultToStats(prev, result);
    saveStats(next);
    return next;
}

function loadRecordedIds(): Set<string> {
    if (typeof window === "undefined") return new Set();
    try {
        const raw = window.localStorage.getItem(RECORDED_KEY);
        if (!raw) return new Set();
        const arr = JSON.parse(raw) as unknown;
        if (!Array.isArray(arr)) return new Set();
        return new Set(arr.filter((x): x is string => typeof x === "string"));
    } catch {
        return new Set();
    }
}

function markRecorded(matchId: string) {
    if (typeof window === "undefined") return;
    const set = loadRecordedIds();
    set.add(matchId);
    const arr = Array.from(set).slice(-50);
    try {
        window.localStorage.setItem(RECORDED_KEY, JSON.stringify(arr));
    } catch {
        // localStorage 不可用时静默
    }
}

/**
 * 据已结束对局的 winner 与我的角色计算战绩增量。纯函数，便于单测。
 * winner='draw' 记平；等于我的角色记胜；否则记负。
 */
export function computeMemoryOnlineResult(
    winner: MemoryRole | "draw" | null,
    myRole: MemoryRole | null,
): MemoryOnlineResult | null {
    if (winner === null) return null;
    if (winner === "draw") return "draw";
    if (myRole === null) return null;
    return winner === myRole ? "win" : "loss";
}

export function applyResultToStats(
    prev: MemoryOnlineStats,
    result: MemoryOnlineResult,
): MemoryOnlineStats {
    return {
        totalGames: prev.totalGames + 1,
        wins: prev.wins + (result === "win" ? 1 : 0),
        losses: prev.losses + (result === "loss" ? 1 : 0),
        draws: prev.draws + (result === "draw" ? 1 : 0),
        memoryOnlineWins: prev.memoryOnlineWins + (result === "win" ? 1 : 0),
    };
}

/**
 * 记忆翻牌在线对战 hook。消费 useGameRoom 的房间状态，派生出牌堆/轮次/比分/胜负，
 * 翻牌走 RPC memory_flip_card，结果由 Realtime/轮询回推统一更新（不本地改盘）。
 */
export function useMemoryOnline() {
    const { user } = useAuth();
    const room = useGameRoom<MemoryMatchRow>(MEMORY_ROOM_CONFIG);
    const supabaseRef = useRef(createClient());
    const roomRef = useRef(room);
    roomRef.current = room;

    const [stats, setStats] = useState<MemoryOnlineStats>(() => ({ ...EMPTY_STATS }));
    const [flipping, setFlipping] = useState(false);
    const [lastError, setLastError] = useState<string | null>(null);
    const recordedRef = useRef<Set<string>>(loadRecordedIds());

    usePlaygroundStatsLoader(() => {
        setStats(loadStats());
    });

    const isRecorded = useCallback((matchId: string): boolean => {
        if (recordedRef.current.has(matchId)) return true;
        const fresh = loadRecordedIds();
        if (fresh.has(matchId)) {
            recordedRef.current = fresh;
            return true;
        }
        return false;
    }, []);

    const markStatsRecorded = useCallback((matchId: string) => {
        recordedRef.current = new Set(recordedRef.current).add(matchId);
        markRecorded(matchId);
    }, []);

    const match = room.state.match;
    const myUserId = user?.id ?? null;

    const myRole: MemoryRole | null = useMemo(() => {
        if (!match || !myUserId) return null;
        if (match.host_user_id === myUserId) return "host";
        if (match.guest_user_id === myUserId) return "guest";
        return null;
    }, [match, myUserId]);

    const deck = useMemo(() => (Array.isArray(match?.deck) ? match.deck : []), [match?.deck]);
    const currentTurn: MemoryRole = match?.current_turn ?? "host";
    const scores = match?.scores ?? { host: 0, guest: 0 };
    const winner = match?.winner ?? null;
    const firstFlip = match?.first_flip ?? null;
    const lastResult = match?.last_result ?? null;
    const resultSeq = match?.result_seq ?? 0;
    const isMyTurn = match?.status === "playing" && myRole !== null && currentTurn === myRole;
    const isFinished = match?.status === "finished" || match?.status === "cancelled";
    const columns = getMemoryColumns((match?.difficulty ?? "easy") as MemoryDifficulty);

    // 记录活跃对局 id，便于刷新/断线后重连
    useEffect(() => {
        if (typeof window === "undefined") return;
        if (match?.id && (match.status === "waiting" || match.status === "playing")) {
            window.localStorage.setItem(ACTIVE_MATCH_KEY, match.id);
        } else if (match?.id && isFinished) {
            const stored = window.localStorage.getItem(ACTIVE_MATCH_KEY);
            if (stored === match.id) window.localStorage.removeItem(ACTIVE_MATCH_KEY);
        }
    }, [match?.id, match?.status, isFinished]);

    // 对局结束时写战绩（每场只记一次，跨标签页/重入去重）
    useEffect(() => {
        if (!match || !myRole) return;
        if (match.status !== "finished") return;
        if (isRecorded(match.id)) return;

        const result = computeMemoryOnlineResult(match.winner, myRole);
        if (!result) return;

        setStats(() => applyResultAndPersist(result));
        markStatsRecorded(match.id);
    }, [match, myRole, isRecorded, markStatsRecorded]);

    const flipCard = useCallback(
        async (cardId: string) => {
            if (!match?.id || flipping) return;
            if (!isMyTurn) return;
            const card = deck.find((c) => c.id === cardId);
            if (!card || card.matched) return;
            if (firstFlip?.id === cardId) return;

            setFlipping(true);
            setLastError(null);
            try {
                const { data, error } = await supabaseRef.current.rpc("memory_flip_card", {
                    match_uuid: match.id,
                    p_card_id: cardId,
                });
                if (error) throw error;
                const result = (data as MemoryFlipResult[] | undefined)?.[0];
                if (!result?.ok) setLastError(result?.reason ?? "翻牌失败");
                // 实际牌堆更新由 Realtime/轮询推回，这里不本地改盘
            } catch (error) {
                const message = error instanceof Error ? error.message : "翻牌失败，请重试";
                setLastError(message);
            } finally {
                setFlipping(false);
            }
        },
        [deck, firstFlip?.id, flipping, isMyTurn, match?.id],
    );

    const createRoom = useCallback(
        (theme: MemoryTheme = "animals", difficulty: MemoryDifficulty = "easy") =>
            room.createRoom({ theme, difficulty }),
        [room],
    );
    const joinRoom = useCallback((code: string) => room.joinRoom(code), [room]);

    // 主动离开进行中对局：先本地记一次 loss（每局只记一次），再清活跃缓存，最后调 leave API。
    const leaveRoom = useCallback(() => {
        const currentRoom = roomRef.current;
        const currentMatch = currentRoom.state.match;
        if (
            currentMatch &&
            currentMatch.status === "playing" &&
            myRole &&
            !isRecorded(currentMatch.id)
        ) {
            setStats(() => applyResultAndPersist("loss"));
            markStatsRecorded(currentMatch.id);
        }
        if (typeof window !== "undefined" && currentMatch?.id) {
            const stored = window.localStorage.getItem(ACTIVE_MATCH_KEY);
            if (stored === currentMatch.id) window.localStorage.removeItem(ACTIVE_MATCH_KEY);
        }
        void currentRoom.leaveRoom();
    }, [myRole, isRecorded, markStatsRecorded]);

    const reconnect = useCallback((matchId: string) => room.reconnect(matchId), [room]);

    const reset = useCallback(() => {
        const currentRoom = roomRef.current;
        setLastError(null);
        if (typeof window !== "undefined") {
            const stored = window.localStorage.getItem(ACTIVE_MATCH_KEY);
            if (stored && stored === currentRoom.state.matchId) {
                window.localStorage.removeItem(ACTIVE_MATCH_KEY);
            }
        }
        currentRoom.resetLocalState();
    }, []);

    return {
        // 房间
        phase: room.state.phase,
        matchId: room.state.matchId,
        code: room.state.code,
        error: room.state.error ?? lastError,
        // 对局
        match,
        deck,
        columns,
        currentTurn,
        myRole,
        isMyTurn,
        isFinished,
        winner,
        scores,
        firstFlip,
        lastResult,
        resultSeq,
        flipping,
        stats,
        opponentRole,
        // 操作
        createRoom,
        joinRoom,
        leaveRoom,
        reconnect,
        flipCard,
        reset,
    };
}
