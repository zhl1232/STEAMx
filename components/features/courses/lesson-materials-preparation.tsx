"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { Check, CheckCircle2, ChevronDown, Minus, Plus, ShoppingBasket } from "lucide-react";

import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { cn } from "@/lib/utils";
import type { LdrawBomEntry } from "@/lib/utils/ldraw-bom";
import {
  KIT_CATALOG,
  getDefaultKitCounts,
  hasKitComparison,
  kitCountsToSelections,
  type KitCounts,
  type KitSetNum,
} from "@/lib/courses/course-kit-config";
import {
  MAX_KIT_COPIES,
  mergeLessonMaterialPreferences,
  readStoredKitCounts,
  writeStoredKitCounts,
} from "@/lib/courses/lesson-material-preferences";
import {
  compareLessonMaterials,
  mergeKitInventories,
  summarizeMaterialOutcome,
  substituteDetail,
  type MaterialRequirement,
} from "@/lib/courses/lesson-materials";
import { PartThumbnail } from "./part-thumbnail";

/** 套装里没有、也不在 LDraw 官方库的特殊件，给一个家长能看懂的名字。 */
const SPECIAL_PART_NAMES: Record<string, string> = {
  "31196c01.dat": "Toolo 座舱（4×6）",
};

export interface LessonMaterialsPreparationProps {
  courseId: number;
  entries: LdrawBomEntry[];
  partCount: number;
  /** 测试/预览用：跳过 localStorage，直接用这组套数 */
  initialCounts?: KitCounts;
  intro?: React.ReactNode;
  children?: React.ReactNode;
}

