"use client";

import type { MouseEvent } from "react";
import { useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  CircleHelp,
  Loader2,
  Lock,
  Palette,
  ShoppingBag,
  Sparkles,
  Trophy,
  UserRound,
  WalletCards,
} from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { CoinIcon } from "@/components/icons/coin-icon";
import { MobileGlobalHeader } from "@/components/layout/mobile-global-header";
import { AvatarWithFrame } from "@/components/ui/avatar-with-frame";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/context/auth-context";
import { useGamification } from "@/lib/context/gamification-context";
import { getDefaultAvatarPath } from "@/lib/profile/avatar-options";
import { getDisplayName } from "@/lib/utils/user";
import { createClient } from "@/lib/supabase/client";
import { SHOP_ITEMS, getNameColorClassName, getShopItemById } from "@/lib/shop/items";
import type { Profile } from "@/lib/mappers/types";
import type { ShopItem, ShopItemType } from "@/lib/shop/items";
import { cn } from "@/lib/utils";

type ShopRpcResult = {
  ok?: boolean;
  error?: string;
  item_id?: string;
  price?: number;
  min_level?: number;
  level?: number;
};

type ShopMutationError = Error & {
  code?: string;
  minLevel?: number;
  currentLevel?: number;
};

type ItemState = {
  owned: boolean;
  equipped: boolean;
  levelLocked: boolean;
  canBuy: boolean;
};

function createShopMutationError(result: ShopRpcResult, fallbackCode: string): ShopMutationError {
  const error = new Error(result.error || fallbackCode) as ShopMutationError;
  error.code = result.error || fallbackCode;
  error.minLevel = result.min_level;
  error.currentLevel = result.level;
  return error;
}

export function getShopMutationErrorMessage(error: unknown): string {
  const shopError = error as ShopMutationError | null;
  const code = shopError?.code || shopError?.message;

  switch (code) {
    case "insufficient_coins":
      return "硬币不足";
    case "invalid_item":
      return "商品无效";
    case "already_owned":
      return "已拥有该商品，无需重复兑换";
    case "unauthorized":
      return "登录状态已失效，请重新登录后再试";
    case "profile_not_found":
      return "未找到当前账号资料，请稍后重试";
    case "min_level_required":
      return typeof shopError?.minLevel === "number"
        ? `等级不足，需达到 Lv.${shopError.minLevel}`
        : "当前等级不足，暂时无法兑换";
    case "not_owned":
      return "未拥有该商品，无法装备";
    case "not_name_color":
      return "该商品不是昵称颜色，无法装备";
    case "equip_failed":
      return "装备失败，请稍后重试";
    case "purchase_failed":
      return "兑换失败，请稍后重试";
    default:
      return error instanceof Error && error.message ? error.message : "请稍后重试";
  }
}

