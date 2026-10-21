"use client";

import { X } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { trackLoginPrompt } from "@/lib/auth/login-nudge";
import { useAuth } from "@/lib/context/auth-context";
import { useLoginPrompt } from "@/lib/context/login-prompt-context";

const DISMISS_KEY = "steamx:home-login-banner:dismissed";

/** 首页顶部可关闭的登录提示横幅，替代首次访问自动弹登录。 */
export function HomeLoginBanner() {
    const { user, loading } = useAuth();
    const { promptLogin } = useLoginPrompt();
    const [dismissed, setDismissed] = useState(true);

    useEffect(() => {
        try {
            setDismissed(localStorage.getItem(DISMISS_KEY) === "1");
        } catch {
            setDismissed(false);
        }
    }, []);

    const visible = !loading && !user && !dismissed;
    useEffect(() => {
        if (visible) trackLoginPrompt("banner", "show");
    }, [visible]);

    if (!visible) return null;

    const close = () => {
        setDismissed(true);
        try { localStorage.setItem(DISMISS_KEY, "1"); } catch { /* ignore */ }
    };

    // 浮在顶部、不占文档流：登录状态晚一点才确定，占位会把首屏内容往下推，导致误点。
    return (
        <div data-testid="home-login-banner" role="region" aria-label="登录提示" className="fixed inset-x-3 top-[calc(env(safe-area-inset-top)+0.5rem)] z-40 mx-auto flex max-w-xl items-center gap-3 rounded-md border border-[hsl(var(--brand-blue)/0.25)] bg-[hsl(var(--surface-raised)/0.97)] px-4 py-2 text-sm shadow-[0_12px_32px_-16px_hsl(var(--surface-shadow)/0.5)] backdrop-blur md:top-[4.75rem]">
            <p className="min-w-0 flex-1 font-medium text-foreground">登录后保存孩子的作品和进度</p>
            <Button
                type="button"
                size="sm"
                tone="brand"
                className="h-9 shrink-0"
                onClick={() => {
                    trackLoginPrompt("banner", "click");
                    promptLogin(undefined, { title: "登录或注册", description: "登录后可以保存进度", source: "banner" });
                }}
            >
                登录
            </Button>
            <button type="button" aria-label="关闭登录提示" onClick={close} className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-muted">
                <X className="h-4 w-4" />
            </button>
        </div>
    );
}
