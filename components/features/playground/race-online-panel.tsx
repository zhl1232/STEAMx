"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Check, Copy, Loader2, LogOut, RotateCcw, Trophy, Users } from "lucide-react";

import type { useRaceOnline } from "@/hooks/playground/use-race-online";
import { useAuth } from "@/lib/context/auth-context";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type RaceOnlineApi = ReturnType<typeof useRaceOnline>;

function readInitialRoomCode(): string | null {
    if (typeof window === "undefined") return null;
    const code = new URLSearchParams(window.location.search).get("room")?.trim().toUpperCase();
    return code && code.length === 6 ? code : null;
}

function shareUrl(path: string, code: string): string {
    if (typeof window === "undefined") return `${path}?room=${code}`;
    const url = new URL(path, window.location.origin);
    url.searchParams.set("room", code);
    return url.toString();
}

function roleLabel(role: string | null): string {
    if (role === "host") return "房主"
    if (role === "guest") return "对手"
    return "玩家"
}

function outcomeText(online: RaceOnlineApi): string {
    if (online.match?.finish_reason === "waiting_timeout") return "等待超时，房间已关闭"
    if (online.match?.finish_reason === "no_result_timeout") return "对局超时，未计胜负"
    if (!online.winner) return "对局已结束"
    if (online.winner === "draw") return "平局"
    return online.winner === online.myRole ? "你获胜了" : "对手获胜"
}

