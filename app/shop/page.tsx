"use client";

import type { MouseEvent } from "react";
import { useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Loader2,
  Lock,
  Palette,
  UserRound,
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
      className="relative overflow-hidden rounded-xl border border-blue-200/70 bg-[hsl(var(--surface-raised)/0.92)] shadow-[0_28px_70px_-48px_hsl(var(--surface-shadow)/0.58)] dark:border-blue-300/20"
    >
      <div
        className="absolute inset-0 bg-cover bg-center opacity-65 dark:opacity-30"
        style={{ backgroundImage: "url('/assets/reward-shop-blue-coins-bg.png')" }}
      />
      <div className="absolute inset-0 bg-linear-to-r from-[hsl(var(--surface-raised))] via-[hsl(var(--surface-raised)/0.88)] to-[hsl(var(--surface-raised)/0.22)] dark:from-[hsl(var(--background)/0.94)] dark:via-[hsl(var(--background)/0.78)] dark:to-[hsl(var(--background)/0.22)]" />

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
              <span className="rounded-xs bg-blue-600 px-2.5 py-1 text-sm font-bold text-white shadow-xs">Lv.{level}</span>
            </div>
            <div className="mt-4 flex max-w-sm items-center gap-3 text-sm text-muted-foreground">
              <span className="shrink-0">经验 {levelProgress.toLocaleString()} / {levelTotalNeeded.toLocaleString()}</span>
              <div className="h-2 min-w-20 flex-1 overflow-hidden rounded-full bg-blue-100 dark:bg-blue-400/10">
                <div className="h-full rounded-full bg-linear-to-r from-blue-600 to-cyan-400" style={{ width: `${safeProgress}%` }} />
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
    <div className="flex h-20 w-full items-center justify-center rounded-md bg-linear-to-br from-blue-50 to-cyan-50 px-3 dark:from-blue-400/10 dark:to-cyan-400/10 min-[390px]:h-24 sm:h-28">
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
  const buttonClassName = "group h-11 min-w-16 rounded-xs p-0 text-xs font-semibold hover:bg-transparent sm:h-8 sm:min-w-17";
  const visualClassName = "inline-flex h-8 min-w-16 items-center justify-center rounded-xs px-2 sm:min-w-17 sm:px-2.5";

  if (state.owned) {
    if (state.equipped) {
      return (
        <Button variant="ghost" size="sm" className={buttonClassName} onClick={(event) => onEquip(event, null)} disabled={equipPending}>
          <span className={cn(visualClassName, "border border-input bg-background text-foreground transition-colors group-hover:bg-accent")}>
            {equipPending ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <CheckCircle2 className="mr-1 h-3 w-3" />}
            卸下
          </span>
        </Button>
      );
    }

    return (
      <Button variant="ghost" size="sm" className={buttonClassName} onClick={(event) => onEquip(event, item.id)} disabled={equipPending}>
        <span className={cn(visualClassName, "bg-primary text-primary-foreground transition-colors group-hover:bg-primary/90")}>
          {equipPending ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : null}
          使用
        </span>
      </Button>
    );
  }

  if (state.levelLocked) {
    return (
      <Button variant="ghost" size="sm" className={buttonClassName} disabled>
        <span className={cn(visualClassName, "bg-muted text-muted-foreground")}>
          <Lock className="mr-1 h-3 w-3" />
          Lv.{item.minLevel}
        </span>
      </Button>
    );
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      className={buttonClassName}
      disabled={!state.canBuy || purchasePending}
      onClick={onPurchase}
    >
      <span className={cn(visualClassName, state.canBuy ? "bg-primary text-primary-foreground transition-colors group-hover:bg-primary/90" : "bg-muted text-muted-foreground")}>
        {purchasePending ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : null}
        {state.canBuy ? "兑换" : "硬币不足"}
      </span>
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
        "group relative flex min-h-[248px] cursor-pointer flex-col overflow-hidden rounded-lg border bg-[hsl(var(--surface-raised)/0.92)] p-3 shadow-[0_18px_46px_-36px_hsl(var(--surface-shadow)/0.48)] outline-hidden transition hover:-translate-y-0.5 hover:border-blue-300 focus-visible:ring-2 focus-visible:ring-ring dark:bg-white/4 min-[390px]:min-h-[262px] sm:min-h-[292px] sm:p-4",
        selected ? "border-blue-500 ring-2 ring-blue-500/20" : "border-border/75",
        state.levelLocked && "saturate-[0.75]",
      )}
    >
      <div className="flex min-h-6 items-center justify-end gap-2">
        {state.equipped ? (
          <span className="rounded-xs bg-emerald-100 px-2 py-1 text-xs font-bold text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300">使用中</span>
        ) : state.owned ? (
          <span className="rounded-xs bg-slate-100 px-2 py-1 text-xs font-bold text-slate-600 dark:bg-white/8 dark:text-slate-300">已拥有</span>
        ) : null}
      </div>

      <div className="relative mt-2 flex h-[104px] items-center justify-center rounded-md bg-linear-to-b from-blue-50/80 to-white dark:from-blue-400/10 dark:to-white/3 min-[390px]:h-[118px] sm:h-[136px]">
        <ShopItemVisual item={item} avatarSrc={avatarSrc} displayName={displayName} />
        {state.levelLocked ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center rounded-md bg-white/70 text-slate-600 backdrop-blur-[2px] dark:bg-slate-950/70 dark:text-slate-200">
            <Lock className="h-6 w-6" />
            <span className="mt-2 text-xs font-bold">需要 Lv.{item.minLevel}</span>
          </div>
        ) : null}
      </div>

      <div className="mt-3 min-w-0 sm:mt-4">
        <h3 className="truncate text-base font-bold text-slate-950 dark:text-slate-50">{item.name}</h3>
      </div>

      <div className="mt-auto flex items-center justify-between gap-2 pt-3 sm:gap-3 sm:pt-4">
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
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-background/80 px-3 py-1.5 text-sm font-black text-slate-950 shadow-xs dark:bg-white/4 dark:text-slate-50">
            <CoinIcon className="h-4 w-4 text-amber-500" />
            {coins.toLocaleString()}
          </span>
        )}
      />

      <main className="app-shell-wide pt-5 md:pt-8">
        <div className="mb-5 hidden items-center justify-between gap-4 md:flex">
          <div className="flex min-w-0 items-center gap-4">
            <Button variant="ghost" size="icon" shape="square" asChild className="-ml-2 shrink-0 hover:bg-muted">
              <Link href="/profile" aria-label="返回个人中心">
                <ArrowLeft className="h-5 w-5" />
              </Link>
            </Button>
            <h1 className="truncate text-3xl font-black tracking-tight text-slate-950 dark:text-slate-50">创客商店</h1>
          </div>
          <div className="inline-flex shrink-0 items-center gap-2 rounded-sm border border-border/70 bg-[hsl(var(--surface-raised)/0.82)] px-3.5 py-2 text-sm font-black text-slate-950 shadow-xs dark:bg-white/4 dark:text-slate-50">
            <CoinIcon className="h-4 w-4 text-amber-500" />
            <span className="tabular-nums">{coins.toLocaleString()}</span>
          </div>
        </div>

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

          <section>
            <Tabs value={activeType} onValueChange={(value) => setActiveType(value as ShopItemType)}>
              <TabsList className="grid h-auto w-full grid-cols-2 rounded-md bg-muted/60 p-1 sm:max-w-md dark:bg-white/4">
                {(["avatar_frame", "name_color"] as const).map((type) => (
                  <TabsTrigger
                    key={type}
                    value={type}
                    className="min-h-11 rounded-sm text-sm font-bold text-muted-foreground data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=active]:shadow-[0_12px_28px_-20px_rgba(37,99,235,0.9)]"
                  >
                    <CategoryIcon type={type} className="mr-2 h-4 w-4" />
                    {type === "avatar_frame" ? "头像框" : "昵称颜色"}
                  </TabsTrigger>
                ))}
              </TabsList>

              <div className="mt-5 sm:mt-6">
                <div className="mb-4 flex items-center justify-between gap-4">
                  <h2 className="text-lg font-black text-slate-950 dark:text-slate-50">
                    {activeType === "avatar_frame" ? "头像框" : "昵称颜色"}
                  </h2>
                  <span className="text-sm font-semibold text-blue-600 dark:text-blue-300">
                    {activeItems.length} 件
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
        </section>
      </main>
    </div>
  );
}