function getItemBadge(item: ShopItem): { label: string; className: string } {
  if ((item.minLevel ?? 0) >= 30) {
    return { label: "高阶", className: "bg-slate-100 text-slate-700 dark:bg-white/[0.08] dark:text-slate-200" };
  }
  if (item.type === "avatar_frame" && item.price >= 150) {
    return { label: "热门", className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300" };
  }
  if (item.type === "name_color") {
    return { label: "色彩", className: "bg-orange-100 text-orange-700 dark:bg-orange-400/10 dark:text-orange-300" };
  }
  return { label: "新品", className: "bg-blue-100 text-blue-700 dark:bg-blue-400/10 dark:text-blue-300" };
}

function CategoryIcon({ type, className }: { type: ShopItemType; className?: string }) {
  return type === "avatar_frame" ? <UserRound className={className} /> : <Palette className={className} />;
}

function ShopHero({
  level,
  displayName,
  avatarSrc,
  progress,
  levelProgress,
  levelTotalNeeded,
  selectedItem,
  equippedAvatarFrameId,
  equippedNameColorId,
}: {
  level: number;
  displayName: string;
  avatarSrc: string;
  progress: number;
  levelProgress: number;
  levelTotalNeeded: number;
  selectedItem: ShopItem | undefined;
  equippedAvatarFrameId: string | null;
  equippedNameColorId: string | null;
}) {
  const safeProgress = Math.max(0, Math.min(progress || 0, 100));
  const previewFrameId = selectedItem?.type === "avatar_frame" ? selectedItem.id : equippedAvatarFrameId;
  const previewNameColorId = selectedItem?.type === "name_color" ? selectedItem.id : equippedNameColorId;

  return (
    <section
      aria-label="商店个人预览"
      className="relative overflow-hidden rounded-[28px] border border-blue-200/70 bg-[hsl(var(--surface-raised)/0.92)] shadow-[0_28px_70px_-48px_hsl(var(--surface-shadow)/0.58)] dark:border-blue-300/20"
    >
      <div
        className="absolute inset-0 bg-cover bg-center opacity-65 dark:opacity-30"
        style={{ backgroundImage: "url('/assets/reward-shop-blue-coins-bg.png')" }}
      />
      <div className="absolute inset-0 bg-gradient-to-r from-[hsl(var(--surface-raised))] via-[hsl(var(--surface-raised)/0.88)] to-[hsl(var(--surface-raised)/0.22)] dark:from-[hsl(var(--background)/0.94)] dark:via-[hsl(var(--background)/0.78)] dark:to-[hsl(var(--background)/0.22)]" />

      <div className="relative p-5 sm:p-6 md:p-8">
        <div className="flex min-w-0 items-center gap-4">
          <AvatarWithFrame
            avatarFrameId={previewFrameId}
            src={avatarSrc}
            fallback={displayName[0] ?? "?"}
            className="h-20 w-20 shrink-0 border-4 border-white shadow-lg dark:border-slate-900 sm:h-24 sm:w-24"
            avatarClassName="h-20 w-20 sm:h-24 sm:w-24"
          />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className={cn("truncate text-2xl font-black tracking-tight text-slate-950 dark:text-slate-50 sm:text-3xl", getNameColorClassName(previewNameColorId))}>
                {displayName}
              </h1>
              <span className="rounded-lg bg-blue-600 px-2.5 py-1 text-sm font-bold text-white shadow-sm">Lv.{level}</span>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">校园创客 · 自然观察者</p>
            <div className="mt-4 flex max-w-sm items-center gap-3 text-sm text-muted-foreground">
              <span className="shrink-0">经验 {levelProgress.toLocaleString()} / {levelTotalNeeded.toLocaleString()}</span>
              <div className="h-2 min-w-20 flex-1 overflow-hidden rounded-full bg-blue-100 dark:bg-blue-400/10">
                <div className="h-full rounded-full bg-gradient-to-r from-blue-600 to-cyan-400" style={{ width: `${safeProgress}%` }} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function ShopItemVisual({
  item,
  avatarSrc,
  displayName,
}: {
  item: ShopItem;
  avatarSrc: string;
  displayName: string;
}) {
  if (item.type === "avatar_frame") {
    return (
      <AvatarWithFrame
        avatarFrameId={item.id}
        src={avatarSrc}
        fallback={displayName[0] ?? "?"}
        className="h-20 w-20 min-[390px]:h-24 min-[390px]:w-24 sm:h-28 sm:w-28"
        avatarClassName="h-20 w-20 min-[390px]:h-24 min-[390px]:w-24 sm:h-28 sm:w-28"
      />
    );
  }

  return (
    <div className="flex h-20 w-full items-center justify-center rounded-2xl bg-gradient-to-br from-blue-50 to-cyan-50 px-3 dark:from-blue-400/10 dark:to-cyan-400/10 min-[390px]:h-24 sm:h-28">
      <span className={cn("max-w-full truncate text-xl font-black min-[390px]:text-2xl", getNameColorClassName(item.id))}>
        {displayName}
      </span>
    </div>
  );
}

function ShopItemButton({
  item,
  state,
  purchasePending,
  equipPending,
  onPurchase,
  onEquip,
}: {
  item: ShopItem;
  state: ItemState;
  purchasePending: boolean;
  equipPending: boolean;
  onPurchase: (event: MouseEvent<HTMLButtonElement>) => void;
  onEquip: (event: MouseEvent<HTMLButtonElement>, itemId: string | null) => void;
}) {
  const buttonClassName = "h-11 min-w-[4.25rem] rounded-xl px-2 text-xs font-bold sm:h-9 sm:min-w-20 sm:px-3 sm:text-sm";

  if (state.owned) {
    if (state.equipped) {
      return (
        <Button variant="outline" size="sm" className={buttonClassName} onClick={(event) => onEquip(event, null)} disabled={equipPending}>
          {equipPending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />}
          卸下
        </Button>
      );
    }

    return (
      <Button size="sm" className={buttonClassName} onClick={(event) => onEquip(event, item.id)} disabled={equipPending}>
        {equipPending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
        使用
      </Button>
    );
  }

  if (state.levelLocked) {
    return (
      <Button size="sm" className={buttonClassName} disabled>
        <Lock className="mr-1.5 h-3.5 w-3.5" />
        Lv.{item.minLevel}
      </Button>
    );
  }

  return (
    <Button
      size="sm"
      className={buttonClassName}
      disabled={!state.canBuy || purchasePending}
      onClick={onPurchase}
    >
      {purchasePending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
      {state.canBuy ? "兑换" : "硬币不足"}
    </Button>
  );
}

function ShopItemCard({
  item,
  state,
  selected,
  avatarSrc,
  displayName,
  purchasePending,
  equipPending,
  onSelect,
  onPurchase,
  onEquip,
}: {
  item: ShopItem;
  state: ItemState;
  selected: boolean;
  avatarSrc: string;
  displayName: string;
  purchasePending: boolean;
  equipPending: boolean;
  onSelect: (itemId: string) => void;
  onPurchase: (itemId: string) => void;
  onEquip: (itemId: string | null, type: ShopItemType) => void;
}) {
  const badge = getItemBadge(item);

  const handlePurchase = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    onPurchase(item.id);
  };

  const handleEquip = (event: MouseEvent<HTMLButtonElement>, itemId: string | null) => {
    event.stopPropagation();
    onEquip(itemId, item.type);
  };

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={() => onSelect(item.id)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect(item.id);
        }
      }}
      className={cn(
        "group relative flex min-h-[270px] cursor-pointer flex-col overflow-hidden rounded-[20px] border bg-[hsl(var(--surface-raised)/0.92)] p-3 shadow-[0_18px_46px_-36px_hsl(var(--surface-shadow)/0.48)] outline-none transition hover:-translate-y-0.5 hover:border-blue-300 focus-visible:ring-2 focus-visible:ring-ring dark:bg-white/[0.04] min-[390px]:min-h-[286px] sm:min-h-[318px] sm:rounded-[22px] sm:p-4",
        selected ? "border-blue-500 ring-2 ring-blue-500/20" : "border-border/75",
        state.levelLocked && "saturate-[0.75]",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className={cn("rounded-lg px-2 py-1 text-xs font-bold", badge.className)}>{badge.label}</span>
        {state.equipped ? (
          <span className="rounded-lg bg-emerald-100 px-2 py-1 text-xs font-bold text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300">使用中</span>
        ) : state.owned ? (
          <span className="rounded-lg bg-slate-100 px-2 py-1 text-xs font-bold text-slate-600 dark:bg-white/[0.08] dark:text-slate-300">已拥有</span>
        ) : null}
      </div>

      <div className="relative mt-3 flex h-[104px] items-center justify-center rounded-2xl bg-gradient-to-b from-blue-50/80 to-white dark:from-blue-400/10 dark:to-white/[0.03] min-[390px]:h-[122px] sm:h-[142px]">
        <ShopItemVisual item={item} avatarSrc={avatarSrc} displayName={displayName} />
        {state.levelLocked ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center rounded-2xl bg-white/70 text-slate-600 backdrop-blur-[2px] dark:bg-slate-950/70 dark:text-slate-200">
            <Lock className="h-6 w-6" />
            <span className="mt-2 text-xs font-bold">需要 Lv.{item.minLevel}</span>
          </div>
        ) : null}
      </div>

      <div className="mt-3 min-w-0 sm:mt-4">
        <h3 className="truncate text-base font-bold text-slate-950 dark:text-slate-50">{item.name}</h3>
        <p className="mt-1 line-clamp-2 min-h-9 text-xs leading-[18px] text-muted-foreground sm:min-h-10 sm:text-sm sm:leading-5">
          {item.type === "avatar_frame" ? "展示在个人主页与排行榜头像周围" : "让昵称在社区互动中更有辨识度"}
        </p>
      </div>

      <div className="mt-3 flex items-center justify-between gap-2 sm:mt-4 sm:gap-3">
        <div className="flex shrink-0 items-center gap-1.5 text-orange-500">
          <CoinIcon className="h-4 w-4" />
          <span className="whitespace-nowrap text-base font-black tabular-nums sm:text-lg">{item.price}</span>
        </div>
        <ShopItemButton
          item={item}
          state={state}
          purchasePending={purchasePending}
          equipPending={equipPending}
          onPurchase={handlePurchase}
          onEquip={handleEquip}
        />
      </div>
    </article>
  );
}

function PreviewPanel({
  selectedItem,
  displayName,
  avatarSrc,
  level,
  equippedAvatarFrameId,
  equippedNameColorId,
  coins,
}: {
  selectedItem: ShopItem | undefined;
  displayName: string;
  avatarSrc: string;
  level: number;
  equippedAvatarFrameId: string | null;
  equippedNameColorId: string | null;
  coins: number;
}) {
  const previewFrameId = selectedItem?.type === "avatar_frame" ? selectedItem.id : equippedAvatarFrameId;
  const previewNameColorId = selectedItem?.type === "name_color" ? selectedItem.id : equippedNameColorId;

  return (
    <aside className="space-y-5">
      <section className="surface-panel p-5">
        <div className="mb-4 flex items-center justify-between gap-3 border-b border-border/70 pb-4">
          <h2 className="font-bold">效果预览</h2>
          <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700 dark:bg-blue-400/10 dark:text-blue-300">实时</span>
        </div>

        <div className="rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50 to-white p-4 dark:border-blue-300/20 dark:from-blue-400/10 dark:to-white/[0.03]">
          <div className="flex items-center gap-4">
            <AvatarWithFrame
              avatarFrameId={previewFrameId}
              src={avatarSrc}
              fallback={displayName[0] ?? "?"}
              className="h-20 w-20 shrink-0"
              avatarClassName="h-20 w-20"
            />
            <div className="min-w-0">
              <div className={cn("truncate text-xl font-black text-slate-950 dark:text-slate-50", getNameColorClassName(previewNameColorId))}>
                {displayName}
              </div>
              <div className="mt-2 inline-flex rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300">
                校园创客
              </div>
              <div className="mt-3 text-sm text-muted-foreground">Lv.{level}</div>
            </div>
          </div>
          <p className="mt-4 text-sm leading-6 text-muted-foreground">用创造和观察，记录更好的世界。</p>
        </div>
      </section>

      <section className="surface-panel p-5">
        <div className="mb-4 flex items-center gap-2">
          <Trophy className="h-5 w-5 text-orange-500" />
          <h3 className="font-bold">排行榜预览</h3>
        </div>
        <div className="space-y-2">
          {[1, 2, 3].map((rank) => (
            <div key={rank} className="grid grid-cols-[34px_minmax(0,1fr)_auto] items-center gap-3 rounded-xl border border-border/70 bg-background/70 px-3 py-2.5 dark:bg-white/[0.03]">
              <span className={cn("flex h-7 w-7 items-center justify-center rounded-full text-xs font-black", rank === 1 ? "bg-orange-100 text-orange-600" : "bg-blue-100 text-blue-600")}>{rank}</span>
              <div className="flex min-w-0 items-center gap-2">
                <AvatarWithFrame
                  avatarFrameId={rank === 1 ? previewFrameId : null}
                  src={avatarSrc}
                  fallback={displayName[0] ?? "?"}
                  className="h-9 w-9"
                  avatarClassName="h-9 w-9"
                />
                <div className="min-w-0">
                  <p className={cn("truncate text-sm font-bold", rank === 1 && getNameColorClassName(previewNameColorId))}>
                    {rank === 1 ? displayName : rank === 2 ? "自然小达人" : "工程小队"}
                  </p>
                  <p className="text-xs text-muted-foreground">{rank === 1 ? "校园创客" : "自然观察者"}</p>
                </div>
              </div>
              <span className="text-sm font-bold tabular-nums text-slate-900 dark:text-slate-100">
                {(2860 - rank * 160).toLocaleString()} 分
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className="surface-panel p-5">
        <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
          <WalletCards className="h-4 w-4 text-blue-500" />
          当前余额
        </div>
        <div className="mt-2 flex items-center gap-2 text-2xl font-black text-blue-600 dark:text-blue-300">
          <CoinIcon className="h-5 w-5 text-amber-500" />
          {coins.toLocaleString()}
        </div>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">部分装扮需要达到指定等级后解锁，继续探索和创作吧。</p>
      </section>
    </aside>
  );
}

function LoadingState({ label }: { label: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="flex flex-col items-center gap-3 text-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

export default function ShopPage() {
  const { user, profile, loading: authLoading, refreshProfile } = useAuth();
  const {
    coins = 0,
    level = 1,
    progress = 0,
    levelProgress = 0,
    levelTotalNeeded = 1,
  } = useGamification();
  const [activeType, setActiveType] = useState<ShopItemType>("avatar_frame");
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const supabase = useMemo(() => createClient(), []);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const typedProfile = profile as Profile | null;
  const equippedAvatarFrameId = typedProfile?.equipped_avatar_frame_id ?? null;
  const equippedNameColorId = typedProfile?.equipped_name_color_id ?? null;

  const {
    data: ownedItemIds = [],
    isLoading: inventoryLoading,
    isError: inventoryError,
    error: inventoryErrorDetail,
    refetch: refetchInventory,
  } = useQuery<string[]>({
    queryKey: ["user_inventory", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("user_inventory")
        .select("item_id")
        .eq("user_id", user.id);
      if (error) throw error;
      return ((data as { item_id: string }[] | null) || []).map((row) => row.item_id);
    },
    enabled: !!user,
  });

  const purchaseMutation = useMutation({
    mutationFn: async (itemId: string) => {
      const { data, error } = await supabase.rpc("purchase_item", { p_item_id: itemId } as never);
      if (error) throw error;
      const res = data as ShopRpcResult;
      if (!res?.ok) throw createShopMutationError(res, "purchase_failed");
    },
    onSuccess: (_, itemId) => {
      queryClient.invalidateQueries({ queryKey: ["user_inventory", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["coin_logs", user?.id] });
      refreshProfile();
      const item = getShopItemById(itemId);
      toast({ title: "兑换成功", description: item ? `已获得「${item.name}」` : undefined });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "兑换失败",
        description: getShopMutationErrorMessage(error),
      });
    },
  });

  const equipMutation = useMutation({
    mutationFn: async ({ itemId, type }: { itemId: string | null; type: ShopItemType }) => {
      const rpcName = type === "avatar_frame" ? "equip_avatar_frame" : "equip_name_color";
      const { data, error } = await (supabase.rpc as (name: string, args: { p_item_id: string }) => ReturnType<typeof supabase.rpc>)(rpcName, { p_item_id: itemId ?? "" });
      if (error) throw error;
      const res = data as ShopRpcResult;
      if (!res?.ok) throw createShopMutationError(res, "equip_failed");
    },
    onSuccess: () => {
      refreshProfile();
      queryClient.invalidateQueries({ queryKey: ["user_inventory", user?.id] });
      toast({ title: "装备已更新" });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "装备失败",
        description: getShopMutationErrorMessage(error),
      });
    },
  });

  const displayName = getDisplayName({
    profileName: typedProfile?.display_name ?? null,
    metadataFullName: user?.user_metadata?.full_name,
    metadataName: user?.user_metadata?.username,
    phone: user?.phone ?? null,
    email: user?.email,
    fallback: "探索者",
  });
  const avatarSrc = typedProfile?.avatar_url || (user ? getDefaultAvatarPath(user.id) : getDefaultAvatarPath("guest"));
  const avatarItems = SHOP_ITEMS.filter((item) => item.type === "avatar_frame");
  const nameColorItems = SHOP_ITEMS.filter((item) => item.type === "name_color");
  const activeItems = activeType === "avatar_frame" ? avatarItems : nameColorItems;
  const selectedItem = useMemo(() => {
    const item = selectedItemId ? getShopItemById(selectedItemId) : undefined;
    return item?.type === activeType ? item : activeItems[0];
  }, [activeItems, activeType, selectedItemId]);

  const getState = (item: ShopItem): ItemState => {
    const owned = ownedItemIds.includes(item.id);
    const equipped = item.type === "avatar_frame"
      ? equippedAvatarFrameId === item.id
      : equippedNameColorId === item.id;
    const levelLocked = (item.minLevel ?? 0) > level;
    return {
      owned,
      equipped,
      levelLocked,
      canBuy: !owned && !levelLocked && coins >= item.price,
    };
  };
  if (authLoading || !user) {
    return <LoadingState label="加载账号中..." />;
  }

  if (inventoryLoading) {
    return <LoadingState label="加载商店中..." />;
  }

  if (inventoryError) {
    return (
      <div className="app-canvas flex min-h-[calc(100dvh-var(--mobile-global-header-height,3rem))] items-center justify-center px-4 py-12">
        <section className="surface-panel flex w-full max-w-xl flex-col items-center gap-4 px-6 py-10 text-center">
          <AlertCircle className="h-10 w-10 text-destructive" />
          <div className="space-y-1">
            <p className="font-semibold">加载商店失败</p>
            <p className="text-sm text-muted-foreground">
              {inventoryErrorDetail instanceof Error ? inventoryErrorDetail.message : "请检查网络后重试"}
            </p>
          </div>
          <Button variant="outline" onClick={() => refetchInventory()}>
            刷新重试
          </Button>
        </section>
      </div>
    );
  }

  return (
    <div className="app-canvas min-h-[calc(100dvh-var(--mobile-global-header-height,3rem))] pb-24 md:min-h-[calc(100vh-4rem)] md:pb-10">
      <MobileGlobalHeader
        variant="title"
        title="商店"
        showNotification={false}
        showUserButton={false}
        className="md:hidden"
        rightSlot={(
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-background/80 px-3 py-1.5 text-sm font-black text-slate-950 shadow-sm dark:bg-white/[0.04] dark:text-slate-50">
            <CoinIcon className="h-4 w-4 text-amber-500" />
            {coins.toLocaleString()}
          </span>
        )}
      />

      <main className="app-shell-wide pt-5 min-[390px]:px-5 md:px-8 md:pt-8">
        <div className="mb-5 hidden items-center gap-4 md:flex">
          <Button variant="ghost" size="icon" asChild className="-ml-2 shrink-0 rounded-full hover:bg-muted">
            <Link href="/profile" aria-label="返回个人中心">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div>
            <h1 className="text-4xl font-bold tracking-tight text-slate-950 dark:text-slate-50">创客商店</h1>
            <p className="mt-2 text-sm text-muted-foreground">用实践获得的硬币兑换个性化装扮</p>
          </div>
        </div>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_330px] xl:grid-cols-[minmax(0,1fr)_360px] 2xl:grid-cols-[minmax(0,1fr)_380px]">
          <section className="min-w-0 space-y-5">
            <ShopHero
              level={level}
              displayName={displayName}
              avatarSrc={avatarSrc}
              progress={progress}
              levelProgress={levelProgress}
              levelTotalNeeded={levelTotalNeeded}
              selectedItem={selectedItem}
              equippedAvatarFrameId={equippedAvatarFrameId}
              equippedNameColorId={equippedNameColorId}
            />

            <section className="surface-panel overflow-hidden p-3.5 min-[390px]:p-4 sm:p-5">
              <Tabs value={activeType} onValueChange={(value) => setActiveType(value as ShopItemType)}>
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <TabsList className="grid h-auto w-full grid-cols-2 rounded-2xl bg-muted/60 p-1 sm:max-w-md dark:bg-white/[0.04]">
                    {(["avatar_frame", "name_color"] as const).map((type) => (
                      <TabsTrigger
                        key={type}
                        value={type}
                        className="min-h-11 rounded-xl text-sm font-bold text-muted-foreground data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=active]:shadow-[0_12px_28px_-20px_rgba(37,99,235,0.9)]"
                      >
                        <CategoryIcon type={type} className="mr-2 h-4 w-4" />
                        {type === "avatar_frame" ? "头像框" : "昵称颜色"}
                      </TabsTrigger>
                    ))}
                  </TabsList>

                  <div className="hidden items-center gap-2 text-sm text-muted-foreground sm:flex">
                    <CircleHelp className="h-4 w-4" />
                    装扮会展示在个人主页与排行榜
                  </div>
                </div>

                <div className="mt-5 sm:mt-6">
                  <div className="mb-4 flex items-end justify-between gap-4">
                    <div>
                      <h2 className="text-xl font-black text-slate-950 dark:text-slate-50">
                        {activeType === "avatar_frame" ? "精选头像框" : "精选昵称颜色"}
                      </h2>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {activeType === "avatar_frame" ? "用头像框强化社区身份展示" : "用昵称颜色让互动更醒目"}
                      </p>
                    </div>
                    <span className="hidden text-sm font-semibold text-blue-600 dark:text-blue-300 sm:inline">
                      {activeItems.length} 件可选
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-3 2xl:grid-cols-4">
                    {activeItems.map((item) => (
                      <ShopItemCard
                        key={item.id}
                        item={item}
                        state={getState(item)}
                        selected={selectedItem?.id === item.id}
                        avatarSrc={avatarSrc}
                        displayName={displayName}
                        purchasePending={purchaseMutation.isPending}
                        equipPending={equipMutation.isPending}
                        onSelect={setSelectedItemId}
                        onPurchase={(itemId) => purchaseMutation.mutate(itemId)}
                        onEquip={(itemId, type) => equipMutation.mutate({ itemId, type })}
                      />
                    ))}
                  </div>
                </div>
              </Tabs>
            </section>

            <section className="surface-panel flex items-center justify-between gap-4 p-4 lg:hidden">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-100 text-blue-600 dark:bg-blue-400/10 dark:text-blue-300">
                  <ShoppingBag className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="font-bold">更多装扮持续上线中</h3>
                  <p className="mt-1 text-sm text-muted-foreground">继续探索和创作，解锁更高阶装扮。</p>
                </div>
              </div>
              <Sparkles className="hidden h-5 w-5 text-orange-500 sm:block" />
            </section>
          </section>

          <div className="hidden lg:sticky lg:top-24 lg:block lg:self-start">
            <PreviewPanel
              selectedItem={selectedItem}
              displayName={displayName}
              avatarSrc={avatarSrc}
              level={level}
              equippedAvatarFrameId={equippedAvatarFrameId}
              equippedNameColorId={equippedNameColorId}
              coins={coins}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
