"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";

import { useAuth } from "@/lib/context/auth-context";
import { logger } from "@/lib/logger";
import { createClient } from "@/lib/supabase/client";
import type {
    GomokuColor,
    GomokuMatchRow,
} from "@/lib/playground/gomoku-online";

export type GameRoomPhase =
    | "idle"
    | "creating"
    | "waiting"
    | "joining"
    | "playing"
    | "finished"
    | "error";

export type GameRoomState = {
    phase: GameRoomPhase;
    matchId: string | null;
    code: string | null;
    hostColor: GomokuColor | null;
    match: GomokuMatchRow | null;
    error: string | null;
};

// Realtime 开关：与 notification-context 同款约定，本地开发默认跳过 WebSocket。
function isLocalDevelopmentHost() {
    if (process.env.NODE_ENV !== "development") return false;
    if (typeof window === "undefined") return false;
    return (
        window.location.hostname === "localhost" ||
        window.location.hostname === "127.0.0.1"
    );
}

function shouldSubscribePlaygroundRealtime() {
    if (process.env.NEXT_PUBLIC_ENABLE_PLAYGROUND_REALTIME === "true") return true;
    if (process.env.NEXT_PUBLIC_ENABLE_PLAYGROUND_REALTIME === "false") return false;
    return !isLocalDevelopmentHost();
}

const RECONNECT_POLL_INTERVAL_MS = 4000;

/**
 * 通用在线对战房间 hook（MVP 仅服务于五子棋，但 channel/订阅逻辑与游戏无关）。
 * 负责：建房、加入、拉取全量、postgres_changes 订阅、断线轮询兜底、清理。
 * 落子与胜负判定由调用方通过 RPC 触发，本 hook 只负责状态广播。
 */
