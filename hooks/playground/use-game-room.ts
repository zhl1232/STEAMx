"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";

import { useAuth } from "@/lib/context/auth-context";
import { logger } from "@/lib/logger";
import { createClient } from "@/lib/supabase/client";
import type { BaseMatchRow } from "@/lib/playground/online-room";

export type GameRoomPhase =
    | "idle"
    | "creating"
    | "waiting"
    | "joining"
    | "playing"
    | "finished"
    | "error";

export type GameRoomState<TRow extends BaseMatchRow> = {
    phase: GameRoomPhase;
    matchId: string | null;
    code: string | null;
    match: TRow | null;
    error: string | null;
};

/**
 * 各游戏接入房间层需提供的配置。传输逻辑（channel/订阅/轮询/重连）与游戏无关，
 * 差异只在：对局表名、房间 API 前缀、Realtime channel 前缀、建房请求体。
 */
export type GameRoomConfig = {
    /** 对局表名，如 "gomoku_matches" / "memory_matches" */
    table: string;
    /** 房间 API 前缀，如 "/api/playground/gomoku-rooms" */
    apiBase: string;
    /** 私有 channel 前缀，如 "gomoku-match"（实际 topic 为 `${prefix}:${matchId}`） */
    channelPrefix: string;
    /** 建房请求体构造（如五子棋发 { host_color }）；无则发空体 */
    createBody?: (options?: unknown) => Record<string, unknown>;
    /** 加入请求体构造；默认只发 { code } */
    joinBody?: (code: string) => Record<string, unknown>;
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

function isRealtimeFailureStatus(status: string) {
    return status === "CHANNEL_ERROR" || status === "TIMED_OUT";
}

/**
 * 通用在线对战房间 hook（五子棋、记忆翻牌等复用）。
 * 负责：建房、加入、拉取全量、postgres_changes 订阅、断线轮询兜底、清理。
 * 落子/翻牌与胜负判定由调用方通过各游戏的 RPC 触发，本 hook 只负责状态广播。
 * 游戏差异经 config（表名/API 前缀/channel 前缀/建房体）注入。
 */
export function useGameRoom<TRow extends BaseMatchRow>(config: GameRoomConfig) {
    const { table, apiBase, channelPrefix, createBody, joinBody } = config;
    const { user } = useAuth();
    const supabaseRef = useRef(createClient());
    const channelRef = useRef<RealtimeChannel | null>(null);
    const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const lastMatchIdRef = useRef<string | null>(null);
    const realtimeUnavailableRef = useRef(false);

    const [state, setState] = useState<GameRoomState<TRow>>({
        phase: "idle",
        matchId: null,
        code: null,
        match: null,
        error: null,
    });

    const updateMatch = useCallback((row: TRow | null) => {
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

    const fetchMatch = useCallback(
        async (matchId: string) => {
            // table 是运行期字符串（各游戏对局表），Supabase 类型客户端无法窄化到已知表，
            // 会把列名推断为 never。id 列在所有对局表都存在，用最小接口断言避开类型窄化，运行时不变。
            const db = supabaseRef.current as unknown as {
                from: (table: string) => {
                    select: (cols: string) => {
                        eq: (col: string, val: string) => {
                            maybeSingle: () => Promise<{ data: unknown; error: unknown }>;
                        };
                    };
                };
            };
            const { data, error } = await db
                .from(table)
                .select("*")
                .eq("id", matchId)
                .maybeSingle();
            if (error) {
                logger.warn("game room fetch match failed", { table, error });
                return null;
            }
            return data as TRow | null;
        },
        [table],
    );

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

            const handleRow = (row: TRow | null) => {
                if (row) updateMatch(row);
            };

            if (shouldSubscribePlaygroundRealtime() && !realtimeUnavailableRef.current) {
                const channel = supabaseRef.current.channel(
                    `${channelPrefix}:${matchId}`,
                    { config: { private: true } },
                );
                channel
                    .on(
                        "postgres_changes",
                        {
                            event: "*",
                            schema: "public",
                            table,
                            filter: `id=eq.${matchId}`,
                        },
                        (payload) => {
                            updateMatch(payload.new as TRow);
                        },
                    )
                    .subscribe((status, error) => {
                        if (isRealtimeFailureStatus(status)) {
                            realtimeUnavailableRef.current = true;
                            logger.warn("game room realtime channel unavailable", {
                                table,
                                status,
                                error,
                            });
                            if (channelRef.current === channel) {
                                channelRef.current = null;
                                void supabaseRef.current.removeChannel(channel).finally(() => {
                                    supabaseRef.current.realtime.disconnect();
                                });
                            }
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
        [channelPrefix, clearPolling, fetchMatch, table, unsubscribe, updateMatch],
    );

    const createRoom = useCallback(
        async (options?: unknown) => {
            if (!user?.id) {
                setState((p) => ({ ...p, error: "请先登录", phase: "error" }));
                return null;
            }
            setState((p) => ({ ...p, phase: "creating", error: null }));
            try {
                const res = await fetch(apiBase, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(createBody ? createBody(options) : {}),
                });
                if (!res.ok) {
                    const body = await res.json().catch(() => null);
                    throw new Error(body?.error ?? "创建房间失败");
                }
                const data = (await res.json()) as { id: string; code: string };
                setState((p) => ({
                    ...p,
                    phase: "waiting",
                    matchId: data.id,
                    code: data.code,
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
        [apiBase, createBody, fetchMatch, subscribe, updateMatch, user?.id],
    );

    const joinRoom = useCallback(
        async (code: string) => {
            if (!user?.id) {
                setState((p) => ({ ...p, error: "请先登录", phase: "error" }));
                return null;
            }
            setState((p) => ({ ...p, phase: "joining", error: null }));
            try {
                const res = await fetch(`${apiBase}/join`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(joinBody ? joinBody(code) : { code }),
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
        [apiBase, fetchMatch, joinBody, subscribe, updateMatch, user?.id],
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
            await fetch(`${apiBase}/${matchId}/leave`, { method: "POST" });
        } catch {
            // 离开失败不阻塞 UI
        } finally {
            unsubscribe();
            setState({
                phase: "idle",
                matchId: null,
                code: null,
                match: null,
                error: null,
            });
        }
    }, [apiBase, state.matchId, unsubscribe]);

    // 仅清本地状态与订阅，不调 leave API（用于已结束对局"再开一局"）
    const resetLocalState = useCallback(() => {
        unsubscribe();
        setState({
            phase: "idle",
            matchId: null,
            code: null,
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
