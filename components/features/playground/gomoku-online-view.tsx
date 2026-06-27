"use client";

import { useCallback, useEffect, useRef } from "react";
import confetti from "canvas-confetti";
import { LogOut, RefreshCw, Trophy, Users, Loader2 } from "lucide-react";

import { useAuth } from "@/lib/context/auth-context";
import { useGamification } from "@/lib/context/gamification-context";
import { useGomokuOnline } from "@/hooks/playground/use-gomoku-online";
import { createEmptyBoard } from "@/lib/playground/gomoku-online";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { GomokuBoard } from "@/components/features/playground/gomoku-board";
import { GomokuOnlineLobby } from "@/components/features/playground/gomoku-online-lobby";

const ACTIVE_MATCH_KEY = "gomoku_online_active_match";

export function GomokuOnlineView({
    initialRoomCode,
}: {
    initialRoomCode?: string | null;
}) {
    const online = useGomokuOnline();
    const { loading: authLoading, user } = useAuth();
    const { checkBadges } = useGamification();
    const bootstrappedRef = useRef(false);

    // 启动恢复（仅一次）：
    //   - URL 带 room 码 → 优先 joinRoom（好友邀请链接场景，不能被旧缓存拦截）
    //   - 否则若有 active_match → reconnect（自己刷新恢复进行中对局）
    // 合并为单 effect，避免带 room 刷新时 joinRoom 与 reconnect 互相抢位。
    useEffect(() => {
        if (bootstrappedRef.current) return;
        if (typeof window === "undefined") return;
        if (authLoading) return;
        if (online.phase !== "idle") return;

        const roomCode = initialRoomCode?.trim().toUpperCase();
        if (!user) return;

        bootstrappedRef.current = true;
        if (roomCode && roomCode.length === 6) {
            void online.joinRoom(roomCode);
            return;
        }
        const stored = window.localStorage.getItem(ACTIVE_MATCH_KEY);
        if (stored) {
            void online.reconnect(stored);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [authLoading, initialRoomCode, online.phase, user]);

    // 胜负 confetti + 徽章
    useEffect(() => {
        if (online.phase !== "finished" || !online.winner) return;
        if (online.winner === online.myColor) {
            confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
        }
        checkBadges({
            projectsPublished: 0,
            projectsLiked: 0,
            projectsCompleted: 0,
            commentsCount: 0,
            scienceCompleted: 0,
            techCompleted: 0,
            engineeringCompleted: 0,
            artCompleted: 0,
            mathCompleted: 0,
            likesGiven: 0,
            likesReceived: 0,
            collectionsCount: 0,
            challengesJoined: 0,
            level: 1,
            loginDays: 0,
            consecutiveDays: 0,
            discussionsCreated: 0,
            repliesCount: 0,
            minesweeperWins: 0,
            minesweeperExpertWins: 0,
            minesweeperBestTime: 999,
            gomokuWins: online.stats.wins,
            gomokuPvEWins: 0,
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [online.phase, online.winner]);

    const handleCellClick = useCallback(
        (row: number, col: number) => {
            if (online.isFinished) return;
            void online.makeMove(row, col);
        },
        [online],
    );

    const handleLeave = useCallback(() => {
        void online.leaveRoom();
    }, [online]);

    // 再开一局：真正重置房间状态（leaveRoom 会清 channel/状态并回 idle）
    const handleNewMatch = useCallback(() => {
        void online.reset();
    }, [online]);

    const board = online.board.length > 0 ? online.board : createEmptyBoard();

    const statusText = (() => {
        if (online.phase === "waiting") return "等待对手加入…";
        if (online.phase === "finished") {
            if (online.winner === "draw") return "平局";
            if (online.winner === online.myColor) return "你获胜了！";
            return online.winner ? "对手获胜" : "对局已结束";
        }
        if (online.phase === "playing") {
            return online.isMyTurn ? "轮到你落子" : "等待对手落子…";
        }
        return "在线对战";
    })();

    const showBoard =
        online.phase === "playing" || online.phase === "finished";
    // 大厅在 idle / waiting 态显示：waiting 时展示房间码 + 分享链接
    const showLobby = online.phase === "idle" || online.phase === "waiting";
    const showActionButtons =
        online.phase === "playing" || online.phase === "finished";

    return (
        <div className="w-full max-w-4xl flex flex-col gap-4 sm:gap-6">
            {/* 顶部状态条 */}
            <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                    <div
                        className={cn(
                            "w-7 h-7 rounded-full flex items-center justify-center border-2 shrink-0",
                            online.currentTurn === "black"
                                ? "border-primary"
                                : "border-border/60",
                        )}
                    >
                        <div className="w-4 h-4 rounded-full bg-gray-900 dark:bg-gray-100 border border-gray-700 dark:border-gray-300" />
                    </div>
                    <div
                        className={cn(
                            "w-7 h-7 rounded-full flex items-center justify-center border-2 shrink-0",
                            online.currentTurn === "white"
                                ? "border-primary"
                                : "border-border/60",
                        )}
                    >
                        <div className="w-4 h-4 rounded-full bg-gradient-to-br from-white to-gray-100 dark:from-gray-800 dark:to-gray-900 border-2 border-gray-400 dark:border-gray-500" />
                    </div>
                    <span className="text-xs text-muted-foreground ml-1">
                        {statusText}
                    </span>
                    {online.myColor ? (
                        <span className="text-[10px] text-muted-foreground/70 ml-1">
                            你执{online.myColor === "black" ? "黑" : "白"}
                        </span>
                    ) : null}
                </div>
                <span className="text-[10px] text-muted-foreground/60 ml-auto tabular-nums">
                    {online.moveCount} 手
                </span>
            </div>

            {showBoard ? (
                <div className="-mx-3 w-[calc(100%+1.5rem)] min-w-0 md:mx-0 md:w-full md:flex-1">
                    <GomokuBoard
                        board={board}
                        winLine={online.winLine}
                        onCellClick={handleCellClick}
                        disabled={
                            online.isFinished ||
                            !online.isMyTurn ||
                            online.placing
                        }
                    />
                </div>
            ) : (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                    <Users className="w-10 h-10 text-primary/60 mb-3" />
                    <p className="text-sm text-muted-foreground">
                        创建房间或输入房间码，开始在线对弈。
                    </p>
                </div>
            )}

            {/* 大厅（idle / waiting 态显示） */}
            {showLobby ? (
                <GomokuOnlineLobby
                    online={online}
                    initialRoomCode={initialRoomCode}
                />
            ) : null}

            {/* 进行中/结束操作按钮 */}
            {showActionButtons ? (
                <div className="flex flex-wrap gap-2">
                    {online.phase === "finished" ? (
                        <>
                            <Button
                                variant="default"
                                size="sm"
                                className="min-h-11"
                                onClick={handleNewMatch}
                            >
                                <RefreshCw className="w-3.5 h-3.5" />
                                再开一局
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                className="min-h-11"
                                onClick={handleLeave}
                            >
                                <LogOut className="w-3.5 h-3.5" />
                                返回大厅
                            </Button>
                        </>
                    ) : (
                        <Button
                            variant="outline"
                            size="sm"
                            className="min-h-11"
                            onClick={handleLeave}
                        >
                            <LogOut className="w-3.5 h-3.5" />
                            离开对局
                        </Button>
                    )}
                </div>
            ) : null}

            {online.error ? (
                <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
                    {online.error}
                </div>
            ) : null}

            {online.phase === "finished" && online.winner ? (
                <Card className="p-4 bg-background/80 border-border/80 flex items-center gap-2">
                    <Trophy className="w-4 h-4 text-primary" />
                    <span className="text-sm font-semibold">
                        {online.winner === "draw"
                            ? "平局收场"
                            : online.winner === online.myColor
                              ? "你赢了！"
                              : "对手赢了"}
                    </span>
                </Card>
            ) : null}

            {online.placing ? (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    落子中…
                </div>
            ) : null}
        </div>
    );
}