export function LessonMaterialsPreparation({
  courseId,
  entries,
  partCount,
  initialCounts,
  intro,
  children,
}: LessonMaterialsPreparationProps) {
  const [counts, setCounts] = useState<KitCounts>(() => initialCounts ?? getDefaultKitCounts(courseId));
  const [loaded, setLoaded] = useState(Boolean(initialCounts));
  const [kitEditorOpen, setKitEditorOpen] = useState<boolean | null>(null);

  // 服务端先按课程默认值渲染，挂载后再读本地记忆，避免水合不一致。
  useEffect(() => {
    if (initialCounts) return;
    // localStorage 是外部存储，只能在挂载后读取；服务端用默认值保证水合一致。
    // oxlint-disable-next-line react/set-state-in-effect
    setCounts(readStoredKitCounts(safeLocalStorage(), courseId));
    setLoaded(true);
  }, [courseId, initialCounts]);

  useEffect(() => {
    if (loaded && !initialCounts) writeStoredKitCounts(safeLocalStorage(), courseId, counts);
  }, [counts, courseId, loaded, initialCounts]);

  const result = useMemo(() => {
    const prefs = mergeLessonMaterialPreferences(courseId, { kits: kitCountsToSelections(counts) });
    return compareLessonMaterials(
      { entries, partCount, kindCount: entries.length, stepCount: 0, steps: [] },
      mergeKitInventories(prefs.kits),
      prefs,
    );
  }, [counts, courseId, entries, partCount]);

  if (!hasKitComparison(courseId)) return <>{intro}{children}</>;

  const outcome = summarizeMaterialOutcome(result);
  const totalKits = Object.values(counts).reduce((n, c) => n + c, 0);
  const isComplete = outcome.status === "complete" && result.unknown.length === 0;
  const kitsExpanded = kitEditorOpen ?? (totalKits === 0);
  const selectedKits = KIT_CATALOG.filter((kit) => counts[kit.setNum] > 0)
    .map((kit) => `${kit.code} × ${counts[kit.setNum]}`)
    .join(" · ");

  // 用函数式更新，连续快速点击也不会丢次数。
  const adjustCount = (setNum: KitSetNum, delta: number) => {
    setKitEditorOpen(true);
    setCounts((prev) => ({ ...prev, [setNum]: Math.min(MAX_KIT_COPIES, Math.max(0, prev[setNum] + delta)) }));
  };

  return (
    <AllocationContext.Provider value={result.entries}>
    {intro}
    <section className="space-y-3 md:space-y-5" aria-labelledby="kit-check-heading">
      <h2 id="kit-check-heading" className="sr-only">
        用我的套装能不能搭
      </h2>

      <div className="space-y-3">
        {/* 一句话结论 */}
        <div
          role="status"
          aria-live="polite"
          className={cn(
            "flex items-center gap-2.5 rounded-md px-4 py-3",
            isComplete
              ? "border-[hsl(var(--status-success-border))] bg-[hsl(var(--status-success-surface))]"
              : "border-[hsl(var(--brand-amber-border))] bg-[hsl(var(--brand-amber-soft))]",
          )}
        >
          {isComplete ? (
            <CheckCircle2 className="h-5 w-5 shrink-0 text-[hsl(var(--status-success))]" aria-hidden />
          ) : (
            <ShoppingBasket className="h-5 w-5 shrink-0 text-[hsl(var(--brand-amber))]" aria-hidden />
          )}
          <div className="min-w-0">
            <p className="text-sm font-semibold leading-6 text-foreground md:text-base">
              {totalKits === 0
                ? "先选择你有的套装"
                : isComplete
                  ? "所选套装的零件够用"
                  : outcome.missingKinds > 0
                    ? result.requiredMissing.some((entry) => entry.mapping.flags.externalMaterial)
                      ? `还有 ${outcome.missingKinds} 种材料需准备`
                      : `还差 ${outcome.missingKinds} 种、共 ${outcome.missingPieces} 块`
                    : `还有 ${result.unknown.length} 种零件需确认`}
            </p>
            {outcome.missingKinds > 0 && result.unknown.length > 0 ? (
              <p className="text-xs leading-5 text-foreground">另有 {result.unknown.length} 种零件需确认</p>
            ) : null}
          </div>
        </div>

        {/* 套装数量 */}
        <div className="border-y border-border/70">
          <button
            type="button"
            className="flex min-h-14 w-full items-center justify-between gap-3 rounded-sm py-3 text-left focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
            aria-label={kitsExpanded ? "收起套装设置" : "调整套装"}
            aria-expanded={kitsExpanded}
            aria-controls="kit-count-controls"
            onClick={() => setKitEditorOpen(!kitsExpanded)}
          >
            <span className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="text-sm font-semibold text-foreground">我的套装</span>
              <span className="text-xs tabular-nums text-muted-foreground">{selectedKits || "未选择"}</span>
            </span>
            <span className="flex shrink-0 items-center gap-1 text-xs font-medium text-foreground">
              {kitsExpanded ? "收起" : "调整"}
              <ChevronDown className={cn("h-4 w-4", kitsExpanded && "rotate-180")} aria-hidden />
            </span>
          </button>
          <div id="kit-count-controls" hidden={!kitsExpanded}>
          <ul className="grid divide-y divide-border/70 pb-3 md:grid-cols-2 md:gap-x-8 md:[&>li:nth-last-child(2):nth-child(odd)]:border-b-0">
            {KIT_CATALOG.map((kit) => (
              <li
                key={kit.setNum}
                className="flex min-w-0 items-center gap-2 py-2"
              >
                <Image
                  src={kit.image}
                  alt=""
                  width={44}
                  height={40}
                  className="h-11 w-11 shrink-0 rounded-sm bg-white object-contain"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium leading-5 text-foreground">{kit.name} <span className="tabular-nums">{kit.code}</span></p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-11 w-11"
                    aria-label={`${kit.name} ${kit.code}减少一套`}
                    disabled={counts[kit.setNum] <= 0}
                    onClick={() => adjustCount(kit.setNum, -1)}
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                  <output
                    aria-label={`${kit.name} ${kit.code}套数`}
                    className="w-6 text-center text-base font-semibold tabular-nums text-foreground"
                  >
                    {counts[kit.setNum]}
                  </output>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-11 w-11"
                    aria-label={`${kit.name} ${kit.code}增加一套`}
                    disabled={counts[kit.setNum] >= MAX_KIT_COPIES}
                    onClick={() => adjustCount(kit.setNum, 1)}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
          </div>
        </div>

      </div>

    </section>
    {children}
    </AllocationContext.Provider>
  );
}

function safeLocalStorage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

const AllocationContext = createContext<MaterialRequirement[]>([]);

function PartAvailability({ entry }: { entry: MaterialRequirement }) {
  const unit = entry.figureFolded ? "个" : "块";
  const substitutes = entry.substituted > 0 && !entry.figureFolded;
  const exact = entry.figureFolded ? entry.matched : entry.matched - entry.substituted;
  return (
    <span className="mt-1 block space-y-1 text-xs leading-5">
      <span className="flex flex-wrap gap-1.5">
        {entry.mapping.flags.externalMaterial ? (
          <StatusBadge status="info" className="text-foreground">需自备 {entry.missing} 份</StatusBadge>
        ) : entry.status === "unknown" ? (
          <StatusBadge status="warning" className="text-foreground">需确认 {entry.missing} {unit}</StatusBadge>
        ) : (
          <>
            {entry.missing === 0 && !substitutes ? (
              <span className="inline-flex items-center gap-1 text-muted-foreground"><Check className="h-3.5 w-3.5" aria-hidden />已备齐</span>
            ) : null}
            {exact > 0 && (entry.missing > 0 || substitutes) ? (
              <span className="py-0.5 text-muted-foreground">套装已有 {exact} {unit}</span>
            ) : null}
            {entry.status === "requiredMissing" ? <StatusBadge status="warning" className="text-foreground">还缺 {entry.missing} {unit}</StatusBadge> : null}
            {substitutes ? <StatusBadge status="info" className="text-foreground">可替代 {entry.substituted} {unit}</StatusBadge> : null}
            {entry.status === "optionalMissing" ? <span className="text-muted-foreground">可选，缺 {entry.missing} {unit}</span> : null}
          </>
        )}
      </span>
      {substitutes ? <span className="block text-foreground">{substituteDetail(entry).replaceAll("可以用 ", "")}</span> : null}
      {entry.status === "unknown" ? <span className="block text-muted-foreground">套装清单未收录</span> : null}
      {entry.figureFolded ? <span className="block text-muted-foreground">服装颜色不限</span> : null}
    </span>
  );
}

function preparationPriority(entry?: MaterialRequirement) {
  if (entry?.status === "requiredMissing") return 0;
  if (entry?.status === "unknown") return 1;
  if (entry?.status === "optionalMissing") return 4;
  if (entry && entry.substituted > 0 && !entry.figureFolded) return 2;
  return 3;
}

export function MaterialPartTable({ entries, showAvailability = false }: { entries: LdrawBomEntry[]; showAvailability?: boolean }) {
  const allocated = useContext(AllocationContext);
  const rows = entries.map((original) => ({
    original,
    match: allocated.find((row) => row.partId === original.partId && row.modelColorCode === original.colorCode),
  }));
  if (showAvailability) rows.sort((a, b) => preparationPriority(a.match) - preparationPriority(b.match));
  return (
    <ul className="grid md:grid-cols-2 md:gap-x-6">
      {rows.map(({ original, match }) => {
        const entry = match?.mapping.flags.kitColor ? { ...original, colorCode: match.colorCode, colorName: match.colorName, colorHex: match.colorHex } : original;
        const availability = showAvailability ? match : undefined;
        const needsAttention = availability?.status === "requiredMissing" || availability?.status === "unknown";
        const unit = match?.mapping.flags.externalMaterial ? "份" : match?.figureFolded ? "个" : "块";
        return (
          <li
            key={`${original.partId}|${original.colorCode}`}
            className={cn(
              "grid min-w-0 items-start gap-x-3 border-b border-border/70 py-4 last:border-b-0 md:[&:nth-last-child(2):nth-child(odd)]:border-b-0",
              availability ? "grid-cols-[44px_minmax(0,1fr)_auto] px-3" : "grid-cols-[40px_minmax(0,1fr)_auto]",
              needsAttention && "bg-[hsl(var(--status-warning-surface))]",
            )}
            title={entry.partDescription || undefined}
          >
            <span className={availability ? "row-span-2" : undefined}>
              <PartThumbnail partId={entry.partId} colorCode={entry.colorCode} colorHex={entry.colorHex} size={availability ? 44 : 40} />
            </span>
            <span className={cn("min-w-0 text-sm leading-5 text-foreground", needsAttention ? "font-semibold" : "font-medium")}>
              {match?.figureFolded ? "" : entry.colorName}
              {SPECIAL_PART_NAMES[entry.partId] ?? entry.partName}
            </span>
            <span className={cn("shrink-0 font-semibold leading-5 tabular-nums", availability ? "text-sm text-foreground" : "text-xs text-muted-foreground")}>
              {availability ? `需 ${availability.count} ${unit}` : `×${entry.count}`}
            </span>
            {availability ? <span className="col-span-2 col-start-2 min-w-0"><PartAvailability entry={availability} /></span> : null}
          </li>
        );
      })}
    </ul>
  );
}
