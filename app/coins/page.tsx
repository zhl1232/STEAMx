"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowLeft,
  ArrowUpRight,
  CalendarCheck,
  Gift,
  HelpCircle,
  Loader2,
  ShoppingBag,
  Sparkles,
  ThumbsUp,
  Trophy,
  WalletCards,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";

import { CoinIcon } from "@/components/icons/coin-icon";
import { MobileGlobalHeader } from "@/components/layout/mobile-global-header";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useAuth } from "@/lib/context/auth-context";
import { useGamification } from "@/lib/context/gamification-context";
import { getShopItemById, SHOP_ITEMS } from "@/lib/shop/items";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/lib/supabase/types";
import { cn } from "@/lib/utils";

type CoinLogRow = Database["public"]["Tables"]["coin_logs"]["Row"];
type CoinLogEntry = Omit<CoinLogRow, "id"> & {
  id: CoinLogRow["id"] | string;
  synthetic?: "balance_baseline";
};

const COIN_EARNING_RULES = [
  {
    icon: CalendarCheck,
    title: "每日签到",
    description: "每天签到 1 次，可获得 2 硬币。",
  },
  {
    icon: Trophy,
    title: "挑战奖励",
    description: "官方挑战结算后，获奖作品会收到硬币奖励。",
  },
  {
    icon: Gift,
    title: "收到投币",
    description: "别人给你的项目或作品投币时，硬币会直接到账。",
  },
] as const;

const COIN_SPENDING_RULES = [
  {
    icon: ShoppingBag,
    title: "商店兑换",
    description: "可以兑换头像框、昵称颜色等装扮。",
  },
  {
    icon: ThumbsUp,
    title: "投币支持",
    description: "也可以把硬币投给你喜欢的创作者或作品。",
  },
] as const;

type CoinRuleItem = (typeof COIN_EARNING_RULES)[number] | (typeof COIN_SPENDING_RULES)[number];

export function getActionLabel(
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
    case "challenge_prize":
      return counterpartyDisplayText || "挑战奖励";
    case "balance_baseline":
      return "历史结余";
    default:
      return actionType || "其他";
  }
}

function getActionDescription(log: CoinLogEntry): string {
  if (log.synthetic === "balance_baseline") {
    return "早期余额或系统同步，未记录到具体流水";
  }

  switch (log.action_type) {
    case "daily_login":
      return "连续记录探索习惯";
    case "purchase":
      return "商店装扮兑换";
    case "tip":
      return log.amount < 0 ? "支持社区创作者" : "作品获得社区支持";
    case "challenge_prize":
      return "挑战结算奖励";
    default:
      return "硬币账户变动";
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
    case "challenge_prize":
      return <Trophy className="h-4 w-4" />;
    case "balance_baseline":
      return <CoinIcon className="h-4 w-4" />;
    default:
      return <Sparkles className="h-4 w-4" />;
  }
}

function getActionIconStyle(actionType: string) {
  switch (actionType) {
    case "daily_login":
      return "bg-emerald-100 text-emerald-600 dark:bg-emerald-400/10 dark:text-emerald-300";
    case "purchase":
      return "bg-amber-100 text-amber-600 dark:bg-amber-400/10 dark:text-amber-300";
    case "tip":
      return "bg-violet-100 text-violet-600 dark:bg-violet-400/10 dark:text-violet-300";
    case "challenge_prize":
      return "bg-blue-100 text-blue-700 dark:bg-blue-400/10 dark:text-blue-300";
    case "balance_baseline":
      return "bg-slate-100 text-slate-600 dark:bg-white/[0.08] dark:text-slate-300";
    default:
      return "bg-muted text-muted-foreground dark:bg-white/[0.06]";
  }
}

function getStatusLabel(log: CoinLogEntry): string {
  if (log.synthetic === "balance_baseline") return "已计入";
  if (log.action_type === "purchase") return "已兑换";
  if (log.amount >= 0) return "已到账";
  return "已支出";
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
}

function formatEntryTime(log: CoinLogEntry): string {
  if (log.synthetic === "balance_baseline") return "结余";
  return formatTime(log.created_at);
}

