"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { CheckCircle2, ChevronDown, Minus, PackageSearch, Plus, ShoppingBasket } from "lucide-react";

import { Button } from "@/components/ui/button";
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
  const shortage = [...result.requiredMissing].sort((a, b) => b.missing - a.missing);
  const isComplete = outcome.status === "complete";

  // 用函数式更新，连续快速点击也不会丢次数。
  const adjustCount = (setNum: KitSetNum, delta: number) =>
    setCounts((prev) => ({ ...prev, [setNum]: Math.min(MAX_KIT_COPIES, Math.max(0, prev[setNum] + delta)) }));

  return (
    <AllocationContext.Provider value={result.entries}>
    <section className="space-y-3 md:space-y-5" aria-labelledby="kit-check-heading">
      <h2 id="kit-check-heading" className="sr-only">
        用我的套装能不能搭
      </h2>

      <div className="space-y-3 md:space-y-5">
        {intro}
        {/* 一句话结论 */}
        <div
          role="status"
          aria-live="polite"
          className={cn(
            "flex items-start gap-3 rounded-lg px-3 py-2 md:px-4 md:py-3",
            isComplete
              ? "border-[hsl(var(--status-success-border))] bg-[hsl(var(--status-success-surface))]"
              : "border-[hsl(var(--brand-amber-border))] bg-[hsl(var(--brand-amber-soft))]",
          )}
        >
          {isComplete ? (
            <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0 text-[hsl(var(--status-success))]" aria-hidden />
          ) : (
            <ShoppingBasket className="mt-0.5 h-6 w-6 shrink-0 text-[hsl(var(--brand-amber))]" aria-hidden />
          )}
          <div className="min-w-0">
            <p className="text-base font-bold leading-snug text-foreground">
              {totalKits === 0
                ? "先在下面填上你有几套积木"
                : isComplete
                  ? "用你的套装可以搭完"
                  : `还差 ${outcome.missingKinds} 种、共 ${outcome.missingPieces} 块`}
            </p>
            <p className="mt-1 text-sm leading-5 text-muted-foreground">
              {isComplete
                ? "套装里的积木数量够用，颜色不一样的地方可以换着用。"
                : "按你填的套装数量算出来的，补齐下面「需要补买」的积木就能搭完。"}
              {outcome.specialPieces > 0 ? ` 另有 ${outcome.specialPieces} 块特殊零件需要单独准备。` : null}
            </p>
          </div>
        </div>

        {/* 套装数量 */}
        <div className="py-2 md:rounded-xl md:bg-background md:p-5">
          <h3 className="text-base font-black text-foreground">你有几套？</h3>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">没有的填 0，改完马上重新计算，会记在这台设备上。</p>
          <ul className="mt-2 grid divide-y divide-border/70 md:grid-cols-2 md:gap-x-8 md:[&>li:nth-last-child(2):nth-child(odd)]:border-b-0">
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
                  <p className="text-sm font-bold leading-5 text-foreground">{kit.name}</p>
                  <p className="text-xs text-muted-foreground">{kit.code}</p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-10 w-10 rounded-full"
                    aria-label={`${kit.name}减少一套`}
                    disabled={counts[kit.setNum] <= 0}
                    onClick={() => adjustCount(kit.setNum, -1)}
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                  <output
                    aria-label={`${kit.name}套数`}
                    className="w-6 text-center text-base font-black tabular-nums text-foreground"
                  >
                    {counts[kit.setNum]}
                  </output>
                  <Button
                    type="button"
                    tone="brand"
                    size="icon"
                    className="h-10 w-10 rounded-full"
                    aria-label={`${kit.name}增加一套`}
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

      {/* 需要补买 */}
      {shortage.length > 0 ? (
        <div className="py-2 md:rounded-xl md:bg-background md:p-5">
          <h3 className="text-base font-black text-foreground">需要补买</h3>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">按还差的块数排序，颜色以色块为准。</p>
          <ul className="mt-2 grid divide-y divide-border/70 md:grid-cols-2 md:gap-x-8 md:[&>li:nth-last-child(2):nth-child(odd)]:border-b-0">
            {shortage.map((entry) => (
              <PartRow key={rowKey(entry)} entry={entry}>
                <span className="shrink-0 text-sm font-black tabular-nums text-[hsl(var(--brand-amber-foreground))]">
                  还差 {entry.missing} 块
                </span>
              </PartRow>
            ))}
          </ul>
        </div>
      ) : null}

      {result.figureDemand > 0 ? (
        <p className="py-2 text-sm leading-6 text-foreground">
          这一课里有 <strong>{result.figureDemand}</strong> 个小人。小人按整个算，用套装里的小人就行，衣服颜色不用一样。
        </p>
      ) : null}

      {/* 可替代 */}
      {result.colorSubstitutes.length > 0 ? (
        <Fold
          title="可以用其它颜色或零件代替"
          count={result.stats.substituted}
          hint="颜色或图案不一样可以换着用，大的薄板可以拼成小的，按下面的提示搭就不用另买。"
        >
          <ul className="grid divide-y divide-border/70 md:grid-cols-2 md:gap-x-8 md:[&>li:nth-last-child(2):nth-child(odd)]:border-b-0">
            {result.colorSubstitutes.map((entry) => (
              <PartRow key={rowKey(entry)} entry={entry} detail={substituteDetail(entry)}>
                <span className="shrink-0 text-sm font-bold tabular-nums text-muted-foreground">
                  {entry.substituted} 块
                </span>
              </PartRow>
            ))}
          </ul>
        </Fold>
      ) : null}

      {/* 可选底板 */}
      {result.optionalMissing.length > 0 ? (
        <Fold
          title="可选（底板等）"
          count={result.stats.optionalMissing}
          hint="底板主要用来摆放和展示，没有也能搭；想做得和图里一样再补。"
        >
          <ul className="grid divide-y divide-border/70 md:grid-cols-2 md:gap-x-8 md:[&>li:nth-last-child(2):nth-child(odd)]:border-b-0">
            {result.optionalMissing.map((entry) => (
              <PartRow key={rowKey(entry)} entry={entry}>
                <span className="shrink-0 text-sm font-bold tabular-nums text-muted-foreground">
                  {entry.missing} 块
                </span>
              </PartRow>
            ))}
          </ul>
        </Fold>
      ) : null}

      {/* 套装里没有的零件 */}
      {result.unknown.length > 0 ? (
        <p className="flex items-start gap-2 px-1 text-xs leading-5 text-muted-foreground">
          <PackageSearch className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span>
            套装里没有的零件：
            {result.unknown
              .map((entry) => `${entry.colorName}${SPECIAL_PART_NAMES[entry.partId] ?? entry.partName} ${entry.missing} 块`)
              .join("、")}
            。这是课件里的特殊零件，可以用手边的积木自由搭一个代替。
          </span>
        </p>
      ) : null}
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

function rowKey(entry: MaterialRequirement) {
  return `${entry.partId}|${entry.modelColorCode ?? entry.colorCode}`;
}

function PartRow({
  entry,
  detail,
  children,
}: {
  entry: MaterialRequirement;
  detail?: string;
  children: React.ReactNode;
}) {
  return (
    <li className="flex min-w-0 items-center gap-3 py-2.5">
      <PartThumbnail partId={entry.partId} colorCode={entry.colorCode} colorHex={entry.colorHex} size={44} />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5 text-sm font-bold leading-snug text-foreground">
          <span
            aria-hidden
            className="h-3 w-3 shrink-0 rounded-sm border border-black/15"
            style={{ backgroundColor: entry.colorHex }}
          />
          <span className="min-w-0">
            {entry.figureFolded ? "" : entry.colorName}
            {SPECIAL_PART_NAMES[entry.partId] ?? entry.partName}
          </span>
        </span>
        {detail ? <span className="mt-0.5 block text-xs text-muted-foreground">{detail}</span> : null}
      </span>
      {children}
    </li>
  );
}

function Fold({
  title,
  count,
  hint,
  children,
}: {
  title: string;
  count: number;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <details className="group border-t border-border/70 md:rounded-xl md:border-0 md:bg-background">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 py-3 md:p-5 [&::-webkit-details-marker]:hidden">
        <span className="min-w-0">
          <span className="block text-base font-black text-foreground">
            {title} <span className="text-sm font-bold text-muted-foreground">· {count} 块</span>
          </span>
          <span className="mt-0.5 block text-xs leading-5 text-muted-foreground">{hint}</span>
        </span>
        <ChevronDown className="h-5 w-5 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden />
      </summary>
      <div className="pb-3 md:px-5 md:pb-5">{children}</div>
    </details>
  );
}

const AllocationContext = createContext<MaterialRequirement[]>([]);

export function MaterialPartTable({ entries }: { entries: LdrawBomEntry[] }) {
  const allocated = useContext(AllocationContext);
  return (
    <ul className="grid divide-y divide-border/70 md:grid-cols-2 md:gap-x-8 md:[&>li:nth-last-child(2):nth-child(odd)]:border-b-0">
      {entries.map((original) => {
        const match = allocated.find((row) => row.partId === original.partId && row.modelColorCode === original.colorCode);
        const entry = match?.mapping.flags.kitColor ? { ...original, colorCode: match.colorCode, colorName: match.colorName, colorHex: match.colorHex } : original;
        return (
          <li
            key={`${original.partId}|${original.colorCode}`}
            className="flex items-center justify-between gap-3 py-3"
            title={entry.partDescription || undefined}
          >
            <span className="flex min-w-0 items-center gap-2">
              <PartThumbnail partId={entry.partId} colorCode={entry.colorCode} colorHex={entry.colorHex} />
              <span className="min-w-0 text-sm font-medium leading-snug text-foreground">
                {entry.colorName}
                {entry.partName}
              </span>
            </span>
            <span className="shrink-0 text-xs font-semibold tabular-nums text-muted-foreground">
              ×{entry.count}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
