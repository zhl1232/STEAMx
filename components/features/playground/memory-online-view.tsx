"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import confetti from "canvas-confetti";
import { LogOut, RefreshCw, Trophy, Users, Loader2 } from "lucide-react";

import { useAuth } from "@/lib/context/auth-context";
import { useGamification } from "@/lib/context/gamification-context";
import { useMemoryOnline } from "@/hooks/playground/use-memory-online";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { MemoryOnlineLobby } from "@/components/features/playground/memory-online-lobby";

const ACTIVE_MATCH_KEY = "memory_online_active_match";
// 配对成功 250ms、翻错 800ms 后收起本轮揭示（与单机 use-memory-match 观感一致）。
const MATCH_REVEAL_MS = 250;
const MISMATCH_REVEAL_MS = 800;

export function MemoryOnlineView({
    initialRoomCode,
}: {
    initialRoomCode?: string | null;
}) {
    const online = useMemoryOnline();
    const { loading: authLoading, user } = useAuth();
    const { checkBadges } = useGamification();
    const bootstrappedRef = useRef(false);

    // 本轮已消费的 result_seq：据此对「刚完成的一对」只播一次揭示动画，规避实时重渲染重复触发。
    const [seenSeq, setSeenSeq] = useState(0);
    const revealing = online.resultSeq > seenSeq && online.lastResult !== null;

    // 新对局 result_seq 从 0 开始，切局时重置揭示游标，避免上一局的高 seq 压住新局动画。
    useEffect(() => {
        setSeenSeq(0);
    }, [online.matchId]);

    // 启动恢复（仅一次）：URL 带 room 码优先 join；否则有 active_match 则 reconnect。
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
        if (stored) void online.reconnect(stored);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [authLoading, initialRoomCode, online.phase, user]);

    // 揭示计时：新结果到达时短暂展示成对翻牌，到点后收起（matched 牌靠自身状态常显）。
    useEffect(() => {
        if (!revealing || !online.lastResult) return;
        const delay = online.lastResult.matched ? MATCH_REVEAL_MS : MISMATCH_REVEAL_MS;
        const seq = online.resultSeq;
        const timer = setTimeout(() => setSeenSeq(seq), delay);
        return () => clearTimeout(timer);
    }, [revealing, online.lastResult, online.resultSeq]);

    // 胜负 confetti + 徽章
    useEffect(() => {
        if (online.phase !== "finished" || !online.winner) return;
        if (online.winner === online.myRole) {
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
            memoryWins: online.stats.wins,
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [online.phase, online.winner]);

    const handleCardClick = useCallback(
        (cardId: string) => {
            if (online.isFinished || revealing) return;
            void online.flipCard(cardId);
        },
        [online, revealing],
    );

    const handleLeave = useCallback(() => {
        setSeenSeq(0);
        void online.leaveRoom();
    }, [online]);

    const handleNewMatch = useCallback(() => {
        setSeenSeq(0);
        void online.reset();
    }, [online]);

    const myScore = online.myRole ? online.scores[online.myRole] : 0;
    const oppScore = online.myRole ? online.scores[online.opponentRole(online.myRole)] : 0;

    const statusText = (() => {
        if (online.phase === "waiting") return "等待对手加入…";
        if (online.phase === "finished") {
            if (online.winner === "draw") return "平局";
            if (online.winner === online.myRole) return "你获胜了！";
            return online.winner ? "对手获胜" : "对局已结束";
        }
        if (online.phase === "playing") {
            return online.isMyTurn ? "轮到你翻牌" : "等待对手翻牌…";
        }
        return "在线对战";
    })();

    const showBoard = online.phase === "playing" || online.phase === "finished";
    const showLobby =
        online.phase === "idle" ||
        online.phase === "waiting" ||
        online.phase === "creating" ||
        online.phase === "joining" ||
        online.phase === "error";
    const showActionButtons = online.phase === "playing" || online.phase === "finished";

    // 某张牌是否正面朝上：已配对 / 本回合首翻 / 正在揭示的成对牌。
    const isFaceUp = (cardId: string, matched: string | null) => {
        if (matched) return true;
        if (online.firstFlip?.id === cardId) return true;
        if (revealing && online.lastResult) {
            return online.lastResult.a.id === cardId || online.lastResult.b.id === cardId;
        }
        return false;
    };

    return (
        <div className="w-full max-w-4xl flex flex-col gap-4 sm:gap-6">
            {/* 顶部状态条 + 比分 */}
            <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">{statusText}</span>
                    {online.myRole ? (
                        <span className="text-[10px] text-muted-foreground/70">
                            你是{online.myRole === "host" ? "房主" : "对手"}
                        </span>
                    ) : null}
                </div>
                {showBoard ? (
                    <div className="flex items-center gap-2 text-xs tabular-nums ml-auto">
                        <span
                            className={cn(
                                "font-semibold",
                                online.currentTurn === online.myRole ? "text-primary" : "text-muted-foreground",
                            )}
                        >
                            你 {myScore}
                        </span>
                        <span className="text-muted-foreground/50">·</span>
                        <span
                            className={cn(
                                "font-semibold",
                                online.currentTurn !== online.myRole ? "text-amber-500" : "text-muted-foreground",
                            )}
                        >
                            对手 {oppScore}
                        </span>
                    </div>
                ) : null}
            </div>

            {showBoard ? (
                <div
                    className="grid gap-2 sm:gap-3"
                    style={{ gridTemplateColumns: `repeat(${online.columns}, minmax(0, 1fr))` }}
                >
                    {online.deck.map((card) => {
                        const faceUp = isFaceUp(card.id, card.matched);
                        const disabled =
                            online.isFinished || !online.isMyTurn || online.flipping || revealing || faceUp;
                        return (
                            <button
                                key={card.id}
                                type="button"
                                onClick={() => handleCardClick(card.id)}
                                disabled={disabled}
                                aria-label={faceUp ? card.symbol : "未翻开的牌"}
                                className={cn(
                                    "aspect-square rounded-lg border flex items-center justify-center text-2xl sm:text-3xl select-none transition-colors",
                                    card.matched === online.myRole
                                        ? "border-primary/50 bg-primary/10"
                                        : card.matched && card.matched !== online.myRole
                                          ? "border-amber-400/50 bg-amber-400/10"
                                          : faceUp
                                            ? "border-border bg-background"
                                            : "border-border/60 bg-muted/50 hover:bg-muted",
                                    !disabled && "cursor-pointer",
                                )}
                            >
                                {faceUp ? card.symbol : ""}
                            </button>
                        );
                    })}
                </div>
            ) : (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                    <Users className="w-10 h-10 text-primary/60 mb-3" />
                    <p className="text-sm text-muted-foreground">
                        创建房间或输入房间码，开始在线比拼记忆力。
                    </p>
                </div>
            )}

            {showLobby ? (
                <MemoryOnlineLobby online={online} initialRoomCode={initialRoomCode} />
            ) : null}

            {showActionButtons ? (
                <div className="flex flex-wrap gap-2">
                    {online.phase === "finished" ? (
                        <>
                            <Button variant="default" size="sm" className="min-h-11" onClick={handleNewMatch}>
                                <RefreshCw className="w-3.5 h-3.5" />
                                再开一局
                            </Button>
                            <Button variant="outline" size="sm" className="min-h-11" onClick={handleLeave}>
                                <LogOut className="w-3.5 h-3.5" />
                                返回大厅
                            </Button>
                        </>
                    ) : (
                        <Button variant="outline" size="sm" className="min-h-11" onClick={handleLeave}>
                            <LogOut className="w-3.5 h-3.5" />
                            离开对局
                        </Button>
                    )}
                </div>
            ) : null}

            {online.error && !showLobby ? (
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
                            : online.winner === online.myRole
                              ? "你赢了！"
                              : "对手赢了"}
                    </span>
                </Card>
            ) : null}

            {online.flipping ? (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    翻牌中…
                </div>
            ) : null}
        </div>
    );
}