function formatDateGroup(log: CoinLogEntry): string {
  if (log.synthetic === "balance_baseline") return "历史结余";

  const date = new Date(log.created_at);
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);

  const day = date.toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  if (date.toDateString() === now.toDateString()) return `${day} 今天`;
  if (date.toDateString() === yesterday.toDateString()) return `${day} 昨天`;
  return day;
}

function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const mediaQuery = window.matchMedia(query);
    const updateMatches = () => setMatches(mediaQuery.matches);

    updateMatches();
    mediaQuery.addEventListener("change", updateMatches);
    return () => mediaQuery.removeEventListener("change", updateMatches);
  }, [query]);

  return matches;
}


function CoinLogTimeline({
  logs,
  isLoading,
  isError,
  error,
  onRetry,
}: {
  logs: CoinLogEntry[];
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  onRetry: () => void;
}) {
  const groupedLogs = useMemo(() => {
    const groups = new Map<string, CoinLogEntry[]>();
    logs.forEach((log) => {
      const key = formatDateGroup(log);
      groups.set(key, [...(groups.get(key) ?? []), log]);
    });
    return Array.from(groups.entries()).map(([label, items]) => ({ label, items }));
  }, [logs]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-16">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground/60" />
        <p className="text-sm text-muted-foreground">加载记录中...</p>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="px-4 py-12 text-center">
        <AlertCircle className="mx-auto mb-3 h-10 w-10 text-destructive/80" />
        <p className="mb-1 font-medium">加载记录失败</p>
        <p className="mb-4 text-xs text-muted-foreground">
          {error instanceof Error ? error.message : "请检查网络或稍后重试"}
        </p>
        <Button variant="outline" size="sm" onClick={onRetry}>
          刷新重试
        </Button>
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div className="px-4 py-14">
        <div className="mx-auto flex max-w-md items-center gap-4 rounded-md border border-dashed border-blue-200 bg-blue-50/60 px-5 py-5 text-left dark:border-blue-300/20 dark:bg-blue-400/10">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-md bg-white text-blue-500 shadow-sm dark:bg-white/10 dark:text-blue-300">
            <Gift className="h-7 w-7" />
          </div>
          <div>
            <p className="font-bold text-slate-950 dark:text-slate-50">暂无更早记录</p>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">继续探索和创作，赚取更多硬币吧！</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 sm:p-5">
      {groupedLogs.map((group) => (
        <section key={group.label}>
          <h4 className="sticky top-0 z-10 mb-3 w-fit rounded-full bg-background/92 px-3 py-1.5 text-xs font-bold text-slate-600 backdrop-blur dark:bg-background/88 dark:text-slate-300">
            {group.label}
          </h4>
          <div className="relative space-y-1.5">
            <div className="absolute bottom-6 left-[1.375rem] top-6 w-px bg-gradient-to-b from-transparent via-border to-transparent sm:left-[1.625rem]" />
            {group.items.map((log) => {
              const isPositive = log.amount >= 0;
              const actionIcon = getActionIcon(log.action_type);
              const iconStyle = getActionIconStyle(log.action_type);

              return (
                <div key={log.id} className="group relative flex items-center gap-3 rounded-2xl p-2 transition-all hover:bg-muted/50 dark:hover:bg-white/[0.02] sm:gap-4 sm:p-3">
                  <div className="relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-background shadow-sm ring-1 ring-border/50 sm:h-10 sm:w-10">
                     <div className={cn("flex h-7 w-7 items-center justify-center rounded-full sm:h-8 sm:w-8", iconStyle)}>
                        {actionIcon}
                     </div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-slate-950 transition-colors group-hover:text-blue-600 dark:text-slate-50 dark:group-hover:text-blue-400">
                      {getActionLabel(
                        log.action_type,
                        log.resource_id,
                        log.counterparty_display_text ?? null,
                        log.amount,
                      )}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">{getActionDescription(log)}</p>
                  </div>
                  <div className="text-right">
                    <div
                      className={cn(
                        "text-base font-black tabular-nums tracking-tight sm:text-lg",
                        isPositive ? "text-emerald-600 dark:text-emerald-400" : "text-slate-700 dark:text-slate-300",
                      )}
                    >
                      {isPositive ? "+" : ""}
                      {log.amount}
                    </div>
                    <div className="mt-1 flex items-center justify-end gap-1.5 text-[11px] text-muted-foreground sm:text-xs">
                      <span>{getStatusLabel(log)}</span>
                      <span className="h-1 w-1 rounded-full bg-border/80" />
                      <span>{formatEntryTime(log)}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}

function CoinRulesContent() {
  const renderRuleItems = (items: readonly CoinRuleItem[], iconClassName: string) => (
    <div className="mt-4 space-y-4">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <div key={item.title} className="flex items-start gap-3">
            <div className={cn("mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full", iconClassName)}>
              <Icon className="h-4 w-4" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-950 dark:text-slate-50">{item.title}</p>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">{item.description}</p>
            </div>
          </div>
        );
      })}
    </div>
  );

  return (
    <div className="space-y-8 pb-2">
      <div>
        <h3 className="font-bold text-slate-950 dark:text-slate-50">怎么获得</h3>
        {renderRuleItems(COIN_EARNING_RULES, "bg-blue-100 text-blue-600 dark:bg-blue-400/10 dark:text-blue-300")}
      </div>
      <div>
        <h3 className="font-bold text-slate-950 dark:text-slate-50">怎么使用</h3>
        {renderRuleItems(COIN_SPENDING_RULES, "bg-amber-100 text-amber-600 dark:bg-amber-400/10 dark:text-amber-300")}
      </div>
      <div>
        <h3 className="font-bold text-slate-950 dark:text-slate-50">流水怎么算</h3>
        <div className="mt-4 space-y-4 text-sm leading-6 text-muted-foreground">
          <div>
            <p className="font-semibold text-slate-950 dark:text-slate-50">当前硬币</p>
            <p className="mt-1">显示现在可用的余额，不是累计获得总数。</p>
          </div>
          <div>
            <p className="font-semibold text-slate-950 dark:text-slate-50">本月变动笔数</p>
            <p className="mt-1">本月每一笔收入或支出都会计 1 次，包括签到、收到投币、挑战奖励、兑换和投币支持。</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function WalletSidePanel({
  coins,
  nextReward,
}: {
  coins: number;
  nextReward?: { name: string; price: number };
}) {
  const need = nextReward ? Math.max(nextReward.price - coins, 0) : 0;
  const progress = nextReward ? Math.min((coins / nextReward.price) * 100, 100) : 100;

  return (
    <aside className="space-y-5">
      <section className="surface-panel relative overflow-hidden p-6">
        <div className="absolute right-0 top-0 h-32 w-32 -translate-y-1/2 translate-x-1/2 rounded-full bg-blue-400/10 blur-3xl" />
        <div className="relative flex items-center gap-2">
          <WalletCards className="h-5 w-5 text-blue-500" />
          <h3 className="font-bold">可兑换目标</h3>
        </div>
        <p className="relative mt-4 text-sm text-muted-foreground">
          {nextReward ? `距离兑换「${nextReward.name}」还差` : "当前可兑换所有基础装扮"}
        </p>
        <div className="relative mt-2 flex items-end gap-1">
          <span className="text-4xl font-black tabular-nums tracking-tight text-blue-600 dark:text-blue-400">{need.toLocaleString()}</span>
          <span className="pb-1 text-sm font-semibold text-muted-foreground">硬币</span>
        </div>
        <div className="relative mt-5 h-2.5 w-full overflow-hidden rounded-full bg-slate-100 ring-1 ring-inset ring-black/5 dark:bg-white/5 dark:ring-white/5">
          <div className="relative h-full rounded-full bg-gradient-to-r from-blue-500 to-cyan-400 shadow-[0_0_8px_rgba(6,182,212,0.6)]" style={{ width: `${progress}%` }}>
            <div className="absolute inset-0 bg-white/20" style={{ backgroundImage: 'linear-gradient(45deg,rgba(255,255,255,.15) 25%,transparent 25%,transparent 50%,rgba(255,255,255,.15) 50%,rgba(255,255,255,.15) 75%,transparent 75%,transparent)', backgroundSize: '1rem 1rem' }} />
          </div>
        </div>
        {nextReward ? (
          <p className="relative mt-3 text-xs tabular-nums text-muted-foreground">
            {coins.toLocaleString()} / {nextReward.price.toLocaleString()}
          </p>
        ) : null}
        <Button asChild variant="outline" className="relative mt-6 w-full border-blue-200 bg-white/50 font-bold text-blue-700 shadow-sm backdrop-blur transition-all hover:-translate-y-0.5 hover:bg-white hover:shadow-md dark:border-blue-300/20 dark:bg-blue-400/10 dark:text-blue-200 dark:hover:bg-blue-400/15">
          <Link href="/shop">
            去商店看看
            <ArrowUpRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </section>

    </aside>
  );
}

export default function CoinsPage() {
  const { user, loading: authLoading } = useAuth();
  const { coins = 0 } = useGamification();
  const showDesktopSidePanel = useMediaQuery("(min-width: 1280px)");
  const supabase = useMemo(() => createClient(), []);
  const userId = user?.id ?? "";

  const {
    data: logs = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery<CoinLogRow[]>({
    queryKey: ["coin_logs", userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from("coin_logs")
        .select(
          "id, user_id, amount, action_type, resource_id, created_at, counterparty_display_text",
        )
        .eq("user_id", userId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!userId,
    refetchOnWindowFocus: true,
  });



  const nextReward = useMemo(
    () => SHOP_ITEMS.filter((item) => item.price > coins).sort((a, b) => a.price - b.price)[0],
    [coins],
  );

  const displayLogs = useMemo<CoinLogEntry[]>(() => {
    if (!userId) return logs;

    const loggedBalance = logs.reduce((total, log) => total + log.amount, 0);
    const baselineAmount = coins - loggedBalance;

    if (baselineAmount === 0) {
      return logs;
    }

    const oldestLogDate = logs.length > 0
      ? new Date(logs[logs.length - 1].created_at).getTime()
      : Date.now();
    const baselineDate = new Date(oldestLogDate - 1).toISOString();

    return [
      ...logs,
      {
        id: "balance-baseline",
        user_id: userId,
        amount: baselineAmount,
        action_type: "balance_baseline",
        resource_id: null,
        created_at: baselineDate,
        counterparty_display_text: null,
        synthetic: "balance_baseline",
      },
    ];
  }, [coins, logs, userId]);


  if (authLoading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="app-canvas min-h-[calc(100dvh-var(--mobile-global-header-height,3rem))] pb-24 md:min-h-[calc(100vh-4rem)] md:pb-10">
      <MobileGlobalHeader
        variant="title"
        title="硬币"
        showNotification={false}
        showUserButton={false}
        className="md:hidden"
      />

      <main className="app-shell-wide pt-5 md:px-8 md:pt-8">
        <div className="mb-5 hidden items-center gap-4 md:flex">
          <Button variant="ghost" size="icon" shape="square" asChild className="-ml-2 shrink-0 hover:bg-muted">
            <Link href="/profile" aria-label="返回个人中心">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div>
            <h1 className="text-4xl font-bold tracking-tight text-slate-950 dark:text-slate-50">我的钱包</h1>
          </div>
        </div>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px] 2xl:grid-cols-[minmax(0,1fr)_380px]">
          <section className="min-w-0 space-y-6 lg:space-y-7">
            <section className="relative overflow-hidden rounded-2xl border border-blue-200/60 bg-gradient-to-br from-white via-blue-50/40 to-blue-100/60 px-5 py-7 shadow-[0_32px_64px_-24px_rgba(37,99,235,0.15)] dark:border-blue-800/40 dark:from-slate-900/90 dark:via-blue-950/40 dark:to-slate-900 md:px-8 md:py-8">
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="ghost" size="icon" shape="square" className="absolute right-3 top-3 z-20 text-blue-900/40 hover:bg-black/5 hover:text-blue-900/60 dark:text-blue-100/30 dark:hover:bg-white/10 dark:hover:text-blue-100/50">
                    <HelpCircle className="h-[1.125rem] w-[1.125rem]" />
                    <span className="sr-only">硬币规则</span>
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-md">
                  <DialogHeader className="mb-4">
                    <DialogTitle className="text-xl">硬币规则</DialogTitle>
                  </DialogHeader>
                  <CoinRulesContent />
                </DialogContent>
              </Dialog>

              <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl">
                <div className="absolute -left-24 -top-24 h-64 w-64 rounded-full bg-blue-400/20 blur-3xl dark:bg-blue-600/10" />
                <div className="absolute right-10 top-1/2 h-48 w-48 -translate-y-1/2 rounded-full bg-cyan-400/20 blur-3xl dark:bg-cyan-600/10" />
                <div
                  className="absolute inset-y-0 left-0 -right-20 bg-cover bg-[right_center] bg-no-repeat opacity-100 dark:opacity-60 sm:-right-10 md:right-0"
                  style={{ backgroundImage: "url('/assets/reward-shop-blue-coins-bg.png')" }}
                />
                <div
                  className="absolute inset-0 dark:hidden"
                  style={{
                    background:
                      "linear-gradient(90deg, #ffffff 0%, rgba(255,255,255,0.96) 35%, rgba(255,255,255,0.4) 65%, transparent 100%)",
                  }}
                />
                <div
                  className="absolute inset-0 hidden dark:block"
                  style={{
                    background:
                      "linear-gradient(90deg, hsl(var(--background)) 0%, hsl(var(--background) / 0.96) 35%, hsl(var(--background) / 0.6) 65%, transparent 100%)",
                  }}
                />
              </div>

              <div className="relative flex min-h-[180px] flex-col justify-center">
                <div className="max-w-xl">
                  <div className="inline-flex items-center gap-2 rounded-full border border-blue-200/60 bg-white/80 px-3.5 py-1.5 text-xs font-bold text-blue-900 shadow-sm backdrop-blur-md dark:border-white/10 dark:bg-black/20 dark:text-blue-100">
                    <CoinIcon className="h-4 w-4 text-amber-500 drop-shadow-[0_0_8px_rgba(245,158,11,0.6)]" />
                    当前硬币余额
                  </div>
                  <div className="mt-5 flex flex-wrap items-baseline gap-x-3 gap-y-2">
                    <span className="bg-gradient-to-br from-blue-700 via-indigo-600 to-violet-600 bg-clip-text text-7xl font-black leading-[0.85] tracking-tighter text-transparent tabular-nums drop-shadow-sm dark:from-blue-400 dark:via-indigo-400 dark:to-violet-400 sm:text-8xl">
                      {coins.toLocaleString()}
                    </span>
                    <span className="text-2xl font-bold text-indigo-600/80 dark:text-indigo-400/80">枚</span>
                  </div>
                  <p className="mt-5 max-w-xl text-sm font-medium leading-6 text-slate-600 dark:text-slate-300">硬币可用于兑换商店道具、头像框和个性化权益。</p>

                  <Button asChild size="lg" shape="pill" className="mt-6 w-fit border border-blue-100 bg-white/90 px-8 font-bold text-blue-700 shadow-[0_8px_16px_-6px_rgba(37,99,235,0.2)] backdrop-blur transition-all hover:-translate-y-0.5 hover:bg-white hover:shadow-[0_12px_24px_-8px_rgba(37,99,235,0.3)] dark:border-none dark:bg-blue-50 dark:text-blue-800 dark:hover:bg-white">
                    <Link href="/shop">
                      <ShoppingBag className="mr-2 h-4 w-4" />
                      去兑换装扮
                    </Link>
                  </Button>
                </div>
              </div>
            </section>


            <section className="surface-panel overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/40 px-5 py-4 dark:border-white/[0.04]">
                <div>
                  <h2 className="text-lg font-bold">交易记录</h2>
                </div>
                <span className="rounded-full border border-border/70 bg-background/70 px-3 py-1 text-xs font-semibold text-muted-foreground dark:bg-white/[0.03]">
                  共 {displayLogs.length} 条
                </span>
              </div>
              <CoinLogTimeline
                logs={displayLogs}
                isLoading={isLoading}
                isError={isError}
                error={error}
                onRetry={() => refetch()}
              />
            </section>
          </section>

          {showDesktopSidePanel ? (
            <div className="xl:self-start xl:sticky xl:top-24">
              <WalletSidePanel coins={coins} nextReward={nextReward} />
            </div>
          ) : null}
        </div>
      </main>
    </div>
  );
}
