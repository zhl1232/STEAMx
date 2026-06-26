"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { Users, LogOut, Copy, Check, Loader2 } from "lucide-react";

import type { useGomokuOnline } from "@/hooks/playground/use-gomoku-online";
import { useAuth } from "@/lib/context/auth-context";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { GomokuColor } from "@/lib/playground/gomoku-online";

type OnlineApi = ReturnType<typeof useGomokuOnline>;

function shareUrlFromCode(code: string): string {
    if (typeof window === "undefined") return `/playground/gomoku?room=${code}`;
    const url = new URL("/playground/gomoku", window.location.origin);
    url.searchParams.set("room", code);
    return url.toString();
}

/**
 * 在线对战大厅。受控组件：由父组件（GomokuOnlineView）持有一份 useGomokuOnline 实例传入，
 * 避免父子各自实例化导致两套独立的房间状态与 Realtime 订阅。
 */
export function GomokuOnlineLobby({
    online,
    initialRoomCode,
}: {
    online: OnlineApi;
    initialRoomCode?: string | null;
}) {
    const { user } = useAuth();
    const [joinCode, setJoinCode] = useState("");
    const [copied, setCopied] = useState(false);
    const [hostColor, setHostColor] = useState<GomokuColor>("black");

    const handleCreate = useCallback(() => {
        void online.createRoom(hostColor);
    }, [online, hostColor]);

    const handleJoin = useCallback(() => {
        const code = joinCode.trim().toUpperCase();
        if (code.length !== 6) return;
        void online.joinRoom(code);
    }, [joinCode, online]);

    const handleCopy = useCallback(async () => {
        if (!online.code) return;
        try {
            await navigator.clipboard.writeText(shareUrlFromCode(online.code));
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
        } catch {
            // 剪贴板不可用时静默
        }
    }, [online.code]);

    const loginNextPath = initialRoomCode?.trim()
        ? `/playground/gomoku?room=${encodeURIComponent(initialRoomCode.trim().toUpperCase())}`
        : "/playground/gomoku";
    const loginHref = `/login?next=${encodeURIComponent(loginNextPath)}`;

    if (!user) {
        return (
            <Card className="p-6 bg-background/80 border-border/80 text-center space-y-3">
                <Users className="w-8 h-8 mx-auto text-primary" />
                <h3 className="text-sm font-semibold">在线对战需要登录</h3>
                <p className="text-xs text-muted-foreground">
                    登录后即可创建房间，邀请好友在线对弈。
                </p>
                <Button asChild size="sm" className="min-h-11">
                    <Link href={loginHref}>去登录</Link>
                </Button>
            </Card>
        );
    }

    // 等待对手：显示房间码 + 分享链接
    if (online.phase === "waiting" && online.code) {
        return (
            <Card className="p-6 bg-background/80 border-border/80 space-y-4">
                <div className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-primary" />
                    <h3 className="text-sm font-semibold">等待对手加入…</h3>
                </div>
                <div className="space-y-2">
                    <p className="text-xs text-muted-foreground">
                        把房间码或邀请链接发给好友：
                    </p>
                    <div className="flex items-center gap-2">
                        <div className="flex-1 rounded-md border border-dashed border-primary/40 bg-primary/5 px-3 py-2 text-center text-lg font-bold tracking-[0.3em] text-primary">
                            {online.code}
                        </div>
                        <Button
                            size="icon"
                            variant="outline"
                            onClick={handleCopy}
                            aria-label="复制邀请链接"
                            className="h-11 w-11"
                        >
                            {copied ? (
                                <Check className="w-4 h-4 text-green-500" />
                            ) : (
                                <Copy className="w-4 h-4" />
                            )}
                        </Button>
                    </div>
                </div>
                <div className="text-[11px] text-muted-foreground break-all">
                    链接：{shareUrlFromCode(online.code)}
                </div>
                <Button
                    variant="outline"
                    size="sm"
                    className="min-h-11 w-full"
                    onClick={() => void online.leaveRoom()}
                >
                    <LogOut className="w-3.5 h-3.5" />
                    取消房间
                </Button>
            </Card>
        );
    }

    // 大厅入口：建房 / 加入
    return (
        <Card className="p-6 bg-background/80 border-border/80 space-y-5">
            <div className="space-y-1">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                    <Users className="w-4 h-4 text-primary" />
                    在线对战
                </h3>
                <p className="text-xs text-muted-foreground">
                    创建房间邀请好友，或输入房间码加入对局。
                </p>
            </div>

            {/* 创建房间 */}
            <div className="space-y-3">
                <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">我执</span>
                    <div className="flex items-center gap-1 rounded-full border border-border/60 bg-muted/40 p-0.5">
                        {(["black", "white"] as const).map((color) => (
                            <button
                                key={color}
                                type="button"
                                onClick={() => setHostColor(color)}
                                className={cn(
                                    "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                                    hostColor === color
                                        ? "bg-primary text-primary-foreground shadow-sm"
                                        : "text-muted-foreground hover:text-foreground",
                                )}
                                aria-pressed={hostColor === color}
                            >
                                {color === "black" ? "黑棋" : "白棋"}
                            </button>
                        ))}
                    </div>
                </div>
                <Button
                    size="sm"
                    className="min-h-11 w-full"
                    onClick={handleCreate}
                    disabled={online.phase === "creating"}
                >
                    {online.phase === "creating" ? (
                        <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            创建中…
                        </>
                    ) : (
                        "创建房间"
                    )}
                </Button>
            </div>

            <div className="h-px bg-border" />

            {/* 加入房间 */}
            <div className="space-y-3">
                <Input
                    value={joinCode}
                    onChange={(e) =>
                        setJoinCode(e.target.value.toUpperCase().slice(0, 6))
                    }
                    placeholder="输入 6 位房间码"
                    maxLength={6}
                    className="text-center tracking-[0.3em] font-bold"
                    onKeyDown={(e) => {
                        if (e.key === "Enter") handleJoin();
                    }}
                />
                <Button
                    size="sm"
                    variant="outline"
                    className="min-h-11 w-full"
                    onClick={handleJoin}
                    disabled={
                        online.phase === "joining" || joinCode.length !== 6
                    }
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
