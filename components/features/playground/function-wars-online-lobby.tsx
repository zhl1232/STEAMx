"use client"

import { useCallback, useMemo, useState } from "react"
import Link from "next/link"
import { Check, Copy, Crosshair, Loader2, LogIn, LogOut, Radio, Users } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useFunctionWarsOnline } from "@/hooks/playground/use-function-wars-online"
import { useAuth } from "@/lib/context/auth-context"

type FunctionWarsOnlineApi = ReturnType<typeof useFunctionWarsOnline>

function getShareUrl(code: string): string {
    if (typeof window === "undefined") return `/playground/functionwars?room=${code}`
    const url = new URL("/playground/functionwars", window.location.origin)
    url.searchParams.set("room", code)
    return url.toString()
}

export function FunctionWarsOnlineLobby({
    online,
    initialRoomCode,
}: {
    online: FunctionWarsOnlineApi
    initialRoomCode?: string | null
}) {
    const { user } = useAuth()
    const [joinCode, setJoinCode] = useState(() => initialRoomCode?.trim().toUpperCase().slice(0, 6) ?? "")
    const [copied, setCopied] = useState(false)

    const loginHref = useMemo(() => {
        const next = initialRoomCode?.trim()
            ? `/playground/functionwars?room=${encodeURIComponent(initialRoomCode.trim().toUpperCase())}`
            : "/playground/functionwars"
        return `/login?next=${encodeURIComponent(next)}`
    }, [initialRoomCode])

    const handleJoin = useCallback(() => {
        const code = joinCode.trim().toUpperCase()
        if (code.length !== 6) return
        void online.joinRoom(code)
    }, [joinCode, online])

    const handleCopy = useCallback(async () => {
        if (!online.code) return
        try {
            await navigator.clipboard.writeText(getShareUrl(online.code))
            setCopied(true)
            window.setTimeout(() => setCopied(false), 1600)
        } catch {
            setCopied(false)
        }
    }, [online.code])

    if (!user) {
        return (
            <section className="border border-border/80 bg-background/72 px-4 py-5 sm:px-5" aria-label="在线对战登录">
                <div className="flex items-start gap-3">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-amber-500/14 text-amber-700 dark:text-amber-300">
                        <Radio className="h-5 w-5" aria-hidden />
                    </span>
                    <div className="min-w-0 flex-1">
                        <h2 className="text-sm font-black text-foreground">接入真人炮术频道</h2>
                        <p className="mt-1 text-xs leading-5 text-muted-foreground">登录后创建 1v1 房间，邀请链接会保留当前房间码。</p>
                        <Button asChild size="sm" className="mt-4 min-h-11 gap-2 rounded-md">
                            <Link href={loginHref}>
                                <LogIn className="h-4 w-4" aria-hidden />
                                登录并继续
                            </Link>
                        </Button>
                    </div>
                </div>
            </section>
        )
    }

    if (online.phase === "waiting" && online.code) {
        return (
            <section className="border border-border/80 bg-background/72 px-4 py-5 sm:px-5" aria-label="等待对手加入">
                <div className="flex items-center gap-2 text-sm font-black">
                    <Loader2 className="h-4 w-4 animate-spin text-amber-600 motion-reduce:animate-none dark:text-amber-300" aria-hidden />
                    战场已部署，等待对手
                </div>
                <div className="mt-4 grid grid-cols-[minmax(0,1fr)_44px] gap-2">
                    <div className="grid min-h-11 place-items-center border border-dashed border-amber-500/55 bg-amber-500/9 px-3 font-mono text-lg font-black tracking-[0.28em] text-amber-800 dark:text-amber-200">
                        {online.code}
                    </div>
                    <Button
                        type="button"
                        size="icon"
                        variant="outline"
                        className="h-11 w-11 rounded-md"
                        onClick={handleCopy}
                        aria-label="复制邀请链接"
                        title="复制邀请链接"
                    >
                        {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                    </Button>
                </div>
                <p className="mt-2 truncate text-[11px] text-muted-foreground">{getShareUrl(online.code)}</p>
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="mt-3 min-h-11 gap-2 rounded-md text-muted-foreground"
                    onClick={() => void online.leaveRoom()}
                >
                    <LogOut className="h-4 w-4" aria-hidden />
                    撤销房间
                </Button>
            </section>
        )
    }

    return (
        <section className="border border-border/80 bg-background/72" aria-label="函数战争在线大厅">
            <div className="grid gap-px bg-border/80 sm:grid-cols-2">
                <div className="bg-background px-4 py-5 sm:px-5">
                    <div className="flex items-center gap-2">
                        <Crosshair className="h-4 w-4 text-amber-700 dark:text-amber-300" aria-hidden />
                        <h2 className="text-sm font-black">创建对称战场</h2>
                    </div>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">峡谷地图，双方弹药与掩体完全对称。</p>
                    <Button
                        type="button"
                        size="sm"
                        className="mt-4 min-h-11 w-full gap-2 rounded-md"
                        onClick={() => void online.createRoom("symmetric-canyon")}
                        disabled={online.phase === "creating"}
                    >
                        {online.phase === "creating" ? (
                            <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden />
                        ) : (
                            <Users className="h-4 w-4" aria-hidden />
                        )}
                        {online.phase === "creating" ? "部署中" : "创建房间"}
                    </Button>
                </div>

                <div className="bg-background px-4 py-5 sm:px-5">
                    <div className="flex items-center gap-2">
                        <Radio className="h-4 w-4 text-sky-700 dark:text-sky-300" aria-hidden />
                        <h2 className="text-sm font-black">加入好友战场</h2>
                    </div>
                    <div className="mt-4 flex gap-2">
                        <Input
                            value={joinCode}
                            onChange={(event) => setJoinCode(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6))}
                            onKeyDown={(event) => {
                                if (event.key === "Enter") handleJoin()
                            }}
                            inputMode="text"
                            autoCapitalize="characters"
                            autoComplete="off"
                            maxLength={6}
                            placeholder="6 位房间码"
                            aria-label="房间码"
                            className="h-11 min-w-0 rounded-md text-center font-mono font-black tracking-[0.18em]"
                        />
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="min-h-11 shrink-0 rounded-md px-4"
                            onClick={handleJoin}
                            disabled={joinCode.length !== 6 || online.phase === "joining"}
                        >
                            {online.phase === "joining" ? <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden /> : "加入"}
                        </Button>
                    </div>
                </div>
            </div>
            {online.error ? (
                <p className="border-t border-destructive/25 bg-destructive/7 px-4 py-3 text-xs font-semibold text-destructive" role="alert">
                    {online.error}
                </p>
            ) : null}
        </section>
    )
}
