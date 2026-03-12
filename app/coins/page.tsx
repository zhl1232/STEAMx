"use client";

import { useMemo } from "react";
import Link from "next/link";
import {
  Coins,
  ArrowLeft,
  Loader2,
  AlertCircle,
  CalendarCheck,
  ShoppingBag,
  Gift,
  History,
  Activity,
  ArrowRight,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";

import { useAuth } from "@/context/auth-context";
import { useGamification } from "@/context/gamification-context";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/lib/supabase/types";
import { getShopItemById } from "@/lib/shop/items";
import { Button } from "@/components/ui/button";

type CoinLogRow = Database["public"]["Tables"]["coin_logs"]["Row"];

function getActionLabel(
  actionType: string,
  resourceId: string | null,
  counterpartyDisplayText: string | null,
  amount: number,
): string {
  switch (actionType) {
    case "daily_login":
      return "每日签到";
    case "purchase": {
      const item = resourceId ? getShopItemById(resourceId) : null;
      return item ? `兑换「${item.name}」` : "兑换商品";
    }
    case "tip": {
      if (counterpartyDisplayText) {
        return amount < 0
          ? `打赏给 ${counterpartyDisplayText}`
          : `收到 ${counterpartyDisplayText} 的打赏`;
      }
      return resourceId ? `打赏 ${resourceId}` : "打赏";
    }
    default:
      return actionType || "其他";
  }
}

function getActionIcon(actionType: string) {
  switch (actionType) {
    case "daily_login":
      return <CalendarCheck className="h-4 w-4" />;
    case "purchase":
      return <ShoppingBag className="h-4 w-4" />;
    case "tip":
      return <Gift className="h-4 w-4" />;
    default:
      return <Activity className="h-4 w-4" />;
  }
}

function getActionIconStyle(actionType: string) {
  switch (actionType) {
    case "daily_login":
      return "bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400";
    case "purchase":
      return "bg-amber-100 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400";
    case "tip":
      return "bg-purple-100 text-purple-600 dark:bg-purple-500/20 dark:text-purple-400";
    default:
      return "bg-muted text-muted-foreground dark:bg-muted/50 dark:text-muted-foreground/80";
  }
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  if (isToday) {
    return d.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
  }
  return d.toLocaleDateString("zh-CN", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function CoinsPage() {
  const { user, loading: authLoading } = useAuth();
  const { coins = 0 } = useGamification();
  const supabase = useMemo(() => createClient(), []);

  const {
    data: logs = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery<CoinLogRow[]>({
    queryKey: ["coin_logs", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("coin_logs")
        .select(
          "id, user_id, amount, action_type, resource_id, created_at, counterparty_display_text",
        )
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!user,
    refetchOnWindowFocus: true,
  });

  if (authLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="container max-w-3xl py-8 px-4 pb-24 md:py-12">
      <div className="space-y-8 md:space-y-10">
        {/* 顶部导航 */}
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            asChild
            className="shrink-0 rounded-full hover:bg-muted -ml-2"
          >
            <Link href="/profile">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">我的钱包</h1>
          </div>
        </div>

        {/* 余额大卡片 */}
        <div className="relative overflow-hidden rounded-3xl border border-amber-200/50 bg-gradient-to-br from-amber-50 md:from-amber-100 via-amber-50/50 to-orange-100 dark:border-amber-900/40 dark:from-amber-950/60 dark:via-orange-950/40 dark:to-orange-900/40 p-8 shadow-lg shadow-amber-900/5 dark:shadow-black/20">
          {/* 装饰性光晕 */}
          <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-amber-400/20 blur-3xl dark:bg-amber-600/20" />
          <div className="pointer-events-none absolute -bottom-10 -left-10 h-40 w-40 rounded-full bg-orange-400/20 blur-3xl dark:bg-orange-600/20" />

          <div className="relative flex flex-col items-center text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-tr from-amber-200 to-amber-100 shadow-inner dark:from-amber-800 dark:to-amber-900">
              <Coins className="h-8 w-8 text-amber-600 dark:text-amber-400" />
            </div>
            <h2 className="mb-2 text-sm font-medium text-amber-800/80 dark:text-amber-200/80">
              当前余额
            </h2>
            <div className="mb-8 flex items-baseline justify-center gap-1.5">
              <span className="text-6xl font-black tabular-nums tracking-tight text-transparent bg-clip-text bg-gradient-to-b from-amber-500 to-orange-600 dark:from-amber-400 dark:to-orange-500 drop-shadow-sm">
                {coins.toLocaleString()}
              </span>
            </div>

            <Button
              asChild
              size="lg"
              className="group relative w-full sm:w-auto min-w-[240px] overflow-hidden rounded-full bg-gradient-to-r from-amber-500 to-orange-500 px-8 font-medium text-white shadow-md shadow-orange-500/25 transition-all hover:scale-105 hover:from-amber-400 hover:to-orange-400 hover:shadow-lg hover:shadow-orange-500/30 border-0"
            >
              <Link href="/shop">
                <span className="relative z-10 flex items-center justify-center gap-2">
                  <ShoppingBag className="h-4 w-4" />
                  去商店兑换
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </span>
              </Link>
            </Button>
          </div>
        </div>

        {/* 交易记录 */}
        <div className="rounded-2xl border bg-card/50 backdrop-blur-sm shadow-sm overflow-hidden">
          <div className="flex items-center justify-between border-b bg-muted/20 px-6 py-5">
            <div className="flex items-center gap-2">
              <History className="h-5 w-5 text-muted-foreground" />
              <h3 className="font-semibold text-foreground">交易记录</h3>
            </div>
            <span className="rounded-full bg-background border px-2.5 py-1 text-xs font-medium text-muted-foreground shadow-sm">
              最近 {logs.length} 条
            </span>
          </div>

          <div className="divide-y divide-border/50">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground/50" />
                <p className="text-sm text-muted-foreground">加载记录中...</p>
              </div>
            ) : isError ? (
              <div className="py-12 px-4 text-center">
                <AlertCircle className="h-10 w-10 text-destructive/80 mx-auto mb-3" />
                <p className="font-medium mb-1">加载记录失败</p>
                <p className="text-xs text-muted-foreground mb-4">
                  {error instanceof Error ? error.message : "请检查网络或稍后重试"}
                </p>
                <Button variant="outline" size="sm" onClick={() => refetch()}>
                  刷新重试
                </Button>
              </div>
            ) : logs.length === 0 ? (
              <div className="py-16 px-4 text-center">
                <div className="h-12 w-12 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-3">
                  <Coins className="h-6 w-6 text-muted-foreground/40" />
                </div>
                <p className="text-sm font-medium text-muted-foreground mb-1">暂无交易记录</p>
                <p className="text-xs text-muted-foreground/60 max-w-xs mx-auto">
                  您的硬币收支明细将显示在这里
                </p>
              </div>
            ) : (
              logs.map((log) => {
                const isPositive = log.amount >= 0;
                const Icon = getActionIcon(log.action_type);
                const iconStyle = getActionIconStyle(log.action_type);

                return (
                  <div
                    key={log.id}
                    className="flex items-center justify-between px-6 py-4 transition-colors hover:bg-muted/40 sm:py-5 group"
                  >
                    <div className="flex items-center gap-4">
                      <div
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${iconStyle}`}
                      >
                        {Icon}
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <p className="text-sm font-medium leading-none text-foreground group-hover:text-primary transition-colors">
                          {getActionLabel(
                            log.action_type,
                            log.resource_id,
                            log.counterparty_display_text ?? null,
                            log.amount,
                          )}
                        </p>
                        <p className="text-xs text-muted-foreground tabular-nums">
                          {formatDate(log.created_at)}
                        </p>
                      </div>
                    </div>
                    <div
                      className={`inline-flex items-center justify-center rounded-full px-3 py-1 text-sm font-bold tabular-nums tracking-tight ${
                        isPositive
                          ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400"
                          : "bg-muted text-muted-foreground dark:bg-muted/50 dark:text-muted-foreground/80"
                      }`}
                    >
                      {isPositive ? "+" : ""}
                      {log.amount}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
