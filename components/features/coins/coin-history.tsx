"use client";

import { useMemo } from "react";
import {
  AlertCircle,
  CalendarCheck,
  Gift,
  Loader2,
  ShoppingBag,
  Sparkles,
  ThumbsUp,
  Trophy,
} from "lucide-react";
import { useInfiniteQuery } from "@tanstack/react-query";

import { CoinIcon } from "@/components/icons/coin-icon";
import { Button } from "@/components/ui/button";

import { useAuth } from "@/lib/context/auth-context";
import { useGamification } from "@/lib/context/gamification-context";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/lib/supabase/types";
import { cn } from "@/lib/utils";
import { getActionLabel } from "@/app/coins/action-label";

type CoinLogRow = Database["public"]["Tables"]["coin_logs"]["Row"];
type CoinLogEntry = Omit<CoinLogRow, "id"> & {
  id: CoinLogRow["id"] | string;
  synthetic?: "balance_baseline";
};

const COIN_LOG_PAGE_SIZE = 20;

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
    title: "兑换优惠券",
    description: "用硬币兑换材料优惠券，购买实物时按券的使用规则减免。硬币不直接抵扣订单金额。",
  },
  {
    icon: ShoppingBag,
    title: "装扮兑换",
    description: "可以兑换头像框、昵称颜色等装扮。",
  },
  {
    icon: ThumbsUp,
    title: "投币支持",
    description: "也可以把硬币投给你喜欢的创作者或作品。",
  },
] as const;

type CoinRuleItem = (typeof COIN_EARNING_RULES)[number] | (typeof COIN_SPENDING_RULES)[number];

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
    case "store_redeem":
      return "实物订单预扣，取消或整单退款确认后返还";
    case "store_release":
      return "订单取消或退款确认后返还原抵扣硬币";
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
      return "bg-slate-100 text-slate-600 dark:bg-white/8 dark:text-slate-300";
    default:
      return "bg-muted text-muted-foreground dark:bg-white/6";
  }
}

function getStatusLabel(log: CoinLogEntry): string {
  if (log.synthetic === "balance_baseline") return "已计入";
  if (log.action_type === "purchase") return "已兑换";
  if (log.amount >= 0) return "已到账";
  return "已支出";
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("zh-CN", { timeZone: "Asia/Shanghai", hour: "2-digit", minute: "2-digit" });
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

  const day = date.toLocaleDateString("zh-CN", { timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  if (date.toDateString() === now.toDateString()) return `${day} 今天`;
  if (date.toDateString() === yesterday.toDateString()) return `${day} 昨天`;
  return day;
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
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-md bg-white text-blue-500 shadow-xs dark:bg-white/10 dark:text-blue-300">
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
          <h4 className="sticky top-0 z-10 mb-3 w-fit rounded-full bg-background/92 px-3 py-1.5 text-xs font-bold text-slate-600 backdrop-blur-sm dark:bg-background/88 dark:text-slate-300">
            {group.label}
          </h4>
          <div className="relative space-y-1.5">
            <div className="absolute bottom-6 left-5.5 top-6 w-px bg-linear-to-b from-transparent via-border to-transparent sm:left-6.5" />
            {group.items.map((log) => {
              const isPositive = log.amount >= 0;
              const actionIcon = getActionIcon(log.action_type);
              const iconStyle = getActionIconStyle(log.action_type);

              return (
                <div key={log.id} className="group relative flex items-center gap-3 rounded-2xl p-2 transition-all hover:bg-muted/50 dark:hover:bg-white/2 sm:gap-4 sm:p-3">
                  <div className="relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-background shadow-xs ring-1 ring-border/50 sm:h-10 sm:w-10">
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

export default function CoinHistory() {
  const { user, loading: authLoading } = useAuth();
  const { coins = 0 } = useGamification();
  const supabase = useMemo(() => createClient(), []);
  const userId = user?.id ?? "";

  const {
    data,
    dataUpdatedAt,
    isLoading,
    isError,
    error,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetching,
    isFetchingNextPage,
    isFetchNextPageError,
  } = useInfiniteQuery({
    queryKey: ["coin_logs", userId, "infinite"],
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      const { data, error, count } = await supabase
        .from("coin_logs")
        .select(
          "id, user_id, amount, action_type, resource_id, created_at, counterparty_display_text",
          { count: "exact" },
        )
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .range(pageParam, pageParam + COIN_LOG_PAGE_SIZE - 1);
      if (error) throw error;
      const logs = data ?? [];
      const nextOffset = pageParam + logs.length;
      return {
        logs,
        count,
        nextOffset: logs.length === COIN_LOG_PAGE_SIZE && (count === null || nextOffset < count)
          ? nextOffset
          : undefined,
      };
    },
    getNextPageParam: (lastPage) => lastPage.nextOffset,
    enabled: !!userId,
    refetchOnWindowFocus: true,
  });


  const logs = useMemo(() => data?.pages.flatMap((page) => page.logs) ?? [], [data]);

  const displayLogs = useMemo<CoinLogEntry[]>(() => {
    if (!userId || !data || hasNextPage || isError) return logs;

    const loggedBalance = logs.reduce((total, log) => total + log.amount, 0);
    const baselineAmount = coins - loggedBalance;

    if (baselineAmount === 0) {
      return logs;
    }

    const oldestLogDate = logs.length > 0
      ? new Date(logs[logs.length - 1].created_at).getTime()
      : dataUpdatedAt;
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
  }, [coins, logs, userId, data, dataUpdatedAt, hasNextPage, isError]);


  if (authLoading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return <div className="space-y-5"><details><summary className="min-h-11 cursor-pointer py-3">硬币规则</summary><CoinRulesContent /></details>
            <section className="surface-panel overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/40 px-5 py-4 dark:border-white/4">
                <div>
                  <h2 className="text-lg font-bold">收支明细</h2>
                </div>
                <span className="rounded-full border border-border/70 bg-background/70 px-3 py-1 text-xs font-semibold text-muted-foreground dark:bg-white/3">
                  共 {(data?.pages.at(-1)?.count ?? logs.length) + displayLogs.length - logs.length} 条
                </span>
              </div>
              <CoinLogTimeline
                logs={displayLogs}
                isLoading={isLoading}
                isError={isError && !isFetchNextPageError}
                error={error}
                onRetry={() => refetch()}
              />
              {hasNextPage ? (
                <div className="flex flex-col items-center gap-3 px-5 py-4">
                  {isFetchNextPageError ? <p role="alert" className="text-sm text-destructive">加载更多失败，请重试</p> : null}
                  <Button
                    variant="outline"
                    disabled={isFetching}
                    onClick={() => { if (!isFetching) void fetchNextPage(); }}
                  >
                    {isFetchingNextPage ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> : null}
                    {isFetchingNextPage ? "加载中..." : "加载更多"}
                  </Button>
                </div>
              ) : null}
            </section>
</div>;
}