export function useGameRoom() {
    const { user } = useAuth();
    const supabaseRef = useRef(createClient());
    const channelRef = useRef<RealtimeChannel | null>(null);
    const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const lastMatchIdRef = useRef<string | null>(null);

    const [state, setState] = useState<GameRoomState>({
        phase: "idle",
        matchId: null,
        code: null,
        hostColor: null,
        match: null,
        error: null,
    });

    const updateMatch = useCallback((row: GomokuMatchRow | null) => {
        setState((prev) => {
            const phase: GameRoomPhase =
                row == null
                    ? prev.phase
                    : row.status === "waiting"
                      ? prev.phase === "joining"
                          ? "joining"
                          : "waiting"
                      : row.status === "playing"
                        ? "playing"
                        : row.status === "finished"
                          ? "finished"
                          : row.status === "cancelled"
                            ? "finished"
                            : prev.phase;
            return { ...prev, match: row, phase };
        });
    }, []);

    const fetchMatch = useCallback(async (matchId: string) => {
        const { data, error } = await supabaseRef.current
            .from("gomoku_matches")
            .select("*")
            .eq("id", matchId)
            .maybeSingle();
        if (error) {
            logger.warn("gomoku fetch match failed", { error });
            return null;
        }
        return data as GomokuMatchRow | null;
    }, []);

    const clearPolling = useCallback(() => {
        if (pollRef.current !== null) {
            clearInterval(pollRef.current);
            pollRef.current = null;
        }
    }, []);

    const unsubscribe = useCallback(() => {
        clearPolling();
        if (channelRef.current) {
            void supabaseRef.current.removeChannel(channelRef.current);
            channelRef.current = null;
        }
    }, [clearPolling]);

    // 订阅对局变更；Realtime 关闭时退化为轮询。
    const subscribe = useCallback(
        (matchId: string) => {
            unsubscribe();
            lastMatchIdRef.current = matchId;

            const handleRow = (row: GomokuMatchRow | null) => {
                if (row) updateMatch(row);
            };

            if (shouldSubscribePlaygroundRealtime()) {
                const channel = supabaseRef.current
                    .channel(`gomoku-match:${matchId}`, {
                        config: { private: true },
                    })
                    .on(
                        "postgres_changes",
                        {
                            event: "*",
                            schema: "public",
                            table: "gomoku_matches",
                            filter: `id=eq.${matchId}`,
                        },
                        (payload) => {
                            updateMatch(payload.new as GomokuMatchRow);
                        },
                    )
                    .subscribe((status, error) => {
                        if (
                            status === "CHANNEL_ERROR" ||
                            status === "TIMED_OUT" ||
                            status === "CLOSED"
                        ) {
                            logger.warn("gomoku realtime channel unavailable", {
                                status,
                                error,
                            });
                        }
                    });
                channelRef.current = channel;
            }

            // Realtime 关闭或作为兜底：定期拉取全量
            clearPolling();
            pollRef.current = setInterval(async () => {
                if (lastMatchIdRef.current !== matchId) return;
                const row = await fetchMatch(matchId);
                handleRow(row);
                if (row && (row.status === "finished" || row.status === "cancelled")) {
                    clearPolling();
                }
            }, RECONNECT_POLL_INTERVAL_MS);
        },
        [clearPolling, fetchMatch, unsubscribe, updateMatch],
    );

    const createRoom = useCallback(
        async (hostColor: GomokuColor = "black") => {
            if (!user?.id) {
                setState((p) => ({ ...p, error: "请先登录", phase: "error" }));
                return null;
            }
            setState((p) => ({ ...p, phase: "creating", error: null }));
            try {
                const res = await fetch("/api/playground/gomoku-rooms", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ host_color: hostColor }),
                });
                if (!res.ok) {
                    const body = await res.json().catch(() => null);
                    throw new Error(body?.error ?? "创建房间失败");
                }
                const data = (await res.json()) as {
                    id: string;
                    code: string;
                    host_color: GomokuColor;
                };
                setState((p) => ({
                    ...p,
                    phase: "waiting",
                    matchId: data.id,
                    code: data.code,
                    hostColor: data.host_color,
                    error: null,
                }));
                subscribe(data.id);
                const row = await fetchMatch(data.id);
                if (row) updateMatch(row);
                return data;
            } catch (error) {
                const message = error instanceof Error ? error.message : "创建房间失败";
                setState((p) => ({ ...p, phase: "error", error: message }));
                return null;
            }
        },
        [fetchMatch, subscribe, updateMatch, user?.id],
    );

    const joinRoom = useCallback(
        async (code: string) => {
            if (!user?.id) {
                setState((p) => ({ ...p, error: "请先登录", phase: "error" }));
                return null;
            }
            setState((p) => ({ ...p, phase: "joining", error: null }));
            try {
                const res = await fetch("/api/playground/gomoku-rooms/join", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ code }),
                });
                if (!res.ok) {
                    const body = await res.json().catch(() => null);
                    throw new Error(body?.error ?? "加入房间失败");
                }
                const data = (await res.json()) as {
                    id: string;
                    code: string;
                    status: string;
                };
                // 重入已开始/已结束对局时，phase 跟随服务端 status
                const nextPhase =
                    data.status === "waiting"
                        ? "joining"
                        : data.status === "playing"
                          ? "playing"
                          : data.status === "finished" ||
                              data.status === "cancelled"
                            ? "finished"
                            : "joining";
                setState((p) => ({
                    ...p,
                    phase: nextPhase,
                    matchId: data.id,
                    code: data.code,
                    error: null,
                }));
                subscribe(data.id);
                const row = await fetchMatch(data.id);
                if (row) updateMatch(row);
                return data;
            } catch (error) {
                const message = error instanceof Error ? error.message : "加入房间失败";
                setState((p) => ({ ...p, phase: "error", error: message }));
                return null;
            }
        },
        [fetchMatch, subscribe, updateMatch, user?.id],
    );

    // 按 matchId 重连（页面冷启动 / 刷新恢复）
    const reconnect = useCallback(
        async (matchId: string) => {
            setState((p) => ({ ...p, matchId, error: null }));
            const row = await fetchMatch(matchId);
            if (!row) {
                setState((p) => ({ ...p, phase: "idle", error: "对局不存在" }));
                return false;
            }
            setState((p) => ({
                ...p,
                matchId: row.id,
                code: row.code,
                hostColor: row.host_color,
                match: row,
                phase:
                    row.status === "waiting"
                        ? "waiting"
                        : row.status === "playing"
                          ? "playing"
                          : "finished",
            }));
            if (row.status === "waiting" || row.status === "playing") {
                subscribe(row.id);
            }
            return true;
        },
        [fetchMatch, subscribe],
    );

    const leaveRoom = useCallback(async () => {
        const matchId = state.matchId;
        if (!matchId) return;
        try {
            await fetch(`/api/playground/gomoku-rooms/${matchId}/leave`, {
                method: "POST",
            });
        } catch {
            // 离开失败不阻塞 UI
        } finally {
            unsubscribe();
            setState({
                phase: "idle",
                matchId: null,
                code: null,
                hostColor: null,
                match: null,
                error: null,
            });
        }
    }, [state.matchId, unsubscribe]);

    // 仅清本地状态与订阅，不调 leave API（用于已结束对局"再开一局"）
    const resetLocalState = useCallback(() => {
        unsubscribe();
        setState({
            phase: "idle",
            matchId: null,
            code: null,
            hostColor: null,
            match: null,
            error: null,
        });
    }, [unsubscribe]);

    // 卸载时清理 channel 与轮询
    useEffect(() => {
        const supabase = supabaseRef.current;
        return () => {
            clearPolling();
            const channel = channelRef.current;
            if (channel) {
                void supabase.removeChannel(channel);
                channelRef.current = null;
            }
        };
    }, [clearPolling]);

    return {
        state,
        createRoom,
        joinRoom,
        reconnect,
        leaveRoom,
        resetLocalState,
        refresh: useCallback(() => {
            if (state.matchId) {
                void fetchMatch(state.matchId).then(updateMatch);
            }
        }, [fetchMatch, state.matchId, updateMatch]),
    };
}
