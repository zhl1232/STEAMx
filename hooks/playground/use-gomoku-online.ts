"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useAuth } from "@/lib/context/auth-context";
import { useGameRoom } from "@/hooks/playground/use-game-room";
import {
    getPlaygroundItem,
    setPlaygroundItem,
} from "@/lib/playground/storage";
import { usePlaygroundStatsLoader } from "@/lib/playground/use-playground-stats-loader";
import { createClient } from "@/lib/supabase/client";
import {
    GOMOKU_BOARD_SIZE,
    opponentColor,
    type GomokuCell,
    type GomokuColor,
    type GomokuPlaceStoneResult,
} from "@/lib/playground/gomoku-online";

export type GomokuOnlineResult = "win" | "loss" | "draw";

type GomokuOnlineStats = {
    totalGames: number;
    wins: number;
    losses: number;
    draws: number;
    gomokuOnlineWins: number;
};

const STATS_KEY = "gomoku_records";
const ACTIVE_MATCH_KEY = "gomoku_online_active_match";
// 已记账的 matchId 集合，持久化到 localStorage，避免重入已结束对局/新标签页重复记账。
const RECORDED_KEY = "gomoku_online_recorded";

const EMPTY_STATS: GomokuOnlineStats = {
    totalGames: 0,
    wins: 0,
    losses: 0,
    draws: 0,
    gomokuOnlineWins: 0,
};

function loadStats(): GomokuOnlineStats {
    const p = getPlaygroundItem<Partial<GomokuOnlineStats>>(STATS_KEY);
    if (!p) return { ...EMPTY_STATS };
    return {
        totalGames: p.totalGames ?? 0,
        wins: p.wins ?? 0,
        losses: p.losses ?? 0,
        draws: p.draws ?? 0,
        gomokuOnlineWins: p.gomokuOnlineWins ?? 0,
    };
}

// 从 localStorage 实时读最新值再增量写回，避免内存 stats 快照过期导致覆盖
// （例如 PvE 对局已把 wins 写大，切回在线结算时内存 prev 仍是旧值）。
function applyResultAndPersist(result: GomokuOnlineResult): GomokuOnlineStats {
    const prev = loadStats();
    const next = applyResultToStats(prev, result);
    saveStats(next);
    return next;
}

function saveStats(stats: GomokuOnlineStats) {
    // 合并到既有 records，避免覆盖 pve 等其它字段
    const existing = getPlaygroundItem<Record<string, unknown>>(STATS_KEY) ?? {};
    setPlaygroundItem(STATS_KEY, { ...existing, ...stats });
}

// 已记账 matchId 集合的持久化读写；上限保留最近 50 条避免无限增长。
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
 * 根据已结束对局与我的执子颜色，计算战绩增量。
 * 纯函数，便于单测；winner 为 'draw' 记平局，等于我的颜色记胜，否则记负。
 */
export function computeOnlineResult(
    winner: GomokuColor | "draw" | null,
    myColor: GomokuColor | null,
): GomokuOnlineResult | null {
    if (winner === null) return null;
    if (winner === "draw") return "draw";
    if (myColor === null) return null;
    return winner === myColor ? "win" : "loss";
}

export function applyResultToStats(
    prev: GomokuOnlineStats,
    result: GomokuOnlineResult,
): GomokuOnlineStats {
    return {
        totalGames: prev.totalGames + 1,
        wins: prev.wins + (result === "win" ? 1 : 0),
        losses: prev.losses + (result === "loss" ? 1 : 0),
        draws: prev.draws + (result === "draw" ? 1 : 0),
        gomokuOnlineWins: prev.gomokuOnlineWins + (result === "win" ? 1 : 0),
    };
}

function normalizeBoard(board: unknown): GomokuCell[][] {
    if (!Array.isArray(board) || board.length !== GOMOKU_BOARD_SIZE) return [];
    return board as GomokuCell[][];
}

function lineArray(line: unknown): { row: number; col: number }[] | null {
    if (!Array.isArray(line)) return null;
    return line as { row: number; col: number }[];
}

/**
 * 五子棋在线对战 hook。消费 useGameRoom 的房间状态，派生出棋盘/轮次/胜负，
 * 落子走 RPC gomoku_place_stone，结果由 Realtime/轮询回推统一更新（不本地改盘）。
 */
