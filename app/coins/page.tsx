"use client";

import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowLeft,
  ArrowUpRight,
  CalendarCheck,
  ChevronDown,
  Gift,
  History,
  Loader2,
  ShoppingBag,
  Sparkles,
  ThumbsUp,
  Trophy,
  WalletCards,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";

import { CoinIcon } from "@/components/icons/coin-icon";
import { Button } from "@/components/ui/button";
import { MobilePageHeader } from "@/components/ui/mobile-page-header";
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

function SummaryCard({
  icon,
  label,
  value,
  description,
  showDescription,
  tone,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  description?: string;
  showDescription: boolean;
  tone: string;
}) {
  return (
    <div className="flex min-w-0 flex-col items-start gap-2 border-r border-border/70 px-3 py-3.5 last:border-r-0 min-[390px]:px-4 sm:flex-row sm:items-center sm:gap-3 sm:px-4 sm:py-4">
      <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl sm:h-11 sm:w-11 sm:rounded-full", tone)}>{icon}</div>
      <div className="min-w-0">
        <div className="text-[11px] font-medium leading-4 text-muted-foreground min-[390px]:text-xs sm:text-sm">{label}</div>
        <div className="mt-1 text-[1.95rem] font-black leading-none tabular-nums text-slate-950 dark:text-slate-50 sm:truncate sm:text-2xl">{value}</div>
        {showDescription && description ? <div className="mt-1 text-xs text-muted-foreground">{description}</div> : null}
      </div>
    </div>
  );
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
        <div className="mx-auto flex max-w-md items-center gap-4 rounded-2xl border border-dashed border-blue-200 bg-blue-50/60 px-5 py-5 text-left dark:border-blue-300/20 dark:bg-blue-400/10">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white text-blue-500 shadow-sm dark:bg-white/10 dark:text-blue-300">
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
          <h4 className="sticky top-0 z-10 mb-3 w-fit rounded-full bg-background/92 px-2.5 py-1 text-xs font-semibold text-muted-foreground backdrop-blur dark:bg-background/88">
            {group.label}
          </h4>
          <div className="relative overflow-hidden rounded-2xl border border-border/70 bg-background/70 dark:bg-white/[0.03]">
            <div className="absolute bottom-5 left-9 top-5 w-px bg-border/70" />
            {group.items.map((log) => {
              const isPositive = log.amount >= 0;
              const actionIcon = getActionIcon(log.action_type);
              const iconStyle = getActionIconStyle(log.action_type);

              return (
                <div key={log.id} className="relative grid grid-cols-[40px_minmax(0,1fr)_auto] items-center gap-3 border-b border-border/60 px-4 py-4 last:border-b-0 sm:grid-cols-[48px_minmax(0,1fr)_auto] sm:gap-4">
                  <div className={cn("z-10 flex h-10 w-10 items-center justify-center rounded-full", iconStyle)}>
                    {actionIcon}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-slate-950 dark:text-slate-50">
                      {getActionLabel(
                        log.action_type,
                        log.resource_id,
                        log.counterparty_display_text ?? null,
                        log.amount,
                      )}
                    </p>
                    <p className="mt-1 truncate text-xs text-muted-foreground">{getActionDescription(log)}</p>
                  </div>
                  <div className="text-right">
                    <div
                      className={cn(
                        "text-lg font-black tabular-nums",
                        isPositive ? "text-emerald-600 dark:text-emerald-300" : "text-orange-600 dark:text-orange-300",
                      )}
                    >
                      {isPositive ? "+" : ""}
                      {log.amount}
                    </div>
                    <div className="mt-0.5 text-xs text-muted-foreground">{formatEntryTime(log)}</div>
                    <div className="mt-0.5 text-xs text-muted-foreground">{getStatusLabel(log)}</div>
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

function CoinRulesSection({
  className,
  compact = false,
  isDesktopViewport = false,
}: {
  className?: string;
  compact?: boolean;
  isDesktopViewport?: boolean;
}) {
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const showDesktopLayout = !compact && isDesktopViewport;
  const shouldRenderContent = compact || isDesktopViewport || isMobileOpen;
  const rulesContentId = "coins-rules-content";

  const renderRuleItems = (items: readonly CoinRuleItem[], iconClassName: string) => (
    <div className={cn("space-y-3.5 sm:space-y-4", compact ? "mt-3" : "mt-4")}>
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <div key={item.title} className="flex items-start gap-3">
            <div className={cn("mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-2xl sm:h-9 sm:w-9 sm:rounded-full", iconClassName)}>
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
    <section className={cn("surface-panel p-5", compact ? "sm:p-5" : "sm:p-6", className)}>
      {!compact ? (
        <>
          <button
            type="button"
            aria-expanded={isMobileOpen}
            aria-controls={rulesContentId}
            onClick={() => setIsMobileOpen((open) => !open)}
            className="flex w-full items-start justify-between gap-4 text-left md:hidden"
          >
            <span className="min-w-0">
              <span className="block text-lg font-bold text-slate-950 dark:text-slate-50">硬币规则</span>
              <span className="mt-1 block text-sm leading-6 text-muted-foreground">获得、使用和流水说明</span>
            </span>
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border/70 bg-background/70 text-muted-foreground dark:bg-white/[0.03]">
              <ChevronDown className={cn("h-4 w-4 transition-transform", isMobileOpen && "rotate-180")} />
            </span>
          </button>

          <div className="hidden items-start justify-between gap-3 md:flex">
            <div className="max-w-3xl">
              <h2 className="text-lg font-bold">硬币规则</h2>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                这里集中说明硬币的获得、使用和流水统计；页面其他区域只展示余额、进度和记录。
              </p>
            </div>
            <span className="rounded-full border border-border/70 bg-background/70 px-3 py-1 text-xs font-semibold text-muted-foreground dark:bg-white/[0.03]">
              规则说明
            </span>
          </div>
        </>
      ) : (
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold">硬币规则</h2>
          </div>
        </div>
      )}

      {shouldRenderContent ? (
        <div
          id={compact ? undefined : rulesContentId}
          className={cn(
            "border-t border-border/70",
            compact
              ? "mt-5 space-y-6 pt-5"
              : showDesktopLayout
                ? "mt-5 grid gap-6 pt-5 lg:grid-cols-3 lg:gap-0 lg:divide-x lg:divide-border/70"
                : "mt-4 space-y-5 pt-4",
          )}
        >
          <div className={cn(showDesktopLayout && "lg:pr-6")}>
            <h3 className="font-bold text-slate-950 dark:text-slate-50">怎么获得</h3>
            {renderRuleItems(COIN_EARNING_RULES, "bg-blue-100 text-blue-600 dark:bg-blue-400/10 dark:text-blue-300")}
          </div>

          <div className={cn(showDesktopLayout && "lg:px-6")}>
            <h3 className="font-bold text-slate-950 dark:text-slate-50">怎么使用</h3>
            {renderRuleItems(COIN_SPENDING_RULES, "bg-amber-100 text-amber-600 dark:bg-amber-400/10 dark:text-amber-300")}
          </div>

          <div className={cn(showDesktopLayout && "lg:pl-6")}>
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
      ) : null}
    </section>
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
      <CoinRulesSection compact />

      <section className="surface-panel overflow-hidden p-5">
        <div className="flex items-center gap-2">
          <WalletCards className="h-5 w-5 text-blue-500" />
          <h3 className="font-bold">可兑换目标</h3>
        </div>
        <p className="mt-4 text-sm text-muted-foreground">
          {nextReward ? `距离兑换「${nextReward.name}」还差` : "当前可兑换所有基础装扮"}
        </p>
        <div className="mt-2 flex items-end gap-1">
          <span className="text-3xl font-black tabular-nums text-blue-600 dark:text-blue-300">{need.toLocaleString()}</span>
          <span className="pb-1 text-sm font-semibold text-muted-foreground">硬币</span>
        </div>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-gradient-to-r from-blue-600 to-cyan-400" style={{ width: `${progress}%` }} />
        </div>
        {nextReward ? (
          <p className="mt-3 text-xs tabular-nums text-muted-foreground">
            {coins.toLocaleString()} / {nextReward.price.toLocaleString()}
          </p>
        ) : null}
        <Button asChild variant="outline" className="mt-5 w-full rounded-full border-blue-200 bg-blue-50/70 font-bold text-blue-700 hover:bg-blue-100 dark:border-blue-300/20 dark:bg-blue-400/10 dark:text-blue-200 dark:hover:bg-blue-400/15">
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
  const showSummaryDescription = useMediaQuery("(min-width: 640px)");
  const isDesktopRulesViewport = useMediaQuery("(min-width: 768px)");
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

  const summary = useMemo(() => {
    const now = new Date();
    const month = now.getMonth();
    const year = now.getFullYear();

    const thisMonthLogs = logs.filter((log) => {
      const date = new Date(log.created_at);
      return date.getFullYear() === year && date.getMonth() === month;
    });

    return {
      monthlyIncome: thisMonthLogs.reduce((total, log) => total + Math.max(log.amount, 0), 0),
      monthlySpend: Math.abs(thisMonthLogs.reduce((total, log) => total + Math.min(log.amount, 0), 0)),
      monthlyChangeCount: thisMonthLogs.length,
      redeemed: Math.abs(logs.filter((log) => log.amount < 0).reduce((total, log) => total + log.amount, 0)),
      streakDays: logs.filter((log) => log.action_type === "daily_login").length,
    };
  }, [logs]);

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
    <div className="app-canvas min-h-[calc(100dvh-var(--mobile-global-header-height,4rem))] pb-24 md:min-h-[calc(100vh-4rem)] md:pb-10">
      <MobilePageHeader
        title="我的钱包"
        fallbackHref="/profile"
        className="md:hidden"
        titleClassName="text-center text-lg"
      />

      <main className="mx-auto w-full max-w-[1840px] px-4 pt-5 min-[390px]:px-5 md:px-8 md:pt-8">
        <div className="mb-5 hidden items-center gap-4 md:flex">
          <Button variant="ghost" size="icon" asChild className="-ml-2 shrink-0 rounded-full hover:bg-muted">
            <Link href="/profile" aria-label="返回个人中心">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div>
            <h1 className="text-4xl font-bold tracking-tight text-slate-950 dark:text-slate-50">我的钱包</h1>
          </div>
        </div>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px] 2xl:grid-cols-[minmax(0,1fr)_380px]">
          <section className="min-w-0 space-y-5 lg:space-y-6">
            <section className="relative overflow-hidden rounded-[30px] border border-blue-200/70 bg-[hsl(var(--surface-raised)/0.92)] px-5 py-6 shadow-[0_28px_64px_-42px_rgba(37,99,235,0.34)] dark:border-blue-300/20 md:px-8 md:py-7">
              <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[30px]">
                <div
                  className="absolute inset-y-0 left-0 -right-20 bg-cover bg-[right_center] bg-no-repeat opacity-100 dark:opacity-55 min-[390px]:-right-16 sm:-right-10 md:right-0"
                  style={{ backgroundImage: "url('/assets/reward-shop-blue-coins-bg.png')" }}
                />
                <div
                  className="absolute inset-0 dark:hidden"
                  style={{
                    background:
                      "linear-gradient(90deg, hsl(var(--surface-raised)) 0%, hsl(var(--surface-raised) / 0.98) 28%, hsl(var(--surface-raised) / 0.72) 46%, hsl(var(--surface-raised) / 0.16) 62%, transparent 74%)",
                  }}
                />
                <div
                  className="absolute inset-0 hidden dark:block"
                  style={{
                    background:
                      "linear-gradient(90deg, hsl(var(--background)) 0%, hsl(var(--background) / 0.96) 30%, hsl(var(--background) / 0.72) 48%, hsl(var(--background) / 0.18) 64%, transparent 76%)",
                  }}
                />
              </div>

              <div className="relative flex min-h-[176px] flex-col justify-center md:min-h-[164px]">
                <div className="max-w-xl">
                  <div className="inline-flex items-center gap-2 rounded-full border border-blue-100 bg-white/72 px-3 py-1 text-sm font-bold text-slate-900 shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/[0.07] dark:text-slate-50">
                    <CoinIcon className="h-4 w-4 text-amber-500" />
                    当前硬币
                  </div>
                  <div className="mt-4 flex flex-wrap items-end gap-x-3 gap-y-2">
                    <span className="text-6xl font-black leading-[0.9] tracking-tight text-slate-950 tabular-nums dark:text-slate-50 sm:text-7xl">
                      {coins.toLocaleString()}
                    </span>
                    <span className="pb-2 text-xl font-bold text-slate-700 dark:text-slate-200">硬币</span>
                  </div>
                  <p className="mt-4 max-w-xl text-sm leading-6 text-slate-700 dark:text-slate-200">硬币可用于兑换商店道具、头像框和个性化权益。</p>

                  <Button asChild size="lg" className="mt-5 w-fit rounded-full bg-white px-6 font-bold text-blue-700 shadow-lg shadow-blue-950/10 hover:bg-blue-50 dark:bg-blue-50 dark:text-blue-800 dark:hover:bg-white">
                    <Link href="/shop">
                      <ShoppingBag className="mr-2 h-4 w-4" />
                      去商店兑换
                    </Link>
                  </Button>
                </div>
              </div>
            </section>

            <section className="surface-panel grid grid-cols-3 overflow-hidden">
              <SummaryCard
                icon={<ArrowUpRight className="h-5 w-5" />}
                label="本月获得"
                value={summary.monthlyIncome.toLocaleString()}
                description="本月到账的硬币收入"
                showDescription={showSummaryDescription}
                tone="bg-blue-100 text-blue-600 dark:bg-blue-400/10 dark:text-blue-300"
              />
              <SummaryCard
                icon={<ShoppingBag className="h-5 w-5" />}
                label="本月支出"
                value={summary.monthlySpend.toLocaleString()}
                description="兑换和投币支出"
                showDescription={showSummaryDescription}
                tone="bg-emerald-100 text-emerald-600 dark:bg-emerald-400/10 dark:text-emerald-300"
              />
              <SummaryCard
                icon={<History className="h-5 w-5" />}
                label="本月变动笔数"
                value={summary.monthlyChangeCount.toLocaleString()}
                description={`收入、支出记录共 ${summary.monthlyChangeCount.toLocaleString()} 笔`}
                showDescription={showSummaryDescription}
                tone="bg-orange-100 text-orange-600 dark:bg-orange-400/10 dark:text-orange-300"
              />
            </section>

            <CoinRulesSection className="xl:hidden" isDesktopViewport={isDesktopRulesViewport} />

            <section className="surface-panel overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 px-5 py-4">
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
