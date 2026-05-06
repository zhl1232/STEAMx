"use client";

import type { ReactNode } from "react";
import { useMemo } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  CalendarCheck,
  CheckCircle2,
  CircleHelp,
  Gift,
  History,
  Loader2,
  ShoppingBag,
  Sparkles,
  Star,
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
    default:
      return actionType || "其他";
  }
}

function getActionDescription(log: CoinLogRow): string {
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
    default:
      return "bg-muted text-muted-foreground dark:bg-white/[0.06]";
  }
}

function getStatusLabel(log: CoinLogRow): string {
  if (log.action_type === "purchase") return "已兑换";
  if (log.amount >= 0) return "已到账";
  return "已支出";
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

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
}

function formatDateGroup(iso: string): string {
  const date = new Date(iso);
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

function getWeekStart(date: Date) {
  const result = new Date(date);
  const day = result.getDay() || 7;
  result.setHours(0, 0, 0, 0);
  result.setDate(result.getDate() - day + 1);
  return result;
}

function SummaryCard({
  icon,
  label,
  value,
  tone,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  tone: string;
}) {
  return (
    <div className="flex min-w-0 items-center gap-3 border-r border-border/70 px-4 py-4 last:border-r-0 max-sm:border-r-0">
      <div className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-full", tone)}>{icon}</div>
      <div className="min-w-0">
        <div className="text-sm text-muted-foreground">{label}</div>
        <div className="mt-1 truncate text-2xl font-black tabular-nums text-slate-950 dark:text-slate-50">{value}</div>
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
  logs: CoinLogRow[];
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  onRetry: () => void;
}) {
  const groupedLogs = useMemo(() => {
    const groups = new Map<string, CoinLogRow[]>();
    logs.forEach((log) => {
      const key = formatDateGroup(log.created_at);
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
          <h4 className="mb-3 text-sm font-semibold text-muted-foreground">{group.label}</h4>
          <div className="relative overflow-hidden rounded-2xl border border-border/70 bg-background/70 dark:bg-white/[0.03]">
            <div className="absolute bottom-5 left-[34px] top-5 w-px bg-border/70" />
            {group.items.map((log) => {
              const isPositive = log.amount >= 0;
              const actionIcon = getActionIcon(log.action_type);
              const iconStyle = getActionIconStyle(log.action_type);

              return (
                <div key={log.id} className="relative grid grid-cols-[40px_minmax(0,1fr)_auto] items-center gap-3 border-b border-border/60 px-4 py-4 last:border-b-0 sm:grid-cols-[48px_minmax(0,1fr)_86px_110px]">
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
                  <div className="hidden text-right text-xs tabular-nums text-muted-foreground sm:block">{formatDate(log.created_at)}</div>
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
                    <div className="mt-0.5 text-xs text-muted-foreground sm:hidden">{formatTime(log.created_at)}</div>
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

function WalletSidePanel({ coins, nextReward }: { coins: number; nextReward?: { name: string; price: number } }) {
  const need = nextReward ? Math.max(nextReward.price - coins, 0) : 0;
  const progress = nextReward ? Math.min((coins / nextReward.price) * 100, 100) : 100;
  const earningWays = [
    { icon: CheckCircle2, label: "作品通过审核", value: "+50 ~ 300 硬币", tone: "text-emerald-500" },
    { icon: Trophy, label: "完成官方挑战", value: "+50 ~ 500 硬币", tone: "text-blue-500" },
    { icon: ThumbsUp, label: "获得认可", value: "+1 ~ 20 硬币", tone: "text-orange-500" },
    { icon: CalendarCheck, label: "连续观察自然", value: "+20 ~ 100 硬币", tone: "text-emerald-500" },
  ];

  return (
    <aside className="space-y-5">
      <section className="surface-panel p-5">
        <div className="mb-4 flex items-center gap-2">
          <Star className="h-5 w-5 text-blue-500" />
          <h3 className="font-bold">如何获得硬币</h3>
        </div>
        <div className="space-y-3">
          {earningWays.map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.label} className="flex items-center justify-between gap-3 rounded-xl border border-border/70 bg-background/70 px-3 py-2.5 text-sm dark:bg-white/[0.03]">
                <span className="flex min-w-0 items-center gap-2 text-muted-foreground">
                  <Icon className={cn("h-4 w-4 shrink-0", item.tone)} />
                  <span className="truncate">{item.label}</span>
                </span>
                <span className="shrink-0 font-semibold text-emerald-600 dark:text-emerald-300">{item.value}</span>
              </div>
            );
          })}
        </div>
        <Link href="/community" className="mt-4 inline-flex items-center text-sm font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-300">
          查看完整规则
          <ArrowRight className="ml-1 h-4 w-4" />
        </Link>
      </section>

      <section className="surface-panel overflow-hidden p-5">
        <div className="flex items-center gap-2">
          <WalletCards className="h-5 w-5 text-blue-500" />
          <h3 className="font-bold">成长进度</h3>
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
      </section>

      <section className="surface-panel relative overflow-hidden p-5">
        <div className="absolute -right-10 -top-10 h-24 w-24 rounded-full bg-amber-300/25 blur-2xl dark:bg-amber-300/10" />
        <div className="flex items-center gap-2">
          <CircleHelp className="h-5 w-5 text-orange-500" />
          <h3 className="font-bold">小贴士</h3>
        </div>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">坚持记录和参与挑战，硬币会让你的探索之旅更有收获。</p>
      </section>
    </aside>
  );
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

  const summary = useMemo(() => {
    const now = new Date();
    const weekStart = getWeekStart(now);
    const month = now.getMonth();
    const year = now.getFullYear();

    const thisMonthLogs = logs.filter((log) => {
      const date = new Date(log.created_at);
      return date.getFullYear() === year && date.getMonth() === month;
    });
    const thisWeekLogs = logs.filter((log) => new Date(log.created_at) >= weekStart);

    return {
      monthlyIncome: thisMonthLogs.reduce((total, log) => total + Math.max(log.amount, 0), 0),
      monthlySpend: Math.abs(thisMonthLogs.reduce((total, log) => total + Math.min(log.amount, 0), 0)),
      monthlyCount: thisMonthLogs.length,
      weeklyIncome: thisWeekLogs.reduce((total, log) => total + Math.max(log.amount, 0), 0),
      redeemed: Math.abs(logs.filter((log) => log.amount < 0).reduce((total, log) => total + log.amount, 0)),
      streakDays: logs.filter((log) => log.action_type === "daily_login").length,
    };
  }, [logs]);

  const nextReward = useMemo(
    () => SHOP_ITEMS.filter((item) => item.price > coins).sort((a, b) => a.price - b.price)[0],
    [coins],
  );

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
        rightSlot={<CircleHelp className="h-5 w-5 text-muted-foreground" />}
      />

      <main className="page-shell pt-5 md:pt-8">
        <div className="mb-5 hidden items-center gap-4 md:flex">
          <Button variant="ghost" size="icon" asChild className="-ml-2 shrink-0 rounded-full hover:bg-muted">
            <Link href="/profile" aria-label="返回个人中心">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div>
            <h1 className="text-4xl font-bold tracking-tight text-slate-950 dark:text-slate-50">我的钱包</h1>
            <p className="mt-2 text-sm text-muted-foreground">记录每一次学习实践获得的奖励</p>
          </div>
        </div>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_330px]">
          <section className="min-w-0 space-y-5">
            <section className="relative overflow-hidden rounded-[28px] border border-blue-200/70 bg-blue-600 px-5 py-6 text-white shadow-[0_28px_64px_-42px_rgba(37,99,235,0.9)] dark:border-blue-300/20 md:px-8 md:py-8">
              <div
                className="absolute inset-0 bg-[length:820px_auto] bg-[right_-240px_center] bg-no-repeat opacity-45 mix-blend-screen md:bg-[right_-170px_center]"
                style={{ backgroundImage: "url('/assets/reward-shop-blue-coins-bg.png')" }}
              />
              <div className="absolute inset-0 bg-gradient-to-r from-blue-600 via-blue-600/90 to-blue-500/20 dark:from-blue-950 dark:via-blue-900/90 dark:to-blue-800/20" />

              <div className="relative grid gap-7 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
                <div>
                  <div className="flex items-center gap-2 text-blue-50/90">
                    <span className="text-lg font-bold">当前硬币</span>
                    <CircleHelp className="h-4 w-4" />
                  </div>
                  <div className="mt-4 flex flex-wrap items-end gap-3">
                    <span className="text-6xl font-black leading-none tracking-tight tabular-nums sm:text-7xl">
                      {coins.toLocaleString()}
                    </span>
                    <span className="pb-2 text-xl font-bold text-blue-50/90">硬币</span>
                  </div>
                  <p className="mt-3 max-w-lg text-sm leading-6 text-blue-50/90">硬币可用于兑换商店道具、头像框和个性化权益。</p>
                </div>

                <div className="flex flex-wrap gap-3 md:justify-end">
                  <Button asChild size="lg" className="rounded-full bg-white px-6 font-bold text-blue-700 shadow-lg shadow-blue-950/10 hover:bg-blue-50">
                    <Link href="/shop">
                      <ShoppingBag className="mr-2 h-4 w-4" />
                      去商店兑换
                    </Link>
                  </Button>
                  <Button asChild variant="outline" size="lg" className="rounded-full border-white/60 bg-white/10 px-6 font-bold text-white hover:bg-white/20 hover:text-white">
                    <Link href="/community">
                      了解规则
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                </div>
              </div>
            </section>

            <section className="surface-panel grid overflow-hidden sm:grid-cols-3">
              <SummaryCard
                icon={<ArrowUpRight className="h-5 w-5" />}
                label="本月获得"
                value={summary.monthlyIncome.toLocaleString()}
                tone="bg-blue-100 text-blue-600 dark:bg-blue-400/10 dark:text-blue-300"
              />
              <SummaryCard
                icon={<ShoppingBag className="h-5 w-5" />}
                label="本月支出"
                value={summary.monthlySpend.toLocaleString()}
                tone="bg-emerald-100 text-emerald-600 dark:bg-emerald-400/10 dark:text-emerald-300"
              />
              <SummaryCard
                icon={<History className="h-5 w-5" />}
                label="本月交易"
                value={summary.monthlyCount.toLocaleString()}
                tone="bg-orange-100 text-orange-600 dark:bg-orange-400/10 dark:text-orange-300"
              />
            </section>

            <section className="surface-panel overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 px-5 py-4">
                <div>
                  <h2 className="text-lg font-bold">交易记录</h2>
                  <p className="mt-1 text-sm text-muted-foreground">收入、支出与兑换状态一目了然</p>
                </div>
                <span className="rounded-full border border-border/70 bg-background/70 px-3 py-1 text-xs font-semibold text-muted-foreground dark:bg-white/[0.03]">
                  最近 {logs.length} 条
                </span>
              </div>
              <CoinLogTimeline
                logs={logs}
                isLoading={isLoading}
                isError={isError}
                error={error}
                onRetry={() => refetch()}
              />
            </section>

            <section className="surface-panel flex items-center justify-between gap-4 p-4 lg:hidden">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100 text-amber-600 dark:bg-amber-400/10 dark:text-amber-300">
                  <CoinIcon className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="font-bold">本周获得 +{summary.weeklyIncome.toLocaleString()}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">发布项目、完成挑战、记录观察都可获得硬币</p>
                </div>
              </div>
              <ArrowUpRight className="hidden h-5 w-5 text-blue-500 sm:block" />
            </section>
          </section>

          <div className="hidden lg:block">
            <WalletSidePanel coins={coins} nextReward={nextReward} />
          </div>
        </div>
      </main>
    </div>
  );
}