export function useGomokuOnline() {
    const { user } = useAuth();
    const room = useGameRoom();
    const supabaseRef = useRef(createClient());
    // room 整体每次渲染都是新引用，用 ref 在 callback 里引用以避免依赖告警与重建
    const roomRef = useRef(room);
    roomRef.current = room;

    const [stats, setStats] = useState<GomokuOnlineStats>(() => ({ ...EMPTY_STATS }));
    const [placing, setPlacing] = useState(false);
    const [lastError, setLastError] = useState<string | null>(null);
    // 已记账 matchId 集合（持久化），避免重入/新标签页重复记账
    const recordedRef = useRef<Set<string>>(loadRecordedIds());

    usePlaygroundStatsLoader(() => {
        setStats(loadStats());
    });

    // 判断某 matchId 是否已记账（内存优先，命中即返回；否则回查 localStorage 以覆盖跨标签页）
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

    const myColor: GomokuColor | null = useMemo(() => {
        if (!match || !myUserId) return null;
        if (match.host_user_id === myUserId) return match.host_color;
        if (match.guest_user_id === myUserId) return opponentColor(match.host_color);
        return null;
    }, [match, myUserId]);

    const board = useMemo(() => normalizeBoard(match?.board), [match?.board]);
    const currentTurn: GomokuColor = match?.current_turn ?? "black";
    const winner = match?.winner ?? null;
    const winLine = useMemo(() => lineArray(match?.win_line), [match?.win_line]);
    const moveCount = Array.isArray(match?.moves) ? match.moves.length : 0;
    const isMyTurn =
        match?.status === "playing" && myColor !== null && currentTurn === myColor;
    const isFinished = match?.status === "finished" || match?.status === "cancelled";

    // 记录活跃对局 id，便于刷新/断线后重连
    useEffect(() => {
        if (typeof window === "undefined") return;
        if (match?.id && (match.status === "waiting" || match.status === "playing")) {
            window.localStorage.setItem(ACTIVE_MATCH_KEY, match.id);
        } else if (match?.id && isFinished) {
            const stored = window.localStorage.getItem(ACTIVE_MATCH_KEY);
            if (stored === match.id) {
                window.localStorage.removeItem(ACTIVE_MATCH_KEY);
            }
        }
    }, [match?.id, match?.status, isFinished]);

    // 对局结束时写战绩（每场只记一次，跨标签页/重入已结束对局也去重）
    useEffect(() => {
        if (!match || !myColor) return;
        if (match.status !== "finished") return;
        if (isRecorded(match.id)) return;

        const result = computeOnlineResult(match.winner, myColor);
        if (!result) return;

        setStats(() => applyResultAndPersist(result));
        markStatsRecorded(match.id);
    }, [match, myColor, isRecorded, markStatsRecorded]);

    const makeMove = useCallback(
        async (row: number, col: number) => {
            if (!match?.id || placing) return;
            if (!isMyTurn) return;
            if (row < 0 || row >= GOMOKU_BOARD_SIZE || col < 0 || col >= GOMOKU_BOARD_SIZE)
                return;
            const cell = board[row]?.[col];
            if (cell?.value) return;

            setPlacing(true);
            setLastError(null);
            try {
                const { data, error } = await supabaseRef.current.rpc(
                    "gomoku_place_stone",
                    { match_uuid: match.id, p_row: row, p_col: col },
                );
                if (error) throw error;
                const result = (data as GomokuPlaceStoneResult[] | undefined)?.[0];
                if (!result?.ok) {
                    setLastError(result?.reason ?? "落子失败");
                }
                // 实际棋盘更新由 Realtime/轮询推回，这里不本地改盘
            } catch (error) {
                const message =
                    error instanceof Error ? error.message : "落子失败，请重试";
                setLastError(message);
            } finally {
                setPlacing(false);
            }
        },
        [board, isMyTurn, match?.id, placing],
    );

    // 暴露给页面的大厅操作
    const createRoom = useCallback(
        (hostColor: GomokuColor = "black") => room.createRoom(hostColor),
        [room],
    );
    const joinRoom = useCallback((code: string) => room.joinRoom(code), [room]);

    // 主动离开进行中对局：先本地记一次 loss（每局只记一次，与 finished 推回互斥），
    // 再清掉活跃对局缓存，最后调 room.leaveRoom 触发 API 判负 + 清状态。
    // 先清缓存很重要：room.leaveRoom 会把 match 置空，导致 finished 写战绩 effect 拿不到
    // match.id 来清缓存；若不清，刷新会 reconnect 回已结束对局并重复记战绩。
    const leaveRoom = useCallback(() => {
        const currentRoom = roomRef.current;
        const currentMatch = currentRoom.state.match;
        if (
            currentMatch &&
            currentMatch.status === "playing" &&
            myColor &&
            !isRecorded(currentMatch.id)
        ) {
            setStats(() => applyResultAndPersist("loss"));
            markStatsRecorded(currentMatch.id);
        }
        if (typeof window !== "undefined" && currentMatch?.id) {
            const stored = window.localStorage.getItem(ACTIVE_MATCH_KEY);
            if (stored === currentMatch.id) {
                window.localStorage.removeItem(ACTIVE_MATCH_KEY);
            }
        }
        void currentRoom.leaveRoom();
    }, [myColor, isRecorded, markStatsRecorded]);
    const reconnect = useCallback(
        (matchId: string) => room.reconnect(matchId),
        [room],
    );

    const reset = useCallback(() => {
        const currentRoom = roomRef.current;
        setLastError(null);
        if (typeof window !== "undefined") {
            // 清掉活跃对局记录，避免下次进入时误重连到已结束对局
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
        board,
        currentTurn,
        myColor,
        isMyTurn,
        isFinished,
        winner,
        winLine,
        moveCount,
        placing,
        stats,
        // 操作
        createRoom,
        joinRoom,
        leaveRoom,
        reconnect,
        makeMove,
        reset,
    };
}
