"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
    useGameRoom,
    type GameRoomConfig,
} from "@/hooks/playground/use-game-room";
import { useAuth } from "@/lib/context/auth-context";
import {
    addFunctionWarsRepairsToMap,
    availableFunctionWarsCrates,
    buildFunctionWarsOnlineMap,
    createFunctionWarsInitialInventory,
    FUNCTION_WARS_DEFAULT_MAP_ID,
    isFunctionWarsWeaponId,
    normalizeFunctionWarsExpression,
    type FunctionWarsCrater,
    type FunctionWarsFireResult,
    type FunctionWarsHp,
    type FunctionWarsMapId,
    type FunctionWarsMatchRow,
    type FunctionWarsOnlineCrate,
    type FunctionWarsRepair,
    type FunctionWarsRole,
    type FunctionWarsWeaponId,
    type FunctionWarsWinner,
} from "@/lib/playground/function-wars-online";
import {
    getPlaygroundItem,
    setPlaygroundItem,
} from "@/lib/playground/storage";
import { usePlaygroundStatsLoader } from "@/lib/playground/use-playground-stats-loader";
import { createClient } from "@/lib/supabase/client";

export const FUNCTION_WARS_ROOM_CONFIG: GameRoomConfig = {
    table: "function_wars_matches",
    apiBase: "/api/playground/functionwars-rooms",
    channelPrefix: "function-wars-match",
    createBody: (options) => ({
        map_id:
            (options as { mapId?: FunctionWarsMapId } | undefined)?.mapId ??
            FUNCTION_WARS_DEFAULT_MAP_ID,
    }),
    fetchMatchViaApi: true,
};

export type FunctionWarsOnlineStats = {
    onlineGames: number;
    onlineWins: number;
};

const STATS_KEY = "function_wars_stats";
const ACTIVE_MATCH_KEY = "function_wars_online_active_match";

const EMPTY_STATS: FunctionWarsOnlineStats = {
    onlineGames: 0,
    onlineWins: 0,
};

const EMPTY_HP: FunctionWarsHp = { host: 100, guest: 100 };

function loadStats(): FunctionWarsOnlineStats {
    const stored = getPlaygroundItem<Partial<FunctionWarsOnlineStats>>(STATS_KEY);
    return {
        onlineGames: stored?.onlineGames ?? 0,
        onlineWins: stored?.onlineWins ?? 0,
    };
}

function saveStats(stats: FunctionWarsOnlineStats) {
    const existing = getPlaygroundItem<Record<string, unknown>>(STATS_KEY) ?? {};
    setPlaygroundItem(STATS_KEY, { ...existing, ...stats });
}