export function RaceOnlinePanel({
    online,
    gamePath,
    className,
}: {
    online: RaceOnlineApi;
    gamePath: string;
    className?: string;
}) {
    const { loading, user } = useAuth();
    const [joinCode, setJoinCode] = useState("");
    const [copied, setCopied] = useState(false);
    const [initialRoomCode] = useState(readInitialRoomCode);
    const bootstrappedRef = useRef(false);

    const settingText = online.meta.settingLabel(online.settings);
    const loginHref = useMemo(() => {
        const next = typeof window === "undefined" ? gamePath : `${window.location.pathname}${window.location.search}`;
        return `/login?next=${encodeURIComponent(next)}`;
    }, [gamePath]);

    useEffect(() => {
        if (bootstrappedRef.current) return;
        if (typeof window === "undefined") return;
        if (loading) return;
        if (!user) return;
        if (online.phase !== "idle") return;

        bootstrappedRef.current = true;
        if (initialRoomCode) {
            void online.joinRoom(initialRoomCode);
            return;
        }

        const stored = window.localStorage.getItem(online.activeMatchStorageKey);
        if (stored) void online.reconnect(stored);
        // online object is intentionally not a dependency; phase/key/callbacks are enough for bootstrap.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [initialRoomCode, loading, online.activeMatchStorageKey, online.phase, user]);

    const handleCreate = useCallback(() => {
        void online.createRoom();
    }, [online]);

    const handleJoin = useCallback(() => {
        const code = joinCode.trim().toUpperCase();
        if (code.length !== 6) return;
        void online.joinRoom(code);
    }, [joinCode, online]);

    const handleCopy = useCallback(async () => {
        if (!online.code) return;
        try {
            await navigator.clipboard.writeText(shareUrl(gamePath, online.code));
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
        } catch {
            // 剪贴板不可用时静默
        }
    }, [gamePath, online.code]);

    if (!user && !loading) {
        return (
            <Card className={cn("space-y-3 p-4", className)}>
                <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-primary" />
                    <h3 className="text-sm font-bold">联网竞速</h3>
                </div>
                <p className="text-xs leading-relaxed text-muted-foreground">
                    登录后可以创建房间，邀请好友在同一规则下比成绩。
                </p>
                <Button asChild size="sm" className="min-h-11 w-full">
                    <Link href={loginHref}>去登录</Link>
                </Button>
            </Card>
        );
    }

    if (online.phase === "waiting" && online.code) {
        return (
            <Card className={cn("space-y-4 p-4", className)}>
                <div className="flex items-center justify-between gap-2">
                    <div>
                        <h3 className="text-sm font-bold">等待对手加入</h3>
                        <p className="text-xs text-muted-foreground">{online.meta.label} · {settingText}</p>
                    </div>
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                </div>
                <div className="flex items-center gap-2">
                    <div className="flex-1 rounded-md border border-dashed border-primary/40 bg-primary/5 px-3 py-2 text-center text-lg font-black tracking-[0.28em] text-primary">
                        {online.code}
                    </div>
                    <Button
                        size="icon"
                        variant="outline"
                        className="h-11 w-11"
                        onClick={handleCopy}
                        aria-label="复制邀请链接"
                    >
                        {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
                    </Button>
                </div>
                <Button variant="outline" size="sm" className="min-h-11 w-full" onClick={online.leaveRoom}>
                    <LogOut className="h-3.5 w-3.5" />
                    取消房间
                </Button>
            </Card>
        );
    }

    if (online.phase === "playing" || online.phase === "finished") {
        const finished = online.phase === "finished";
        return (
            <Card className={cn("space-y-4 p-4", className)}>
                <div className="flex items-start justify-between gap-3">
                    <div>
                        <h3 className="text-sm font-bold">{finished ? outcomeText(online) : "联网竞速进行中"}</h3>
                        <p className="text-xs text-muted-foreground">{online.meta.label} · {settingText}</p>
                    </div>
                    {finished ? (
                        <Trophy className="h-4 w-4 text-amber-500" />
                    ) : online.submitting ? (
                        <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    ) : (
                        <Users className="h-4 w-4 text-primary" />
                    )}
                </div>

                <div className="space-y-2 text-xs">
                    <div className="flex items-center justify-between gap-3 rounded-sm bg-muted/35 px-3 py-2">
                        <span className="text-muted-foreground">你（{roleLabel(online.myRole)}）</span>
                        <span className="font-semibold">{online.meta.resultLabel(online.myResult)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3 rounded-sm bg-muted/35 px-3 py-2">
                        <span className="text-muted-foreground">对手</span>
                        <span className="font-semibold">{online.meta.resultLabel(online.opponentResult)}</span>
                    </div>
                </div>

                {!online.hasSubmitted && !finished ? (
                    <p className="rounded-sm border border-primary/20 bg-primary/5 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
                        完成本局后会自动提交成绩。离开进行中的房间会按认输处理。
                    </p>
                ) : null}

                {online.error ? (
                    <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
                        {online.error}
                    </div>
                ) : null}

                <div className="flex gap-2">
                    {finished ? (
                        <>
                            <Button size="sm" className="min-h-11 flex-1" onClick={online.createRoom}>
                                <RotateCcw className="h-3.5 w-3.5" />
                                再开一局
                            </Button>
                            <Button size="sm" variant="outline" className="min-h-11" onClick={online.reset}>
                                关闭
                            </Button>
                        </>
                    ) : !online.hasSubmitted ? (
                        <Button size="sm" variant="outline" className="min-h-11 w-full" onClick={online.leaveRoom}>
                            <LogOut className="h-3.5 w-3.5" />
                            认输并退出
                        </Button>
                    ) : null}
                </div>
            </Card>
        );
    }

    return (
        <Card className={cn("space-y-4 p-4", className)}>
            <div className="space-y-1">
                <h3 className="flex items-center gap-2 text-sm font-bold">
                    <Users className="h-4 w-4 text-primary" />
                    联网竞速
                </h3>
                <p className="text-xs leading-relaxed text-muted-foreground">{online.meta.objective}</p>
                <p className="text-[11px] text-muted-foreground/80">当前设置：{settingText}</p>
            </div>

            <Button
                size="sm"
                className="min-h-11 w-full"
                onClick={handleCreate}
                disabled={online.phase === "creating" || loading}
            >
                {online.phase === "creating" ? (
                    <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        创建中…
                    </>
                ) : (
                    "创建房间"
                )}
            </Button>

            <div className="h-px bg-border" />

            <div className="space-y-2">
                <Input
                    value={joinCode}
                    onChange={(event) => setJoinCode(event.target.value.toUpperCase().slice(0, 6))}
                    placeholder="输入 6 位房间码"
                    maxLength={6}
                    className="text-center font-bold tracking-[0.28em]"
                    onKeyDown={(event) => {
                        if (event.key === "Enter") handleJoin();
                    }}
                />
                <Button
                    size="sm"
                    variant="outline"
                    className="min-h-11 w-full"
                    onClick={handleJoin}
                    disabled={online.phase === "joining" || joinCode.length !== 6}
                >
                    {online.phase === "joining" ? "加入中…" : "加入房间"}
                </Button>
            </div>

            {online.error ? (
                <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
                    {online.error}
                </div>
            ) : null}
        </Card>
    );
}