export function useFunctionWarsOnline() {
    const { user } = useAuth();
    const room = useGameRoom<FunctionWarsMatchRow>(FUNCTION_WARS_ROOM_CONFIG);
    const roomRef = useRef(room);
    roomRef.current = room;
    const supabaseRef = useRef(createClient());
    const refreshedFinishedMatchRef = useRef<string | null>(null);

    const [stats, setStats] = useState<FunctionWarsOnlineStats>(() => ({
        ...EMPTY_STATS,
    }));
    const [firing, setFiring] = useState(false);
    const [lastError, setLastError] = useState<string | null>(null);

    usePlaygroundStatsLoader(() => setStats(loadStats()));

    const match = room.state.match;
    const userId = user?.id ?? null;

    const refreshAuthoritativeStats = useCallback(async () => {
        if (!userId) return null;
        const { data, error } = await supabaseRef.current
            .from("playground_stats")
            .select("stats")
            .eq("user_id", userId)
            .maybeSingle();
        if (error) throw error;

        const source = data?.stats as Record<string, unknown> | null | undefined;
        const online = source?.[STATS_KEY];
        const record = online && typeof online === "object" && !Array.isArray(online)
            ? online as Record<string, unknown>
            : {};
        const next: FunctionWarsOnlineStats = {
            onlineGames: typeof record.onlineGames === "number"
                ? Math.max(0, Math.floor(record.onlineGames))
                : 0,
            onlineWins: typeof record.onlineWins === "number"
                ? Math.max(0, Math.floor(record.onlineWins))
                : 0,
        };
        saveStats(next);
        setStats(next);
        return next;
    }, [userId]);

    useEffect(() => {
        if (!userId) return;
        void refreshAuthoritativeStats().catch(() => undefined);
    }, [refreshAuthoritativeStats, userId]);
    const myRole: FunctionWarsRole | null = useMemo(() => {
        if (!match || !userId) return null;
        if (match.host_user_id === userId) return "host";
        if (match.guest_user_id === userId) return "guest";
        return null;
    }, [match, userId]);

    const mapId = match?.map_id ?? null;
    const mapSeed = match?.map_seed ?? null;
    const baseMap = useMemo(
        () =>
            mapId !== null && mapSeed !== null
                ? buildFunctionWarsOnlineMap(Number(mapSeed), mapId)
                : null,
        [mapId, mapSeed],
    );
    const currentTurn: FunctionWarsRole = match?.current_turn ?? "host";
    const winner = match?.winner ?? null;
    const hp = match?.hp ?? EMPTY_HP;
    const inventory = useMemo(
        () => match?.inventory ?? createFunctionWarsInitialInventory(),
        [match?.inventory],
    );
    const crates: FunctionWarsOnlineCrate[] = useMemo(
        () => (Array.isArray(match?.crates) ? match.crates : []),
        [match?.crates],
    );
    const repairs: FunctionWarsRepair[] = useMemo(
        () => (Array.isArray(match?.repairs) ? match.repairs : []),
        [match?.repairs],
    );
    const map = useMemo(
        () => (baseMap ? addFunctionWarsRepairsToMap(baseMap, repairs) : null),
        [baseMap, repairs],
    );
    const craters: FunctionWarsCrater[] = useMemo(
        () => (Array.isArray(match?.craters) ? match.craters : []),
        [match?.craters],
    );
    const shotSeq = match?.shot_seq ?? 0;
    const availableCrates = useMemo(
        () => availableFunctionWarsCrates(crates, shotSeq),
        [crates, shotSeq],
    );
    const isMyTurn =
        match?.status === "playing" && myRole !== null && currentTurn === myRole;
    const isFinished = match?.status === "finished" || match?.status === "cancelled";

    useEffect(() => {
        if (typeof window === "undefined") return;
        if (match?.id && (match.status === "waiting" || match.status === "playing")) {
            window.localStorage.setItem(ACTIVE_MATCH_KEY, match.id);
            return;
        }
        if (match?.id && isFinished) {
            const stored = window.localStorage.getItem(ACTIVE_MATCH_KEY);
            if (stored === match.id) window.localStorage.removeItem(ACTIVE_MATCH_KEY);
        }
    }, [isFinished, match?.id, match?.status]);

    useEffect(() => {
        if (!match || !myRole || match.status !== "finished") return;
        if (refreshedFinishedMatchRef.current === match.id) return;
        refreshedFinishedMatchRef.current = match.id;
        void refreshAuthoritativeStats().catch(() => {
            refreshedFinishedMatchRef.current = null;
        });
    }, [match, myRole, refreshAuthoritativeStats]);

    const fire = useCallback(
        async (
            weapon: FunctionWarsWeaponId,
            expression: string,
        ): Promise<FunctionWarsFireResult | null> => {
            const currentRoom = roomRef.current;
            const currentMatch = currentRoom.state.match;
            if (!currentMatch?.id || firing || !isMyTurn) return null;
            if (!isFunctionWarsWeaponId(weapon)) {
                setLastError("函数或武器无效");
                return null;
            }
            const normalizedExpression = normalizeFunctionWarsExpression(expression);
            if (!normalizedExpression.ok) {
                setLastError(normalizedExpression.error);
                return null;
            }

            setFiring(true);
            setLastError(null);
            try {
                const response = await fetch(
                    `${FUNCTION_WARS_ROOM_CONFIG.apiBase}/${currentMatch.id}/fire`,
                    {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            weapon,
                            expression: normalizedExpression.expression,
                            expected_shot_seq: currentMatch.shot_seq,
                        }),
                    },
                );
                const result = (await response.json().catch(() => null)) as
                    | FunctionWarsFireResult
                    | { error?: string }
                    | null;
                if (!response.ok) {
                    throw new Error(
                        result && "error" in result
                            ? result.error ?? "开火失败"
                            : result && "reason" in result
                              ? result.reason
                              : "开火失败",
                    );
                }
                if (!result || !("ok" in result)) throw new Error("开火失败");
                if (!result?.ok) {
                    setLastError(result?.reason ?? "开火失败");
                }
                currentRoom.refresh();
                return result;
            } catch (error) {
                setLastError(
                    error instanceof Error ? error.message : "开火失败，请重试",
                );
                return null;
            } finally {
                setFiring(false);
            }
        },
        [firing, isMyTurn],
    );

    const createRoom = useCallback(
        (mapId: FunctionWarsMapId = FUNCTION_WARS_DEFAULT_MAP_ID) =>
            roomRef.current.createRoom({ mapId }),
        [],
    );
    const joinRoom = useCallback(
        (code: string) => roomRef.current.joinRoom(code),
        [],
    );
    const reconnect = useCallback(
        (matchId: string) => roomRef.current.reconnect(matchId),
        [],
    );
    const refresh = useCallback(() => roomRef.current.refresh(), []);

    const leaveRoom = useCallback(async (): Promise<boolean> => {
        const currentRoom = roomRef.current;
        const currentMatch = currentRoom.state.match;
        const matchId = currentMatch?.id ?? currentRoom.state.matchId;
        if (!matchId) return false;

        setLastError(null);
        try {
            const response = await fetch(
                `${FUNCTION_WARS_ROOM_CONFIG.apiBase}/${matchId}/leave`,
                { method: "POST" },
            );
            const payload = (await response.json().catch(() => null)) as {
                status?: string;
                winner?: FunctionWarsWinner | null;
                error?: string;
            } | null;
            if (!response.ok) {
                throw new Error(payload?.error ?? "离开对局失败");
            }
            if (payload?.status !== "finished" && payload?.status !== "cancelled") {
                throw new Error("离开对局尚未完成，请重试");
            }

            if (payload.status === "finished") await refreshAuthoritativeStats();
            if (typeof window !== "undefined") {
                const stored = window.localStorage.getItem(ACTIVE_MATCH_KEY);
                if (stored === matchId) window.localStorage.removeItem(ACTIVE_MATCH_KEY);
            }
            currentRoom.resetLocalState();
            return true;
        } catch (error) {
            setLastError(
                error instanceof Error ? error.message : "离开对局失败，请重试",
            );
            currentRoom.refresh();
            return false;
        }
    }, [refreshAuthoritativeStats]);

    const reset = useCallback(() => {
        const currentRoom = roomRef.current;
        setLastError(null);
        if (typeof window !== "undefined") {
            const stored = window.localStorage.getItem(ACTIVE_MATCH_KEY);
            if (stored === currentRoom.state.matchId) {
                window.localStorage.removeItem(ACTIVE_MATCH_KEY);
            }
        }
        currentRoom.resetLocalState();
    }, []);

    return {
        phase: room.state.phase,
        matchId: room.state.matchId,
        code: room.state.code,
        error: room.state.error ?? lastError,
        match,
        baseMap,
        map,
        currentTurn,
        myRole,
        isMyTurn,
        isFinished,
        winner,
        hp,
        inventory,
        crates,
        repairs,
        availableCrates,
        craters,
        turnDeadlineAt: match?.turn_deadline_at ?? null,
        lastShot: match?.last_shot ?? null,
        shotSeq,
        firing,
        stats,
        createRoom,
        joinRoom,
        leaveRoom,
        reconnect,
        fire,
        reset,
        refresh,
    };
}
